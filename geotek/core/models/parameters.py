"""Traceable derived parameters: every value carries its method, source and validity."""

from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field, model_validator

Source = Literal["SPT", "CPT", "lab", "user", "combined"]
Reliability = Literal["A", "B", "C"]
SelectionMode = Literal["correlation", "statistic", "manual"]
Statistic = Literal["mean", "median", "min", "max", "mean_minus_k_sd"]
DesignKey = Literal["phi_eff", "c_eff", "su", "E", "gamma", "gamma_sat", "delta_base"]
"""Layer quantities the engineer selects and approves (DesignParameters fields plus unit weights)."""


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


class ParameterSelection(BaseModel):
    """Engineer's choice for one quantity of one layer, with the candidates it was made from.

    ``candidates`` holds one entry per applicable correlation (or lab/user source), each a
    layer-representative value whose ``stats`` give the spread over the depth points inside
    the layer. ``suggested`` is the program's proposal. The engineer picks a correlation, a
    statistic over the candidates, or enters a value; ``selected`` is the resolved value with
    its trace. Only approved selections are written to ``SoilLayer.design``.
    """

    parameter: DesignKey
    candidates: list[DerivedParameter] = Field(default_factory=list)
    suggested: DerivedParameter | None = None
    mode: SelectionMode | None = None
    method_id: str | None = None
    """Chosen candidate (mode 'correlation')."""
    statistic: Statistic | None = None
    """Statistic over valid candidates (mode 'statistic')."""
    k_sd: float | None = Field(None, ge=0)
    """User-entered k for 'mean_minus_k_sd'; never defaulted by the program."""
    manual_value: float | None = None
    selected: DerivedParameter | None = None
    approved: bool = False
    approved_at: dt.datetime | None = None
    basis_hash: str | None = None
    """Fingerprint of the layer bounds and inputs at approval; a mismatch marks it stale."""

    @model_validator(mode="after")
    def _check(self) -> ParameterSelection:
        if self.statistic == "mean_minus_k_sd" and self.k_sd is None:
            raise ValueError("mean_minus_k_sd needs a user-entered k_sd")
        if self.approved and (self.selected is None or self.approved_at is None or self.basis_hash is None):
            raise ValueError("An approved selection needs selected, approved_at and basis_hash")
        return self
