"""GeoTek HTTP surface: health and the core shell are live, other workflow bodies raise 501.

Core routes live here under /api; pluggable modules mount at /api/m/<id> via the registry.
Run with ``uvicorn geotek.api.app:create_app --factory --host 127.0.0.1``.
Multipart is documented explicitly so creating the contract needs no parser package.
"""

from __future__ import annotations

from pathlib import Path
from typing import Annotated, NoReturn

from fastapi import APIRouter, Body, Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from pydantic import ValidationError

from geotek.api import library_routes, registry
from geotek.api import schemas as dto
from geotek.api.common import ERROR_RESPONSES, not_implemented
from geotek.api.session import Session, api_error, get_session, load_external
from geotek.config.codes import FactorOverride
from geotek.core.models.project import Project, ProjectMeta, SiteSeismic
from geotek.core.models.structures import Structure, StructureSoilModel
from geotek.io.project_io import save_project

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
def get_i18n(lang: dto.Language) -> NoReturn:
    """Return the flat translation key-to-string catalog in the selected language."""
    not_implemented()


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
                stale=item.soil.is_stale(profiles.get(item.soil.source_profile_id)),
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
    session.open_project(opened, path=path)
    return _summary(opened)


@project.post("/project/save", response_model=dto.ProjectSaveResponse, operation_id="save_project")
def save_project_route(
    session: SessionDep, payload: Annotated[dto.ProjectSave | None, Body()] = None,
) -> dto.ProjectSaveResponse:
    """Save to the open library file, the path-based file, or an explicit path (Save As)."""
    with session.lock:
        current = session.require_project()
        try:
            if payload is not None and payload.path:
                target = save_project(current, Path(payload.path).expanduser())
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
def list_structures() -> NoReturn:
    """List structures and their soil/result freshness state."""
    not_implemented()


@structures.post("/structures", response_model=Structure, operation_id="create_structure")
def create_structure(
    payload: Annotated[dto.StructureCreate, Body(discriminator="kind")],
) -> NoReturn:
    """Create a wall or sheet pile with its own soil copy; choose the variant by kind."""
    not_implemented()


@structures.get("/structures/{id}", response_model=Structure, operation_id="get_structure")
def get_structure(id: str) -> NoReturn:
    """Return a complete structure, discriminated by kind."""
    not_implemented()


@structures.put("/structures/{id}", response_model=Structure, operation_id="update_structure")
def update_structure(
    id: str, payload: Annotated[Structure, Body(discriminator="kind")],
) -> NoReturn:
    """Replace a structure; the body id must identify the path resource."""
    not_implemented()


@structures.delete(
    "/structures/{id}", response_model=dto.DeletionResponse, operation_id="delete_structure",
)
def delete_structure(id: str) -> NoReturn:
    """Delete a structure and return a JSON acknowledgement."""
    not_implemented()


@structures.put(
    "/structures/{id}/soil", response_model=Structure, operation_id="set_structure_soil",
)
def set_structure_soil(id: str, payload: StructureSoilModel) -> NoReturn:
    """Replace the structure-specific soil model."""
    not_implemented()


@structures.post(
    "/structures/{id}/soil/resync", response_model=Structure, operation_id="resync_structure_soil",
)
def resync_structure_soil(id: str) -> NoReturn:
    """Re-copy soil from the structure's source project profile."""
    not_implemented()

@jobs.get("/jobs/{job_id}", response_model=dto.JobState, operation_id="get_job")
def get_job(job_id: str) -> NoReturn:
    """Poll status, progress, step translation key, result or error."""
    not_implemented()


@jobs.delete("/jobs/{job_id}", response_model=dto.JobState, operation_id="cancel_job")
def cancel_job(job_id: str) -> NoReturn:
    """Request cancellation and return the resulting job state."""
    not_implemented()

@codes.get("/codes", response_model=list[dto.DesignCodeSummary], operation_id="list_codes")
def list_codes() -> NoReturn:
    """List design codes in the project language and their named approaches."""
    not_implemented()


@codes.get(
    "/codes/{code_id}/factors", response_model=list[dto.FactorRowDTO],
    operation_id="list_code_factors",
)
def list_code_factors(code_id: str) -> NoReturn:
    """Return code factor values and their provenance."""
    not_implemented()


@codes.get(
    "/codes/{code_id}/required", response_model=list[dto.MissingFactorDTO],
    operation_id="get_code_required_factors",
)
def get_code_required_factors(
    code_id: str, approach: str | None = None, seismic: bool = False,
) -> NoReturn:
    """List missing factors for the selected approach and seismic/static case."""
    not_implemented()


@codes.put(
    "/project/design-overrides/{code_id}", response_model=dict[str, FactorOverride],
    operation_id="set_design_overrides",
)
def set_design_overrides(code_id: str, payload: dict[str, FactorOverride]) -> NoReturn:
    """Replace the project's user factor overrides for one design code."""
    not_implemented()


def create_app(session: Session | None = None) -> FastAPI:
    """Build an application with its own session (settings via GEOTEK_SETTINGS or defaults)."""
    app = FastAPI(
        title="GeoTek API", version=API_VERSION,
        description=(
            "GeoTek v2 local HTTP contract. Units: m, kPa, kN/m3 and degrees unless "
            "explicitly labelled otherwise. Non-finite result numbers are JSON null. "
            "The core shell (session, project, library, settings, modules) is implemented; "
            "other workflow routes return ApiError with HTTP 501."
        ),
        servers=[{"url": "http://127.0.0.1:8000"}],
    )
    app.state.session = session if session is not None else Session()

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
