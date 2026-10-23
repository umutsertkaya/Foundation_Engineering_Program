"""Retaining wall metadata, preflight and background calculation routes."""

from __future__ import annotations

from fastapi import APIRouter

from geotek.api import schemas as dto
from geotek.api.common import ERROR_RESPONSES
from geotek.api.calculation_jobs import SessionDep, require_structure, submit_structure
from geotek.api.jobs import RunnerDep, raise_service_error
from geotek.api.session import api_error
from geotek.core.errors import GeoTekError
from geotek.modules.walls.schemas import AtRestResultDTO, WallTypeInfo
from geotek.services.at_rest import AtRestInput, at_rest_analysis
from geotek.services.structures import required_factors


def router() -> APIRouter:
    """Build a fresh router; the registry adds the prefix and module tag."""
    api = APIRouter(responses=ERROR_RESPONSES)

    @api.get("/wall-types", response_model=list[WallTypeInfo], operation_id="list_wall_types")
    def list_wall_types() -> list[WallTypeInfo]:
        """List selectable retaining wall types."""
        return [WallTypeInfo(id="cantilever", title_key="walls.type.cantilever"),
                WallTypeInfo(id="gravity", title_key="walls.type.gravity")]

    @api.post(
        "/structures/{id}/required-factors", response_model=list[dto.MissingFactorDTO],
        operation_id="get_structure_required_factors",
    )
    def get_structure_required_factors(id: str, session: SessionDep) -> list[dto.MissingFactorDTO]:
        """List missing design factors for this structure's selected workflow."""
        with session.lock:
            project = session.require_project()
            require_structure(project, id, "retaining_wall")
            try:
                return [dto.MissingFactorDTO.model_validate(item)
                        for item in required_factors(project, id)]
            except Exception as exc:
                raise_service_error(exc)

    @api.post(
        "/structures/{id}/size", response_model=dto.JobRef, status_code=202,
        operation_id="size_wall",
    )
    def size_wall(id: str, session: SessionDep, runner: RunnerDep) -> dto.JobRef:
        """Queue wall_size; poll the job for WallResultDTO including proposed geometry."""
        return submit_structure(session, runner, id, "wall_size")

    @api.post(
        "/structures/{id}/check", response_model=dto.JobRef, status_code=202,
        operation_id="check_wall",
    )
    def check_wall(id: str, session: SessionDep, runner: RunnerDep) -> dto.JobRef:
        """Queue wall_check; poll the job for WallResultDTO."""
        return submit_structure(session, runner, id, "wall_check")

    @api.post("/at-rest", response_model=AtRestResultDTO, operation_id="analyze_at_rest")
    def analyze_at_rest(body: AtRestInput, session: SessionDep) -> AtRestResultDTO:
        """At-rest (K0) pressure on a wall of height H through a soil profile (Das)."""
        with session.lock:
            project = session.require_project()
            try:
                return AtRestResultDTO.model_validate(at_rest_analysis(project, body))
            except KeyError:
                api_error(404, "not_found", f"Soil profile {body.profile_id!r} not found.")
            except GeoTekError as exc:
                details = ({"message_code": exc.message_code, "params": exc.message_params or {}}
                           if exc.message_code else {})
                api_error(422, "engine_error", str(exc), **details)

    return api
