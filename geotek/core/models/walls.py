"""Retaining wall input models (SI units, angles in degrees).

Coordinate frame for all wall calculations: origin at the bottom of the toe (front-bottom
corner of the base), x toward the retained soil, y up.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from geotek.config.codes import FactorOverride


class Backfill(BaseModel):
    """Retained (drained) backfill. Water behind the wall is not modelled: drainage assumed."""

    gamma: float = Field(gt=5, lt=30)
    phi: float = Field(gt=0, lt=50)
    delta: float | None = Field(None, ge=0, lt=50)
    """Wall friction on the back face (gravity walls). Default 2/3 phi."""
    slope: float = Field(0.0, ge=0, lt=45, description="Backfill slope beta")

    @model_validator(mode="after")
    def _check(self) -> Backfill:
        if self.slope > self.phi:
            raise ValueError("Backfill slope cannot exceed phi")
        return self


class FoundationSoil(BaseModel):
    """Soil below the base. ``gamma`` is the effective unit weight for the N_gamma term and
    ``overburden`` the effective vertical stress at base level on the toe side."""

    drainage: Literal["drained", "undrained"] = "drained"
    phi: float = Field(0.0, ge=0, lt=50)
    c: float = Field(0.0, ge=0)
    su: float | None = Field(None, gt=0)
    gamma: float = Field(gt=0, lt=30)
    overburden: float = Field(0.0, ge=0)
    delta_base: float | None = Field(None, ge=0, lt=50)
    """Base-soil interface friction angle; defaults to phi (cast-in-place concrete)."""
    adhesion: float = Field(0.0, ge=0)
    """Base adhesion c_a for drained sliding [kPa]."""

    @model_validator(mode="after")
    def _check(self) -> FoundationSoil:
        if self.drainage == "undrained" and self.su is None:
            raise ValueError("Undrained foundation needs s_u")
        if self.drainage == "drained" and self.phi == 0 and self.c == 0:
            raise ValueError("Drained foundation needs phi or c")
        return self


class CantileverGeometry(BaseModel):
    """Reinforced concrete cantilever wall; stem back face vertical, front face battered."""

    stem_height: float = Field(gt=0, description="From top of base to top of stem")
    stem_top: float = Field(gt=0)
    stem_bottom: float = Field(gt=0)
    toe: float = Field(ge=0, description="Toe projection in front of the stem")
    heel: float = Field(gt=0, description="Heel projection behind the stem")
    base_thickness: float = Field(gt=0)
    embedment: float = Field(0.0, ge=0, description="Front soil level above base bottom (D)")

    @model_validator(mode="after")
    def _check(self) -> CantileverGeometry:
        if self.stem_top > self.stem_bottom:
            raise ValueError("stem_top must not exceed stem_bottom")
        return self

    @property
    def width(self) -> float:
        return self.toe + self.stem_bottom + self.heel

    @property
    def height(self) -> float:
        return self.base_thickness + self.stem_height

    @property
    def x_stem_back(self) -> float:
        return self.toe + self.stem_bottom


class GravityGeometry(BaseModel):
    """Trapezoidal gravity wall: base width B, top width, back face offset at the top."""

    height: float = Field(gt=0)
    base_width: float = Field(gt=0)
    top_width: float = Field(gt=0)
    back_offset: float = Field(0.0, ge=0, description="Horizontal set-back of the back face top from the heel")
    embedment: float = Field(0.0, ge=0)

    @model_validator(mode="after")
    def _check(self) -> GravityGeometry:
        if self.top_width + self.back_offset > self.base_width + 1e-9:
            raise ValueError("Front face would overhang the toe (top_width + back_offset > base_width)")
        return self

    @property
    def width(self) -> float:
        return self.base_width


class WallLoads(BaseModel):
    surcharge: float = Field(0.0, ge=0, description="Uniform vertical surcharge on the backfill [kPa]")
    surcharge_resists: bool = False
    """Count surcharge over the heel as a stabilising load (usually not, for live load)."""
    kh: float = Field(0.0, ge=0, lt=1)
    kv: float = Field(0.0, gt=-1, lt=1)
    seismic_increment_height: float = Field(0.6, gt=0, lt=1)
    """Height of the seismic thrust increment as a fraction of H (Seed & Whitman: 0.6)."""


class WallSettings(BaseModel):
    uplift_moment: Literal["overturning", "resisting"] = "overturning"
    """Put base uplift in overturning demand (safe default), or deduct it from resistance."""
    gwt_bearing_correction: bool = True
    """Interpolate the drained N_gamma unit weight for groundwater within B below the base."""
    design_code: str = "asd"
    bearing_method: Literal["meyerhof", "hansen", "vesic"] = "vesic"
    use_passive: bool = False
    passive_reduction: float = Field(0.5, gt=0, le=1)
    """Fraction of Rankine passive resistance in front of the toe used for sliding."""
    include_toe_soil: bool = False
    concrete_unit_weight: float = Field(24.0, gt=15, lt=30)
    foundation_on: Literal["soil", "rock"] = "soil"
    factor_overrides: dict[str, FactorOverride] = Field(default_factory=dict)
    """User values for design code factors, keyed by factor path (e.g.
    'TBDY-seismic.material.tan_phi'); they are labelled 'Kullanıcı girdisi' in results."""
