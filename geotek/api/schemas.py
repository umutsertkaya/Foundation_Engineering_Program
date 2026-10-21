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
from geotek.core.models.profile import (
    GroundwaterCondition,
    LayeringSettings,
    ProfileOrigin,
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


class DeletionResponse(DTO):
    """JSON acknowledgement of a deleted investigation, profile or structure."""

    id: str
    deleted: Literal[True]


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


class RetainingWallCreate(DTO):
    """Retaining wall inputs without a server id; omitted soil uses the selected profile.

    profile_id selects the copy source, falling back to the active profile when null.
    Explicit soil and profile_id are alternative sources. Heights are depths in metres.

    If ``soil`` is null, ``profile_id`` is null and the project has no active profile, the
    server answers 409 ``no_soil_source``; the client must then send an explicit manual
    ``soil`` with ``source_profile_id=null``.
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
    """Sheet pile inputs without a server id; profile selection matches retaining walls.

    If ``soil`` is null, ``profile_id`` is null and the project has no active profile, the
    server answers 409 ``no_soil_source``; the client must then send an explicit manual
    ``soil`` with ``source_profile_id=null``.
    """

    kind: Literal["sheet_pile"]
    name: str
    profile_id: str | None = None
    soil: StructureSoilModel | None = None
    retained_height: float = Field(gt=0.5, le=12)
    support: Literal["cantilever", "anchored"] | None = None
    anchor_depth: float | None = Field(None, ge=0)
    depth_increase: float | None = Field(None, ge=0)
    anchor_spacing: float | None = Field(None, gt=0, description="[m]")
    anchor_inclination: float | None = Field(None, ge=0, lt=90, description="[deg from horizontal]")
    front_water_depth: float | None = Field(None, ge=0, description="Depth from top [m]")
    backfill_slope: float | None = Field(None, ge=0, lt=45, description="Retained ground slope beta [deg]")
    surcharge: float | None = Field(None, ge=0)
    surcharge_basis: Literal["horizontal", "inclined"] | None = None
    sds: float | None = Field(None, gt=0, lt=3)
    design_code: str | None = None
    approach: str | None = None
    allowable_stress_mpa: float | None = Field(None, gt=0)
    analysis_level: Literal["basic", "advanced"] | None = None

    @model_validator(mode="after")
    def _anchor_inputs(self) -> SheetPileCreate:
        if self.support != "anchored" and (self.anchor_spacing is not None or self.anchor_inclination is not None):
            raise ValueError("anchor_spacing and anchor_inclination require anchored support")
        return self


StructureCreate = Annotated[
    RetainingWallCreate | SheetPileCreate, Field(discriminator="kind")
]


class AssumptionDTO(DTO):
    """Mirror of an engine assumption and its source label."""

    text: str
    source: str
    code: str | None = None
    params: dict = Field(default_factory=dict)


class MessageDTO(DTO):
    """Stable message identifier and interpolation parameters."""

    code: str
    params: dict[str, float | int | str] = Field(default_factory=dict)


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
    kv_sign: Literal["up", "down"] | None = None
    """Vertical seismic sign chosen for this check (+kv up / -kv down); null for static checks."""

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


class ShearKeyDTO(DTO):
    """ShearKeyResult mirror: sliding on both candidate surfaces, with and without the key, and
    the key demands (kN/m, kNm/m; no reinforced-concrete design)."""

    position: Literal["toe", "middle", "heel"]
    width: ResultNumber
    depth: ResultNumber
    passive_full: ResultNumber
    passive_used: ResultNumber
    reduction: ResultNumber
    arm: ResultNumber
    fs_base_surface: ResultNumber
    fs_deep_surface: ResultNumber
    fs_with_key: ResultNumber
    fs_without_key: ResultNumber
    governing: Literal["base", "deep"]
    demand_v: ResultNumber
    demand_m: ResultNumber


class ShearKeyResultDTO(ShearKeyDTO):
    """Shear key result of one design case."""

    case: str


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
    shear_key: ShearKeyDTO | None = None


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
    governing_check_ids: list[str] = Field(default_factory=list)
    """Ids ("case:name", as in checks) of failing checks, or the check that governed sizing."""
    minimum_width_governs: bool = False
    """True when sizing ended at the minimum width with no failing check."""
    checks: list[CheckDTO]
    shear_key: list[ShearKeyResultDTO] = Field(default_factory=list)
    """One entry per design case when the geometry has a shear key; empty otherwise."""
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
    anchor_force_per_anchor: ResultNumber = None
    anchor_spacing_used: ResultNumber = None
    anchor_inclination_used: ResultNumber = None
    warning_items: list[MessageDTO] = Field(default_factory=list)
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


def _strip(value: Any) -> Any:
    return value.strip() if isinstance(value, str) else value


class LibraryEntryDTO(DTO):
    """Project file in the library; error is non-null when the file could not be read."""

    file: str
    name: str
    number: str
    engineer: str
    modified: dt.datetime
    size: int = Field(ge=0)
    schema_version: str | None
    error: str | None


class AppSettingsDTO(DTO):
    """Persistent preferences; recent holds absolute paths, newest first (server-managed)."""

    library_dir: str = Field(min_length=1)
    language: Language
    recent: list[str] = Field(default_factory=list)


class ModuleInfo(DTO):
    """Discovered module metadata for the launcher, sorted by order."""

    id: str
    version: str
    title_key: str
    description_key: str
    icon: str
    order: int


class SessionInfo(DTO):
    """Open-project state of the running server."""

    open: bool
    file: str | None
    dirty: bool


class ProjectSaveResponse(SessionInfo):
    """Session state after a save plus the path written (library or path-based)."""

    path: str


class NewProjectRequest(DTO):
    """Subset of ProjectMeta needed to create a library project."""

    name: Annotated[str, BeforeValidator(_strip)] = Field(min_length=1)
    number: str = ""
    engineer: str = ""
    language: Language | None = None
    design_code: str | None = None


class RenameRequest(DTO):
    """New project name for a library file."""

    name: Annotated[str, BeforeValidator(_strip)] = Field(min_length=1)


class ExportRequest(DTO):
    """Destination file or directory outside the library."""

    dest: str = Field(min_length=1)
    overwrite: bool = Field(default=False, description="Replace an existing destination file.")


class ExportResponse(DTO):
    """Resolved path of the exported copy."""

    path: str


class ImportRequest(DTO):
    """Existing project file to copy into the library."""

    path: str = Field(min_length=1)


class TrashResponse(DTO):
    """Location of a deleted library file inside the library's .trash directory."""

    trash_path: str
