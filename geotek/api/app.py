"""Declared GeoTek HTTP surface: health is live, all workflow bodies raise 501.

Core routes live here under /api; pluggable modules mount at /api/m/<id> via the registry.
Run with ``uvicorn geotek.api.app:create_app --factory --host 127.0.0.1``.
Multipart is documented explicitly so creating the contract needs no parser package.
"""

from __future__ import annotations

from typing import Annotated, NoReturn

from fastapi import APIRouter, Body, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from geotek.api import registry
from geotek.api import schemas as dto
from geotek.api.common import ERROR_RESPONSES, not_implemented
from geotek.config.codes import FactorOverride
from geotek.core.models.project import ProjectMeta, SiteSeismic
from geotek.core.models.structures import Structure, StructureSoilModel

API_VERSION = "0.2.0"

meta = APIRouter(tags=["meta"], responses=ERROR_RESPONSES)
project = APIRouter(tags=["project"], responses=ERROR_RESPONSES)
structures = APIRouter(tags=["structures"], responses=ERROR_RESPONSES)
jobs = APIRouter(tags=["jobs"], responses=ERROR_RESPONSES)
codes = APIRouter(tags=["codes"], responses=ERROR_RESPONSES)


@meta.get("/health", response_model=dto.HealthResponse, operation_id="get_health")
def get_health() -> dto.HealthResponse:
    """Report availability and the HTTP contract version."""
    return dto.HealthResponse(status="ok", version=API_VERSION)


@meta.get("/i18n/{lang}", response_model=dict[str, str], operation_id="get_i18n")
def get_i18n(lang: dto.Language) -> NoReturn:
    """Return the flat translation key-to-string catalog in the selected language."""
    not_implemented()


@project.post("/project/new", response_model=dto.ProjectSummary, operation_id="new_project")
def new_project(payload: dto.ProjectNew) -> NoReturn:
    """Create a project with the requested name and language."""
    not_implemented()


@project.post("/project/open", response_model=dto.ProjectSummary, operation_id="open_project")
def open_project(payload: dto.ProjectOpen) -> NoReturn:
    """Open a local project file."""
    not_implemented()


@project.post("/project/save", response_model=dto.ProjectSaved, operation_id="save_project")
def save_project(payload: dto.ProjectSave) -> NoReturn:
    """Save to the supplied path or the project's current file."""
    not_implemented()


@project.get("/project", response_model=dto.ProjectSummary, operation_id="get_project")
def get_project() -> NoReturn:
    """Return the current project summary."""
    not_implemented()


@project.patch("/project/meta", response_model=ProjectMeta, operation_id="update_project_meta")
def update_project_meta(payload: dto.ProjectMetaPatch) -> NoReturn:
    """Update supplied metadata fields; omission preserves the existing value."""
    not_implemented()


@project.put("/project/site", response_model=SiteSeismic, operation_id="set_project_site")
def set_project_site(payload: SiteSeismic) -> NoReturn:
    """Replace site seismic settings."""
    not_implemented()


@project.put(
    "/project/active-profile", response_model=dto.ProjectSummary,
    operation_id="set_active_profile",
)
def set_active_profile(payload: dto.ActiveProfileUpdate) -> NoReturn:
    """Select the profile used for investigation processing and liquefaction."""
    not_implemented()

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


def create_app() -> FastAPI:
    """Build an independent contract application without loading project state or engines."""
    app = FastAPI(
        title="GeoTek API", version=API_VERSION,
        description=(
            "GeoTek v2 local HTTP contract. Units: m, kPa, kN/m3 and degrees unless "
            "explicitly labelled otherwise. Non-finite result numbers are JSON null. "
            "Only health is implemented; workflow routes return ApiError with HTTP 501."
        ),
        servers=[{"url": "http://127.0.0.1:8000"}],
    )

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

    for router in (meta, project, structures, jobs, codes):
        app.include_router(router, prefix="/api")
    registry.mount_modules(app)
    return app
