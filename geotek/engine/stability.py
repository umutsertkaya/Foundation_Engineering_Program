"""Circular slip surface stability: Bishop's simplified method (moment equilibrium).

    F = sum[(c b + (W - u b) tan phi) / m_alpha] / sum[W sin(alpha) + kh W (y_c - y_g) / R]
    m_alpha = cos(alpha) + sin(alpha) tan(phi) / F

The sliding mass moves toward -x. Soil is horizontally layered (layer i spans from its top
elevation down to the next layer's top), pore pressure is hydrostatic below a horizontal
water level (no ponded water above the surface), and vertical distributed loads act on the
ground surface. Pseudo-static seismic loading uses kh on the slice weights.

Reference: Bishop, A.W. (1955). The use of the slip circle in the stability analysis of
slopes. Geotechnique 5(1).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
from scipy.optimize import minimize

from geotek.core.constants import GAMMA_W
from geotek.core.errors import GeoTekError

DRIVING_MIN_RATIO = 1e-6
"""A circle is rejected when its net driving moment is below this fraction of the sum of the
absolute slice moments (a symmetric mass on flat ground cancels to round-off)."""

M_ALPHA_MIN = 0.2
"""Circles with a smaller m_alpha on an exit-side slice (alpha < 0) are rejected."""


@dataclass
class SoilBand:
    top: float
    """Top elevation [m]; the band extends down to the next band's top."""
    gamma: float
    c: float = 0.0
    phi: float = 0.0


@dataclass
class SurfaceLoad:
    x1: float
    x2: float
    q1: float
    q2: float
    """Vertical pressure [kPa] varying linearly from x1 to x2."""


@dataclass
class SlopeModel:
    surface: list[tuple[float, float]]
    layers: list[SoilBand]
    water_level: float | None = None
    loads: list[SurfaceLoad] = field(default_factory=list)
    kh: float = 0.0

    def __post_init__(self):
        xs = [p[0] for p in self.surface]
        if any(b <= a for a, b in zip(xs, xs[1:])):
            raise GeoTekError("Surface x coordinates must be strictly increasing")
        if not self.layers:
            raise GeoTekError("At least one soil band is required")
        self.layers = sorted(self.layers, key=lambda s: -s.top)
        self._sx = np.array(xs, dtype=float)
        self._sy = np.array([p[1] for p in self.surface], dtype=float)

    def surface_y(self, x):
        return np.interp(x, self._sx, self._sy)

    def band_at(self, y: float) -> SoilBand:
        chosen = self.layers[0]
        for band in self.layers:
            if y <= band.top + 1e-12:
                chosen = band
        return chosen

    def column_weight(self, y_bot: float, y_top: float) -> float:
        """Weight per unit area of the soil column between two elevations [kPa]."""
        tops = [b.top for b in self.layers]
        total = 0.0
        for i, band in enumerate(self.layers):
            upper = math.inf if i == 0 else tops[i]
            lower = tops[i + 1] if i + 1 < len(tops) else -math.inf
            a, b = max(y_bot, lower), min(y_top, upper)
            if b > a:
                total += band.gamma * (b - a)
        return total

    def load_at(self, x: float) -> float:
        q = 0.0
        for ld in self.loads:
            if ld.x1 <= x <= ld.x2 and ld.x2 > ld.x1:
                q += ld.q1 + (ld.q2 - ld.q1) * (x - ld.x1) / (ld.x2 - ld.x1)
        return q


@dataclass
class SlipResult:
    fs: float
    xc: float
    yc: float
    radius: float
    x_entry: float
    x_exit: float
    slices: dict[str, np.ndarray] = field(default_factory=dict)
    iterations: int = 0


def _slip_interval(model: SlopeModel, xc, yc, R, n_probe=600):
    x0, x1 = max(model._sx[0], xc - R), min(model._sx[-1], xc + R)
    if x1 <= x0:
        return None
    x = np.linspace(x0, x1, n_probe)
    ybot = yc - np.sqrt(np.maximum(R**2 - (x - xc) ** 2, 0.0))
    d = model.surface_y(x) - ybot
    pos = d > 1e-9
    if not pos.any():
        return None
    # longest contiguous run of positive depth
    edges = np.flatnonzero(np.diff(np.r_[0, pos.astype(int), 0]))
    starts, ends = edges[::2], edges[1::2] - 1
    k = int(np.argmax(ends - starts))
    i, j = starts[k], ends[k]
    if i == 0 or j == x.size - 1:
        # The arc is still below ground at the model boundary (or the centre is below the
        # surface): part of the sliding mass would be cut off, so the circle is rejected.
        return None

    def root(a, b):
        return x[a] + (x[b] - x[a]) * (0 - d[a]) / (d[b] - d[a])

    return root(i - 1, i), root(j, j + 1)


def bishop(model: SlopeModel, xc: float, yc: float, R: float, *, n_slices: int = 40,
           min_width: float = 0.0, exit_max: float | None = None, entry_min: float | None = None,
           tol: float = 1e-6, max_iter: int = 200) -> SlipResult | None:
    """Bishop's simplified FS for one circle; None if the circle is not admissible.

    ``exit_max`` / ``entry_min`` restrict where the arc may emerge (e.g. in front of a wall
    toe and behind its heel).
    """
    interval = _slip_interval(model, xc, yc, R)
    if interval is None:
        return None
    xa, xb = interval
    if xb - xa <= max(min_width, 1e-6):
        return None
    if (exit_max is not None and xa > exit_max) or (entry_min is not None and xb < entry_min):
        return None
    edges = np.linspace(xa, xb, n_slices + 1)
    xm = 0.5 * (edges[:-1] + edges[1:])
    b = np.diff(edges)
    ybot = yc - np.sqrt(np.maximum(R**2 - (xm - xc) ** 2, 0.0))
    ytop = model.surface_y(xm)
    h = np.maximum(ytop - ybot, 0.0)
    W = np.array([model.column_weight(yb, yt) for yb, yt in zip(ybot, ytop)]) * b
    W += np.array([model.load_at(x) for x in xm]) * b
    yg = 0.5 * (ybot + ytop)
    sin_a = (xm - xc) / R
    cos_a = np.sqrt(np.maximum(1 - sin_a**2, 0.0))
    bands = [model.band_at(y) for y in ybot]
    c = np.array([bd.c for bd in bands])
    tphi = np.tan(np.radians([bd.phi for bd in bands]))
    u = GAMMA_W * np.maximum(0.0, (model.water_level - ybot)) if model.water_level is not None else np.zeros_like(xm)

    driving = float(np.sum(W * sin_a) + np.sum(model.kh * W * (yc - yg)) / R)
    if driving <= DRIVING_MIN_RATIO * float(np.sum(np.abs(W * sin_a)) + np.sum(model.kh * W * np.abs(yc - yg)) / R):
        # No driving moment (flat or reversed ground): the quotient would be round-off noise
        # (FS ~ 1e16) instead of a safety factor.
        return None
    numer_base = c * b + np.maximum(W - u * b, 0.0) * tphi
    F = 1.0
    for it in range(1, max_iter + 1):
        m_alpha = cos_a + sin_a * tphi / F
        # Instability arises on the exit side (alpha < 0) where tan(phi)/F reduces m_alpha
        if np.any(m_alpha <= 0) or np.any(m_alpha[sin_a < 0] < M_ALPHA_MIN):
            return None
        F_new = float(np.sum(numer_base / m_alpha) / driving)
        if abs(F_new - F) < tol:
            F = F_new
            break
        F = F_new
    else:
        return None
    slices = dict(x=xm, width=b, y_base=ybot, height=h, weight=W, alpha=np.degrees(np.arcsin(sin_a)),
                  c=c, phi=np.degrees(np.arctan(tphi)), u=u)
    return SlipResult(fs=F, xc=xc, yc=yc, radius=R, x_entry=float(xb), x_exit=float(xa),
                      slices=slices, iterations=it)


def search_critical_circle(
    model: SlopeModel,
    *,
    x_range: tuple[float, float],
    y_range: tuple[float, float],
    tangent_range: tuple[float, float],
    n_x: int = 15,
    n_y: int = 15,
    n_tangent: int = 12,
    min_width: float = 0.0,
    exit_max: float | None = None,
    entry_min: float | None = None,
    n_slices: int = 40,
    refine: bool = True,
) -> SlipResult:
    """Grid of centres x tangent elevations (R = y_c - y_tangent), then Nelder-Mead refinement
    constrained to the same tangent range."""
    kw = dict(n_slices=n_slices, min_width=min_width, exit_max=exit_max, entry_min=entry_min)
    best: SlipResult | None = None
    for xc in np.linspace(*x_range, n_x):
        for yc in np.linspace(*y_range, n_y):
            for yt in np.linspace(*tangent_range, n_tangent):
                R = yc - yt
                if R <= 0:
                    continue
                r = bishop(model, xc, yc, R, **kw)
                if r is not None and (best is None or r.fs < best.fs):
                    best = r
    if best is None:
        raise GeoTekError("No admissible slip circle found in the search domain")
    if refine:
        lo_t, hi_t = min(tangent_range), max(tangent_range)

        def objective(v):
            xc, yc, R = v
            yt = yc - R
            if R <= 0 or yt < lo_t - 1e-9 or yt > hi_t + 1e-9:
                return 1e6
            r = bishop(model, xc, yc, R, **kw)
            return 1e6 if r is None else r.fs

        res = minimize(objective, [best.xc, best.yc, best.radius], method="Nelder-Mead",
                       options={"xatol": 1e-3, "fatol": 1e-5, "maxiter": 400})
        if res.fun < best.fs:
            refined = bishop(model, *res.x, **kw)
            if refined is not None:
                best = refined
    return best
