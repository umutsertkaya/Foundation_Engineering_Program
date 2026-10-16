"""SoilProfile: the object passed from Module 1 to Module 2."""

from __future__ import annotations

import hashlib
from typing import Literal

import numpy as np
from pydantic import BaseModel, Field, field_validator, model_validator

from geotek.core.constants import DEPTH_TOL
from geotek.core.errors import ProfileError
from geotek.core.models.parameters import DerivedParameter


class GroundwaterCondition(BaseModel):
    """Groundwater depths [m below ground]. Design and seismic default to in-situ."""

    depth_insitu: float = Field(ge=0)
    depth_design: float | None = Field(None, ge=0)
    """Long-term design level (e.g. for wall checks)."""
    depth_seismic: float | None = Field(None, ge=0)
    """Level during the earthquake (liquefaction)."""

    @model_validator(mode="after")
    def _defaults(self) -> GroundwaterCondition:
        if self.depth_design is None:
            self.depth_design = self.depth_insitu
        if self.depth_seismic is None:
            self.depth_seismic = self.depth_insitu
        return self

    def depth_for(self, case: Literal["insitu", "design", "seismic"]) -> float:
        return getattr(self, f"depth_{case}")


class DesignParameters(BaseModel):
    """Characteristic values confirmed by the engineer; Module 2 reads these."""

    phi_eff: float | None = Field(None, ge=0, le=60, description="[deg]")
    c_eff: float = Field(0.0, ge=0, description="[kPa]")
    su: float | None = Field(None, ge=0, description="[kPa]")
    E: float | None = Field(None, gt=0, description="[kPa]")
    delta_base: float | None = Field(None, ge=0, le=60, description="Base friction angle [deg]")


class SoilLayer(BaseModel):
    id: str
    top: float = Field(ge=0, description="[m]")
    bottom: float = Field(gt=0, description="[m]")
    description: str = ""
    uscs: str | None = None
    sbtn_zone: int | None = Field(None, ge=1, le=9)
    behaviour: Literal["drained", "undrained"] = "drained"
    gamma: float = Field(gt=5, lt=30, description="Unit weight above GWT [kN/m3]")
    gamma_sat: float | None = Field(None, gt=5, lt=30, description="Below GWT [kN/m3]")
    params: dict[str, DerivedParameter] = Field(default_factory=dict)
    design: DesignParameters = Field(default_factory=DesignParameters)
    liquefiable: bool | None = None
    residual_su: float | None = Field(None, ge=0, description="Post-liquefaction strength [kPa]")

    @model_validator(mode="after")
    def _check(self) -> SoilLayer:
        if self.bottom <= self.top:
            raise ValueError(f"Layer {self.id!r}: bottom ({self.bottom}) must exceed top ({self.top})")
        if self.gamma_sat is None:
            self.gamma_sat = self.gamma
        return self

    @property
    def thickness(self) -> float:
        return self.bottom - self.top


class SoilProfile(BaseModel):
    id: str
    name: str = ""
    source_ids: list[str] = Field(default_factory=list)
    """Boreholes/CPTs this profile was interpreted from."""
    gwt: GroundwaterCondition
    layers: list[SoilLayer]

    @field_validator("layers")
    @classmethod
    def _contiguous(cls, layers: list[SoilLayer]) -> list[SoilLayer]:
        if not layers:
            raise ValueError("Profile needs at least one layer")
        layers = sorted(layers, key=lambda layer: layer.top)
        if abs(layers[0].top) > DEPTH_TOL:
            raise ValueError("First layer must start at ground surface (top = 0)")
        for upper, lower in zip(layers, layers[1:]):
            if abs(upper.bottom - lower.top) > DEPTH_TOL:
                raise ValueError(
                    f"Layers {upper.id!r} and {lower.id!r} are not contiguous "
                    f"({upper.bottom} != {lower.top})"
                )
        ids = [layer.id for layer in layers]
        if len(set(ids)) != len(ids):
            raise ValueError("Layer ids must be unique")
        return layers

    @property
    def bottom(self) -> float:
        return self.layers[-1].bottom

    def layer_at(self, z: float) -> SoilLayer:
        """Layer containing depth z; a boundary depth belongs to the lower layer."""
        if z < -DEPTH_TOL or z > self.bottom + DEPTH_TOL:
            raise ProfileError(f"Depth {z} m is outside the profile (0 - {self.bottom} m)")
        for layer in self.layers:
            if z < layer.bottom - DEPTH_TOL:
                return layer
        return self.layers[-1]

    def boundaries(self) -> np.ndarray:
        return np.array([self.layers[0].top] + [layer.bottom for layer in self.layers])

    def stresses(self, z, case: Literal["insitu", "design", "seismic"] = "insitu"):
        """Vertical stresses (sigma_v, u, sigma_v_eff) [kPa] at depth(s) z for a GWT case."""
        from geotek.engine.stresses import vertical_stresses

        return vertical_stresses(self, z, gwt_depth=self.gwt.depth_for(case))

    def content_hash(self) -> str:
        """Fingerprint used to flag dependent analyses as out of date."""
        return hashlib.sha256(self.model_dump_json().encode("utf-8")).hexdigest()[:16]
