"""Soil module DTOs; objects shared with core (deletion ack, layering proposal) stay in api.schemas."""

from __future__ import annotations

from pydantic import ConfigDict, Field, model_validator

from geotek.api.schemas import DTO, LayeringProposal, ProfileSummary, ResultNumber  # noqa: F401
from geotek.core.models.investigations import Borehole, CPTSounding
from geotek.core.models.parameters import DesignKey, SelectionMode, Statistic
from geotek.core.models.profile import GroundwaterCondition, ProfileOrigin, SoilLayer


class InvestigationsDTO(DTO):
    """Unprocessed investigation records."""

    boreholes: list[Borehole]
    cpts: list[CPTSounding]


class WorkbookImportResult(DTO):
    """Records added by a workbook import, with translatable warning codes."""

    boreholes: list[Borehole]
    cpts: list[CPTSounding]
    warnings: list[str]


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


class AxisRangeDTO(DTO):
    min: float
    max: float


class SBTNCoordinateDTO(DTO):
    """Chart coordinate: Fr in percent and dimensionless Qtn."""

    Fr: ResultNumber
    Qtn: ResultNumber


class SBTNZoneDTO(DTO):
    zone: int
    name_en: str
    name_tr: str
    ic_min: ResultNumber
    ic_max: ResultNumber


class SBTNContourDTO(DTO):
    Ic: float
    points: list[SBTNCoordinateDTO]


class SBTNReferenceDTO(DTO):
    zones: list[SBTNZoneDTO]
    ic_bounds: list[float]
    zone_1_boundary: list[SBTNCoordinateDTO]
    ic_contours: list[SBTNContourDTO]
    fr_range: AxisRangeDTO
    qtn_range: AxisRangeDTO


class SBTNPointDTO(SBTNCoordinateDTO):
    depth: ResultNumber
    Ic: ResultNumber
    zone: int | None
    zone_name_en: str | None
    zone_name_tr: str | None


class CPTSBTNDTO(DTO):
    points: list[SBTNPointDTO]
    warnings: list[str]


class USCSClassifyRequest(DTO):
    """Stateless engine inputs, with the same numeric bounds as LabRecord."""

    fines: float = Field(ge=0, le=100)
    gravel: float | None = Field(None, ge=0, le=100)
    LL: float | None = Field(None, ge=0)
    PI: float | None = Field(None, ge=0)
    D10: float | None = Field(None, gt=0)
    D30: float | None = Field(None, gt=0)
    D60: float | None = Field(None, gt=0)


class USCSSymbolDTO(DTO):
    symbol: str
    group_name_en: str
    group_name_tr: str
    description: str


class USCSItemDTO(DTO):
    """Lab result; depth and PL are null for stateless classify() requests."""

    depth: ResultNumber
    symbol: str | None
    complete: bool
    notes: list[str]
    FC: ResultNumber
    gravel: ResultNumber
    LL: ResultNumber
    PL: ResultNumber
    PI: ResultNumber
    D10: ResultNumber
    D30: ResultNumber
    D60: ResultNumber
    Cu: ResultNumber
    Cc: ResultNumber
    plastic_class: str | None
    group_name_en: str | None
    group_name_tr: str | None
    description: str | None


class BoreholeUSCSDTO(DTO):
    items: list[USCSItemDTO]


class PlasticityPointDTO(DTO):
    LL: float
    PI: ResultNumber


class USCSReferenceDTO(DTO):
    a_line: list[PlasticityPointDTO]
    u_line: list[PlasticityPointDTO]
    symbols: list[USCSSymbolDTO]


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


class MethodAvailability(DTO):
    """One registry correlation and how many layer points can feed it."""

    id: str
    reference: str
    source: str
    inputs: list[str]
    ready_points: int
    missing_inputs: list[str]
    """Inputs no point of the layer supplies; empty when the method can run somewhere."""


class KeyAvailability(DTO):
    parameter: DesignKey
    methods: list[MethodAvailability]


class LayerInventory(DTO):
    """Input availability of a layer and the correlations it enables, nothing assumed."""

    layer_id: str
    point_count: int
    inputs: dict[str, int]
    keys: list[KeyAvailability]
