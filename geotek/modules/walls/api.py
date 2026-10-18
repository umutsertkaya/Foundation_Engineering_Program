"""Retaining wall metadata, preflight and background calculation routes."""

from __future__ import annotations

from fastapi import APIRouter

from geotek.api import schemas as dto
from geotek.api.common import ERROR_RESPONSES
from geotek.api.calculation_jobs import SessionDep, require_structure, submit_structure
from geotek.api.jobs import RunnerDep, raise_service_error
from geotek.modules.walls.schemas import WallTypeInfo
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

    return api
