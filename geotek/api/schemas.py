"""HTTP data transfer objects, using SI units unless a field states otherwise.

Domain input models are reused without changing their validation or defaults. Result
numbers may be null: non-finite engine output is represented by JSON null, including
individual chart samples. DTOs do not run analyses or choose engineering values.
"""

from __future__ import annotations

import datetime as dt
import math
from numbers import Real
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    ValidationInfo,
    field_validator,
    model_validator,
)

from geotek.config.codes import FactorStatus
from geotek.core.models.investigations import Borehole, CPTSounding
from geotek.core.models.parameters import DesignKey, SelectionMode, Statistic
from geotek.core.models.profile import (
    GroundwaterCondition,
    LayeringSettings,
    ProfileOrigin,
    SoilLayer,
)
from geotek.core.models.project import ProjectMeta, SiteSeismic
from geotek.core.models.structures import StructureSoilModel, WallDesignInputs
from geotek.core.models.walls import CantileverGeometry, GravityGeometry, WallSettings


def _finite_or_none(value: Any) -> Any:
    """Normalize a numeric engine sentinel without calculating a design value."""
    if value is not None and isinstance(value, Real) and not math.isfinite(value):
        return None
    return value


ResultNumber = Annotated[float | None, BeforeValidator(_finite_or_none)]
Language = Literal["tr", "en"]
WallType = Literal["cantilever", "gravity"]
StructureKind = Literal["retaining_wall", "sheet_pile"]
JobStatus = Literal["queued", "running", "done", "failed", "cancelled"]
JobKind = Literal["wall_size", "wall_check", "sheet_pile", "liquefaction", "layering"]


class DTO(BaseModel):
    """Base for contract-owned objects; unknown fields and non-finite inputs are rejected."""

    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, from_attributes=True)


class MissingFactorDTO(DTO):
    """Mirror of a missing code factor, including provenance and the entry hint."""

    path: str
    status: FactorStatus
    source: str
    hint: str = ""


class ApiError(DTO):
    """Shared error envelope; code is also the suffix of an error i18n key."""

    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
    missing_factors: list[MissingFactorDTO] = Field(default_factory=list)


class HealthResponse(DTO):
    """Local API availability and contract version."""

    status: Literal["ok"]
    version: str


class ProjectNew(DTO):
    """Name and UI language for a new project."""

    name: str
    language: Language


class ProjectOpen(DTO):
    """Local project file to open."""

    path: str


class ProjectSave(DTO):
    """Save destination; null or omission uses the current project file."""

    path: str | None = None


class ProjectSaved(DTO):
    """Resolved local path of the saved project."""

    path: str


def _omit_patch_defaults(schema: dict[str, Any]) -> None:
    """Document omission without advertising invalid null defaults for metadata fields."""
    for property_schema in schema.get("properties", {}).values():
        property_schema.pop("default", None)


class ProjectMetaPatch(DTO):
    """Partial ProjectMeta; omitted fields are unchanged and explicit null is invalid.

    Consumers use model_dump(exclude_unset=True) when applying the patch. Placeholder
    None defaults permit omission but are not accepted as supplied field values.
    """

    model_config = ConfigDict(json_schema_extra=_omit_patch_defaults)

    name: str = Field(default=None)  # type: ignore[assignment]
    number: str = Field(default=None)  # type: ignore[assignment]
    engineer: str = Field(default=None)  # type: ignore[assignment]
    date: dt.date = Field(default=None)  # type: ignore[assignment]
    schema_version: str = Field(default=None)  # type: ignore[assignment]
    language: Language = Field(default=None)  # type: ignore[assignment]
    design_code: str = Field(default=None)  # type: ignore[assignment]
    analysis_level: Literal["basic", "advanced"] = Field(default=None)  # type: ignore[assignment]


class ActiveProfileUpdate(DTO):
    """Select a project profile; null restores the domain's first-profile fallback."""

    profile_id: str | None


class StructureSummary(DTO):
    """Structure list entry; stale indicates changed source soil or analysis inputs."""

    id: str
    name: str
    kind: StructureKind
    wall_type: WallType | None
    stale: bool
    has_result: bool


class ProjectCounts(DTO):
    """Counts of each top-level project collection."""

    boreholes: int = Field(ge=0)
    cpts: int = Field(ge=0)
    profiles: int = Field(ge=0)
    structures: int = Field(ge=0)


class ProjectSummary(DTO):
    """Project metadata, site settings, counts, profile selection and structure state."""

    meta: ProjectMeta
    site: SiteSeismic
    counts: ProjectCounts
    active_profile_id: str | None
    structures: list[StructureSummary]


class InvestigationsDTO(DTO):
    """Unprocessed investigation records."""

    boreholes: list[Borehole]
    cpts: list[CPTSounding]


class DeletionResponse(DTO):
    """JSON acknowledgement of a deleted investigation, profile or structure."""

    id: str
    deleted: Literal[True]


class CPTProcessedDTO(DTO):
    """Depth-aligned CPT chart series; stresses in kPa, friction ratios and fc in percent."""

    depth: list[ResultNumber]
    qc: list[ResultNumber]
    fs: list[ResultNumber]
    qt: list[ResultNumber]
    Rf: list[ResultNumber]
    Fr: list[ResultNumber]
    Bq: list[ResultNumber] | None
    Qtn: list[ResultNumber]
    Ic: list[ResultNumber]
    zone: list[int | None]
    fc: list[ResultNumber]
    sigma_v: list[ResultNumber]
    sigma_v_eff: list[ResultNumber]
    warnings: list[str]


class SPTProcessedDTO(DTO):
    """Depth-aligned SPT chart series; API labels map to n_field, n60 and n1_60."""

    depth: list[ResultNumber]
    N_field: list[ResultNumber]
    N60: list[ResultNumber]
    N1_60: list[ResultNumber]
    warnings: list[str]


class ProposedLayer(DTO):
    """Interpreted interval; suggested values remain unapproved engineering inputs."""

    top: float = Field(ge=0, description="Top depth [m]")
    bottom: float = Field(gt=0, description="Bottom depth [m]")
    description: str
    uscs: str | None
    sbtn_zone: int | None = Field(ge=1, le=9)
    ic_mean: ResultNumber
    n60_mean: ResultNumber
    gamma_suggested: ResultNumber = Field(description="Suggested unit weight [kN/m3]")
    behaviour: Literal["drained", "undrained"]


class LayeringProposal(DTO):
    """Layer interpretation and reproducible settings for one investigation."""

    source_id: str
    settings: LayeringSettings
    layers: list[ProposedLayer]
    warnings: list[str]


class ProfileSummary(DTO):
    """Profile picker entry with origin, sources, groundwater and layer count."""

    id: str
    name: str
    origin: ProfileOrigin
    source_ids: list[str]
    gwt: GroundwaterCondition
    layer_count: int = Field(ge=0)


class ProfileCreate(DTO):
    """Create from exactly one of explicit layers or an unapproved layering proposal.

    Groundwater and origin are explicit in both modes. A proposal does not supply
    approved design parameters or missing unit weights automatically.
    """

    model_config = ConfigDict(json_schema_extra={
        "oneOf": [
            {"required": ["layers"], "properties": {"layers": {"type": "array"}},
             "not": {"required": ["from_proposal"]}},
            {"required": ["from_proposal"],
             "properties": {"from_proposal": {"type": "object"}},
             "not": {"required": ["layers"]}},
        ],
    })

    name: str
    origin: ProfileOrigin
    source_ids: list[str]
    gwt: GroundwaterCondition
    layers: list[SoilLayer] | None = Field(None, min_length=1)
    from_proposal: LayeringProposal | None = None

    @model_validator(mode="after")
    def _one_source(self) -> ProfileCreate:
        """Keep runtime validation consistent with the documented exclusive alternatives."""
        if (self.layers is None) == (self.from_proposal is None):
            raise ValueError("Supply exactly one of layers or from_proposal")
        if {"layers", "from_proposal"} <= self.model_fields_set:
            raise ValueError("Omit the unused layer source")
        return self


class LayerSplit(DTO):
    """Depth below ground at which to split the selected layer [m]."""

    depth: float = Field(gt=0)


class LayerMerge(DTO):
    """Exactly two adjacent layer ids to merge; order does not imply approval."""

    layer_ids: list[str] = Field(min_length=2, max_length=2)


class SelectionUpdate(DTO):
    """Selection inputs only; server resolves candidates and leaves approval separate."""

    mode: SelectionMode
    method_id: str | None = None
    statistic: Statistic | None = None
    k_sd: float | None = Field(None, ge=0)
    manual_value: float | None = None


class ParameterApproval(DTO):
    """Design quantities the engineer explicitly approves."""

    keys: list[DesignKey]


class RetainingWallCreate(DTO):
    """Retaining wall inputs without a server id; omitted soil uses the selected profile.

    profile_id selects the copy source, falling back to the active profile when null.
    Explicit soil and profile_id are alternative sources. Heights are depths in metres.
    """

    kind: Literal["retaining_wall"]
    name: str
    profile_id: str | None = None
    soil: StructureSoilModel | None = None
    wall_type: WallType
    height: float = Field(gt=0.5, le=15)
    embedment: float | None = Field(None, ge=0)
    backfill_slope: float | None = Field(None, ge=0, lt=45)
    geometry: CantileverGeometry | GravityGeometry | None = None
    inputs: WallDesignInputs | None = None
    settings: WallSettings | None = None
    analysis_level: Literal["basic", "advanced"] | None = None
    approach: str | None = None


class SheetPileCreate(DTO):
    """Sheet pile inputs without a server id; profile selection matches retaining walls."""

    kind: Literal["sheet_pile"]
    name: str
    profile_id: str | None = None
    soil: StructureSoilModel | None = None
    retained_height: float = Field(gt=0.5, le=12)
    support: Literal["cantilever", "anchored"] | None = None
    anchor_depth: float | None = Field(None, ge=0)
    surcharge: float | None = Field(None, ge=0)
    sds: float | None = Field(None, gt=0, lt=3)
    design_code: str | None = None
    approach: str | None = None
    allowable_stress_mpa: float | None = Field(None, gt=0)
    analysis_level: Literal["basic", "advanced"] | None = None


StructureCreate = Annotated[
    RetainingWallCreate | SheetPileCreate, Field(discriminator="kind")
]


class AssumptionDTO(DTO):
    """Mirror of an engine assumption and its source label."""

    text: str
    source: str


class UsedFactorDTO(DTO):
    """Mirror of geotek.config.codes.UsedFactor with finite JSON representation."""

    path: str
    value: ResultNumber
    source: str
    status: FactorStatus


class FactorRowDTO(DTO):
    """Mirror of a factor table row; null means no supplied factor value."""

    path: str
    value: ResultNumber
    status: FactorStatus
    source: str


class CheckDTO(DTO):
    """CheckResult with case and utilisation supplied by the future API adapter.

    Utilisation is required/value for >= and value/required for <=. It is null
    for non-finite or absent values (and undefined division).
    """

    case: str
    name: str
    value: ResultNumber
    required: float
    passed: bool
    comparison: Literal[">=", "<="]
    utilisation: ResultNumber
    detail: str

    @field_validator("utilisation")
    @classmethod
    def _undefined_utilisation(cls, value: float | None, info: ValidationInfo) -> float | None:
        """An absent or non-finite check value has no defined utilisation."""
        return None if info.data.get("value") is None else value


class ForceDTO(DTO):
    """Force dataclass mirror; fx/fy in kN/m and x/y in metres from the toe."""

    name: str
    fx: ResultNumber
    fy: ResultNumber
    x: ResultNumber
    y: ResultNumber
    kind: str


class BearingResultDTO(DTO):
    """BearingResult dataclass mirror for the WallAnalysis transport model."""

    method: str
    q_ult: ResultNumber
    Q_ult: ResultNumber
    B_eff: ResultNumber
    L_eff: ResultNumber
    factors: dict[str, ResultNumber]
    warnings: list[str]


class WallAnalysisDTO(DTO):
    """WallAnalysis dataclass mirror; checks include their case and utilisation."""

    case: str
    width: ResultNumber
    forces: list[ForceDTO]
    sum_v: ResultNumber
    sum_h: ResultNumber
    m_resisting: ResultNumber
    m_overturning: ResultNumber
    eccentricity: ResultNumber
    q_max: ResultNumber
    q_min: ResultNumber
    bearing: BearingResultDTO | None
    checks: dict[str, CheckDTO]
    warnings: list[str]
    factors_used: list[UsedFactorDTO]


class PressureDiagramDTO(DTO):
    """PressureDistribution chart projection; stresses kPa, force kN/m, depths m."""

    side: Literal["retained", "front"]
    case: str
    z: list[ResultNumber]
    sigma_h_eff: list[ResultNumber]
    u: list[ResultNumber]
    sigma_h: list[ResultNumber]
    force: ResultNumber
    z_resultant: ResultNumber


class SlipCircleDTO(DTO):
    """Critical SlipResult circle per case; non-finite safety factor becomes null."""

    case: str
    xc: ResultNumber
    yc: ResultNumber
    radius: ResultNumber
    fs: ResultNumber


class WallResultDTO(DTO):
    """Wall sizing or checking result, with proposed geometry and traceable evidence."""

    structure_id: str
    geometry: CantileverGeometry | GravityGeometry
    passed: bool
    governing: str
    checks: list[CheckDTO]
    forces: dict[str, list[ForceDTO]]
    pressures: list[PressureDiagramDTO]
    slip_circles: list[SlipCircleDTO]
    assumptions: list[AssumptionDTO]
    factors_used: list[UsedFactorDTO]
    warnings: list[str]
    kh: ResultNumber
    kv: ResultNumber
    iterations: int = Field(ge=0)
    result_hash: str


class SheetPileResultDTO(DTO):
    """SheetPileResult mirror plus structure id, total length and service assumptions.

    Engine names are retained: H is retained height, D0 theoretical embedment,
    D design embedment, M_max maximum moment [kNm/m], z_M_max its depth [m],
    and net the net pressure [kPa]. total_length is H + D [m].
    section_modulus_cm3 retains the engine's explicit cm3 unit exception.
    """

    structure_id: str
    support: str
    H: ResultNumber
    D0: ResultNumber
    D: ResultNumber
    total_length: ResultNumber
    anchor_depth: ResultNumber
    anchor_force: ResultNumber
    toe_force: ResultNumber
    M_max: ResultNumber
    z_M_max: ResultNumber
    z: list[ResultNumber]
    shear: list[ResultNumber]
    moment: list[ResultNumber]
    net: list[ResultNumber]
    section_modulus_cm3: ResultNumber
    assumptions: list[AssumptionDTO]
    warnings: list[str]


class LiquefactionSettingsDTO(DTO):
    """Explicit liquefaction inputs; the contract chooses no engineering coefficients."""

    method: Literal["youd2001", "bi2014"]
    amax_g: float
    mw: float
    target_fs: float
    gwt_seismic: float | None = None
    default_fc: float | None = None
    c_fc: float
    ic_cutoff: float


class SoundingLiquefactionDTO(DTO):
    """Depth-aligned triggering series; CSR/CRR/FS map to engine csr/crr/fs."""

    depth: list[ResultNumber]
    CSR: list[ResultNumber]
    CRR: list[ResultNumber]
    FS: list[ResultNumber]
    status: list[Literal[
        "liquefiable", "marginal", "safe", "above_gwt", "clay_like",
        "non_liquefiable_dense", "excluded_by_user", "beyond_method_depth", "invalid",
    ]]
    warnings: list[str]


class LiquefactionResultDTO(DTO):
    """Results and independent failures keyed by investigation id."""

    per_sounding: dict[str, SoundingLiquefactionDTO]
    errors: dict[str, str]


class JobRef(DTO):
    """Handle for a submitted background computation."""

    job_id: str


class JobState(DTO):
    """Pollable job state; result and error are null until applicable."""

    job_id: str
    kind: JobKind
    status: JobStatus
    progress: float = Field(ge=0, le=1)
    message_key: str | None
    result: WallResultDTO | SheetPileResultDTO | LiquefactionResultDTO | LayeringProposal | None
    error: ApiError | None


class DesignCodeSummary(DTO):
    """Design code name in project language, factor scheme and named approaches."""

    id: str
    name: str
    approach: Literal["global_fs", "partial_factors", "lrfd"]
    approaches: list[str]
