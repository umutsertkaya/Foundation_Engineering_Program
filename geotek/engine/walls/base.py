"""Force bookkeeping and stability checks shared by all wall types (ASD).

Forces act on the wall system (wall body plus soil carried by the base). Moments are taken
about the toe (origin). Sign convention: Fx > 0 toward the retained soil, Fy > 0 upward.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Literal

import numpy as np

from geotek.config.codes import FactorLog, UsedFactor, resolve_code
from geotek.core.errors import GeoTekError
from geotek.core.models.profile import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.core.models.walls import Backfill, FoundationSoil, ShearKey, WallLoads, WallSettings
from geotek.core.warning_codes import format_warning
from geotek.engine.bearing import BearingResult, bearing_capacity
from geotek.engine.earth_pressure.coefficients import mononobe_okabe_kpe, rankine_kp
from geotek.engine.earth_pressure.distribution import lateral_pressure, resultant
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
    kv_sign: Literal["up", "down"] | None = None
    """Vertical seismic sign applied to this check (+kv up / -kv down); None for static checks."""


@dataclass
class KeySliding:
    """Shear key data the sliding check needs (see ``evaluate_checks``)."""

    key: ShearKey
    passive: Force
    """Passive resistance on the key front face after the reduction factor (kind PASSIVE)."""
    full: float
    """Passive resistance before the reduction factor [kN/m]."""
    arm: float
    """Depth of the passive resultant below the base bottom [m]."""
    reduction: float
    deep: FoundationSoil
    """Strength of the soil at key-bottom level (sliding plane through the key tip)."""
    extra_v: float
    """Net soil weight between the base bottom and the key bottom, beside the key [kN/m]
    (times (1 - kv) in the seismic case)."""
    deep_forces: list[Force] = field(default_factory=list)
    """Horizontal actions that load only the block above the key-tip plane: active thrust,
    water and seismic increments between the base and the key bottom, and the inertia of the
    soil beside the key. Fx < 0 drives the wall forward."""
    uplift: float = 0.0
    """Extra hydrostatic uplift on the key bottom beyond the base-level uplift, b * (u_tip - u_base), interpolated front to retained
    [kN/m]; already in the wall forces (kind WA), added back for the key-tip plane, whose ``extra_v`` has it."""


@dataclass
class ShearKeyResult:
    """Sliding with a shear key: both candidate surfaces, the governing one and the key demands.

    The ``fs_*`` values are the sliding resistance over the driving force for the checked case
    (global factor of safety for ASD, R_d / E_d for partial-factor codes).
    """

    position: str
    width: float
    depth: float
    passive_full: float
    """Passive resistance on the key front face before reduction [kN/m]."""
    passive_used: float
    """Passive resistance used in sliding after reduction [kN/m]."""
    reduction: float
    arm: float
    """Resultant of the passive pressure below the base bottom [m]."""
    fs_base_surface: float
    fs_deep_surface: float
    fs_with_key: float
    governing: Literal["base", "deep"]
    fs_without_key: float | None = None
    demand_v: float = 0.0
    """Shear demand at the key root, V = unreduced passive [kN/m]; no reinforced-concrete design."""
    demand_m: float = 0.0
    """Bending demand at the key root, M = V * arm [kNm/m]."""


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
    shear_key: ShearKeyResult | None = None

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


def seismic_passive_ratio(phi: float, loads: WallLoads, seismic: bool) -> float:
    """Pseudo-static passive ratio (1 - kv) K_PE / K_P <= 1 (Mononobe-Okabe passive, horizontal
    front ground, delta = 0); 1 in the static case. phi = 0 for undrained soil."""
    if not seismic or (loads.kh == 0 and loads.kv == 0):
        return 1.0
    return min(1.0, (1 - loads.kv) * mononobe_okabe_kpe(phi, kh=loads.kh, kv=loads.kv) / rankine_kp(phi))


def passive_force(foundation: FoundationSoil, embedment: float, settings: WallSettings,
                  gamma_front: float, reduction: float | None = None,
                  seismic_ratio: float = 1.0) -> Force | None:
    """Rankine passive resistance on the front of the toe (sliding only), multiplied by
    ``reduction`` (default: the ASD ``settings.passive_reduction``) and by the seismic passive
    ratio (see ``seismic_passive_ratio``)."""
    if not settings.use_passive or embedment <= 0:
        return None
    if foundation.drainage == "undrained":
        pp = gamma_front * embedment**2 / 2 + 2 * foundation.su * embedment
    else:
        kp = rankine_kp(foundation.phi)
        pp = 0.5 * kp * gamma_front * embedment**2 + 2 * foundation.c * math.sqrt(kp) * embedment
    pp *= (settings.passive_reduction if reduction is None else reduction) * seismic_ratio
    return Force("Passive (front)", pp, 0.0, 0.0, embedment / 3, "PASSIVE")


def key_weight_forces(geometry, settings: WallSettings, loads: WallLoads, seismic: bool) -> list[Force]:
    """Self-weight (and seismic inertia) of the shear key, below the base bottom (y < 0)."""
    key = geometry.key
    if key is None:
        return []
    x0, x1 = key.span(geometry.width)
    return weight_forces("Shear key", [(x0, -key.depth), (x1, -key.depth), (x1, 0.0), (x0, 0.0)],
                         settings.concrete_unit_weight, loads, seismic, "DC")


def key_passive_from_diagram(z, p, embedment: float, depth: float) -> tuple[float, float]:
    """(force, arm below the base bottom) of a piecewise-linear passive diagram over the key.

    ``z`` is the depth below the front ground; the key face spans ``embedment`` to
    ``embedment + depth``. Jumps at layer boundaries appear as repeated ``z`` values.
    """
    a, b = embedment, embedment + depth
    zs, ps = [], []
    for z0, z1, p0, p1 in zip(z[:-1], z[1:], p[:-1], p[1:]):
        lo, hi = max(z0, a), min(z1, b)
        if hi - lo <= 1e-12 or z1 <= z0:
            continue
        slope = (p1 - p0) / (z1 - z0)
        zs += [lo, hi]
        ps += [p0 + slope * (lo - z0), p0 + slope * (hi - z0)]
    if len(zs) < 2:
        return 0.0, depth / 2
    # Segments are contiguous or separated by jumps; integrate each separately.
    force = moment = 0.0
    for i in range(0, len(zs), 2):
        f, c = resultant(np.array(zs[i:i + 2]), np.array(ps[i:i + 2]))
        if f > 0:
            force += f
            moment += f * c
    return (force, moment / force - a) if force > 0 else (0.0, depth / 2)


def key_sliding_basic(geometry, foundation: FoundationSoil, settings: WallSettings, gamma_front: float,
                      reduction: float | None = None, *, backfill: Backfill, loads: WallLoads,
                      seismic: bool) -> KeySliding | None:
    """Shear key passive resistance and key-tip plane data for a homogeneous foundation.

    Rankine passive on the key front face from the front ground (``embedment`` above the base
    bottom) down to the key bottom: p_p = K_p sigma_v + 2 c sqrt(K_p) (K_p = 1 and s_u for
    undrained soil), sigma_v = gamma_front D + gamma_foundation (z - D), multiplied by the passive
    reduction factor and, in the seismic case, by the M-O passive ratio.
    """
    key = geometry.key
    if key is None:
        return None
    d, df = key.depth, geometry.embedment
    if foundation.drainage == "undrained":
        kp, c, phi = 1.0, foundation.su, 0.0
    else:
        kp, c, phi = rankine_kp(foundation.phi), foundation.c, foundation.phi
    cohesion = 2 * c * math.sqrt(kp)
    sv_top = gamma_front * df
    full, arm = key_passive_from_diagram(
        [df, df + d], [kp * sv_top + cohesion, kp * (sv_top + foundation.gamma * d) + cohesion], df, d)
    r = settings.passive_reduction if reduction is None else reduction
    x0, _ = key.span(geometry.width)
    force = Force("Shear key passive", full * r * seismic_passive_ratio(phi, loads, seismic), 0.0,
                  x0, -arm, "PASSIVE")
    soil_beside = foundation.gamma * (geometry.width - key.width) * d
    vertical = 1.0 - loads.kv if seismic else 1.0
    deep = key_zone_thrust_basic(geometry, backfill, foundation, loads, seismic)
    if seismic and loads.kh > 0:
        deep.append(Force("Soil beside key (inertia)", -loads.kh * soil_beside, 0.0,
                          geometry.width / 2, -d / 2, "EQ"))
    return KeySliding(key, force, full, arm, r, foundation, soil_beside * vertical, deep)


def key_zone_thrust_basic(geometry, backfill: Backfill, foundation: FoundationSoil, loads: WallLoads,
                          seismic: bool) -> list[Force]:
    """Active thrust between the base level and the key-tip plane on the vertical line through
    the heel (homogeneous backfill over the foundation soil).

    The plane through the key tip extends the sliding block below the base, so the retained side
    pushes on it down to the key bottom. Layer-local Coulomb coefficients with delta = beta on that
    vertical soil plane (Rankine-equivalent), the same convention as the layered wall path; c' is
    ignored by the Coulomb solution (conservative). Only the horizontal component is used.
    """
    key = geometry.key
    beta = backfill.slope
    if hasattr(geometry, "heel"):
        hv = geometry.height + geometry.heel * math.tan(math.radians(beta))
    else:
        hv = geometry.height + geometry.back_offset * math.tan(math.radians(beta))
    d = key.depth
    undrained = foundation.drainage == "undrained"
    design = (DesignParameters(su=foundation.su) if undrained
              else DesignParameters(phi_eff=foundation.phi, c_eff=foundation.c))
    profile = SoilProfile(
        id="key-zone", gwt=GroundwaterCondition(depth_insitu=hv + d + 10.0),
        layers=[SoilLayer(id="backfill", top=0.0, bottom=hv, gamma=backfill.gamma,
                          design=DesignParameters(phi_eff=backfill.phi)),
                SoilLayer(id="foundation", top=hv, bottom=hv + d + 1.0, gamma=foundation.gamma,
                          behaviour=foundation.drainage, design=design)])
    common = dict(method="coulomb", delta=beta, beta=beta, layerwise=True, steep_seismic=True)
    dyn = seismic and (loads.kh > 0 or loads.kv != 0)
    try:
        zero = lateral_pressure(profile, hv + d, **common)
        static = lateral_pressure(profile, hv + d, surcharge=loads.surcharge, **common)
        dynamic = (lateral_pressure(profile, hv + d, surcharge=loads.surcharge, kh=loads.kh, kv=loads.kv,
                                    **common) if dyn else static)
    except GeoTekError as exc:
        raise GeoTekError(
            "Kayma dişi: diş derinliği boyunca arka aktif itki hesaplanamadı (drenajsız temel zemininde "
            f"eğimli dolgu veya deprem desteklenmiyor): {exc}") from exc

    def band(dist):
        return key_band_force(dist.z, dist.sigma_h_eff, hv, d)

    out = []
    parts = [("Key zone earth pressure", band(zero), "EH")]
    if loads.surcharge:
        parts.append(("Key zone surcharge pressure", band(static) - band(zero), "LS"))
    if dyn:
        parts.append(("Key zone seismic increment", band(dynamic) - band(static), "EQ"))
    for name, f, kind in parts:
        if abs(f) > 1e-12:
            out.append(Force(name, -f, 0.0, geometry.width, -d / 2, kind))
    return out


def key_band_force(z, p, top: float, depth: float) -> float:
    """Force of a piecewise-linear pressure diagram between depths ``top`` and ``top + depth``."""
    a, b = top, top + depth
    total = 0.0
    for z0, z1, p0, p1 in zip(z[:-1], z[1:], p[:-1], p[1:]):
        lo, hi = max(z0, a), min(z1, b)
        if hi - lo <= 1e-12 or z1 <= z0:
            continue
        slope = (p1 - p0) / (z1 - z0)
        total += 0.5 * (2 * p0 + slope * (lo - z0 + hi - z0)) * (hi - lo)
    return float(total)


def key_warnings(geometry) -> list[str]:
    return [format_warning("walls.warning.shear_key_bearing")] if geometry.key is not None else []


def strip_key(geometry):
    """The same wall without its shear key (for the with/without comparison)."""
    return geometry.model_copy(update={"key": None})


def attach_without_key(results, baseline) -> None:
    """Record the sliding ratio of the key-less wall in each result with a shear key."""
    by_case = {a.case: a for a in baseline}
    for analysis in results:
        base = by_case.get(analysis.case)
        if analysis.shear_key is not None and base is not None and "sliding" in base.checks:
            analysis.shear_key.fs_without_key = base.checks["sliding"].value
            if analysis.shear_key.fs_with_key < analysis.shear_key.fs_without_key - 1e-9:
                analysis.warnings.append(format_warning("walls.warning.shear_key_reduces_sliding"))


def key_result(ks: KeySliding, rb: float, rd: float, driving: float, used: float,
               driving_deep: float | None = None) -> ShearKeyResult:
    """Governing surface = smaller ratio. ``rb``/``rd`` already include all passives;
    ``driving_deep`` adds the key-zone actions (``KeySliding.deep_forces``) to ``driving``."""
    driving_deep = driving if driving_deep is None else driving_deep
    fs_b = float(rb / driving) if driving > 0 else math.inf
    fs_d = float(rd / driving_deep) if driving_deep > 0 else math.inf
    return ShearKeyResult(
        position=ks.key.position, width=ks.key.width, depth=ks.key.depth,
        passive_full=ks.full, passive_used=used, reduction=ks.reduction, arm=ks.arm,
        fs_base_surface=fs_b, fs_deep_surface=fs_d, fs_with_key=min(fs_b, fs_d),
        governing="base" if fs_b <= fs_d else "deep", demand_v=ks.full, demand_m=ks.full * ks.arm)


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
    key: KeySliding | None = None,
) -> WallAnalysis:
    """ASD checks. With a shear key, sliding takes the smaller of two surfaces: (a) the base
    interface (V tan(delta_b) + c_a B') plus the key passive, (b) a horizontal plane through the key
    tip ((V + W_soil) tan(phi) + c B' + key passive); toe passive, if used, acts on both."""
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

    m_res, m_ot = overturning_moments(forces, m_res, m_ot, settings)
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
    key_result_ = None
    if key is not None:
        b_eff = max(width - 2 * abs(e), 0.0)
        toe_pp = passive.fx if passive is not None else 0.0
        if key.deep.drainage == "undrained":
            deep = key.deep.su * b_eff
        else:
            deep = ((sum_v + key.uplift + key.extra_v) * math.tan(math.radians(key.deep.phi))
                    + key.deep.c * b_eff)
        rb = resist + key.passive.fx
        rd = deep + toe_pp + key.passive.fx
        key_result_ = key_result(key, rb, rd, sum_h, key.passive.fx,
                                 sum_h - sum(f.fx for f in key.deep_forces))
        detail += (f" + key passive; governing surface: {key_result_.governing} "
                   f"(base {key_result_.fs_base_surface:.2f}, key tip {key_result_.fs_deep_surface:.2f})")
    fs_sl = resist / sum_h if sum_h > 0 else math.inf
    if key_result_ is not None:
        fs_sl = key_result_.fs_with_key
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

    all_forces = forces + ([passive] if passive is not None else []) + ([key.passive] if key is not None else [])
    return WallAnalysis(
        case=case, width=width, forces=all_forces, sum_v=sum_v, sum_h=sum_h, m_resisting=m_res,
        m_overturning=m_ot, eccentricity=e, q_max=q_max, q_min=q_min, bearing=bearing,
        checks=checks, warnings=warnings, factors_used=log.as_list(), shear_key=key_result_,
    )


def overturning_moments(forces, m_res, m_ot, settings):
    """Reclassify only base uplift; the net moment and contact resultant are unchanged."""
    if settings.uplift_moment == "overturning":
        uplift = sum(f.x * f.fy for f in forces
                     if f.kind == "WA" and f.name in ("Uplift", "Key uplift") and f.fy > 0 and f.y == 0.0)
        if uplift:
            return m_res + uplift, m_ot + uplift
    return m_res, m_ot
