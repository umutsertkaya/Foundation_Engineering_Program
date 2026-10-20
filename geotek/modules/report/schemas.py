"""Report module DTOs."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from geotek.api.schemas import DTO, Language


class ReportSectionDTO(DTO):
    """One reportable block; ``status`` says whether its stored result is usable."""

    id: str
    kind: Literal["project", "soil_profile", "classification", "retaining_wall", "sheet_pile", "liquefaction"]
    name: str
    status: Literal["ready", "stale", "no_result"]


class ReportRequest(DTO):
    """Section ids to include; null means every section whose result is current."""

    sections: list[str] | None = Field(None, max_length=500)
    language: Language | None = None
    """Report language; null = the project language."""
