"""Walls module DTOs; WallResultDTO stays in api.schemas because JobState unions it."""

from __future__ import annotations

from typing import Literal

from geotek.api.schemas import DTO, WallType


class WallTypeInfo(DTO):
    """Selectable retaining wall type and its i18n label key."""

    id: WallType
    title_key: str


class AtRestLayerDTO(DTO):
    """K0 used for one layer within the wall height."""

    layer_id: str
    top: float
    bottom: float
    K0: float


class AtRestComponentDTO(DTO):
    """One resultant of the at-rest diagram: surcharge rectangle, soil triangle or water."""

    name: Literal["soil", "surcharge", "water"]
    force: float
    height: float


class AtRestResultDTO(DTO):
    """At-rest pressure diagram [kPa over depth z in m], layer K0 table and components."""

    z: list[float]
    sigma_h_eff: list[float]
    u: list[float]
    sigma_h: list[float]
    layers: list[AtRestLayerDTO]
    components: list[AtRestComponentDTO]
    total_force: float
    total_height: float
    warnings: list[str]
