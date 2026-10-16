"""Force bookkeeping and stability checks shared by all wall types (ASD).

Forces act on the wall system (wall body plus soil carried by the base). Moments are taken
about the toe (origin). Sign convention: Fx > 0 toward the retained soil, Fy > 0 upward.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from geotek.config.codes import FactorLog, UsedFactor, resolve_code
from geotek.core.errors import GeoTekError
from geotek.core.models.walls import Backfill, FoundationSoil, WallLoads, WallSettings
from geotek.engine.bearing import BearingResult, bearing_capacity
from geotek.engine.earth_pressure.coefficients import rankine_kp
from geotek.engine.earth_pressure.wedge import trial_wedge


@dataclass
class Force:
    name: str
    fx: float
    fy: float
    x: float
    y: float
    kind: str = "DC"
    """Load type for partial factors: DC (structure), EV (soil weight), EH (earth pressure),
    LS (surcharge), EQ (seismic), PASSIVE (resistance)."""

    @property
    def moment(self) -> float:
        """Moment about the toe, counter-clockwise positive (forward overturning)."""
        return self.x * self.fy - self.y * self.fx


@dataclass
class CheckResult:
    name: str
    value: float
    required: float
    passed: bool
    detail: str = ""
    factors_used: list[UsedFactor] = field(default_factory=list)
    comparison: str = ">="
    """How value is compared with required: '>=' (factor of safety) or '<=' (e.g. e/B)."""


@dataclass
class WallAnalysis:
    case: str
    """'static' or 'seismic'."""
    width: float
    forces: list[Force]
    sum_v: float
    sum_h: float
    m_resisting: float
    m_overturning: float
    eccentricity: float
    q_max: float
    q_min: float
    bearing: BearingResult | None
    checks: dict[str, CheckResult]
    warnings: list[str] = field(default_factory=list)
    factors_used: list[UsedFactor] = field(default_factory=list)
    """Every code factor used, with its source label."""

    @property
    def passed(self) -> bool:
        return all(c.passed for c in self.checks.values())


def polygon_area_centroid(points) -> tuple[float, float, float]:
    pts = np.asarray(points, dtype=float)
    x, y = pts[:, 0], pts[:, 1]
    x1, y1 = np.roll(x, -1), np.roll(y, -1)
    cross = x * y1 - x1 * y
    a = 0.5 * cross.sum()
    if abs(a) < 1e-12:
        return 0.0, float(x.mean()), float(y.mean())
    cx = ((x + x1) * cross).sum() / (6 * a)
    cy = ((y + y1) * cross).sum() / (6 * a)
    return abs(a), float(cx), float(cy)


def weight_forces(name, points, unit_weight, loads: WallLoads, seismic: bool, kind: str = "DC") -> list[Force]:
    """Weight and, in the seismic case, horizontal inertia toward the front.

    The vertical seismic coefficient is a separate EQ force (+kv W upward), so that load
    factors on the weight and on the seismic action stay independent.
    """
    area, cx, cy = polygon_area_centroid(points)
    if area <= 0:
        return []
    w = unit_weight * area
    out = [Force(name, 0.0, -w, cx, cy, kind)]
    if seismic and loads.kh > 0:
        out.append(Force(f"{name} (inertia)", -loads.kh * w, 0.0, cx, cy, "EQ"))
    if seismic and loads.kv != 0:
        out.append(Force(f"{name} (vertical seismic)", 0.0, loads.kv * w, cx, cy, "EQ"))
    return out


def clip_polygon_y(points, lower: float, upper: float):
    """Clip a polygon to a horizontal strip (Sutherland-Hodgman half planes)."""
    poly = list(points)
    for level, keep_above in ((lower, True), (upper, False)):
        if not poly:
            break
        clipped = []
        previous = poly[-1]
        previous_in = previous[1] >= level if keep_above else previous[1] <= level
        for current in poly:
            current_in = current[1] >= level if keep_above else current[1] <= level
            if current_in != previous_in:
                t = (level - previous[1]) / (current[1] - previous[1])
                clipped.append((previous[0] + t * (current[0] - previous[0]), level))
            if current_in:
                clipped.append(current)
            previous, previous_in = current, current_in
        poly = clipped
    return poly


def earth_thrust_forces(
    *,
    backfill: Backfill,
    loads: WallLoads,
    seismic: bool,
    H: float,
    base_point: tuple[float, float],
    theta: float,
    delta: float,
) -> tuple[list[Force], list[str]]:
    """Active thrust on a back face from the heel ``base_point`` rising H with lean theta.

    Split into soil (H/3), surcharge (H/2) and seismic increment (fraction of H) parts.
    """
    common = dict(H=H, gamma=backfill.gamma, phi=backfill.phi, delta=delta, theta=theta, beta=backfill.slope)
    p_soil = trial_wedge(**common).force
    p_total_static = trial_wedge(**common, q=loads.surcharge).force
    parts = [("Earth pressure", p_soil, H / 3, "EH")]
    if loads.surcharge > 0:
        parts.append(("Surcharge pressure", p_total_static - p_soil, H / 2, "LS"))
    warnings = []
    if seismic and (loads.kh > 0 or loads.kv != 0):
        p_ae = trial_wedge(**common, q=loads.surcharge, kh=loads.kh, kv=loads.kv).force
        parts.append(("Seismic increment", p_ae - p_total_static, loads.seismic_increment_height * H, "EQ"))
        if p_ae < p_total_static:
            warnings.append("Seismic thrust lower than static (kv effect); check inputs")

    t, d = math.radians(theta), math.radians(delta)
    fx_unit, fy_unit = -math.cos(d + t), -math.sin(d + t)  # soil on wall, toward the front and down
    forces = []
    for name, p, h, kind in parts:
        # Point on the back face at height h: the face leans away from the soil by theta
        x = base_point[0] - h * math.tan(t)
        y = base_point[1] + h
        forces.append(Force(name, p * fx_unit, p * fy_unit, x, y, kind))
    return forces, warnings


def passive_force(foundation: FoundationSoil, embedment: float, settings: WallSettings,
                  gamma_front: float, reduction: float | None = None) -> Force | None:
    """Rankine passive resistance on the front of the toe (sliding only), multiplied by
    ``reduction`` (default: the ASD ``settings.passive_reduction``)."""
    if not settings.use_passive or embedment <= 0:
        return None
    if foundation.drainage == "undrained":
        pp = gamma_front * embedment**2 / 2 + 2 * foundation.su * embedment
    else:
        kp = rankine_kp(foundation.phi)
        pp = 0.5 * kp * gamma_front * embedment**2 + 2 * foundation.c * math.sqrt(kp) * embedment
    pp *= settings.passive_reduction if reduction is None else reduction
    return Force("Passive (front)", pp, 0.0, 0.0, embedment / 3, "PASSIVE")


def evaluate_checks(
    *,
    case: str,
    width: float,
    forces: list[Force],
    passive: Force | None,
    foundation: FoundationSoil,
    embedment: float,
    settings: WallSettings,
    warnings: list[str],
) -> WallAnalysis:
    code = resolve_code(settings.design_code, settings.factor_overrides)
    if code.approach != "global_fs":
        raise GeoTekError(
            f"Design code {code.id!r} uses {code.approach}; wall checks are implemented for "
            "global factors of safety (ASD) so far"
        )
    log = FactorLog(code)

    sum_v = -sum(f.fy for f in forces)
    sum_h = -sum(f.fx for f in forces)
    m_res = -sum(f.x * f.fy for f in forces)   # vertical components (downward right of toe) resist
    m_ot = -sum(f.y * f.fx for f in forces)    # horizontal components (toward the front) overturn
    if sum_v <= 0:
        raise GeoTekError("Net vertical load is not compressive")

    x_r = (m_res - m_ot) / sum_v
    e = width / 2 - x_r
    if abs(e) <= width / 6:
        q_max = sum_v / width * (1 + 6 * abs(e) / width)
        q_min = sum_v / width * (1 - 6 * abs(e) / width)
    elif abs(e) < width / 2:
        q_max = 2 * sum_v / (3 * (width / 2 - abs(e)))
        q_min = 0.0
    else:
        q_max, q_min = math.inf, 0.0

    checks: dict[str, CheckResult] = {}
    req = log.value(f"safety.overturning.{case}")
    fs_ot = m_res / m_ot if m_ot > 0 else math.inf
    checks["overturning"] = CheckResult("overturning", fs_ot, req, fs_ot >= req,
                                        f"M_R = {m_res:.1f}, M_O = {m_ot:.1f} kNm/m")

    if foundation.drainage == "undrained":
        resist = foundation.su * max(width - 2 * abs(e), 0.0)
        detail = "s_u B'"
    else:
        db = foundation.delta_base if foundation.delta_base is not None else foundation.phi
        resist = sum_v * math.tan(math.radians(db)) + foundation.adhesion * max(width - 2 * abs(e), 0.0)
        detail = f"V tan({db:g}) + c_a B'"
    if passive is not None:
        resist += passive.fx
        detail += " + reduced passive"
    fs_sl = resist / sum_h if sum_h > 0 else math.inf
    req = log.value(f"safety.sliding.{case}")
    checks["sliding"] = CheckResult("sliding", fs_sl, req, fs_sl >= req, detail)

    on = settings.foundation_on
    limit = log.value(f"eccentricity.{on}.{case}") if case in code.eccentricity_limits.get(on, {}) else None
    if limit is not None:
        checks["eccentricity"] = CheckResult(
            "eccentricity", abs(e) / width, limit, abs(e) / width <= limit,
            f"e = {e:.3f} m (e/B limit {limit:.3f})", comparison="<=",
        )

    bearing = None
    if abs(e) < width / 2:
        phi = 0.0 if foundation.drainage == "undrained" else foundation.phi
        c = foundation.su if foundation.drainage == "undrained" else foundation.c
        bearing = bearing_capacity(
            method=settings.bearing_method, B=width, D=embedment, phi=phi, c=c,
            gamma=foundation.gamma, q=foundation.overburden, V=sum_v, H=max(sum_h, 0.0), e_B=e,
        )
        fs_b = bearing.Q_ult / sum_v
        req = log.value(f"safety.bearing_capacity.{case}")
        checks["bearing"] = CheckResult(
            "bearing", fs_b, req, fs_b >= req,
            f"q_ult = {bearing.q_ult:.0f} kPa on B' = {bearing.B_eff:.2f} m; q_eff = {sum_v / bearing.B_eff:.0f} kPa",
        )
    else:
        checks["bearing"] = CheckResult("bearing", 0.0, log.value(f"safety.bearing_capacity.{case}"), False,
                                        "Resultant outside the base")

    all_forces = forces + ([passive] if passive is not None else [])
    return WallAnalysis(
        case=case, width=width, forces=all_forces, sum_v=sum_v, sum_h=sum_h, m_resisting=m_res,
        m_overturning=m_ot, eccentricity=e, q_max=q_max, q_min=q_min, bearing=bearing,
        checks=checks, warnings=warnings, factors_used=log.as_list(),
    )
