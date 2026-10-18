"""Liquefaction module DTOs; the result DTOs stay in api.schemas because JobState unions them."""

from __future__ import annotations

from typing import Literal

from geotek.api.schemas import DTO


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
