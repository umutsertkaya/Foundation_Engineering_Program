"""Structures (retaining walls, sheet piles) and their structure-specific soil models.

Structure frame: depth z [m] is measured downward from the retained ground surface at the
back of the structure. A wall's base bottom is at z = height; the front ground is at
z = height - embedment. A sheet pile's dredge line is at z = retained_height.

A structure works on its own copy of a project profile, so engineers can add, remove or
split layers for one structure without touching the project profile. The copy remembers the
source profile id and its content hash; a hash mismatch marks the structure out of date.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, model_validator

from geotek.core.constants import DEPTH_TOL
from geotek.core.models.profile import GroundwaterCondition, SoilLayer, SoilProfile
from geotek.core.models.walls import CantileverGeometry, GravityGeometry, WallSettings

GwtCase = Literal["insitu", "design", "seismic"]


class LayerSlice(BaseModel):
    """Part of a layer inside a zone, in structure-frame depths."""

    layer_id: str
    top: float
    bottom: float


class SoilZones(BaseModel):
    backfill: list[LayerSlice]
    """Retained side, from the surface to the base (or dredge line)."""
    front: list[LayerSlice]
    """Front side, from the front ground level to the base (empty when embedment is 0)."""
    foundation: list[LayerSlice]
    """Below the base, to the bottom of the profile."""


class StructureSoilModel(BaseModel):
    source_profile_id: str | None = None
    """Project profile this copy was taken from; None when entered for the structure only."""
    source_hash: str | None = None
    """``SoilProfile.content_hash()`` of the source at copy (or re-sync) time."""
    profile: SoilProfile
    """Structure copy in the structure frame. Front side and foundation always use it."""
    retained_fill: list[SoilLayer] = Field(default_factory=list)
    """Optional fill behind the structure, contiguous from z = 0. Where given it replaces
    ``profile`` on the retained side only (e.g. engineered backfill over natural ground)."""
    gwt_retained: GroundwaterCondition | None = None
    """Water behind the structure (structure-frame depths); None = ``profile.gwt``."""
    gwt_front: GroundwaterCondition | None = None
    """Water in front of the structure (structure-frame depths, so >= front ground depth when
    the excavation is dry); None = ``profile.gwt``. Pore pressure below the base varies
    linearly from the front head to the retained head (no seepage analysis)."""

    @model_validator(mode="after")
    def _check_fill(self) -> StructureSoilModel:
        fill = sorted(self.retained_fill, key=lambda layer: layer.top)
        if fill:
            fill_ids = [layer.id for layer in fill]
            if len(set(fill_ids)) != len(fill_ids):
                raise ValueError("Retained fill layer ids must be unique")
            if abs(fill[0].top) > DEPTH_TOL:
                raise ValueError("Retained fill must start at z = 0")
            for upper, lower in zip(fill, fill[1:]):
                if abs(upper.bottom - lower.top) > DEPTH_TOL:
                    raise ValueError("Retained fill layers must be contiguous")
            if fill[-1].bottom > self.profile.bottom + DEPTH_TOL:
                raise ValueError("Retained fill extends below the profile")
            ids = {layer.id for layer in self.profile.layers}
            if ids & {layer.id for layer in fill}:
                raise ValueError("Retained fill layer ids must differ from profile layer ids")
        self.retained_fill = fill
        if fill:
            self.retained_profile()  # validates the assembled profile
        return self

    def is_stale(self, source: SoilProfile | None) -> bool:
        """True when the source profile changed (or vanished) since the copy was made."""
        if self.source_profile_id is None:
            return False
        return source is None or source.content_hash() != self.source_hash

    def retained_profile(self) -> SoilProfile:
        """Profile seen by the retained side: fill layers over the remaining profile layers,
        with the retained-side water table."""
        gwt = self.gwt_retained or self.profile.gwt
        if not self.retained_fill:
            return self.profile if gwt is self.profile.gwt else self.profile.model_copy(update={"gwt": gwt})
        z_fill = self.retained_fill[-1].bottom
        below = []
        for layer in self.profile.layers:
            if layer.bottom <= z_fill + DEPTH_TOL:
                continue
            below.append(layer if layer.top >= z_fill - DEPTH_TOL
                         else layer.model_copy(update={"top": z_fill}))
        data = self.profile.model_dump()
        data["gwt"] = gwt.model_dump()
        data["layers"] = [layer.model_dump() for layer in list(self.retained_fill) + below]
        return SoilProfile.model_validate(data)

    def front_profile(self) -> SoilProfile:
        """``profile`` with the front-side water table (for passive and front overburden)."""
        if self.gwt_front is None:
            return self.profile
        return self.profile.model_copy(update={"gwt": self.gwt_front})

    def zones(self, front_depth: float, base_depth: float) -> SoilZones:
        """Backfill, front and foundation slices cut at the front ground and base levels."""
        if not 0 <= front_depth <= base_depth:
            raise ValueError("Need 0 <= front_depth <= base_depth")
        if base_depth >= self.profile.bottom - DEPTH_TOL:
            raise ValueError(f"Profile ends at {self.profile.bottom} m, not below the base at {base_depth} m")

        def cut(profile: SoilProfile, a: float, b: float) -> list[LayerSlice]:
            return [LayerSlice(layer_id=layer.id, top=max(layer.top, a), bottom=min(layer.bottom, b))
                    for layer in profile.layers if min(layer.bottom, b) - max(layer.top, a) > DEPTH_TOL]

        return SoilZones(
            backfill=cut(self.retained_profile(), 0.0, base_depth),
            front=cut(self.profile, front_depth, base_depth),
            foundation=cut(self.profile, base_depth, self.profile.bottom),
        )


SurchargeBasis = Literal["horizontal", "inclined"]
SURCHARGE_BASIS_DESCRIPTION = (
    "horizontal: the surcharge is a vertical load per horizontal projected area; "
    "inclined: per area of the inclined ground surface (q / cos(beta) per horizontal area)")


class WallDesignInputs(BaseModel):
    surcharge: float = Field(0.0, ge=0, description="Uniform surcharge on the retained side [kPa]")
    surcharge_basis: SurchargeBasis = Field("horizontal", description=SURCHARGE_BASIS_DESCRIPTION)
    surcharge_resists: bool = False
    sds: float | None = Field(None, gt=0, lt=3, description="TBDY S_DS; None = no seismic case")
    r: float | None = Field(None, gt=0, le=2, description="TBDY Table 16.7 r; None = by wall type")
    gwt_case: GwtCase = "design"
    include_global_stability: bool = True


class RetainingWallStructure(BaseModel):
    kind: Literal["retaining_wall"] = "retaining_wall"
    id: str
    name: str = ""
    wall_type: Literal["cantilever", "gravity"]
    height: float = Field(gt=0.5, le=15, description="Base bottom to top of wall = base depth z [m]")
    embedment: float | None = Field(None, ge=0, description="D; None = sizing default")
    """Sizing input. Once ``geometry`` exists, ``geometry.embedment`` is the authority and
    this field must equal it."""
    backfill_slope: float = Field(0.0, ge=0, lt=45)
    geometry: CantileverGeometry | GravityGeometry | None = None
    """Dimensions proposed by sizing or edited by the user; None before 'Boyut öner'."""
    soil: StructureSoilModel
    inputs: WallDesignInputs = Field(default_factory=WallDesignInputs)
    settings: WallSettings = Field(default_factory=WallSettings)
    analysis_level: Literal["basic", "advanced"] = "basic"
    approach: str | None = None
    """Design approach for partial-factor codes (e.g. 'DA1')."""
    result_hash: str | None = None
    """Fingerprint of the inputs of the last check; a mismatch marks the result out of date."""
    result: dict[str, Any] | None = None
    """Last JSON calculation payload; excluded from the input fingerprint."""

    @model_validator(mode="after")
    def _check(self) -> RetainingWallStructure:
        g = self.geometry
        if g is not None:
            if isinstance(g, CantileverGeometry) != (self.wall_type == "cantilever"):
                raise ValueError("Geometry type does not match wall_type")
            if abs(g.height - self.height) > DEPTH_TOL:
                raise ValueError(f"Geometry height {g.height} differs from structure height {self.height}")
            if self.embedment is not None and abs(g.embedment - self.embedment) > DEPTH_TOL:
                raise ValueError("embedment differs from geometry.embedment")
        if self.embedment is not None and self.embedment >= self.height:
            raise ValueError("Embedment must be less than the wall height")
        if self.soil.profile.bottom <= self.height + DEPTH_TOL:
            raise ValueError("Structure soil profile must extend below the wall base")
        return self

    @property
    def front_depth(self) -> float | None:
        """Front ground depth z = height - D (None while D is unknown)."""
        d = self.geometry.embedment if self.geometry is not None else self.embedment
        return None if d is None else self.height - d


class SheetPileStructure(BaseModel):
    kind: Literal["sheet_pile"] = "sheet_pile"
    id: str
    name: str = ""
    support: Literal["cantilever", "anchored"] = "cantilever"
    retained_height: float = Field(gt=0.5, le=12, description="Dredge line depth z [m]")
    anchor_depth: float | None = Field(None, ge=0)
    depth_increase: float | None = Field(None, ge=0)
    anchor_spacing: float | None = Field(None, gt=0, description="[m]")
    anchor_inclination: float | None = Field(None, ge=0, lt=90, description="[deg from horizontal]")
    front_water_depth: float | None = Field(None, ge=0, description="Depth from top [m]")
    soil: StructureSoilModel
    backfill_slope: float = Field(0.0, ge=0, lt=45, description="Retained ground slope beta [deg]; front side stays horizontal")
    surcharge: float = Field(0.0, ge=0)
    surcharge_basis: SurchargeBasis = Field("horizontal", description=SURCHARGE_BASIS_DESCRIPTION)
    sds: float | None = Field(None, gt=0, lt=3)
    design_code: str = "asd"
    approach: str | None = None
    allowable_stress_mpa: float | None = Field(None, gt=0)
    analysis_level: Literal["basic", "advanced"] = "basic"
    result_hash: str | None = None
    result: dict[str, Any] | None = None
    """Last JSON calculation payload; excluded from the input fingerprint."""

    @model_validator(mode="after")
    def _check(self) -> SheetPileStructure:
        if self.support != "anchored" and (self.anchor_spacing is not None or self.anchor_inclination is not None):
            raise ValueError("anchor_spacing and anchor_inclination require anchored support")
        if self.support == "anchored" and self.anchor_depth is None:
            raise ValueError("Anchored wall needs anchor_depth")
        if self.anchor_depth is not None and self.anchor_depth >= self.retained_height:
            raise ValueError("Anchor must be above the dredge line")
        if self.soil.profile.bottom <= self.retained_height + DEPTH_TOL:
            raise ValueError("Structure soil profile must extend below the dredge line")
        return self


Structure = Annotated[RetainingWallStructure | SheetPileStructure, Field(discriminator="kind")]
