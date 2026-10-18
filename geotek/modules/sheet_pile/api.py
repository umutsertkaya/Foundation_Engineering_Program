"""Sheet pile design jobs, mounted at /api/m/sheet_pile."""

from __future__ import annotations

from fastapi import APIRouter

from geotek.api import schemas as dto
from geotek.api.common import ERROR_RESPONSES
from geotek.api.calculation_jobs import SessionDep, submit_structure
from geotek.api.jobs import RunnerDep


def router() -> APIRouter:
    """Build a fresh router; the registry adds the prefix and module tag."""
    api = APIRouter(responses=ERROR_RESPONSES)

    @api.post(
        "/structures/{id}/design", response_model=dto.JobRef, status_code=202,
        operation_id="design_sheet_pile",
    )
    def design_sheet_pile(id: str, session: SessionDep, runner: RunnerDep) -> dto.JobRef:
        """Queue sheet_pile; poll the job for SheetPileResultDTO."""
        return submit_structure(session, runner, id, "sheet_pile")

    return api
