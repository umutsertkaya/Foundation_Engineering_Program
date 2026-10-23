"""Atterberg limits: liquid limit from a flow curve, plastic limit and plasticity index.

References
----------
ASTM D4318: multipoint liquid limit (Method A) reads the water content at 25 blows from
the straight line of w against log10(N); the one-point method (Method B) uses
LL = w (N/25)^0.121 for 20 <= N <= 30.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from geotek.core.warning_codes import format_warning

BLOW_RANGE = (15, 35)
"""Blow counts accepted by the multipoint method (ASTM D4318)."""
ONE_POINT_BLOW_RANGE = (20, 30)
ONE_POINT_EXPONENT = 0.121


@dataclass
class LiquidLimitResult:
    ll: float
    slope: float
    """Flow index: dw / dlog10(N) [% per log cycle] (negative for normal data)."""
    r2: float | None
    n_points: int
    warnings: list[str] = field(default_factory=list)


def liquid_limit_multipoint(blows, water_content) -> LiquidLimitResult:
    """LL = w at N = 25 on the least-squares line w = a + b log10(N)."""
    n = np.asarray(blows, dtype=float)
    w = np.asarray(water_content, dtype=float)
    if n.shape != w.shape or n.ndim != 1:
        raise ValueError("Blow counts and water contents must be equal-length lists")
    if n.size < 2:
        raise ValueError("At least two flow-curve points are required")
    if not (np.all(np.isfinite(n)) and np.all(np.isfinite(w))) or np.any(n <= 0) or np.any(w < 0):
        raise ValueError("Flow-curve data must be finite with positive blow counts")
    if np.ptp(n) == 0:
        raise ValueError("Flow-curve blow counts must not all be equal")
    warnings: list[str] = []
    if n.size < 3:
        warnings.append(format_warning("lab.warning.ll_few_points", count=int(n.size)))
    lo, hi = BLOW_RANGE
    if np.any(n < lo) or np.any(n > hi):
        warnings.append(format_warning("lab.warning.ll_blows_outside_range", minimum=lo, maximum=hi))
    x = np.log10(n)
    b, a = np.polyfit(x, w, 1)
    ll = float(a + b * math.log10(25.0))
    r2 = None
    if n.size >= 3:
        ss_tot = float(np.sum((w - w.mean()) ** 2))
        ss_res = float(np.sum((w - (a + b * x)) ** 2))
        r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 1.0
    if b >= 0:
        warnings.append(format_warning("lab.warning.ll_slope_not_negative"))
    return LiquidLimitResult(ll=ll, slope=float(b), r2=r2, n_points=int(n.size), warnings=warnings)


def liquid_limit_one_point(blows: float, water_content: float) -> tuple[float, list[str]]:
    """LL = w (N/25)^0.121 (ASTM D4318 Method B); warns outside 20-30 blows."""
    if blows <= 0 or water_content < 0:
        raise ValueError("Blow count must be positive and water content non-negative")
    warnings = []
    lo, hi = ONE_POINT_BLOW_RANGE
    if not lo <= blows <= hi:
        warnings.append(format_warning(
            "lab.warning.ll_one_point_range", blows=float(blows), minimum=lo, maximum=hi))
    return float(water_content * (blows / 25.0) ** ONE_POINT_EXPONENT), warnings


@dataclass
class PlasticityResult:
    ll: float | None
    pl: float | None
    pi: float | None
    non_plastic: bool
    """True when PL could not be determined or PL >= LL (reported as NP, not as an error)."""
    pl_spread: float | None = None
    """Max - min of the plastic-limit replicates [%]; no acceptance limit is applied."""
    n_pl: int = 0
    warnings: list[str] = field(default_factory=list)


def plasticity(ll: float | None, pl_values=None) -> PlasticityResult:
    """PL = mean of replicates; PI = LL - PL. NP when PL is missing or not below LL."""
    pls = [float(v) for v in (pl_values or []) if v is not None and math.isfinite(v)]
    if any(v < 0 for v in pls):
        raise ValueError("Plastic-limit water contents must be non-negative")
    pl = float(np.mean(pls)) if pls else None
    spread = float(max(pls) - min(pls)) if len(pls) > 1 else None
    if ll is None or pl is None:
        return PlasticityResult(ll, pl, None, non_plastic=False, pl_spread=spread, n_pl=len(pls))
    if pl >= ll:
        return PlasticityResult(ll, pl, 0.0, non_plastic=True, pl_spread=spread, n_pl=len(pls),
                                warnings=[format_warning("lab.warning.non_plastic")])
    return PlasticityResult(ll, pl, ll - pl, non_plastic=False, pl_spread=spread, n_pl=len(pls))
