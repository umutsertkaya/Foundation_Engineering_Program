"""Field and laboratory investigation records (raw input data, SI units)."""

from __future__ import annotations

from typing import Literal

import numpy as np
from pydantic import BaseModel, Field, field_validator, model_validator


class SPTRecord(BaseModel):
    depth: float = Field(gt=0, description="Test depth [m]")
    n_field: int = Field(ge=0, description="Field blow count N (blows/300 mm)")
    refusal: bool = False
    """True when the test was stopped at refusal (N is then a lower bound)."""
    notes: str = ""


class LabRecord(BaseModel):
    depth: float = Field(ge=0, description="Sample depth [m]")
    w: float | None = Field(None, ge=0, description="Water content [%]")
    LL: float | None = Field(None, ge=0, description="Liquid limit [%]")
    PL: float | None = Field(None, ge=0, description="Plastic limit [%]")
    PI: float | None = Field(None, ge=0, description="Plasticity index [%]")
    gravel: float | None = Field(None, ge=0, le=100, description="Retained on No.4 sieve [%]")
    FC: float | None = Field(None, ge=0, le=100, description="Fines content, passing No.200 [%]")
    D10: float | None = Field(None, gt=0, description="[mm]")
    D30: float | None = Field(None, gt=0, description="[mm]")
    D60: float | None = Field(None, gt=0, description="[mm]")
    gamma: float | None = Field(None, gt=0, description="Unit weight [kN/m3]")
    c_eff: float | None = Field(None, ge=0, description="Effective cohesion [kPa]")
    phi_eff: float | None = Field(None, ge=0, le=60, description="Effective friction angle [deg]")
    su: float | None = Field(None, ge=0, description="Undrained shear strength [kPa]")

    @model_validator(mode="after")
    def _plasticity_index(self) -> LabRecord:
        if self.LL is not None and self.PL is not None:
            if self.PL > self.LL:
                raise ValueError(f"PL ({self.PL}) cannot exceed LL ({self.LL})")
            pi = self.LL - self.PL
            if self.PI is None:
                self.PI = pi
            elif abs(self.PI - pi) > 1.0:
                raise ValueError(f"PI ({self.PI}) inconsistent with LL - PL ({pi})")
        return self


class Borehole(BaseModel):
    id: str
    x: float | None = None
    y: float | None = None
    elevation: float | None = Field(None, description="Ground surface elevation [m]")
    gwt_depth: float | None = Field(None, ge=0, description="Measured groundwater depth [m]")
    energy_ratio: float = Field(60.0, gt=0, le=100, description="Hammer energy ratio ER [%]")
    borehole_diameter_mm: float = Field(100.0, gt=0)
    sampler: Literal["standard", "no_liner"] = "standard"
    spt: list[SPTRecord] = Field(default_factory=list)
    lab: list[LabRecord] = Field(default_factory=list)

    @field_validator("spt")
    @classmethod
    def _sorted_unique_depths(cls, records: list[SPTRecord]) -> list[SPTRecord]:
        records = sorted(records, key=lambda r: r.depth)
        depths = [r.depth for r in records]
        if len(set(depths)) != len(depths):
            raise ValueError("Duplicate SPT depths in borehole")
        return records


class CPTSounding(BaseModel):
    """CPT(u) record. Stresses stored in kPa (convert MPa at import)."""

    id: str
    x: float | None = None
    y: float | None = None
    elevation: float | None = None
    gwt_depth: float | None = Field(None, ge=0)
    area_ratio: float = Field(0.80, gt=0, le=1.0, description="Cone net area ratio a")
    predrill_depth: float = Field(0.0, ge=0)
    depth: list[float]
    qc: list[float]
    fs: list[float]
    u2: list[float] | None = None

    @model_validator(mode="after")
    def _check_arrays(self) -> CPTSounding:
        n = len(self.depth)
        if n == 0:
            raise ValueError("CPT sounding has no data")
        for name in ("qc", "fs") + (("u2",) if self.u2 is not None else ()):
            if len(getattr(self, name)) != n:
                raise ValueError(f"CPT column {name!r} length differs from depth")
        if np.any(np.diff(self.depth) <= 0):
            raise ValueError("CPT depths must be strictly increasing")
        if self.depth[0] < 0:
            raise ValueError("CPT depths must be non-negative")
        if min(self.qc) < 0 or min(self.fs) < 0:
            raise ValueError("qc and fs must be non-negative")
        return self

    def arrays(self) -> dict[str, np.ndarray]:
        out = {k: np.asarray(getattr(self, k), dtype=float) for k in ("depth", "qc", "fs")}
        if self.u2 is not None:
            out["u2"] = np.asarray(self.u2, dtype=float)
        return out


class Investigations(BaseModel):
    boreholes: list[Borehole] = Field(default_factory=list)
    cpts: list[CPTSounding] = Field(default_factory=list)

    @model_validator(mode="after")
    def _unique_ids(self) -> Investigations:
        ids = [b.id for b in self.boreholes] + [c.id for c in self.cpts]
        if len(set(ids)) != len(ids):
            raise ValueError("Borehole/CPT ids must be unique")
        return self
