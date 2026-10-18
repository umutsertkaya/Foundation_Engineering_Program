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
