"""Soil routes at /api/m/soil: investigations, classification, profiles and parameters."""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone
from typing import Annotated, get_args

import numpy as np
from fastapi import APIRouter, Depends, Request, Response

from geotek.api import schemas as dto
from geotek.api.common import ERROR_RESPONSES, multipart_body
from geotek.api.session import Session, api_error, get_session
from geotek.core.models.investigations import Borehole, BoreholeLayer, CPTSounding, LabRecord
from geotek.core.models.parameters import DesignKey, ParameterSelection
from geotek.core.models.profile import LayeringSettings, SoilLayer, SoilProfile
from geotek.engine.classification import robertson, uscs
from geotek.engine.classification.uscs_names import USCS_NAMES
from geotek.modules.soil import service
from geotek.modules.soil.schemas import (
    AxisRangeDTO,
    BoreholeUSCSDTO,
    CPTProcessedDTO,
    CPTSBTNDTO,
    InvestigationsDTO,
    LayerMerge,
    LayerSplit,
    ParameterApproval,
    PlasticityPointDTO,
    ProfileCreate,
    ProfileSummary,
    SelectionUpdate,
    SBTNContourDTO,
    SBTNCoordinateDTO,
    SBTNPointDTO,
    SBTNReferenceDTO,
    SBTNZoneDTO,
    SPTProcessedDTO,
    USCSClassifyRequest,
    USCSItemDTO,
    USCSReferenceDTO,
    USCSSymbolDTO,
)
from geotek.services import parameters
from geotek.services.layering import propose_layers
from geotek.services.module1 import process_investigations

SessionDep = Annotated[Session, Depends(get_session)]


def _uscs_item(record: LabRecord | USCSClassifyRequest, result: uscs.USCSResult) -> USCSItemDTO:
    """Enrich an engine result with echoed inputs and static names."""
    name = USCS_NAMES.get(result.symbol)
    cu = cc = None
    if all(value is not None for value in (record.D10, record.D30, record.D60)):
        # NumPy preserves non-finite result sentinels for ResultNumber normalization.
        with np.errstate(divide="ignore", invalid="ignore", over="ignore", under="ignore"):
            cu = np.divide(record.D60, record.D10)
            cc = np.divide(np.square(record.D30), np.multiply(record.D10, record.D60))
    lab = isinstance(record, LabRecord)
    return USCSItemDTO(
        depth=record.depth if lab else None,
        symbol=result.symbol, complete=result.complete, notes=result.notes,
        FC=record.FC if lab else record.fines, gravel=record.gravel,
        LL=record.LL, PL=record.PL if lab else None, PI=record.PI,
        D10=record.D10, D30=record.D30, D60=record.D60, Cu=cu, Cc=cc,
        plastic_class=uscs.fines_type(record.LL, record.PI)
        if record.LL is not None and record.PI is not None else None,
        group_name_en=name.group_name_en if name else None,
        group_name_tr=name.group_name_tr if name else None,
        description=name.description if name else None,
    )


def _investigation(session: Session, kind: str, identifier: str, payload=None):
    """Replace or delete an existing raw record, preserving project reference validity.

    Deleting an investigation still referenced by a profile returns 422 ``validation``.
    """
    with session.lock:
        project = session.require_project()
        records = getattr(project.investigations, kind)
        service.find(records, identifier)
        if payload is not None:
            service.check_id(identifier, payload)
        updated = [payload if item.id == identifier else item for item in records
                   if item.id != identifier or payload is not None]
        investigations = project.investigations.model_copy(update={kind: updated})
        service.commit(session, investigations=investigations)
        return payload if payload is not None else dto.DeletionResponse(id=identifier, deleted=True)


def _profile(session: Session, profile: SoilProfile) -> SoilProfile:
    """Publish a profile replacement without changing any structure's owned soil copy."""
    project = session.require_project()
    service.commit(session, soil_profiles=[
        profile if item.id == profile.id else item for item in project.soil_profiles
    ])
    return profile


def _propose(
    session: Session, identifier: str, settings: LayeringSettings,
) -> dto.LayeringProposal:
    """Propose layers for one investigation without modifying the project."""
    with session.lock:
        project = session.require_project()
        known = {item.id for item in project.investigations.cpts}
        known |= {item.id for item in project.investigations.boreholes}
        if identifier not in known:
            api_error(404, "not_found", f"Investigation {identifier!r} not found.")
        try:
            proposal = propose_layers(project, identifier, settings)
        except ValueError as exc:
            api_error(422, "validation", str(exc))
        return dto.LayeringProposal.model_validate(asdict(proposal))


def _refreshed(session: Session, profile_id: str) -> tuple[SoilProfile, SoilProfile]:
    """Return the stored profile and its refreshed copy; caller holds the lock."""
    project = session.require_project()
    profile = service.find(project.soil_profiles, profile_id)
    try:
        return profile, parameters.refresh_profile(project, profile_id)
    except (KeyError, ValueError) as exc:
        api_error(422, "validation", str(exc))


def _with_layer(profile: SoilProfile, layer: SoilLayer) -> SoilProfile:
    """Return the profile with one layer replaced by id."""
    return profile.model_copy(update={
        "layers": [layer if item.id == layer.id else item for item in profile.layers],
    })


def router() -> APIRouter:
    """Build a fresh router; the registry adds the prefix and module tag."""
    api = APIRouter(responses=ERROR_RESPONSES)

    @api.get(
        "/investigations", response_model=InvestigationsDTO, operation_id="list_investigations",
    )
    def list_investigations(session: SessionDep) -> InvestigationsDTO:
        """List raw borehole and CPT records."""
        with session.lock:
            return InvestigationsDTO.model_validate(
                session.require_project().investigations.model_dump())

    @api.post(
        "/import/cpt", response_model=CPTSounding, operation_id="import_cpt",
        openapi_extra=multipart_body("sounding_id", cpt=True),
    )
    async def import_cpt(request: Request, session: SessionDep) -> CPTSounding:
        """Import multipart file, sounding_id, qc_unit, delimiter and decimal form parts.

        qc_unit applies to the file's cone resistance; stored sounding stresses are kPa.
        Multipart parsing does not require the optional python-multipart package.
        """
        with session.lock:
            session.require_project()
            generation = session.generation
        body = await service.read_upload(request)
        with session.lock:
            project = session.require_project()
            if session.generation != generation:
                api_error(409, "project_changed", "The open project changed during CSV upload.")
            parts = service.multipart(body, request.headers.get("content-type", ""),
                                      "sounding_id", cpt=True)
            sounding = service.import_csv(parts, cpt=True)
            project = session.require_project()
            if session.generation != generation:
                api_error(409, "project_changed", "The open project changed during CSV import.")
            investigations = project.investigations.model_copy(update={
                "cpts": [*project.investigations.cpts, sounding],
            })
            service.commit(session, investigations=investigations)
            return sounding

    @api.post(
        "/import/spt", response_model=Borehole, operation_id="import_spt",
        openapi_extra=multipart_body("borehole_id"),
    )
    async def import_spt(request: Request, session: SessionDep) -> Borehole:
        """Import multipart file and borehole_id form parts."""
        with session.lock:
            session.require_project()
            generation = session.generation
        body = await service.read_upload(request)
        with session.lock:
            project = session.require_project()
            if session.generation != generation:
                api_error(409, "project_changed", "The open project changed during CSV upload.")
            parts = service.multipart(body, request.headers.get("content-type", ""), "borehole_id")
            borehole = service.import_csv(parts, cpt=False)
            project = session.require_project()
            if session.generation != generation:
                api_error(409, "project_changed", "The open project changed during CSV import.")
            investigations = project.investigations.model_copy(update={
                "boreholes": [*project.investigations.boreholes, borehole],
            })
            service.commit(session, investigations=investigations)
            return borehole

    @api.post("/boreholes", response_model=Borehole, operation_id="create_borehole")
    def create_borehole(payload: Borehole, session: SessionDep) -> Borehole:
        """Add a borehole entered by hand (SPT, log and laboratory records may follow later)."""
        with session.lock:
            project = session.require_project()
            service.finite(payload.model_dump())
            if any(item.id == payload.id for item in project.investigations.boreholes):
                api_error(409, "validation", f"Borehole {payload.id!r} already exists.")
            investigations = project.investigations.model_copy(update={
                "boreholes": [*project.investigations.boreholes, payload],
            })
            service.commit(session, investigations=investigations)
            return payload

    @api.put("/boreholes/{id}", response_model=Borehole, operation_id="update_borehole")
    def update_borehole(id: str, payload: Borehole, session: SessionDep) -> Borehole:
        """Replace a borehole; the body id must identify the path resource."""
        return _investigation(session, "boreholes", id, payload)

    @api.delete(
        "/boreholes/{id}", response_model=dto.DeletionResponse, operation_id="delete_borehole",
    )
    def delete_borehole(id: str, session: SessionDep) -> dto.DeletionResponse:
        """Delete a borehole and return a JSON acknowledgement."""
        return _investigation(session, "boreholes", id)

    @api.put(
        "/boreholes/{id}/log", response_model=Borehole, operation_id="set_borehole_log",
    )
    def set_borehole_log(id: str, payload: list[BoreholeLayer], session: SessionDep) -> Borehole:
        """Replace the complete borehole log using a JSON array."""
        with session.lock:
            current = service.find(session.require_project().investigations.boreholes, id)
            updated = service.validate(Borehole, {
                **current.model_dump(), "log": [layer.model_dump() for layer in payload],
            })
            return _investigation(session, "boreholes", id, updated)

    @api.put("/cpts/{id}", response_model=CPTSounding, operation_id="update_cpt")
    def update_cpt(id: str, payload: CPTSounding, session: SessionDep) -> CPTSounding:
        """Replace a CPT sounding; the body id must identify the path resource."""
        return _investigation(session, "cpts", id, payload)

    @api.delete("/cpts/{id}", response_model=dto.DeletionResponse, operation_id="delete_cpt")
    def delete_cpt(id: str, session: SessionDep) -> dto.DeletionResponse:
        """Delete a CPT sounding and return a JSON acknowledgement."""
        return _investigation(session, "cpts", id)

    @api.get(
        "/cpts/{id}/processed", response_model=CPTProcessedDTO, operation_id="get_processed_cpt",
    )
    def get_processed_cpt(id: str, session: SessionDep) -> CPTProcessedDTO:
        """Return processed CPT chart data with null samples for non-finite values."""
        with session.lock:
            project = session.require_project()
            service.find(project.investigations.cpts, id)
            result = process_investigations(project)
            if id in result.errors:
                api_error(422, "validation", result.errors[id])
            processed = result.cpt[id]
            data = {}
            for key in CPTProcessedDTO.model_fields:
                value = getattr(processed, key)
                data[key] = value.tolist() if hasattr(value, "tolist") else value
            # The classifier uses zone 0 as its invalid-sample sentinel.
            data["zone"] = [int(zone) if 1 <= zone <= 9 else None for zone in processed.zone]
            return CPTProcessedDTO.model_validate(data)

    @api.get(
        "/classification/sbtn/reference", response_model=SBTNReferenceDTO,
        operation_id="get_sbtn_reference",
    )
    def get_sbtn_reference() -> SBTNReferenceDTO:
        """Return SBTn chart data; zones 8/9 are disabled by default and omitted.

        Ic limits describe zones 2-7 before the zone-1 override, which has no Ic
        interval. Contours use the lower-Qtn inverse branch, clipped to the chart
        axes. The full zone-1 boundary is sampled even below the Qtn axis minimum.
        """
        fr_range = AxisRangeDTO(min=0.1, max=10.0)
        qtn_range = AxisRangeDTO(min=1.0, max=1000.0)
        fr_grid = np.geomspace(fr_range.min, fr_range.max, 201)
        bounds = (None, *robertson.IC_BOUNDS, None)
        zones = [SBTNZoneDTO(zone=1, name_en=robertson.ZONE_NAMES[1]["en"],
                             name_tr=robertson.ZONE_NAMES[1]["tr"], ic_min=None, ic_max=None)]
        for zone in range(2, 8):
            zones.append(SBTNZoneDTO(
                zone=zone, name_en=robertson.ZONE_NAMES[zone]["en"],
                name_tr=robertson.ZONE_NAMES[zone]["tr"],
                ic_min=bounds[7 - zone], ic_max=bounds[8 - zone],
            ))
        contours = []
        for ic in robertson.IC_BOUNDS:
            qtn = robertson.qtn_from_ic(ic, fr_grid)
            contours.append(SBTNContourDTO(Ic=ic, points=[
                SBTNCoordinateDTO(Fr=fr, Qtn=q) for fr, q in zip(fr_grid, qtn)
                if np.isfinite(q) and qtn_range.min <= q <= qtn_range.max
            ]))
        return SBTNReferenceDTO(
            zones=zones, ic_bounds=list(robertson.IC_BOUNDS), ic_contours=contours,
            zone_1_boundary=[SBTNCoordinateDTO(Fr=fr, Qtn=q) for fr, q in
                             zip(fr_grid, robertson.zone_1_boundary(fr_grid))],
            fr_range=fr_range, qtn_range=qtn_range,
        )

    @api.get("/cpts/{id}/sbtn", response_model=CPTSBTNDTO, operation_id="get_cpt_sbtn")
    def get_cpt_sbtn(id: str, session: SessionDep) -> CPTSBTNDTO:
        """Use the processed-CPT path, including its profile, warnings and errors."""
        processed = get_processed_cpt(id, session)
        return CPTSBTNDTO(points=[
            SBTNPointDTO(
                depth=depth, Fr=fr, Qtn=qtn, Ic=ic, zone=zone,
                zone_name_en=robertson.ZONE_NAMES[zone]["en"] if zone else None,
                zone_name_tr=robertson.ZONE_NAMES[zone]["tr"] if zone else None,
            ) for depth, fr, qtn, ic, zone in zip(
                processed.depth, processed.Fr, processed.Qtn, processed.Ic, processed.zone,
            )
        ], warnings=processed.warnings)

    @api.get(
        "/boreholes/{id}/uscs", response_model=BoreholeUSCSDTO,
        operation_id="get_borehole_uscs",
    )
    def get_borehole_uscs(id: str, session: SessionDep) -> BoreholeUSCSDTO:
        """Classify every lab record, preserving engine incompleteness and notes."""
        with session.lock:
            project = session.require_project()
            borehole = service.find(project.investigations.boreholes, id)
            return BoreholeUSCSDTO(items=[
                _uscs_item(record, uscs.classify_lab_record(record)) for record in borehole.lab
            ])

    @api.post(
        "/classification/uscs", response_model=USCSItemDTO, operation_id="classify_uscs",
    )
    def classify_uscs(payload: USCSClassifyRequest) -> USCSItemDTO:
        """Classify stateless inputs; unavailable depth and PL are returned as null."""
        return _uscs_item(payload, uscs.classify(**payload.model_dump()))

    @api.get(
        "/classification/uscs/reference", response_model=USCSReferenceDTO,
        operation_id="get_uscs_reference",
    )
    def get_uscs_reference() -> USCSReferenceDTO:
        """Sample LL=0..100%; preserve negative A/U-line values from the engine."""
        return USCSReferenceDTO(
            a_line=[PlasticityPointDTO(LL=ll, PI=uscs.a_line(ll)) for ll in range(101)],
            u_line=[PlasticityPointDTO(LL=ll, PI=uscs.u_line(ll)) for ll in range(101)],
            symbols=[USCSSymbolDTO(symbol=symbol, **asdict(name))
                     for symbol, name in USCS_NAMES.items()],
        )

    @api.get(
        "/boreholes/{id}/processed", response_model=SPTProcessedDTO,
        operation_id="get_processed_spt",
    )
    def get_processed_spt(id: str, session: SessionDep) -> SPTProcessedDTO:
        """Return corrected SPT chart data."""
        with session.lock:
            project = session.require_project()
            borehole = service.find(project.investigations.boreholes, id)
            if not borehole.spt:
                api_error(422, "validation", "Borehole has no SPT records.")
            result = process_investigations(project)
            if id in result.errors:
                api_error(422, "validation", result.errors[id])
            processed = result.spt[id]
            return SPTProcessedDTO(depth=processed.depth.tolist(), N_field=processed.n_field.tolist(),
                                   N60=processed.n60.tolist(), N1_60=processed.n1_60.tolist(),
                                   warnings=processed.warnings)

    @api.post(
        "/layering/cpt/{cpt_id}", response_model=dto.LayeringProposal,
        operation_id="propose_cpt_layers",
    )
    def propose_cpt_layers(
        cpt_id: str, payload: LayeringSettings, session: SessionDep,
    ) -> dto.LayeringProposal:
        """Return a synchronous, unapproved CPT layering proposal."""
        return _propose(session, cpt_id, payload)

    @api.post(
        "/layering/spt/{borehole_id}", response_model=dto.LayeringProposal,
        operation_id="propose_spt_layers",
    )
    def propose_spt_layers(
        borehole_id: str, payload: LayeringSettings, session: SessionDep,
    ) -> dto.LayeringProposal:
        """Return a synchronous, unapproved SPT layering proposal."""
        return _propose(session, borehole_id, payload)

    @api.get("/profiles", response_model=list[ProfileSummary], operation_id="list_profiles")
    def list_profiles(session: SessionDep) -> list[ProfileSummary]:
        """List profiles available for selection or copying into structures."""
        with session.lock:
            return [ProfileSummary(
                id=p.id, name=p.name, origin=p.origin, source_ids=p.source_ids,
                gwt=p.gwt, layer_count=len(p.layers),
            ) for p in session.require_project().soil_profiles]

    @api.post("/profiles", response_model=SoilProfile, operation_id="create_profile")
    def create_profile(payload: ProfileCreate, session: SessionDep) -> SoilProfile:
        """Create from explicit layers or a proposal; assign profile and layer ids server-side."""
        with session.lock:
            project = session.require_project()
            profile = service.materialise(payload)
            service.commit(session, soil_profiles=[*project.soil_profiles, profile])
            return profile

    @api.get("/profiles/{id}", response_model=SoilProfile, operation_id="get_profile")
    def get_profile(id: str, session: SessionDep) -> SoilProfile:
        """Return a complete project soil profile."""
        with session.lock:
            return service.find(session.require_project().soil_profiles, id)

    def _keep_approvals_honest(layer, previous) -> dict:
        """Approval only comes from the approve route: an edited value (or a forged flag) revokes it."""
        data = layer.model_dump()

        def value(item, key):
            return getattr(item, key) if key in ("gamma", "gamma_sat") else getattr(item.design, key)

        for key, selection in data["selections"].items():
            if not selection.get("approved"):
                continue
            before = previous.selections.get(key)
            if (before is None or not before.approved
                    or before.basis_hash != selection.get("basis_hash")
                    or value(layer, key) != value(previous, key)):
                selection.update(approved=False, approved_at=None, basis_hash=None)
        return data

    @api.put("/profiles/{id}", response_model=SoilProfile, operation_id="update_profile")
    def update_profile(id: str, payload: SoilProfile, session: SessionDep) -> SoilProfile:
        """Replace a profile; the body id must identify the path resource."""
        with session.lock:
            current = service.find(session.require_project().soil_profiles, id)
            service.check_id(id, payload)
            existing = {layer.id: layer for layer in current.layers}
            layers = []
            for layer in payload.layers:
                previous = existing.get(layer.id)
                if (previous is None
                        or (layer.top, layer.bottom) != (previous.top, previous.bottom)
                        or set(layer.source_ids or payload.source_ids)
                        != set(previous.source_ids or current.source_ids)):
                    layers.append(service.reset_interval(layer))
                else:
                    layers.append(_keep_approvals_honest(layer, previous))
            updated = service.validate(SoilProfile, {**payload.model_dump(), "layers": layers})
            return _profile(session, updated)

    @api.delete(
        "/profiles/{id}", response_model=dto.DeletionResponse, operation_id="delete_profile",
    )
    def delete_profile(id: str, session: SessionDep) -> dto.DeletionResponse:
        """Delete a project profile and return a JSON acknowledgement."""
        with session.lock:
            project = session.require_project()
            service.find(project.soil_profiles, id)
            users = [s.name for s in project.structures if s.soil.source_profile_id == id]
            if users:
                # Their soil copies would point at a missing source and stay stale for good.
                api_error(409, "profile_in_use", "Structures copy their soil from this profile.",
                          message_code="profile_in_use", params={"structures": ", ".join(users)})
            profiles = [profile for profile in project.soil_profiles if profile.id != id]
            active = project.active_profile_id
            if active == id:
                active = profiles[0].id if profiles else None
            service.commit(session, soil_profiles=profiles, active_profile_id=active)
            return dto.DeletionResponse(id=id, deleted=True)

    @api.post(
        "/profiles/{id}/layers/{layer_id}/split", response_model=SoilProfile,
        operation_id="split_layer",
    )
    def split_layer(id: str, layer_id: str, payload: LayerSplit, session: SessionDep) -> SoilProfile:
        """Split the selected layer at an absolute depth below ground."""
        with session.lock:
            profile = service.find(session.require_project().soil_profiles, id)
            return _profile(session, service.split(profile, layer_id, payload.depth))

    @api.post(
        "/profiles/{id}/layers/merge", response_model=SoilProfile, operation_id="merge_layers",
    )
    def merge_layers(
        id: str, payload: LayerMerge, session: SessionDep, response: Response,
    ) -> SoilProfile:
        """Merge two adjacent layers in the selected profile."""
        with session.lock:
            profile = service.find(session.require_project().soil_profiles, id)
            merged, warnings = service.merge(profile, payload.layer_ids)
            result = _profile(session, merged)
            if warnings:
                response.headers["Warning"] = ", ".join(
                    f'299 geotek "{warning}"' for warning in warnings
                )
            return result

    @api.get(
        "/profiles/{id}/layers/{layer_id}/parameters", response_model=list[ParameterSelection],
        operation_id="list_layer_parameters",
    )
    def list_layer_parameters(
        id: str, layer_id: str, session: SessionDep,
    ) -> list[ParameterSelection]:
        """Return parameter selections and candidates evaluated on the server."""
        with session.lock:
            profile, refreshed = _refreshed(session, id)
            service.find(profile.layers, layer_id)
            layer = service.find(refreshed.layers, layer_id)
            return [layer.selections[key] for key in get_args(DesignKey)]

    @api.put(
        "/profiles/{id}/layers/{layer_id}/parameters/{key}", response_model=ParameterSelection,
        operation_id="update_parameter_selection",
    )
    def update_parameter_selection(
        id: str, layer_id: str, key: DesignKey, payload: SelectionUpdate, session: SessionDep,
    ) -> ParameterSelection:
        """Choose a method, statistic or manual value without approving it."""
        with session.lock:
            profile, refreshed = _refreshed(session, id)
            service.find(profile.layers, layer_id)
            layer = service.find(refreshed.layers, layer_id)
            chosen = layer.selections[key]
            chosen = chosen.model_copy(update=payload.model_dump())
            try:
                resolved = parameters.resolve(chosen)
            except ValueError as exc:
                api_error(422, "validation", str(exc))
            # Persist the whole refreshed layer so no key keeps stale candidates.
            layer.selections[key] = resolved
            _profile(session, _with_layer(profile, layer))
            return resolved

    @api.post(
        "/profiles/{id}/layers/{layer_id}/parameters/approve", response_model=SoilLayer,
        operation_id="approve_parameters",
    )
    def approve_parameters(
        id: str, layer_id: str, payload: ParameterApproval, session: SessionDep,
    ) -> SoilLayer:
        """Approve only the explicitly listed design quantities."""
        with session.lock:
            project = session.require_project()
            profile = service.find(project.soil_profiles, id)
            stored = service.find(profile.layers, layer_id)
            # Resolve against fresh candidates so the approved value and the basis hash
            # describe the same inputs; the stored selection inputs are carried by refresh.
            _, refreshed = _refreshed(session, id)
            layer = service.find(refreshed.layers, layer_id)
            try:
                points = parameters.layer_points(project, profile, stored)
                approved = parameters.approve(
                    layer, payload.keys, parameters.basis_hash(stored, points),
                    datetime.now(timezone.utc),
                )
            except (KeyError, ValueError) as exc:
                api_error(422, "validation", str(exc))
            _profile(session, _with_layer(profile, approved))
            return approved

    @api.post(
        "/profiles/{id}/parameters/suggest-all", response_model=SoilProfile,
        operation_id="suggest_all_parameters",
    )
    def suggest_all_parameters(id: str, session: SessionDep) -> SoilProfile:
        """Fill parameter suggestions throughout a profile; approve nothing."""
        with session.lock:
            _, refreshed = _refreshed(session, id)
            return _profile(session, refreshed)

    return api
