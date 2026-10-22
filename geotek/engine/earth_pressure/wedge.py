"""Numerical trial-wedge (Coulomb / Culmann type) earth pressure for cohesionless backfill.

A planar failure surface through the heel is searched for the maximum active (or minimum
passive) wall force, from force equilibrium of the wedge. Supports a battered back face,
sloping ground, a uniform vertical surcharge and pseudo-static seismic coefficients.
Unlike Mononobe-Okabe it also works when phi - beta - psi < 0 (FHWA GEC-3 "generalised
limit equilibrium"), as long as a bounded wedge exists.

Geometry: heel at the origin, retained soil on the +x side, back face rising to height H.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal

import numpy as np
from scipy.optimize import minimize_scalar

from geotek.core.errors import GeoTekError


@dataclass
class WedgeResult:
    force: float
    """Wall force P [kN/m], inclined at delta to the face normal."""
    K: float
    """P / (1/2 gamma H^2 (1 - kv)); equals the K of the closed-form solutions."""
    rho: float
    """Critical failure plane angle from horizontal [deg]."""
    state: str


def _wall_force(rho, *, H, gamma, phi, delta, theta, beta, q, kh, kv, state):
    """Wall force for a trial plane at angle rho [rad]; NaN if the wedge is not admissible."""
    lean = theta  # positive: top of the face moves away from the soil (-x)
    xa, ya = -H * math.tan(lean), H
    denom = math.sin(rho) - math.cos(rho) * math.tan(beta)
    if denom <= 1e-9:
        return math.nan
    s = (H - xa * math.tan(beta)) / denom
    xg, yg = s * math.cos(rho), s * math.sin(rho)
    if xg <= xa + 1e-9:
        return math.nan
    area = 0.5 * abs(xa * yg - ya * xg)
    W = gamma * area + q * (xg - xa)

    sign = 1.0 if state == "active" else -1.0
    # Body force on the wedge; inertia toward the wall for active, away from it for passive
    body = np.array([-sign * kh * W, -(1.0 - kv) * W])
    f = np.array([-math.sin(lean), math.cos(lean)])      # up along the face
    n_w = np.array([math.cos(lean), math.sin(lean)])     # face normal into the soil
    e = np.array([math.cos(rho), math.sin(rho)])         # up along the plane
    n_p = np.array([-math.sin(rho), math.cos(rho)])      # plane normal into the wedge
    p_dir = math.cos(delta) * n_w + sign * math.sin(delta) * f
    r_dir = math.cos(phi) * n_p + sign * math.sin(phi) * e
    try:
        P, R = np.linalg.solve(np.column_stack([p_dir, r_dir]), -body)
    except np.linalg.LinAlgError:
        return math.nan
    if R < 0:
        return math.nan
    return P


def trial_wedge(
    *,
    H: float,
    gamma: float,
    phi: float,
    delta: float = 0.0,
    theta: float = 0.0,
    beta: float = 0.0,
    q: float = 0.0,
    kh: float = 0.0,
    kv: float = 0.0,
    state: Literal["active", "passive"] = "active",
    n_grid: int = 720,
) -> WedgeResult:
    """Critical wedge. Angles in degrees; q is a vertical surcharge per horizontal length."""
    if H <= 0 or gamma <= 0:
        raise GeoTekError("H and gamma must be positive")
    if state not in ("active", "passive"):
        raise GeoTekError(f"Unknown earth pressure state {state!r}; expected 'active' or 'passive'")
    p, d, t, b = (math.radians(a) for a in (phi, delta, theta, beta))
    kwargs = dict(H=H, gamma=gamma, phi=p, delta=d, theta=t, beta=b, q=q, kh=kh, kv=kv, state=state)
    lo = max(b, -math.pi / 2) + 1e-4
    hi = math.pi / 2 + t - 1e-4  # the plane must stay on the soil side of the face
    if hi <= lo:
        raise GeoTekError("No admissible wedge for this geometry")
    rhos = np.linspace(lo, hi, n_grid)
    forces = np.array([_wall_force(r, **kwargs) for r in rhos])
    ok = np.isfinite(forces)
    if not ok.any():
        raise GeoTekError("No admissible wedge for this geometry")
    sign = 1.0 if state == "active" else -1.0
    objective = -sign * forces
    i = int(np.nanargmin(np.where(ok, objective, np.nan)))
    if state == "active" and i == 0:
        # Active force still grows toward the lower search bound (rho -> beta+): the wedge that
        # maximises it is unbounded (beta >= phi - psi), so no finite critical wedge exists.
        raise GeoTekError(
            "No finite critical wedge: the backfill slope is too steep for the friction angle and the "
            "seismic coefficient (beta >= phi - psi); the active force is unbounded")
    a, c = rhos[max(i - 1, 0)], rhos[min(i + 1, n_grid - 1)]

    def fn(r):
        v = _wall_force(r, **kwargs)
        return math.inf if not math.isfinite(v) else -sign * v

    res = minimize_scalar(fn, bounds=(a, c), method="bounded", options={"xatol": 1e-8})
    rho, P = (res.x, -sign * res.fun) if res.fun <= objective[i] else (rhos[i], forces[i])
    if state == "active" and P < 0:
        P = 0.0
    K = P / (0.5 * gamma * H**2 * (1.0 - kv))
    return WedgeResult(force=float(P), K=float(K), rho=math.degrees(rho), state=state)
