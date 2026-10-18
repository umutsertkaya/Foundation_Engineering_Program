"""Retaining wall routes, mounted at /api/m/walls; all bodies are 501 stubs."""

from __future__ import annotations

from typing import NoReturn

from fastapi import APIRouter

from geotek.api import schemas as dto
from geotek.api.common import ERROR_RESPONSES, not_implemented
from geotek.modules.walls.schemas import WallTypeInfo


def router() -> APIRouter:
    """Build a fresh router; the registry adds the prefix and module tag."""
    api = APIRouter(responses=ERROR_RESPONSES)

    @api.get("/wall-types", response_model=list[WallTypeInfo], operation_id="list_wall_types")
    def list_wall_types() -> NoReturn:
        """List selectable retaining wall types."""
        not_implemented()

    @api.post(
        "/structures/{id}/required-factors", response_model=list[dto.MissingFactorDTO],
        operation_id="get_structure_required_factors",
    )
    def get_structure_required_factors(id: str) -> NoReturn:
        """List missing design factors for this structure's selected workflow."""
        not_implemented()

    @api.post(
        "/structures/{id}/size", response_model=dto.JobRef, status_code=202,
        operation_id="size_wall",
    )
    def size_wall(id: str) -> NoReturn:
        """Queue wall_size; poll the job for WallResultDTO including proposed geometry."""
        not_implemented()

    @api.post(
        "/structures/{id}/check", response_model=dto.JobRef, status_code=202,
        operation_id="check_wall",
    )
    def check_wall(id: str) -> NoReturn:
        """Queue wall_check; poll the job for WallResultDTO."""
        not_implemented()

    return api
