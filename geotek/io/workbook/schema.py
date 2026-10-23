"""Import plan: what the analyser found and what the engineer must still decide."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Role = Literal["cpt", "spt", "samples", "sieve", "limits", "cu_setup", "cu_curves"]
UnitSource = Literal["header", "inferred", "default", "user"]
Severity = Literal["blocker", "confirm", "info"]


class ColumnMap(BaseModel):
    header: str
    """Header text exactly as in the file."""
    unit: str | None = None
    unit_source: UnitSource = "default"


class SheetPlan(BaseModel):
    name: str
    role: Role | None = None
    """None: the sheet is ignored."""
    confidence: float = 0.0
    header_row: int = Field(0, ge=0)
    """0-based row index of the header within the sheet."""
    row_count: int = Field(0, ge=0)
    columns: dict[str, ColumnMap] = Field(default_factory=dict)
    """Canonical field name -> file column."""


class ImportIssue(BaseModel):
    code: str
    """Translatable key ``import.issue.<name>``; ``params`` fill its placeholders."""
    severity: Severity
    sheet: str | None = None
    field: str | None = None
    params: dict[str, str | float | int | None] = Field(default_factory=dict)


class ImportOptions(BaseModel):
    borehole_id: str | None = None
    """Borehole that receives SPT rows (and samples) without their own id column."""
    cpt_id: str | None = None
    sampler_map: dict[str, Literal["standard", "no_liner"] | None] = Field(default_factory=dict)
    """Sampler description in the file -> sampler type. None is an unanswered question."""
    sampler_suggestions: dict[str, Literal["standard", "no_liner"]] = Field(default_factory=dict)
    energy_ratio_scale: Literal["percent", "fraction"] | None = None
    water_content_scale: Literal["percent", "fraction"] | None = None
    u2_zero_is_missing: bool = True
    """An all-zero u2 column means 'not measured'."""
    cu_failure: Literal["max_stress_ratio", "max_q", "strain_limit"] = "max_stress_ratio"
    cu_strain_limit: float = Field(15.0, gt=0)


class ImportPlan(BaseModel):
    filename: str
    sheets: list[SheetPlan] = Field(default_factory=list)
    options: ImportOptions = Field(default_factory=ImportOptions)
    issues: list[ImportIssue] = Field(default_factory=list)

    def blockers(self) -> list[ImportIssue]:
        return [i for i in self.issues if i.severity == "blocker"]
