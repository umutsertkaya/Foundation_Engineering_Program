"""Passive earth pressure with a log-spiral failure surface (Terzaghi 1943 method).

Vertical wall, horizontal cohesionless backfill, wall friction delta. The failure surface
is a log spiral from the heel, tangent to the planar boundary of a Rankine passive zone that
reaches the ground surface. The pole O lies on the ground surface; moment equilibrium about
O eliminates the reaction on the spiral (it passes through O). The minimum wall force over
the pole position is the passive resistance.

Coordinates: top of wall A = (0, 0), heel B = (0, -H), soil on the +x side.
The spiral r = r_B exp((psi - psi_B) tan(phi)) expands from B toward C, which is the
orientation for which the friction on the spiral opposes the upward wedge motion.

References: Terzaghi (1943) Theoretical Soil Mechanics; Das, Principles of Foundation
Engineering, Ch. 7 (passive pressure with curved failure surface).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from scipy.optimize import minimize_scalar

from geotek.core.errors import GeoTekError

N_SPIRAL = 400


@dataclass
class LogSpiralResult:
    Kp: float
    """P_p / (1/2 gamma H^2); P_p inclined at delta below the face normal."""
    Kp_horizontal: float
    pole_x: float
    """Critical pole position on the ground surface, as a multiple of H."""


def _moment(o, point, force):
    return (point[0] - o[0]) * force[1] - (point[1] - o[1]) * force[0]


def _polygon_area_centroid(pts: np.ndarray):
    x, y = pts[:, 0], pts[:, 1]
    x1, y1 = np.roll(x, -1), np.roll(y, -1)
    cross = x * y1 - x1 * y
    a = 0.5 * cross.sum()
    if abs(a) < 1e-12:
        return 0.0, np.array([0.0, 0.0])
    cx = ((x + x1) * cross).sum() / (6 * a)
    cy = ((y + y1) * cross).sum() / (6 * a)
    return abs(a), np.array([cx, cy])


def _passive_force(x0, *, H, gamma, phi, delta):
    a = math.pi / 4 - phi / 2
    o = np.array([x0, 0.0])
    psi_b = math.atan2(-H, -x0)
    psi_c = -a
    span = psi_c - psi_b
    if span < -1e-12:
        return math.nan
    r_b = math.hypot(x0, H)
    psi = np.linspace(psi_b, psi_c, N_SPIRAL)
    r = r_b * np.exp((psi - psi_b) * math.tan(phi))
    spiral = o + np.column_stack([r * np.cos(psi), r * np.sin(psi)])
    if spiral[:, 0].min() < -1e-9:
        return math.nan  # the spiral would cut through the wall
    c = spiral[-1]
    h_c = -c[1]
    poly = np.vstack([[0.0, 0.0], spiral, [c[0], 0.0]])
    area, centroid = _polygon_area_centroid(poly)

    kp_rankine = math.tan(math.pi / 4 + phi / 2) ** 2
    m_w = _moment(o, centroid, np.array([0.0, -gamma * area]))
    m_d = _moment(o, np.array([c[0], -2 * h_c / 3]), np.array([-0.5 * gamma * h_c**2 * kp_rankine, 0.0]))
    m_unit = _moment(o, np.array([0.0, -2 * H / 3]), np.array([math.cos(delta), -math.sin(delta)]))
    if abs(m_unit) < 1e-12:
        return math.nan
    return -(m_w + m_d) / m_unit


def log_spiral_kp(phi: float, delta: float = 0.0, *, H: float = 1.0, gamma: float = 1.0) -> LogSpiralResult:
    """Passive coefficient for a vertical wall and horizontal backfill. Angles in degrees.

    K_p is independent of H and gamma; they are parameters only for testing.
    """
    if not 0 < phi < 60:
        raise GeoTekError("phi must be within 0-60 deg")
    if not 0 <= delta <= phi:
        raise GeoTekError("delta must be within 0-phi")
    p, d = math.radians(phi), math.radians(delta)
    x_min = -H / math.tan(math.pi / 4 - p / 2)
    kw = dict(H=H, gamma=gamma, phi=p, delta=d)
    xs = np.linspace(x_min, x_min + 6 * H, 600)
    forces = np.array([_passive_force(x, **kw) for x in xs])
    ok = np.isfinite(forces) & (forces > 0)
    if not ok.any():
        raise GeoTekError("Log-spiral search found no admissible mechanism")
    i = int(np.argmin(np.where(ok, forces, np.inf)))
    lo, hi = xs[max(i - 1, 0)], xs[min(i + 1, xs.size - 1)]

    def fn(x):
        v = _passive_force(x, **kw)
        return math.inf if not (math.isfinite(v) and v > 0) else v

    res = minimize_scalar(fn, bounds=(lo, hi), method="bounded", options={"xatol": 1e-9})
    P, x0 = (res.fun, res.x) if res.fun <= forces[i] else (forces[i], xs[i])
    kp = P / (0.5 * gamma * H**2)
    return LogSpiralResult(Kp=float(kp), Kp_horizontal=float(kp * math.cos(d)), pole_x=float(x0 / H))
