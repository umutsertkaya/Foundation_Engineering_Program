"""Lateral pressure distribution on a vertical plane through a layered SoilProfile.

This is the Module 1 -> Module 2 link: strengths come from each layer's engineer-approved
``DesignParameters``; unit weights and groundwater from the profile.

Horizontal effective pressure per layer:
    active  : sigma'_h = K_h (sigma'_v + q) - 2 c' sqrt(K)      (>= 0, tension crack)
    passive : sigma'_h = K_h (sigma'_v + q) + 2 c' sqrt(K)
    at rest : sigma'_h = K0 (sigma'_v + q),  K0 = 1 - sin(phi')  (Jaky, normally consolidated)
Undrained (total stress) analysis uses phi = 0, c = s_u on total vertical stress with no
separate water pressure. Water pressure is hydrostatic below the chosen GWT.

Pressures are piecewise linear in depth. The diagram is evaluated at every breakpoint
(layer boundaries, water table, tension-crack depth, minimum-pressure crossover) and the
resultant and its depth are integrated exactly.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Literal

import numpy as np

from geotek.core.constants import GAMMA_W
from geotek.core.errors import GeoTekError
from geotek.core.models.profile import SoilLayer, SoilProfile
from geotek.engine.earth_pressure.coefficients import (
    coulomb_ka, coulomb_kp, mononobe_okabe_kae, rankine_ka, rankine_kp,
)
from geotek.engine.earth_pressure.log_spiral import log_spiral_kp

State = Literal["active", "passive", "at_rest"]
Method = Literal["rankine", "coulomb", "log_spiral"]


@dataclass
class PressureDistribution:
    z: np.ndarray
    """Depth below the top of the plane [m]; a layer boundary appears twice (jump)."""
    sigma_v_eff: np.ndarray
    """Vertical stress used (effective, or total for undrained), incl. surcharge [kPa]."""
    K: np.ndarray
    """Horizontal-component coefficient at each point."""
    sigma_h_eff: np.ndarray
    u: np.ndarray
    sigma_h: np.ndarray
    """Total horizontal pressure = sigma'_h + u [kPa]."""
    force: float
    """Horizontal resultant [kN/m]."""
    z_resultant: float
    """Depth of the resultant below the top [m]."""
    state: str
    method: str
    warnings: list[str] = field(default_factory=list)

    def component(self, which: Literal["effective", "water"]):
        """(resultant [kN/m], depth [m]) of one component."""
        return resultant(self.z, self.sigma_h_eff if which == "effective" else self.u)


def resultant(z, p) -> tuple[float, float]:
    """Exact force and centroid depth of a piecewise-linear pressure diagram."""
    z, p = np.asarray(z, float), np.asarray(p, float)
    dz = np.diff(z)
    f = float(np.sum(0.5 * (p[:-1] + p[1:]) * dz))
    m = float(np.sum(dz / 6.0 * (p[:-1] * (2 * z[:-1] + z[1:]) + p[1:] * (z[:-1] + 2 * z[1:]))))
    return f, (m / f if f > 0 else float("nan"))


def _layer_coefficients(layer: SoilLayer, state, method, delta, beta, drainage, warnings,
                        *, theta=0.0, kh=0.0, kv=0.0):
    """(K_horizontal, K_for_cohesion, c) for a layer."""
    dp = layer.design
    if drainage == "undrained":
        if dp.su is None:
            raise GeoTekError(f"Layer {layer.id}: undrained analysis needs s_u")
        if kh or kv:
            raise GeoTekError(f"Layer {layer.id}: seismic undrained earth pressure is not implemented")
        return 1.0, 1.0, dp.su
    if dp.phi_eff is None:
        raise GeoTekError(f"Layer {layer.id}: design phi' not set")
    phi, c = dp.phi_eff, dp.c_eff
    if state == "at_rest":
        if beta:
            raise GeoTekError("At-rest coefficient implemented for horizontal backfill only")
        return 1.0 - math.sin(math.radians(phi)), 1.0, 0.0
    if method == "rankine":
        if c and beta:
            raise GeoTekError("Cohesion with sloping backfill is not supported (Rankine)")
        k = rankine_ka(phi, beta) if state == "active" else rankine_kp(phi, beta)
        return k * math.cos(math.radians(beta)), k, c
    if c:
        warnings.append(f"Layer {layer.id}: c' ignored by the {method} solution")
    if method == "coulomb":
        if (kh or kv) and state != "active":
            raise GeoTekError("Seismic distribution is implemented for active Coulomb pressure only")
        if state == "active" and (kh or kv):
            k = (1.0 - kv) * mononobe_okabe_kae(phi, delta, theta, beta, kh, kv)
        else:
            k = coulomb_ka(phi, delta, theta, beta) if state == "active" else coulomb_kp(phi, delta, theta, beta)
        if state == "passive" and delta > phi / 2:
            warnings.append(f"Layer {layer.id}: Coulomb passive with delta > phi/2 is unconservative")
        return k * math.cos(math.radians(delta + theta)), k, 0.0
    if method == "log_spiral":
        if state != "passive" or beta:
            raise GeoTekError("Log-spiral is implemented for passive pressure, horizontal backfill")
        r = log_spiral_kp(phi, min(delta, phi))
        return r.Kp_horizontal, r.Kp, 0.0
    raise GeoTekError(f"Unknown method {method!r}")


def _insert_crossings(z, seg, y):
    """Add nodes where y changes sign inside a segment (not across a layer jump)."""
    zs, ss = [z[0]], [seg[0]]
    for i in range(1, z.size):
        same = seg[i] == seg[i - 1] and z[i] > z[i - 1]
        if same and y[i - 1] * y[i] < 0:
            zs.append(z[i - 1] + (z[i] - z[i - 1]) * y[i - 1] / (y[i - 1] - y[i]))
            ss.append(seg[i])
        zs.append(z[i])
        ss.append(seg[i])
    return np.array(zs), np.array(ss)


def lateral_pressure(
    profile: SoilProfile,
    height: float,
    *,
    state: State = "active",
    method: Method = "rankine",
    delta: float = 0.0,
    beta: float = 0.0,
    surcharge: float = 0.0,
    gwt_case: Literal["insitu", "design", "seismic"] = "design",
    drainage: Literal["drained", "undrained"] = "drained",
    top: float = 0.0,
    min_efp: float | None = None,
    theta: float = 0.0,
    kh: float = 0.0,
    kv: float = 0.0,
    layerwise: bool = False,
    delta_ratio: float | None = None,
    total_stress_surcharge: float = 0.0,
) -> PressureDistribution:
    """Pressure on a vertical plane from depth ``top`` to ``top + height`` of the profile.

    ``top`` > 0 models the passive side in front of a wall (soil starts at the dredge line,
    the overburden above it is removed). ``min_efp``: minimum equivalent fluid pressure
    [kN/m3] for the active case (e.g. cohesive backfill), sigma'_h >= min_efp * z.

    Opt-in wall extensions: ``theta`` is face lean; ``kh, kv`` select M-O active
    coefficients; ``layerwise`` reads each layer's drainage behaviour. ``delta_ratio``
    uses delta = ratio * phi per drained layer. Defaults preserve the original path.
    Undrained layers use total stress without an additional water component.
    ``total_stress_surcharge`` is an optional boundary load on undrained layers
    only, e.g. free water above an excavated front ground.
    """
    if height <= 0 or top < 0:
        raise GeoTekError("Height must be positive")
    if (theta or kh or kv or delta_ratio is not None) and method != "coulomb":
        raise GeoTekError("Face lean and seismic coefficients require the Coulomb method")
    bottom = top + height
    if bottom > profile.bottom + 1e-9:
        raise GeoTekError(f"Profile ends at {profile.bottom} m, above the base at {bottom} m")
    warnings: list[str] = []
    gwt = profile.gwt.depth_for(gwt_case)

    coeffs, modes, z_nodes, seg_nodes = [], [], [], []
    for layer in profile.layers:
        a, b = max(layer.top, top), min(layer.bottom, bottom)
        if b <= a:
            continue
        mode = layer.behaviour if layerwise else drainage
        layer_delta = (delta_ratio * layer.design.phi_eff
                       if delta_ratio is not None and mode == "drained" and layer.design.phi_eff is not None
                       else delta)
        coeffs.append(_layer_coefficients(layer, state, method, layer_delta, beta, mode, warnings,
                                          theta=theta, kh=kh, kv=kv))
        modes.append(mode)
        pts = [a, b] + ([gwt] if a < gwt < b else [])
        z_nodes += sorted(pts)
        seg_nodes += [len(coeffs) - 1] * len(pts)
    z = np.array(z_nodes)
    seg = np.array(seg_nodes)

    def evaluate(z, seg):
        K = np.array([coeffs[s][0] for s in seg])
        Kc = np.array([coeffs[s][1] for s in seg])
        c = np.array([coeffs[s][2] for s in seg])
        sv, u, sve = profile.stresses(z, gwt_case)
        if top > 0:  # excavated overburden above the dredge line
            sv = sv - profile.stresses(top, gwt_case)[0]
            u = GAMMA_W * np.maximum(0.0, z - max(gwt, top))
            sve = sv - u
        if layerwise:
            undrained = np.array([modes[s] == "undrained" for s in seg])
            vertical = np.where(undrained, sv, sve) + surcharge
            u = np.where(undrained, 0.0, u)
        elif drainage == "undrained":
            vertical, u = sv + surcharge, np.zeros_like(z)
        else:
            vertical = sve + surcharge
        if total_stress_surcharge:
            if layerwise:
                vertical = vertical + np.where(undrained, total_stress_surcharge, 0.0)
            elif drainage == "undrained":
                vertical = vertical + total_stress_surcharge
        cterm = 2.0 * c * np.sqrt(Kc)
        sign = {"active": -1.0, "passive": 1.0, "at_rest": 0.0}[state]
        return K, vertical, u, K * vertical + sign * cterm

    K, vertical, u, she = evaluate(z, seg)
    if state == "active":
        z, seg = _insert_crossings(z, seg, she)
        K, vertical, u, she = evaluate(z, seg)
        if np.any(she < -1e-9):
            warnings.append(f"Tension zone to {float(z[she < -1e-9].max() - top):.2f} m set to zero (tension crack)")
        she = np.maximum(she, 0.0)
        if min_efp is not None:
            z, seg = _insert_crossings(z, seg, she - min_efp * (z - top))
            K, vertical, u, she = evaluate(z, seg)
            she = np.maximum(np.maximum(she, 0.0), min_efp * (z - top))

    z_rel = z - top
    total = she + u
    force, z_res = resultant(z_rel, total)
    return PressureDistribution(
        z=z_rel, sigma_v_eff=vertical, K=K, sigma_h_eff=she, u=u, sigma_h=total,
        force=force, z_resultant=z_res, state=state, method=method, warnings=warnings,
    )
