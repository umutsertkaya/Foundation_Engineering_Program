"""Declared GeoTek HTTP surface: health is live, all workflow bodies raise 501.

Run with ``uvicorn geotek.api.app:create_app --factory --host 127.0.0.1``.
Multipart is documented explicitly so creating the contract needs no parser package.
"""

from __future__ import annotations

from typing import Annotated, Any, NoReturn

from fastapi import APIRouter, Body, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from geotek.api import schemas as dto
from geotek.config.codes import FactorOverride
from geotek.core.models.investigations import Borehole, BoreholeLayer, CPTSounding
from geotek.core.models.parameters import DesignKey, ParameterSelection
from geotek.core.models.profile import LayeringSettings, SoilLayer, SoilProfile
from geotek.core.models.project import ProjectMeta, SiteSeismic
from geotek.core.models.structures import Structure, StructureSoilModel

API_VERSION = "0.2.0"
ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    400: {"model": dto.ApiError, "description": "Invalid operation or input file"},
    404: {"model": dto.ApiError, "description": "Resource not found"},
    409: {"model": dto.ApiError, "description": "Conflicting or stale structure state"},
    422: {"model": dto.ApiError, "description": "Validation error or missing_factors"},
    500: {"model": dto.ApiError, "description": "Engine or server error"},
    501: {"model": dto.ApiError, "description": "Contract stub; not implemented"},
    "4XX": {"model": dto.ApiError, "description": "Other client error"},
    "5XX": {"model": dto.ApiError, "description": "Other server error"},
}


def _not_implemented() -> NoReturn:
    """Raise the same documented error from every unimplemented workflow."""
    error = dto.ApiError(code="not_implemented", message="This operation is not implemented.")
    raise HTTPException(status_code=501, detail=error.model_dump(mode="json"))


meta = APIRouter(tags=["meta"], responses=ERROR_RESPONSES)
project = APIRouter(tags=["project"], responses=ERROR_RESPONSES)
investigations = APIRouter(tags=["investigations"], responses=ERROR_RESPONSES)
processed = APIRouter(tags=["processed"], responses=ERROR_RESPONSES)
layering = APIRouter(tags=["layering"], responses=ERROR_RESPONSES)
profiles = APIRouter(tags=["profiles"], responses=ERROR_RESPONSES)
parameters = APIRouter(tags=["parameters"], responses=ERROR_RESPONSES)
structures = APIRouter(tags=["structures"], responses=ERROR_RESPONSES)
walls = APIRouter(tags=["walls"], responses=ERROR_RESPONSES)
jobs = APIRouter(tags=["jobs"], responses=ERROR_RESPONSES)
sheet_pile = APIRouter(tags=["sheet_pile"], responses=ERROR_RESPONSES)
liquefaction = APIRouter(tags=["liquefaction"], responses=ERROR_RESPONSES)
codes = APIRouter(tags=["codes"], responses=ERROR_RESPONSES)


@meta.get("/health", response_model=dto.HealthResponse, operation_id="get_health")
def get_health() -> dto.HealthResponse:
    """Report availability and the HTTP contract version."""
    return dto.HealthResponse(status="ok", version=API_VERSION)


@meta.get("/i18n/{lang}", response_model=dict[str, str], operation_id="get_i18n")
def get_i18n(lang: dto.Language) -> NoReturn:
    """Return the flat translation key-to-string catalog in the selected language."""
    _not_implemented()


@project.post("/project/new", response_model=dto.ProjectSummary, operation_id="new_project")
def new_project(payload: dto.ProjectNew) -> NoReturn:
    """Create a project with the requested name and language."""
    _not_implemented()


@project.post("/project/open", response_model=dto.ProjectSummary, operation_id="open_project")
def open_project(payload: dto.ProjectOpen) -> NoReturn:
    """Open a local project file."""
    _not_implemented()


@project.post("/project/save", response_model=dto.ProjectSaved, operation_id="save_project")
def save_project(payload: dto.ProjectSave) -> NoReturn:
    """Save to the supplied path or the project's current file."""
    _not_implemented()


@project.get("/project", response_model=dto.ProjectSummary, operation_id="get_project")
def get_project() -> NoReturn:
    """Return the current project summary."""
    _not_implemented()


@project.patch("/project/meta", response_model=ProjectMeta, operation_id="update_project_meta")
def update_project_meta(payload: dto.ProjectMetaPatch) -> NoReturn:
    """Update supplied metadata fields; omission preserves the existing value."""
    _not_implemented()


@project.put("/project/site", response_model=SiteSeismic, operation_id="set_project_site")
def set_project_site(payload: SiteSeismic) -> NoReturn:
    """Replace site seismic settings."""
    _not_implemented()


@project.put(
    "/project/active-profile", response_model=dto.ProjectSummary,
    operation_id="set_active_profile",
)
def set_active_profile(payload: dto.ActiveProfileUpdate) -> NoReturn:
    """Select the profile used for investigation processing and liquefaction."""
    _not_implemented()


@investigations.get(
    "/investigations", response_model=dto.InvestigationsDTO, operation_id="list_investigations",
)
def list_investigations() -> NoReturn:
    """List raw borehole and CPT records."""
    _not_implemented()


def _multipart_body(identifier: str, *, cpt: bool = False) -> dict[str, Any]:
    """Describe required multipart parts without importing python-multipart."""
    properties: dict[str, Any] = {
        "file": {"type": "string", "format": "binary", "description": "Investigation file"},
        identifier: {"type": "string", "description": "Investigation id assigned at import"},
    }
    if cpt:
        properties.update({
            "qc_unit": {"type": "string", "enum": ["MPa", "kPa"]},
            "delimiter": {"type": "string", "minLength": 1},
            "decimal": {"type": "string", "minLength": 1},
        })
    return {"requestBody": {
        "required": True,
        "content": {"multipart/form-data": {"schema": {
            "type": "object", "properties": properties, "required": list(properties),
            "additionalProperties": False,
        }}},
    }}


@investigations.post(
    "/import/cpt", response_model=CPTSounding, operation_id="import_cpt",
    openapi_extra=_multipart_body("sounding_id", cpt=True),
)
def import_cpt(request: Request) -> NoReturn:
    """Import multipart file, sounding_id, qc_unit, delimiter and decimal form parts.

    qc_unit applies to the file's cone resistance; stored sounding stresses are kPa.
    The stub deliberately does not parse uploads or require python-multipart.
    """
    _not_implemented()


@investigations.post(
    "/import/spt", response_model=Borehole, operation_id="import_spt",
    openapi_extra=_multipart_body("borehole_id"),
)
def import_spt(request: Request) -> NoReturn:
    """Import multipart file and borehole_id form parts."""
    _not_implemented()


@investigations.put("/boreholes/{id}", response_model=Borehole, operation_id="update_borehole")
def update_borehole(id: str, payload: Borehole) -> NoReturn:
    """Replace a borehole; the body id must identify the path resource."""
    _not_implemented()


@investigations.delete(
    "/boreholes/{id}", response_model=dto.DeletionResponse, operation_id="delete_borehole",
)
def delete_borehole(id: str) -> NoReturn:
    """Delete a borehole and return a JSON acknowledgement."""
    _not_implemented()


@investigations.put(
    "/boreholes/{id}/log", response_model=Borehole, operation_id="set_borehole_log",
)
def set_borehole_log(id: str, payload: list[BoreholeLayer]) -> NoReturn:
    """Replace the complete borehole log using a JSON array."""
    _not_implemented()


@investigations.put("/cpts/{id}", response_model=CPTSounding, operation_id="update_cpt")
def update_cpt(id: str, payload: CPTSounding) -> NoReturn:
    """Replace a CPT sounding; the body id must identify the path resource."""
    _not_implemented()


@investigations.delete("/cpts/{id}", response_model=dto.DeletionResponse, operation_id="delete_cpt")
def delete_cpt(id: str) -> NoReturn:
    """Delete a CPT sounding and return a JSON acknowledgement."""
    _not_implemented()


@processed.get(
    "/cpts/{id}/processed", response_model=dto.CPTProcessedDTO, operation_id="get_processed_cpt",
)
def get_processed_cpt(id: str) -> NoReturn:
    """Return processed CPT chart data with null samples for non-finite values."""
    _not_implemented()


@processed.get(
    "/boreholes/{id}/processed", response_model=dto.SPTProcessedDTO,
    operation_id="get_processed_spt",
)
def get_processed_spt(id: str) -> NoReturn:
    """Return corrected SPT chart data."""
    _not_implemented()


@layering.post(
    "/layering/cpt/{cpt_id}", response_model=dto.LayeringProposal,
    operation_id="propose_cpt_layers",
)
def propose_cpt_layers(cpt_id: str, payload: LayeringSettings) -> NoReturn:
    """Return a synchronous, unapproved CPT layering proposal."""
    _not_implemented()


@layering.post(
    "/layering/spt/{borehole_id}", response_model=dto.LayeringProposal,
    operation_id="propose_spt_layers",
)
def propose_spt_layers(borehole_id: str, payload: LayeringSettings) -> NoReturn:
    """Return a synchronous, unapproved SPT layering proposal."""
    _not_implemented()


@profiles.get("/profiles", response_model=list[dto.ProfileSummary], operation_id="list_profiles")
def list_profiles() -> NoReturn:
    """List profiles available for selection or copying into structures."""
    _not_implemented()


@profiles.post("/profiles", response_model=SoilProfile, operation_id="create_profile")
def create_profile(payload: dto.ProfileCreate) -> NoReturn:
    """Create from explicit layers or a proposal; assign profile and layer ids server-side."""
    _not_implemented()


@profiles.get("/profiles/{id}", response_model=SoilProfile, operation_id="get_profile")
def get_profile(id: str) -> NoReturn:
    """Return a complete project soil profile."""
    _not_implemented()


@profiles.put("/profiles/{id}", response_model=SoilProfile, operation_id="update_profile")
def update_profile(id: str, payload: SoilProfile) -> NoReturn:
    """Replace a profile; the body id must identify the path resource."""
    _not_implemented()


@profiles.delete(
    "/profiles/{id}", response_model=dto.DeletionResponse, operation_id="delete_profile",
)
def delete_profile(id: str) -> NoReturn:
    """Delete a project profile and return a JSON acknowledgement."""
    _not_implemented()


@profiles.post(
    "/profiles/{id}/layers/{layer_id}/split", response_model=SoilProfile,
    operation_id="split_layer",
)
def split_layer(id: str, layer_id: str, payload: dto.LayerSplit) -> NoReturn:
    """Split the selected layer at an absolute depth below ground."""
    _not_implemented()


@profiles.post(
    "/profiles/{id}/layers/merge", response_model=SoilProfile, operation_id="merge_layers",
)
def merge_layers(id: str, payload: dto.LayerMerge) -> NoReturn:
    """Merge two adjacent layers in the selected profile."""
    _not_implemented()


@parameters.get(
    "/profiles/{id}/layers/{layer_id}/parameters", response_model=list[ParameterSelection],
    operation_id="list_layer_parameters",
)
def list_layer_parameters(id: str, layer_id: str) -> NoReturn:
    """Return parameter selections and candidates evaluated on the server."""
    _not_implemented()


@parameters.put(
    "/profiles/{id}/layers/{layer_id}/parameters/{key}", response_model=ParameterSelection,
    operation_id="update_parameter_selection",
)
def update_parameter_selection(
    id: str, layer_id: str, key: DesignKey, payload: dto.SelectionUpdate,
) -> NoReturn:
    """Choose a method, statistic or manual value without approving it."""
    _not_implemented()


@parameters.post(
    "/profiles/{id}/layers/{layer_id}/parameters/approve", response_model=SoilLayer,
    operation_id="approve_parameters",
)
def approve_parameters(id: str, layer_id: str, payload: dto.ParameterApproval) -> NoReturn:
    """Approve only the explicitly listed design quantities."""
    _not_implemented()


@parameters.post(
    "/profiles/{id}/parameters/suggest-all", response_model=SoilProfile,
    operation_id="suggest_all_parameters",
)
def suggest_all_parameters(id: str) -> NoReturn:
    """Fill parameter suggestions throughout a profile; approve nothing."""
    _not_implemented()


@structures.get(
    "/structures", response_model=list[dto.StructureSummary], operation_id="list_structures",
)
def list_structures() -> NoReturn:
    """List structures and their soil/result freshness state."""
    _not_implemented()


@structures.post("/structures", response_model=Structure, operation_id="create_structure")
def create_structure(
    payload: Annotated[dto.StructureCreate, Body(discriminator="kind")],
) -> NoReturn:
    """Create a wall or sheet pile with its own soil copy; choose the variant by kind."""
    _not_implemented()


@structures.get("/structures/{id}", response_model=Structure, operation_id="get_structure")
def get_structure(id: str) -> NoReturn:
    """Return a complete structure, discriminated by kind."""
    _not_implemented()


@structures.put("/structures/{id}", response_model=Structure, operation_id="update_structure")
def update_structure(
    id: str, payload: Annotated[Structure, Body(discriminator="kind")],
) -> NoReturn:
    """Replace a structure; the body id must identify the path resource."""
    _not_implemented()


@structures.delete(
    "/structures/{id}", response_model=dto.DeletionResponse, operation_id="delete_structure",
)
def delete_structure(id: str) -> NoReturn:
    """Delete a structure and return a JSON acknowledgement."""
    _not_implemented()


@structures.put(
    "/structures/{id}/soil", response_model=Structure, operation_id="set_structure_soil",
)
def set_structure_soil(id: str, payload: StructureSoilModel) -> NoReturn:
    """Replace the structure-specific soil model."""
    _not_implemented()


@structures.post(
    "/structures/{id}/soil/resync", response_model=Structure, operation_id="resync_structure_soil",
)
def resync_structure_soil(id: str) -> NoReturn:
    """Re-copy soil from the structure's source project profile."""
    _not_implemented()


@walls.post(
    "/structures/{id}/required-factors", response_model=list[dto.MissingFactorDTO],
    operation_id="get_structure_required_factors",
)
def get_structure_required_factors(id: str) -> NoReturn:
    """List missing design factors for this structure's selected workflow."""
    _not_implemented()


@walls.post(
    "/structures/{id}/size", response_model=dto.JobRef, status_code=202, operation_id="size_wall",
)
def size_wall(id: str) -> NoReturn:
    """Queue wall_size; poll the job for WallResultDTO including proposed geometry."""
    _not_implemented()


@walls.post(
    "/structures/{id}/check", response_model=dto.JobRef, status_code=202, operation_id="check_wall",
)
def check_wall(id: str) -> NoReturn:
    """Queue wall_check; poll the job for WallResultDTO."""
    _not_implemented()


@jobs.get("/jobs/{job_id}", response_model=dto.JobState, operation_id="get_job")
def get_job(job_id: str) -> NoReturn:
    """Poll status, progress, step translation key, result or error."""
    _not_implemented()


@jobs.delete("/jobs/{job_id}", response_model=dto.JobState, operation_id="cancel_job")
def cancel_job(job_id: str) -> NoReturn:
    """Request cancellation and return the resulting job state."""
    _not_implemented()


@sheet_pile.post(
    "/structures/{id}/design", response_model=dto.JobRef, status_code=202,
    operation_id="design_sheet_pile",
)
def design_sheet_pile(id: str) -> NoReturn:
    """Queue sheet_pile; poll the job for SheetPileResultDTO."""
    _not_implemented()


@liquefaction.post(
    "/liquefaction", response_model=dto.JobRef, status_code=202, operation_id="run_liquefaction",
)
def run_liquefaction(payload: dto.LiquefactionSettingsDTO) -> NoReturn:
    """Queue liquefaction for the project investigations; poll for LiquefactionResultDTO."""
    _not_implemented()


@codes.get("/codes", response_model=list[dto.DesignCodeSummary], operation_id="list_codes")
def list_codes() -> NoReturn:
    """List design codes in the project language and their named approaches."""
    _not_implemented()


@codes.get(
    "/codes/{code_id}/factors", response_model=list[dto.FactorRowDTO],
    operation_id="list_code_factors",
)
def list_code_factors(code_id: str) -> NoReturn:
    """Return code factor values and their provenance."""
    _not_implemented()


@codes.get(
    "/codes/{code_id}/required", response_model=list[dto.MissingFactorDTO],
    operation_id="get_code_required_factors",
)
def get_code_required_factors(
    code_id: str, approach: str | None = None, seismic: bool = False,
) -> NoReturn:
    """List missing factors for the selected approach and seismic/static case."""
    _not_implemented()


@codes.put(
    "/project/design-overrides/{code_id}", response_model=dict[str, FactorOverride],
    operation_id="set_design_overrides",
)
def set_design_overrides(code_id: str, payload: dict[str, FactorOverride]) -> NoReturn:
    """Replace the project's user factor overrides for one design code."""
    _not_implemented()


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

    for router in (
        meta, project, investigations, processed, layering, profiles, parameters,
        structures, walls, jobs, sheet_pile, liquefaction, codes,
    ):
        app.include_router(router, prefix="/api")
    return app
