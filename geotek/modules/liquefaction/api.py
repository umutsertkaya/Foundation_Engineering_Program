"""Liquefaction routes, mounted at /api/m/liquefaction; all bodies are 501 stubs."""

from __future__ import annotations

from typing import NoReturn

from fastapi import APIRouter

from geotek.api import schemas as dto
from geotek.api.common import ERROR_RESPONSES, not_implemented
from geotek.modules.liquefaction.schemas import LiquefactionSettingsDTO


def router() -> APIRouter:
    """Build a fresh router; the registry adds the prefix and module tag."""
    api = APIRouter(responses=ERROR_RESPONSES)

    @api.post("/run", response_model=dto.JobRef, status_code=202, operation_id="run_liquefaction")
    def run_liquefaction(payload: LiquefactionSettingsDTO) -> NoReturn:
        """Queue liquefaction for the project investigations; poll for LiquefactionResultDTO."""
        not_implemented()

    return api
