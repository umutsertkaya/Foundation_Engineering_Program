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


class ShearKey(BaseModel):
    """Concrete shear key (kayma dişi) cast under the base slab; a full-length strip, per metre of wall.

    ``position`` places the key under the toe, the middle of the base or the heel; ``width`` is its
    horizontal size and ``depth`` how far it projects below the base bottom.
    """

    position: Literal["toe", "middle", "heel"] = "heel"
    width: float = Field(gt=0, description="Horizontal size of the key [m]")
    depth: float = Field(gt=0, lt=10, description="Projection below the base bottom [m]")

    def span(self, base_width: float) -> tuple[float, float]:
        """(x_front, x_back) of the key in the wall frame (origin at the toe)."""
        if self.position == "toe":
            return 0.0, self.width
        if self.position == "heel":
            return base_width - self.width, base_width
        return (base_width - self.width) / 2, (base_width + self.width) / 2


def _check_key(key: ShearKey | None, width: float) -> None:
    if key is not None and key.width > width + 1e-9:
        raise ValueError("Shear key width cannot exceed the base width")


class CantileverGeometry(BaseModel):
    """Reinforced concrete cantilever wall; stem back face vertical, front face battered."""

    stem_height: float = Field(gt=0, description="From top of base to top of stem")
    stem_top: float = Field(gt=0)
    stem_bottom: float = Field(gt=0)
    toe: float = Field(ge=0, description="Toe projection in front of the stem")
    heel: float = Field(gt=0, description="Heel projection behind the stem")
    base_thickness: float = Field(gt=0)
    embedment: float = Field(0.0, ge=0, description="Front soil level above base bottom (D)")
    key: ShearKey | None = None

    @model_validator(mode="after")
    def _check(self) -> CantileverGeometry:
        if self.stem_top > self.stem_bottom:
            raise ValueError("stem_top must not exceed stem_bottom")
        _check_key(self.key, self.width)
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

    height: float = Field(gt=0, allow_inf_nan=False)
    base_width: float = Field(gt=0, allow_inf_nan=False)
    top_width: float = Field(gt=0, allow_inf_nan=False)
    back_offset: float = Field(0.0, ge=0, allow_inf_nan=False,
                               description="Horizontal set-back of the back face top from the heel")
    embedment: float = Field(0.0, ge=0, allow_inf_nan=False)
    key: ShearKey | None = None

    @model_validator(mode="after")
    def _check(self) -> GravityGeometry:
        if self.embedment >= self.height:
            raise ValueError("Embedment must be smaller than the wall height")
        if self.top_width + self.back_offset > self.base_width + 1e-9:
            raise ValueError("Front face would overhang the toe (top_width + back_offset > base_width)")
        _check_key(self.key, self.base_width)
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
    """Positive upward: thrust uses (1-kv), vertical wall inertia is +kv*W."""
    water_kh: float | None = Field(None, ge=0, description="0.4 S_DS, r=1 for TBDY Denk. 16.20")
    seismic_increment_height: float = Field(0.6, gt=0, lt=1)
    """Height of the seismic thrust increment as a fraction of H (Seed & Whitman: 0.6)."""


class WallSettings(BaseModel):
    kv_sign: Literal["envelope", "up", "down"] = "envelope"
    """TBDY 16.12.2.3: envelope both signs per check; up=+|kv|, down=-|kv|."""
    submerged_seismic: Literal["envelope", "impervious", "pervious", "by_permeability"] = "envelope"
    """TBDY 16.26: envelope maximises soil increment plus dynamic water thrust."""
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
