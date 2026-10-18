"""Soil routes mounted at /api/m/soil; layering and parameter workflows remain stubs."""

from __future__ import annotations

from typing import Annotated, NoReturn

from fastapi import APIRouter, Depends, Request

from geotek.api import schemas as dto
from geotek.api.common import ERROR_RESPONSES, multipart_body, not_implemented
from geotek.api.session import Session, api_error, get_session
from geotek.core.models.investigations import Borehole, BoreholeLayer, CPTSounding
from geotek.core.models.parameters import DesignKey, ParameterSelection
from geotek.core.models.profile import LayeringSettings, SoilLayer, SoilProfile
from geotek.modules.soil import service
from geotek.modules.soil.schemas import (
    CPTProcessedDTO,
    InvestigationsDTO,
    LayerMerge,
    LayerSplit,
    ParameterApproval,
    ProfileCreate,
    ProfileSummary,
    SelectionUpdate,
    SPTProcessedDTO,
)
from geotek.services.module1 import process_investigations

SessionDep = Annotated[Session, Depends(get_session)]


def _investigation(session: Session, kind: str, identifier: str, payload=None):
    """Replace or delete an existing raw record, preserving project reference validity."""
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
        session.require_project()
        parts = await service.multipart(request, "sounding_id", cpt=True)
        sounding = service.import_csv(parts, cpt=True)
        with session.lock:
            project = session.require_project()
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
        session.require_project()
        parts = await service.multipart(request, "borehole_id")
        borehole = service.import_csv(parts, cpt=False)
        with session.lock:
            project = session.require_project()
            investigations = project.investigations.model_copy(update={
                "boreholes": [*project.investigations.boreholes, borehole],
            })
            service.commit(session, investigations=investigations)
            return borehole

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
    def propose_cpt_layers(cpt_id: str, payload: LayeringSettings) -> NoReturn:
        """Return a synchronous, unapproved CPT layering proposal."""
        not_implemented()

    @api.post(
        "/layering/spt/{borehole_id}", response_model=dto.LayeringProposal,
        operation_id="propose_spt_layers",
    )
    def propose_spt_layers(borehole_id: str, payload: LayeringSettings) -> NoReturn:
        """Return a synchronous, unapproved SPT layering proposal."""
        not_implemented()

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

    @api.put("/profiles/{id}", response_model=SoilProfile, operation_id="update_profile")
    def update_profile(id: str, payload: SoilProfile, session: SessionDep) -> SoilProfile:
        """Replace a profile; the body id must identify the path resource."""
        with session.lock:
            service.find(session.require_project().soil_profiles, id)
            service.check_id(id, payload)
            return _profile(session, payload)

    @api.delete(
        "/profiles/{id}", response_model=dto.DeletionResponse, operation_id="delete_profile",
    )
    def delete_profile(id: str, session: SessionDep) -> dto.DeletionResponse:
        """Delete a project profile and return a JSON acknowledgement."""
        with session.lock:
            project = session.require_project()
            service.find(project.soil_profiles, id)
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
    def merge_layers(id: str, payload: LayerMerge, session: SessionDep) -> SoilProfile:
        """Merge two adjacent layers in the selected profile."""
        with session.lock:
            profile = service.find(session.require_project().soil_profiles, id)
            return _profile(session, service.merge(profile, payload.layer_ids))

    @api.get(
        "/profiles/{id}/layers/{layer_id}/parameters", response_model=list[ParameterSelection],
        operation_id="list_layer_parameters",
    )
    def list_layer_parameters(id: str, layer_id: str) -> NoReturn:
        """Return parameter selections and candidates evaluated on the server."""
        not_implemented()

    @api.put(
        "/profiles/{id}/layers/{layer_id}/parameters/{key}", response_model=ParameterSelection,
        operation_id="update_parameter_selection",
    )
    def update_parameter_selection(
        id: str, layer_id: str, key: DesignKey, payload: SelectionUpdate,
    ) -> NoReturn:
        """Choose a method, statistic or manual value without approving it."""
        not_implemented()

    @api.post(
        "/profiles/{id}/layers/{layer_id}/parameters/approve", response_model=SoilLayer,
        operation_id="approve_parameters",
    )
    def approve_parameters(id: str, layer_id: str, payload: ParameterApproval) -> NoReturn:
        """Approve only the explicitly listed design quantities."""
        not_implemented()

    @api.post(
        "/profiles/{id}/parameters/suggest-all", response_model=SoilProfile,
        operation_id="suggest_all_parameters",
    )
    def suggest_all_parameters(id: str) -> NoReturn:
        """Fill parameter suggestions throughout a profile; approve nothing."""
        not_implemented()

    return api
