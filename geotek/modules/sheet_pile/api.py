"""Sheet pile routes, mounted at /api/m/sheet_pile; all bodies are 501 stubs."""

from __future__ import annotations

from typing import NoReturn

from fastapi import APIRouter

from geotek.api import schemas as dto
from geotek.api.common import ERROR_RESPONSES, not_implemented


def router() -> APIRouter:
    """Build a fresh router; the registry adds the prefix and module tag."""
    api = APIRouter(responses=ERROR_RESPONSES)

    @api.post(
        "/structures/{id}/design", response_model=dto.JobRef, status_code=202,
        operation_id="design_sheet_pile",
    )
    def design_sheet_pile(id: str) -> NoReturn:
        """Queue sheet_pile; poll the job for SheetPileResultDTO."""
        not_implemented()

    return api
