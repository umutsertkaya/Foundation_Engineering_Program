"""Traceable derived parameters: every value carries its method, source and validity."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Source = Literal["SPT", "CPT", "lab", "user", "combined"]
Reliability = Literal["A", "B", "C"]


class ParameterStats(BaseModel):
    """Spread when several correlations were evaluated for the same parameter."""

    n: int = Field(ge=1)
    min: float
    mean: float
    max: float


class DerivedParameter(BaseModel):
    value: float
    unit: str
    method_id: str
    """Correlation registry id, e.g. ``"KM1990_phi_SPT"``; ``"user"`` for manual entry."""
    reference: str = ""
    source: Source
    inputs_used: dict[str, float] = Field(default_factory=dict)
    validity_ok: bool = True
    """False when an input lies outside the correlation's stated range."""
    warnings: list[str] = Field(default_factory=list)
    reliability: Reliability | None = None
    stats: ParameterStats | None = None
    user_override: bool = False
