"""Ground anchor design inputs, results and the anchored-wall module state.

Units: m, kN, kPa, degrees. ``Optional`` engineering inputs (safety factor, ultimate
load transfer, lock-off ratio) have no hidden default: the engine reports them as
missing instead of assuming a value. Defaults that exist carry a source in the engine.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ANCHOR_STATE_VERSION = 1


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class TendonSpec(_Model):
    """Prestressing steel selection; ``None`` library id / count means choose automatically."""

    type: Literal["strand", "bar"]
    library_id: str | None = None
    """Id from the tendon library (``GET /anchor/reference``); strands default to 15 mm Gr 270."""
    count: int | None = Field(None, ge=1)
    """Number of strands (strand type only); ``None`` selects the smallest adequate count."""
    custom_smts_kn: float | None = Field(None, gt=0)
    """User-supplied SMTS of one strand or bar [kN]; replaces the library entry."""
    custom_area_mm2: float | None = Field(None, gt=0)
    """Cross-section area of one strand or bar [mm²]; informational with ``custom_smts_kn``."""

    @model_validator(mode="after")
    def _consistent(self) -> TendonSpec:
        if self.custom_smts_kn is not None and self.library_id is not None:
            raise ValueError("custom_smts_kn and library_id are mutually exclusive")
        if self.custom_area_mm2 is not None and self.custom_smts_kn is None:
            raise ValueError("custom_area_mm2 requires custom_smts_kn")
        if self.count is not None and self.type != "strand":
            raise ValueError("count applies to strand tendons only")
        return self


class AnchorDesignInputs(_Model):
    # Geometry (level retained ground, vertical wall face)
    excavation_height: float = Field(gt=0)
    """H: retained height from the ground surface to the excavation base [m]."""
    head_depth: float = Field(ge=0)
    """Depth of the anchor head below the ground surface [m]; must be above the base."""
    inclination_deg: float = Field(ge=0, lt=90)
    """Anchor inclination below the horizontal [°]."""
    phi_deg: float = Field(ge=0, lt=90)
    """Effective friction angle of the retained soil, sets the active wedge angle [°]."""
    wedge_origin_below_base: float = Field(0.0, ge=0)
    """Depth of the failure surface origin below the excavation base [m]; 0 = at the corner."""
    beyond_wedge: float | None = Field(None, gt=0)
    """Distance of the bond zone start behind the failure surface [m]; default max(1.5, 0.2 H)."""
    # Load: either horizontal load per metre of wall with spacing, or axial load per anchor
    horizontal_load_per_m: float | None = Field(None, gt=0)
    """T_h,i: horizontal anchor load per metre of wall [kN/m]."""
    spacing: float | None = Field(None, gt=0)
    """Horizontal anchor spacing s [m]."""
    axial_load: float | None = Field(None, gt=0)
    """Design load along the anchor axis, per anchor [kN]."""
    # Bond zone
    safety_factor: float | None = Field(None, gt=1)
    """FS on the ultimate load transfer; required, GEC-4 values are listed in the reference."""
    ultimate_transfer_load: float | None = Field(None, gt=0)
    """q_u: ultimate load transfer per metre of bond length [kN/m]."""
    ultimate_bond_stress: float | None = Field(None, gt=0)
    """τ_ult at the grout/ground interface [kPa]; needs ``hole_diameter``."""
    hole_diameter: float | None = Field(None, gt=0)
    """As-drilled hole diameter d_h [m]."""
    min_bond_length: float | None = Field(None, gt=0)
    max_bond_length: float | None = Field(None, gt=0)
    min_free_length: float | None = Field(None, gt=0)
    """Override of the minimum unbonded length [m]; default by tendon type (GEC-4)."""
    # Tendon and loads
    tendon: TendonSpec
    lock_off_ratio: float | None = Field(None, gt=0, le=1.5)
    """Lock-off load as a fraction of the design load; required user input."""
    test_factor: float = Field(1.33, gt=1)
    """Maximum test load / design load (GEC-4 permanent anchors: 1.33)."""
    design_limit: float = Field(0.60, gt=0, le=1)
    """Design load limit as a fraction of SMTS (GEC-4: 0.60)."""
    lock_off_limit: float = Field(0.70, gt=0, le=1)
    """Lock-off load limit as a fraction of SMTS (GEC-4: 0.70)."""
    test_limit: float = Field(0.80, gt=0, le=1)
    """Maximum test load limit as a fraction of SMTS (GEC-4: 0.80)."""
    min_overburden: float = Field(4.5, ge=0)
    """Minimum soil cover over the centre of the bond zone [m] (GEC-4: 4.5)."""

    @model_validator(mode="after")
    def _consistent(self) -> AnchorDesignInputs:
        if self.head_depth >= self.excavation_height:
            raise ValueError("head_depth must be above the excavation base (< excavation_height)")
        horizontal = self.horizontal_load_per_m is not None
        if horizontal == (self.axial_load is not None):
            raise ValueError("give either horizontal_load_per_m with spacing, or axial_load")
        if horizontal and self.spacing is None:
            raise ValueError("horizontal_load_per_m requires spacing")
        if self.axial_load is not None and self.spacing is not None:
            raise ValueError("spacing applies only with horizontal_load_per_m")
        if (self.ultimate_transfer_load is not None) and (self.ultimate_bond_stress is not None):
            raise ValueError("give ultimate_transfer_load or ultimate_bond_stress, not both")
        if (self.min_bond_length and self.max_bond_length
                and self.min_bond_length > self.max_bond_length):
            raise ValueError("min_bond_length exceeds max_bond_length")
        return self


class Notice(_Model):
    """A translatable message: ``anchored_wall.warning.<code>`` / ``.assumption.<code>``."""

    code: str
    params: dict[str, float | int | str] = Field(default_factory=dict)


class AnchorCheck(_Model):
    id: str
    demand: float
    limit: float
    ok: bool


class TendonResult(_Model):
    type: Literal["strand", "bar", "custom"]
    label: str
    source: str
    """Table and page of the source, or ``user input``."""
    count: int
    smts_each: float
    smts_total: float
    area_total_mm2: float | None
    design_utilisation: float
    """T / SMTS; compare with ``design_limit``."""
    lock_off_utilisation: float
    test_utilisation: float
    count_governing: Literal["design", "lock_off", "test", "user"]


class AnchorDesignResult(_Model):
    # Loads
    load_source: Literal["horizontal_per_m", "axial"]
    horizontal_load_per_anchor: float
    """T_h [kN]."""
    design_load: float
    """T [kN] along the anchor axis."""
    vertical_load_per_anchor: float
    """T_v = T sin α [kN]."""
    vertical_load_per_m: float | None
    lock_off_load: float
    test_load: float
    # Free length
    wedge_angle_deg: float
    wedge_distance: float
    """Horizontal distance wall to failure surface at the anchor line [m]."""
    wedge_length: float
    """Anchor length from the head to the failure surface [m]."""
    beyond_wedge: float
    free_length_required: float
    free_length_minimum: float
    free_length: float
    free_length_governing: Literal["wedge", "minimum"]
    # Bond length
    transfer_load: float
    transfer_load_source: Literal["direct", "bond_stress"]
    safety_factor: float
    bond_length_calculated: float
    bond_length: float
    bond_length_governing: Literal["calculated", "minimum"]
    bond_capacity: float
    """Allowable bond capacity q_u L_b / FS [kN]."""
    total_length: float
    bond_centre_depth: float
    tendon: TendonResult
    checks: list[AnchorCheck]
    warnings: list[Notice]
    assumptions: list[Notice]
    sources: list[str]


class AnchorRecord(_Model):
    """Stored anchor design: the inputs, the last result and the hash of its inputs."""

    inputs: AnchorDesignInputs
    result: AnchorDesignResult | None = None
    result_hash: str | None = None


class AnchoredWallState(_Model):
    """``Project.modules["anchored_wall"]``; later phases add fields with defaults."""

    anchor: AnchorRecord | None = None
