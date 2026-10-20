"""Field and laboratory investigation records (raw input data, SI units)."""

from __future__ import annotations

from typing import Literal

import numpy as np
from pydantic import BaseModel, Field, field_validator, model_validator

from geotek.core.constants import DEPTH_TOL


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


USCS_SYMBOLS = frozenset({
    "GW", "GP", "GM", "GC", "SW", "SP", "SM", "SC", "ML", "CL", "OL", "MH", "CH", "OH", "PT",
    "GW-GM", "GW-GC", "GP-GM", "GP-GC", "SW-SM", "SW-SC", "SP-SM", "SP-SC", "GC-GM", "SC-SM", "CL-ML",
})
"""ASTM D2487 group symbols, including dual symbols."""


class BoreholeLayer(BaseModel):
    """One logged interval of a borehole (field description). Gaps between intervals are
    allowed (unlogged or no recovery); overlaps are not."""

    top: float = Field(ge=0, description="[m]")
    bottom: float = Field(gt=0, description="[m]")
    description: str = ""
    uscs: str | None = None
    """ASTM D2487 group symbol (validated against USCS_SYMBOLS) or None."""
    notes: str = ""

    @model_validator(mode="after")
    def _check(self) -> BoreholeLayer:
        if self.bottom <= self.top:
            raise ValueError(f"Log interval bottom ({self.bottom}) must exceed top ({self.top})")
        if self.uscs is not None:
            self.uscs = self.uscs.strip().upper()
            if self.uscs not in USCS_SYMBOLS:
                raise ValueError(f"Unknown USCS symbol {self.uscs!r}")
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
    log: list[BoreholeLayer] = Field(default_factory=list)

    @field_validator("log")
    @classmethod
    def _sorted_non_overlapping(cls, log: list[BoreholeLayer]) -> list[BoreholeLayer]:
        log = sorted(log, key=lambda r: r.top)
        for upper, lower in zip(log, log[1:]):
            if lower.top < upper.bottom - DEPTH_TOL:
                raise ValueError(f"Log intervals overlap at {lower.top} m")
        return log

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
        columns = ("depth", "qc", "fs") + (("u2",) if self.u2 is not None else ())
        if not all(np.isfinite(getattr(self, name)).all() for name in columns):
            raise ValueError("CPT columns must contain only finite numbers")
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
