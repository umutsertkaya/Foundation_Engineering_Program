"""Liquefaction module DTOs; the result DTOs stay in api.schemas because JobState unions them."""

from __future__ import annotations

from typing import Literal

from geotek.api.schemas import DTO, LiquefactionResultDTO


class LiquefactionSettingsDTO(DTO):
    """Explicit liquefaction inputs; the contract chooses no engineering coefficients."""

    profile_id: str | None = None
    """Soil profile for unit weights and the seismic GWT; None = the project's active profile."""
    method: Literal["youd2001", "bi2014"]
    amax_g: float
    mw: float
    target_fs: float
    gwt_seismic: float | None = None
    default_fc: float | None = None
    c_fc: float
    ic_cutoff: float


class StoredLiquefactionDTO(DTO):
    """The liquefaction result saved in the project, with the settings it was computed with."""

    profile_id: str
    settings: LiquefactionSettingsDTO
    result: LiquefactionResultDTO
    stale: bool
    """True when soil profile or investigations changed since the run (the result is outdated)."""
