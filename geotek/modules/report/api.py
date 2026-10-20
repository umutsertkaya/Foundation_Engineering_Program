"""Report routes, mounted at /api/m/report."""

from __future__ import annotations

import re

from fastapi import APIRouter, Response

from geotek.api.calculation_jobs import SessionDep
from geotek.api.common import ERROR_RESPONSES
from geotek.api.session import api_error
from geotek.modules.report.schemas import ReportRequest, ReportSectionDTO
from geotek.services import report as service

DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
_STATUS = {"unknown_section": 404, "no_result": 409, "stale_result": 409, "empty_selection": 422}


def _filename(name: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9_-]+", "_", name).strip("_") or "report"
    return f"{stem}_report.docx"


def router() -> APIRouter:
    """Build a fresh router; the registry adds the prefix and module tag."""
    api = APIRouter(responses=ERROR_RESPONSES)

    @api.get("/sections", response_model=list[ReportSectionDTO], operation_id="list_report_sections")
    def list_sections(session: SessionDep) -> list[ReportSectionDTO]:
        """List reportable sections with the state of their stored results."""
        with session.lock:
            project = session.require_project()
            return [ReportSectionDTO(id=s.id, kind=s.kind, name=s.name, status=s.status)
                    for s in service.list_sections(project)]

    @api.post(
        "/docx", operation_id="build_report_docx",
        responses={200: {"description": "Word document", "content": {
            DOCX_MEDIA_TYPE: {"schema": {"type": "string", "format": "binary"}}}}},
        response_class=Response,
    )
    def build_docx(payload: ReportRequest, session: SessionDep) -> Response:
        """Build the .docx from stored results; stale or missing results are refused.

        404 ``unknown_section``, 409 ``no_result`` / ``stale_result`` (details.sections lists
        the ids), 422 ``empty_selection``.
        """
        with session.lock:
            project = session.require_project()
            try:
                content = service.build_docx(project, payload.sections, payload.language)
            except service.ReportError as exc:
                api_error(_STATUS[exc.code], exc.code, str(exc), sections=exc.section_ids)
            name = project.meta.name
        return Response(
            content, media_type=DOCX_MEDIA_TYPE,
            headers={"Content-Disposition": f'attachment; filename="{_filename(name)}"'},
        )

    return api
