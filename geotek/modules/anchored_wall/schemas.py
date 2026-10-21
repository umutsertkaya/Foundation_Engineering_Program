"""Anchored wall module DTOs; design inputs/results live in ``core.models.anchors``."""

from __future__ import annotations

from geotek.api.schemas import DTO
from geotek.core.models.anchors import AnchoredWallState


class StateResponse(DTO):
    """Stored module state plus whether the stored anchor result still matches its inputs."""

    state: AnchoredWallState
    anchor_result_stale: bool
    analysis_result_stale: bool = False
    analysis_soil_stale: bool = False
    """The project profile the analysis soil was copied from has changed or is gone."""


class TendonInfo(DTO):
    id: str
    type: str
    label: str
    smts_kn: float
    area_mm2: float
    source: str


class TransferLoadInfo(DTO):
    id: str
    ground: str
    condition: str
    q_u_kn_per_m: float
    source: str


class SafetyFactorGuidance(DTO):
    ground: str
    value: float
    source: str


class AnchorDefaults(DTO):
    """Defaults the engine applies when the input is left out, each with its source."""

    min_free_length_strand: float
    min_free_length_bar: float
    min_free_length_source: str
    test_factor: float
    design_limit: float
    lock_off_limit: float
    test_limit: float
    min_overburden: float
    beyond_wedge_rule: str
    source: str


class AnchorReference(DTO):
    """Source-labelled library for the UI; presumptive values are never applied silently."""

    tendons: list[TendonInfo]
    transfer_loads: list[TransferLoadInfo]
    safety_factor_guidance: list[SafetyFactorGuidance]
    defaults: AnchorDefaults
