"""Ground anchor design inputs, results and the anchored-wall module state.

Units: m, kN, kPa, degrees. ``Optional`` engineering inputs (safety factor, ultimate
load transfer, lock-off ratio) have no hidden default: the engine reports them as
missing instead of assuming a value. Defaults that exist carry a source in the engine.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from geotek.core.models.structures import SURCHARGE_BASIS_DESCRIPTION, StructureSoilModel, SurchargeBasis

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
    ground: Literal["soil", "rock"] = "soil"
    """Bond ground; the cover requirement is GEC-4's for soil anchors and not checked in rock."""
    transfer_load_ref: str | None = Field(None, max_length=120)
    """Where the transfer load / bond stress came from, e.g. a library row id; echoed in the result."""

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
        if not self.design_limit <= self.lock_off_limit <= self.test_limit:
            raise ValueError("limits must satisfy design_limit <= lock_off_limit <= test_limit")
        if (self.min_bond_length and self.max_bond_length
                and self.min_bond_length > self.max_bond_length):
            raise ValueError("min_bond_length exceeds max_bond_length")
        return self


class Notice(_Model):
    """A translatable message: ``anchored_wall.warning.<code>`` / ``.assumption.<code>``."""

    code: str
    params: dict[str, float | int | str] = Field(default_factory=dict)


class AnchorCheck(_Model):
    """``ok`` when demand <= limit; for ``overburden`` demand is the required cover, limit the available."""

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
    transfer_load_ref: str | None
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


class AnchorLevel(_Model):
    """One anchor row of the wall; loads are per metre of wall, anchors repeat at ``spacing``."""

    depth: float = Field(ge=0)
    """Anchor head depth below the ground surface [m]."""
    spacing: float = Field(gt=0)
    """Horizontal anchor spacing [m]."""
    inclination_deg: float = Field(0.0, ge=0, lt=60)
    """Inclination below the horizontal [°]; the wall load is the horizontal component."""


class AnchorDesignCommon(_Model):
    """Anchor design inputs shared by every level; geometry and load come from the analysis.

    Same meaning and rules as ``AnchorDesignInputs``; nothing is assumed when left out.
    """

    safety_factor: float | None = Field(None, gt=1)
    ultimate_transfer_load: float | None = Field(None, gt=0)
    ultimate_bond_stress: float | None = Field(None, gt=0)
    hole_diameter: float | None = Field(None, gt=0)
    min_bond_length: float | None = Field(None, gt=0)
    max_bond_length: float | None = Field(None, gt=0)
    min_free_length: float | None = Field(None, gt=0)
    beyond_wedge: float | None = Field(None, gt=0)
    wedge_origin_below_base: float = Field(0.0, ge=0)
    tendon: TendonSpec
    lock_off_ratio: float | None = Field(None, gt=0, le=1.5)
    test_factor: float = Field(1.33, gt=1)
    design_limit: float = Field(0.60, gt=0, le=1)
    lock_off_limit: float = Field(0.70, gt=0, le=1)
    test_limit: float = Field(0.80, gt=0, le=1)
    min_overburden: float = Field(4.5, ge=0)
    ground: Literal["soil", "rock"] = "soil"
    transfer_load_ref: str | None = Field(None, max_length=120)


class WallSection(_Model):
    """Generic wall section: strength check only, no steel or concrete design."""

    w_cm3: float | None = Field(None, gt=0)
    """Elastic section modulus: per metre of wall (sheet pile) or per pile (soldier pile) [cm³]."""
    allowable_stress_mpa: float | None = Field(None, gt=0)
    ei_knm2: float | None = Field(None, gt=0)
    """Bending stiffness, same basis as ``w_cm3``; stored for later deflection work, not used."""


class AnchoredWallAnalysisInputs(_Model):
    wall_type: Literal["sheet_pile", "soldier_pile"] = "sheet_pile"
    excavation_height: float = Field(gt=0.5, le=30)
    """H: depth of the excavation base below the ground surface [m]."""
    soil: StructureSoilModel
    """Structure copy of the soil profile (design parameters); fill and water overrides are not used."""
    levels: list[AnchorLevel] = Field(min_length=1, max_length=6)
    drainage: Literal["drained", "undrained"] = "drained"
    backfill_slope: float = Field(0.0, ge=0, lt=45)
    """Retained ground slope β [°]; single anchor level only."""
    surcharge: float = Field(0.0, ge=0)
    surcharge_basis: SurchargeBasis = Field("horizontal", description=SURCHARGE_BASIS_DESCRIPTION)
    passive_factor: float = Field(1.0, ge=1)
    """Divisor on the passive resistance below the excavation base."""
    depth_increase: float | None = Field(None, ge=0)
    """D = D0 (1 + increase); ``None``: 0 for one level, 0.2 for several levels."""
    front_water_depth: float | None = Field(None, ge=0)
    load_method: Literal["hinge", "tributary"] = "hinge"
    """Several levels: how the apparent pressure envelope is split into anchor loads."""
    stiff_clay_coefficient: float = Field(0.3, ge=0.2, le=0.4)
    """Several levels, stiff clay (γH/Su <= 4): envelope ordinate = coefficient x γ H."""
    pile_spacing: float | None = Field(None, gt=0)
    """Soldier pile wall: centre spacing [m]."""
    passive_width: float | None = Field(None, gt=0)
    """Soldier pile wall: effective passive width per pile below the base [m]."""
    section: WallSection = Field(default_factory=WallSection)
    anchor_design: AnchorDesignCommon | None = None
    """When given, every level is fed to the anchor design engine."""

    @model_validator(mode="after")
    def _consistent(self) -> AnchoredWallAnalysisInputs:
        depths = [lv.depth for lv in self.levels]
        if depths != sorted(depths) or len(set(depths)) != len(depths):
            raise ValueError("levels must be listed by increasing, distinct depth")
        if depths[-1] >= self.excavation_height:
            raise ValueError("every anchor must be above the excavation base")
        if self.soil.retained_fill or self.soil.gwt_retained or self.soil.gwt_front:
            raise ValueError("retained fill and separate retained/front groundwater are not supported")
        if self.wall_type == "soldier_pile":
            if self.pile_spacing is None or self.passive_width is None:
                raise ValueError("soldier pile walls need pile_spacing and passive_width")
        elif self.pile_spacing is not None or self.passive_width is not None:
            raise ValueError("pile_spacing and passive_width apply to soldier pile walls only")
        if self.backfill_slope > 0 and self.drainage == "undrained":
            raise ValueError("sloping ground with undrained behaviour is not supported")
        return self


class LevelResult(_Model):
    depth: float
    inclination_deg: float
    spacing: float
    horizontal_load_per_m: float
    """T_h [kN/m of wall]."""
    horizontal_load_per_anchor: float
    axial_load_per_anchor: float
    vertical_load_per_m: float
    design: AnchorDesignResult | None = None
    design_missing: list[str] = Field(default_factory=list)
    design_error: str | None = None


class EnvelopeResult(_Model):
    kind: Literal["sand", "soft_clay", "stiff_clay"]
    p_max: float
    total_thrust: float
    gamma: float
    phi_deg: float | None
    su: float | None
    ka: float | None
    z: list[float]
    p: list[float]


class AnalysisResult(_Model):
    method: Literal["free_earth_single", "apparent_hinge", "apparent_tributary"]
    wall_type: Literal["sheet_pile", "soldier_pile"]
    excavation_height: float
    embedment_theoretical: float
    embedment: float
    wall_length: float
    base_reaction: float | None
    """Several levels: force the wall passes to the soil at the excavation base [kN/m]."""
    envelope: EnvelopeResult | None
    levels: list[LevelResult]
    m_max: float
    """Largest bending moment per metre of wall [kNm/m]."""
    z_m_max: float
    v_max: float
    """Largest shear per metre of wall [kN/m]."""
    member_spacing: float
    """Wall length carried by one structural member (1 m for sheet piles, pile spacing otherwise)."""
    m_max_member: float
    v_max_member: float
    required_section_modulus_cm3: float | None
    checks: list[AnchorCheck]
    z: list[float]
    shear: list[float]
    moment: list[float]
    warnings: list[Notice]
    assumptions: list[Notice]
    sources: list[str]


class AnalysisRecord(_Model):
    inputs: AnchoredWallAnalysisInputs
    result: AnalysisResult | None = None
    result_hash: str | None = None


class AnchoredWallState(_Model):
    """``Project.modules["anchored_wall"]``; later phases add fields with defaults."""

    anchor: AnchorRecord | None = None
    analysis: AnalysisRecord | None = None
