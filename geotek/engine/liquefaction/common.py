"""Shared liquefaction machinery: seismic demand, point status, result container, LPI."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from geotek.core.models.profile import SoilProfile
from geotek.engine.insitu.cpt import stresses_from_unit_weight
from geotek.engine.stresses import vertical_stresses

# Point status codes
LIQUEFIABLE = "liquefiable"          # FS < 1
MARGINAL = "marginal"                # 1 <= FS < target
SAFE = "safe"                        # FS >= target
ABOVE_GWT = "above_gwt"              # not saturated during the earthquake
CLAY_LIKE = "clay_like"              # not susceptible; check cyclic softening
DENSE = "non_liquefiable_dense"      # resistance above the method's upper limit
EXCLUDED = "excluded_by_user"
BEYOND_DEPTH = "beyond_method_depth"
INVALID = "invalid"

NO_FS_STATUSES = (ABOVE_GWT, CLAY_LIKE, DENSE, EXCLUDED, BEYOND_DEPTH, INVALID)

LPI_SURFACE_EXTENSION_DEPTH = 2.0
"""Depth [m] up to which the first test point is extended to the ground surface in the LPI."""

SIMPLIFIED_DEPTH_WARNING = 20.0
"""Depth [m] beyond which the simplified procedure is less reliable."""


def cyclic_stress_ratio(amax_g: float, sigma_v, sigma_v_eff, rd):
    """CSR = 0.65 (a_max/g) (sigma_v0 / sigma'_v0) r_d (Seed & Idriss 1971)."""
    with np.errstate(divide="ignore", invalid="ignore"):
        return 0.65 * amax_g * np.asarray(sigma_v) / np.asarray(sigma_v_eff) * rd


def seismic_stresses(depth, *, profile: SoilProfile | None = None, gamma=None, gwt_depth=None):
    """Stresses at the time of the earthquake.

    With a profile, its seismic GWT is used unless ``gwt_depth`` overrides it. Without a
    profile, ``gamma`` (e.g. estimated from the CPT) and ``gwt_depth`` are required.
    Returns (sigma_v, u, sigma_v_eff, gwt_depth).
    """
    if profile is not None:
        gwt = profile.gwt.depth_seismic if gwt_depth is None else gwt_depth
        sv, u, se = vertical_stresses(profile, depth, gwt)
        return sv, u, se, gwt
    if gamma is None or gwt_depth is None:
        raise ValueError("Without a soil profile both unit weights and the seismic GWT are required")
    sv, u, se = stresses_from_unit_weight(depth, gamma, gwt_depth)
    return sv, u, se, gwt_depth


def tributary_thickness(depth) -> tuple[np.ndarray, np.ndarray]:
    """Top and bottom of the interval represented by each test point (midpoint rule)."""
    z = np.asarray(depth, dtype=float)
    if z.size == 1:
        return np.array([0.0]), z.copy()
    mids = 0.5 * (z[1:] + z[:-1])
    top = np.concatenate([[max(0.0, z[0] - (z[1] - z[0]) / 2)], mids])
    bot = np.concatenate([mids, [z[-1] + (z[-1] - z[-2]) / 2]])
    return top, bot


def liquefaction_potential_index(depth, fs, gwt_depth: float | None = None) -> float:
    """LPI = integral over 0-20 m of F(z) w(z) dz (Iwasaki et al. 1978).

    F = 1 - FS for FS < 1, else 0 (NaN FS, i.e. non-susceptible points, count as 0);
    w = 10 - 0.5 z.

    When the first test point is shallow (at most ``LPI_SURFACE_EXTENSION_DEPTH``), it also
    represents the layer above it: its interval is extended up to the ground surface, where
    the weight is largest (dropping that layer is on the unsafe side). Every cell is clipped
    to ``[gwt_depth, 20 m]`` when ``gwt_depth`` is given, since soil above the water table is not
    counted as liquefiable. Depths must be finite and sorted ascending (ValueError otherwise).
    """
    depth = np.asarray(depth, dtype=float)
    if depth.size == 0:
        return 0.0
    if not np.all(np.isfinite(depth)):
        raise ValueError("LPI needs finite test depths")
    if np.any(np.diff(depth) < 0):
        raise ValueError("LPI needs test depths sorted in ascending order")
    top, bot = tributary_thickness(depth)
    top = top.copy()
    if depth[0] <= LPI_SURFACE_EXTENSION_DEPTH:
        top[0] = 0.0
    # Every cell is clipped to [GWT, 20 m]: soil above the water table is not counted as liquefiable.
    lower = 0.0 if gwt_depth is None else max(0.0, float(gwt_depth))
    top, bot = np.clip(top, lower, 20.0), np.clip(bot, lower, 20.0)
    fs = np.asarray(fs, dtype=float)
    F = np.where(np.isfinite(fs) & (fs < 1.0), 1.0 - fs, 0.0)
    # exact integral of the linear weight over each interval
    w_int = 10.0 * (bot - top) - 0.25 * (bot**2 - top**2)
    return float(np.sum(F * w_int))


def lpi_category(lpi: float) -> str:
    """Iwasaki et al. (1982) categories."""
    if lpi == 0:
        return "very_low"
    if lpi <= 5:
        return "low"
    if lpi <= 15:
        return "high"
    return "very_high"


@dataclass
class LiquefactionResult:
    method: str
    """'youd2001' or 'bi2014'."""
    test_type: str
    """'SPT' or 'CPT'."""
    source_id: str
    amax_g: float
    mw: float
    gwt_depth: float
    target_fs: float
    depth: np.ndarray
    sigma_v: np.ndarray
    sigma_v_eff: np.ndarray
    rd: np.ndarray
    csr: np.ndarray
    resistance: np.ndarray
    """(N1)60cs for SPT, q_c1Ncs for CPT."""
    fc: np.ndarray
    crr75: np.ndarray
    """CRR for M = 7.5 and sigma'_v0 = 1 atm."""
    msf: np.ndarray
    ksigma: np.ndarray
    crr: np.ndarray
    fs: np.ndarray
    status: np.ndarray
    ic: np.ndarray | None = None
    warnings: list[str] = field(default_factory=list)

    @property
    def resistance_name(self) -> str:
        return "N1_60cs" if self.test_type == "SPT" else "qc1Ncs"

    @property
    def lpi(self) -> float:
        return liquefaction_potential_index(self.depth, self.fs, self.gwt_depth)

    def to_dataframe(self) -> pd.DataFrame:
        cols = {
            "depth": self.depth, "sigma_v": self.sigma_v, "sigma_v_eff": self.sigma_v_eff,
            "rd": self.rd, "CSR": self.csr, self.resistance_name: self.resistance, "FC": self.fc,
            "CRR7.5": self.crr75, "MSF": self.msf, "Ksigma": self.ksigma, "CRR": self.crr,
            "FS": self.fs, "status": self.status,
        }
        if self.ic is not None:
            cols["Ic"] = self.ic
        return pd.DataFrame(cols)

    def summary(self) -> dict:
        counts = {s: int(np.sum(self.status == s)) for s in np.unique(self.status)}
        liq = self.depth[self.status == LIQUEFIABLE]
        invalid = int(np.sum(self.status == INVALID))
        all_invalid = self.status.size > 0 and invalid == self.status.size
        lpi = None if all_invalid else self.lpi
        return {
            "method": self.method, "test_type": self.test_type, "source_id": self.source_id,
            "status_counts": counts,
            "liquefiable_depths": (float(liq.min()), float(liq.max())) if liq.size else None,
            "min_fs": float(np.nanmin(self.fs)) if np.isfinite(self.fs).any() else None,
            "LPI": lpi, "LPI_category": None if lpi is None else lpi_category(lpi),
            # Invalid points contribute 0 to the LPI, so a partly invalid sounding may understate it.
            "LPI_incomplete": 0 < invalid < self.status.size,
        }


def assign_status(
    *,
    depth,
    gwt_depth: float,
    sigma_v_eff,
    fs,
    target_fs: float,
    max_depth: float,
    clay_like=None,
    dense=None,
    exclude=None,
):
    """Status per point. Order of precedence: excluded, above GWT, beyond depth, clay-like,
    dense, invalid (no finite FS), then FS classes. FS is set to NaN for points without an FS."""
    z = np.asarray(depth, dtype=float)
    fs = np.asarray(fs, dtype=float).copy()
    n = z.size
    false = np.zeros(n, dtype=bool)
    clay_like = false if clay_like is None else np.asarray(clay_like, dtype=bool)
    dense = false if dense is None else np.asarray(dense, dtype=bool)
    exclude = false if exclude is None else np.asarray(exclude, dtype=bool)

    status = np.where(fs < 1.0, LIQUEFIABLE, np.where(fs < target_fs, MARGINAL, SAFE)).astype(object)
    # Applied in reverse precedence so earlier rules win
    rules = [
        (~(np.asarray(sigma_v_eff) > 0) | ~np.isfinite(fs), INVALID),
        (dense, DENSE),
        (clay_like, CLAY_LIKE),
        (z > max_depth, BEYOND_DEPTH),
        (z < gwt_depth, ABOVE_GWT),
        (exclude, EXCLUDED),
    ]
    for mask, code in rules:
        status = np.where(mask, code, status)
    no_fs = np.isin(status, NO_FS_STATUSES)
    fs[no_fs] = np.nan
    return status, fs
