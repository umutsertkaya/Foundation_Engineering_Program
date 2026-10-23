"""GeoTek HTTP surface: core shell, structure calculations and in-process jobs.

Core routes live here under /api; pluggable modules mount at /api/m/<id> via the registry.
Run with ``uvicorn geotek.api.app:create_app --factory --host 127.0.0.1``.
Multipart is documented explicitly so creating the contract needs no parser package.
"""

from __future__ import annotations

import math
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from pydantic import TypeAdapter, ValidationError

from geotek.api import library_routes, registry
from geotek.api import schemas as dto
from geotek.api.common import ERROR_RESPONSES
from geotek.api.jobs import JobRunner, RunnerDep
from geotek.api.session import Session, api_error, get_session, load_external
from geotek.config.codes import FactorOverride, get_design_code, list_design_codes
from geotek.core.errors import GeoTekError
from geotek.core.models.project import Project, ProjectMeta, SiteSeismic
from geotek.core.models.structures import Structure, StructureSoilModel
from geotek.i18n import _catalog
from geotek.io.project_io import save_project
from geotek.library import load_settings
from geotek.services.structures import calculation_fingerprint
from geotek.services.walls_advanced import list_factors, required_inputs

API_VERSION = "0.2.0"

meta = APIRouter(tags=["meta"], responses=ERROR_RESPONSES)
project = APIRouter(tags=["project"], responses=ERROR_RESPONSES)
data = APIRouter(tags=["data"], responses=ERROR_RESPONSES)
structures = APIRouter(tags=["structures"], responses=ERROR_RESPONSES)
jobs = APIRouter(tags=["jobs"], responses=ERROR_RESPONSES)
codes = APIRouter(tags=["codes"], responses=ERROR_RESPONSES)
SessionDep = Annotated[Session, Depends(get_session)]


@meta.get("/health", response_model=dto.HealthResponse, operation_id="get_health")
def get_health() -> dto.HealthResponse:
    """Report availability and the HTTP contract version."""
    return dto.HealthResponse(status="ok", version=API_VERSION)


@meta.get("/i18n/{lang}", response_model=dict[str, str], operation_id="get_i18n")
def get_i18n(lang: dto.Language) -> dict[str, str]:
    """Return the flat translation key-to-string catalog in the selected language."""
    return _catalog(lang).copy()


def _summary(project: Project) -> dto.ProjectSummary:
    profiles = {profile.id: profile for profile in project.soil_profiles}
    return dto.ProjectSummary(
        meta=project.meta, site=project.site,
        counts=dto.ProjectCounts(
            boreholes=len(project.investigations.boreholes), cpts=len(project.investigations.cpts),
            profiles=len(project.soil_profiles), structures=len(project.structures),
        ),
        active_profile_id=project.active_profile_id,
        structures=[
            dto.StructureSummary(
                id=item.id, name=item.name, kind=item.kind,
                wall_type=getattr(item, "wall_type", None),
                source_stale=item.soil.is_stale(profiles.get(item.soil.source_profile_id)),
                stale=(item.soil.is_stale(profiles.get(item.soil.source_profile_id))
                       or (item.result_hash is not None
                           and item.result_hash != calculation_fingerprint(project, item))),
                has_result=item.result_hash is not None,
            )
            for item in project.structures
        ],
    )


@project.post("/project/new", response_model=dto.ProjectSummary, operation_id="new_project")
def new_project(payload: dto.ProjectNew, session: SessionDep) -> dto.ProjectSummary:
    """Create an unsaved project outside the library (saving needs a path)."""
    created = Project(meta=ProjectMeta(name=payload.name, language=payload.language))
    session.open_project(created, dirty=True)
    return _summary(created)


@project.post("/project/open", response_model=dto.ProjectSummary, operation_id="open_project")
def open_project(payload: dto.ProjectOpen, session: SessionDep) -> dto.ProjectSummary:
    """Open a local project file by path, outside the library."""
    path = Path(payload.path).expanduser().resolve()
    opened = load_external(path)
    summary = _summary(opened)  # fail before the session switches to the new project
    session.open_project(opened, path=path)
    return summary


@project.post("/project/save", response_model=dto.ProjectSaveResponse, operation_id="save_project")
def save_project_route(
    session: SessionDep, payload: Annotated[dto.ProjectSave | None, Body()] = None,
) -> dto.ProjectSaveResponse:
    """Save to the open library file, the path-based file, or an explicit path (Save As)."""
    with session.lock:
        current = session.require_project()
        try:
            if payload is not None and payload.path:
                destination = Path(payload.path).expanduser()
                destination.parent.mkdir(parents=True, exist_ok=True)
                target = save_project(current, destination)
                session.file, session.path = None, target.resolve()
            elif session.file is not None:
                session.library.save(session.file, current)
                target = session.library.path_of(session.file)
            elif session.path is not None:
                target = save_project(current, session.path)
            else:
                api_error(400, "no_save_target", "Project has no file; supply a path.")
        except OSError as exc:
            api_error(400, "invalid_path", str(exc))
        session.dirty = False
        return dto.ProjectSaveResponse(open=True, file=session.file, dirty=False, path=str(target))


@project.post("/project/close", response_model=dto.SessionInfo, operation_id="close_project")
def close_project(session: SessionDep) -> dto.SessionInfo:
    """Close the open project, discarding unsaved changes."""
    session.close()
    return session.info()


@project.get("/project", response_model=dto.ProjectSummary, operation_id="get_project")
def get_project(session: SessionDep) -> dto.ProjectSummary:
    """Return the current project summary; 409 no_project_open when none."""
    with session.lock:
        return _summary(session.require_project())


@project.patch("/project/meta", response_model=ProjectMeta, operation_id="update_project_meta")
def update_project_meta(payload: dto.ProjectMetaPatch, session: SessionDep) -> ProjectMeta:
    """Update supplied metadata fields; omission preserves the existing value."""
    with session.lock:
        current = session.require_project()
        before = current.meta.model_dump()
        merged = {**before, **payload.model_dump(exclude_unset=True)}
        try:
            current.meta = ProjectMeta.model_validate(merged)
        except ValidationError as exc:
            api_error(422, "validation", "Invalid project metadata.", errors=[
                {"loc": list(item["loc"]), "msg": item["msg"], "type": item["type"]}
                for item in exc.errors()
            ])
        if current.meta.model_dump() != before:
            session.dirty = True
        return current.meta


@project.put("/project/site", response_model=SiteSeismic, operation_id="set_project_site")
def set_project_site(payload: SiteSeismic, session: SessionDep) -> SiteSeismic:
    """Replace site seismic settings."""
    with session.lock:
        current = session.require_project()
        changed = current.site.model_dump() != payload.model_dump()
        current.site = payload
        if changed:
            session.dirty = True
        return current.site


@project.put(
    "/project/active-profile", response_model=dto.ProjectSummary,
    operation_id="set_active_profile",
)
def set_active_profile(payload: dto.ActiveProfileUpdate, session: SessionDep) -> dto.ProjectSummary:
    """Select the profile used for investigation processing and liquefaction."""
    with session.lock:
        current = session.require_project()
        if payload.profile_id is not None and all(
            profile.id != payload.profile_id for profile in current.soil_profiles
        ):
            api_error(404, "not_found", f"Profile not found: {payload.profile_id}")
        current.active_profile_id = payload.profile_id
        session.dirty = True
        return _summary(current)


@data.get(
    "/data/profiles", response_model=list[dto.ProfileSummary], operation_id="list_project_profiles",
)
def list_project_profiles(session: SessionDep) -> list[dto.ProfileSummary]:
    """Read-only list of the open project's soil profiles (409 no_project_open when none)."""
    with session.lock:
        return [
            dto.ProfileSummary(
                id=p.id, name=p.name, origin=p.origin, source_ids=list(p.source_ids),
                gwt=p.gwt, layer_count=len(p.layers),
            )
            for p in session.require_project().soil_profiles
        ]


@structures.get(
    "/structures", response_model=list[dto.StructureSummary], operation_id="list_structures",
)
def list_structures(
    session: SessionDep, kind: dto.StructureKind | None = None,
) -> list[dto.StructureSummary]:
    """List structures and their soil/result freshness state."""
    with session.lock:
        return [item for item in _summary(session.require_project()).structures
                if kind is None or item.kind == kind]


def _structure(current: Project, id: str) -> Structure:
    """Look up an existing resource using the domain model."""
    try:
        return current.structure(id)
    except KeyError:
        api_error(404, "not_found", f"Structure not found: {id}")


def _require_finite(value: object, loc: tuple[str | int, ...] = ()) -> None:
    """DTO configuration does not propagate into nested domain models."""
    if isinstance(value, float) and not math.isfinite(value):
        api_error(422, "validation", "Structure numbers must be finite.", errors=[
            {"loc": list(loc), "msg": "Input should be a finite number", "type": "finite_number"}
        ])
    if isinstance(value, dict):
        for key, item in value.items():
            _require_finite(item, (*loc, key))
    elif isinstance(value, (list, tuple)):
        for index, item in enumerate(value):
            _require_finite(item, (*loc, index))


def _validated_structure(data: dict) -> Structure:
    """Validate assembled inputs before changing any project state."""
    _require_finite(data)
    try:
        validated = TypeAdapter(Structure).validate_python(data)
    except ValidationError as exc:
        api_error(422, "validation", "Invalid structure.", errors=[
            {"loc": list(item["loc"]), "msg": item["msg"], "type": item["type"]}
            for item in exc.errors()
        ])
    _require_finite(validated.model_dump())
    return validated


@structures.post("/structures", response_model=Structure, operation_id="create_structure")
def create_structure(
    payload: Annotated[dto.StructureCreate, Body(discriminator="kind")],
    session: SessionDep,
) -> Structure:
    """Create a wall or sheet pile with its own soil copy; choose the variant by kind."""
    with session.lock:
        current = session.require_project()
        soil = payload.soil
        if soil is not None and payload.profile_id is not None:
            api_error(422, "validation", "Supply either soil or profile_id.")
        if soil is None:
            try:
                source = (current.profile(payload.profile_id) if payload.profile_id is not None
                          else current.active_profile())
            except KeyError:
                api_error(404, "not_found", f"Profile not found: {payload.profile_id}")
            if source is None:
                api_error(409, "no_soil_source", "Select a soil profile or supply manual soil.")
            soil = StructureSoilModel(source_profile_id=source.id,
                                      source_hash=source.content_hash(),
                                      profile=source.model_copy(deep=True))
        created = _validated_structure({
            **payload.model_dump(exclude={"soil", "profile_id"}, exclude_none=True),
            "id": str(uuid4()), "soil": soil.model_dump(),
        })
        current.structures.append(created)
        session.dirty = True
        return created.model_copy(deep=True)


@structures.get("/structures/{id}", response_model=Structure, operation_id="get_structure")
def get_structure(id: str, session: SessionDep) -> Structure:
    """Return a complete structure, discriminated by kind."""
    with session.lock:
        return _structure(session.require_project(), id).model_copy(deep=True)


@structures.put("/structures/{id}", response_model=Structure, operation_id="update_structure")
def update_structure(
    id: str, payload: Annotated[Structure, Body(discriminator="kind")],
    session: SessionDep,
) -> Structure:
    """Replace a structure; the body id must identify the path resource."""
    with session.lock:
        current = session.require_project()
        existing = _structure(current, id)
        if payload.id != id:
            api_error(422, "validation", "Body id must match the structure path id.")
        updated = _validated_structure(payload.model_dump())
        current.structures[current.structures.index(existing)] = updated
        session.dirty = True
        return updated.model_copy(deep=True)


@structures.delete(
    "/structures/{id}", response_model=dto.DeletionResponse, operation_id="delete_structure",
)
def delete_structure(id: str, session: SessionDep) -> dto.DeletionResponse:
    """Delete a structure and return a JSON acknowledgement."""
    with session.lock:
        current = session.require_project()
        current.structures.remove(_structure(current, id))
        session.dirty = True
        return dto.DeletionResponse(id=id, deleted=True)


@structures.put(
    "/structures/{id}/soil", response_model=Structure, operation_id="set_structure_soil",
)
def set_structure_soil(id: str, payload: StructureSoilModel, session: SessionDep) -> Structure:
    """Replace the structure-specific soil model."""
    with session.lock:
        current = session.require_project()
        existing = _structure(current, id)
        updated = _validated_structure({**existing.model_dump(), "soil": payload.model_dump()})
        current.structures[current.structures.index(existing)] = updated
        session.dirty = True
        return updated.model_copy(deep=True)


@structures.post(
    "/structures/{id}/soil/resync", response_model=Structure, operation_id="resync_structure_soil",
)
def resync_structure_soil(id: str, session: SessionDep) -> Structure:
    """Re-copy soil from the structure's source project profile."""
    with session.lock:
        current = session.require_project()
        existing = _structure(current, id)
        if existing.soil.source_profile_id is None:
            api_error(404, "not_found", "Source profile not found.")
        try:
            source = current.profile(existing.soil.source_profile_id)
        except KeyError:
            api_error(404, "not_found", "Source profile not found.")
        soil = {**existing.soil.model_dump(), "profile": source.model_dump(),
                "source_hash": source.content_hash()}
        updated = _validated_structure({**existing.model_dump(), "soil": soil})
        current.structures[current.structures.index(existing)] = updated
        session.dirty = True
        return updated.model_copy(deep=True)

@jobs.get("/jobs/{job_id}", response_model=dto.JobState, operation_id="get_job")
def get_job(job_id: str, runner: RunnerDep) -> dto.JobState:
    """Poll status, progress, step translation key, result or error."""
    return runner.get(job_id)


@jobs.delete("/jobs/{job_id}", response_model=dto.JobState, operation_id="cancel_job")
def cancel_job(job_id: str, runner: RunnerDep) -> dto.JobState:
    """Request cancellation and return the resulting job state."""
    return runner.cancel(job_id)

@codes.get("/codes", response_model=list[dto.DesignCodeSummary], operation_id="list_codes")
def list_codes(session: SessionDep) -> list[dto.DesignCodeSummary]:
    """List design codes in the project language and their named approaches."""
    with session.lock:
        language = (session.project.meta.language if session.project is not None
                    else load_settings().language)
        return [dto.DesignCodeSummary(id=code.id, name=code.label.get(language),
                                      approach=code.approach, approaches=list(code.approaches))
                for code in list_design_codes(list(registry.design_code_dirs())).values()]


def _code_overrides(code_id: str, session: Session) -> dict[str, FactorOverride]:
    """Check the code id before passing optional project overrides to the services."""
    try:
        get_design_code(code_id, list(registry.design_code_dirs()))
    except GeoTekError:
        api_error(404, "not_found", f"Design code not found: {code_id}")
    return (session.project.design_overrides.get(code_id, {})
            if session.project is not None else {})


@codes.get(
    "/codes/{code_id}/factors", response_model=list[dto.FactorRowDTO],
    operation_id="list_code_factors",
)
def list_code_factors(code_id: str, session: SessionDep) -> list[dto.FactorRowDTO]:
    """Return code factor values and their provenance."""
    with session.lock:
        overrides = _code_overrides(code_id, session)
        try:
            rows = list_factors(code_id, overrides, extra_dirs=list(registry.design_code_dirs()))
        except GeoTekError as exc:
            api_error(422, "validation", str(exc))
        return [dto.FactorRowDTO.model_validate(row) for row in rows]


@codes.get(
    "/codes/{code_id}/required", response_model=list[dto.MissingFactorDTO],
    operation_id="get_code_required_factors",
)
def get_code_required_factors(
    code_id: str, session: SessionDep, approach: str | None = None, seismic: bool = False,
) -> list[dto.MissingFactorDTO]:
    """List missing factors for the selected approach and seismic/static case."""
    with session.lock:
        overrides = _code_overrides(code_id, session)
        try:
            missing = required_inputs(code_id, approach=approach, seismic=seismic,
                                      overrides=overrides,
                                      extra_dirs=list(registry.design_code_dirs()))
        except GeoTekError as exc:
            api_error(422, "validation", str(exc))
        return [dto.MissingFactorDTO.model_validate(item) for item in missing]


@codes.put(
    "/project/design-overrides/{code_id}", response_model=dict[str, FactorOverride],
    operation_id="set_design_overrides",
)
def set_design_overrides(
    code_id: str, payload: dict[str, FactorOverride], session: SessionDep,
) -> dict[str, FactorOverride]:
    """Replace the project's user factor overrides for one design code."""
    with session.lock:
        current = session.require_project()
        _code_overrides(code_id, session)
        try:
            code = get_design_code(code_id, list(registry.design_code_dirs()))
            for path, override in payload.items():
                code.get(path)
                if not math.isfinite(override.value):
                    api_error(422, "validation", "Factor values must be finite.")
            code.with_overrides(payload)
        except GeoTekError as exc:
            api_error(422, "validation", str(exc))
        current.design_overrides[code_id] = payload
        session.dirty = True
        return payload


def create_app(session: Session | None = None) -> FastAPI:
    """Build an application with its own session (settings via GEOTEK_SETTINGS or defaults)."""
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        try:
            yield
        finally:
            app.state.jobs.shutdown()

    app = FastAPI(
        lifespan=lifespan,
        title="GeoTek API", version=API_VERSION,
        description=(
            "GeoTek v2 local HTTP contract. Units: m, kPa, kN/m3 and degrees unless "
            "explicitly labelled otherwise. Non-finite result numbers are JSON null. "
            "The core shell, wall and sheet pile calculations, liquefaction and job polling "
            "are implemented. Remaining workflow stubs return ApiError with HTTP 501."
        ),
        servers=[{"url": "http://127.0.0.1:8000"}],
    )
    app.state.session = session if session is not None else Session()
    app.state.jobs = JobRunner()

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        """Keep HTTP errors in the shared envelope, without FastAPI's detail wrapper."""
        if isinstance(exc.detail, dict) and "code" in exc.detail:
            error = dto.ApiError.model_validate(exc.detail)
        else:
            code = {
                404: "not_found", 409: "stale_structure", 422: "validation",
                501: "not_implemented",
            }.get(exc.status_code, "engine_error" if exc.status_code >= 500 else "validation")
            error = dto.ApiError(code=code, message=str(exc.detail))
        return JSONResponse(error.model_dump(mode="json"), status_code=exc.status_code,
                            headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError,
    ) -> JSONResponse:
        """Return safe, JSON-compatible validation locations, messages and error types."""
        errors = [
            {"loc": list(item["loc"]), "msg": item["msg"], "type": item["type"]}
            for item in exc.errors()
        ]
        error = dto.ApiError(code="validation", message="Request validation failed.",
                             details={"errors": errors})
        return JSONResponse(error.model_dump(mode="json"), status_code=422)

    @app.exception_handler(Exception)
    async def handle_server_error(request: Request, exc: Exception) -> JSONResponse:
        """Preserve the documented envelope for an unexpected server failure."""
        error = dto.ApiError(code="engine_error", message="An internal server error occurred.")
        return JSONResponse(error.model_dump(mode="json"), status_code=500)

    for router in (meta, library_routes.router, project, data, structures, jobs, codes):
        app.include_router(router, prefix="/api")
    registry.mount_modules(app)
    return app
