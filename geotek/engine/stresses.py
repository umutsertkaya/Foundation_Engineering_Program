"""In-situ vertical stress profile (hydrostatic pore pressure)."""

from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np

from geotek.core.constants import DEPTH_TOL, GAMMA_W
from geotek.core.errors import ProfileError

if TYPE_CHECKING:
    from geotek.core.models.profile import SoilProfile


def vertical_stresses(profile: SoilProfile, z, gwt_depth: float, gamma_w: float = GAMMA_W):
    """Total stress, pore pressure and effective stress [kPa] at depth(s) z [m].

    Soil above ``gwt_depth`` uses ``gamma``; below it uses ``gamma_sat``.
    Pore pressure is hydrostatic from the groundwater table.
    Returns floats for scalar z, otherwise numpy arrays.
    """
    scalar = np.ndim(z) == 0
    z_arr = np.atleast_1d(np.asarray(z, dtype=float))
    if np.any(z_arr < -DEPTH_TOL) or np.any(z_arr > profile.bottom + DEPTH_TOL):
        raise ProfileError(f"Depth outside the profile (0 - {profile.bottom} m)")
    if gwt_depth < 0:
        raise ProfileError("Groundwater depth must be >= 0 (ponded water is not supported)")

    # Segment breakpoints: layer boundaries plus the water table.
    breaks = profile.boundaries()
    if 0 < gwt_depth < profile.bottom:
        breaks = np.union1d(breaks, [gwt_depth])
    tops, bots = breaks[:-1], breaks[1:]

    seg_gamma = np.empty(len(tops))
    for i, (a, b) in enumerate(zip(tops, bots)):
        layer = profile.layer_at(0.5 * (a + b))
        seg_gamma[i] = layer.gamma if b <= gwt_depth + DEPTH_TOL else layer.gamma_sat

    sigma_top = np.concatenate([[0.0], np.cumsum(seg_gamma * (bots - tops))[:-1]])
    idx = np.clip(np.searchsorted(breaks, z_arr, side="right") - 1, 0, len(tops) - 1)
    sigma_v = sigma_top[idx] + seg_gamma[idx] * (z_arr - tops[idx])
    u = gamma_w * np.maximum(0.0, z_arr - gwt_depth)
    sigma_eff = sigma_v - u

    if scalar:
        return float(sigma_v[0]), float(u[0]), float(sigma_eff[0])
    return sigma_v, u, sigma_eff
