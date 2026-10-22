"""Embedded sheet pile walls by limit equilibrium (per metre run).

Cantilever wall - fixed earth support, simplified (Blum): the counter-force below the toe is
replaced by a concentrated force R at the toe. Taking moments about the toe of the net
pressures gives the theoretical embedment D0; the design embedment is D0 x (1 + increase)
(typically +20 %), and R is the net horizontal force at D0.

Single-anchored wall - free earth support: the pile toe is free to rotate. Moments about the
anchor give D; horizontal equilibrium gives the anchor force T.

Safety is applied either by dividing the passive pressure by ``passive_factor`` (FS on
passive resistance; with ``passive_strength_reduction`` the smaller of that and the pressure from
tan(phi') and c' divided by the factor, USACE EM 1110-2-2504 para. 5-2d), by increasing the
embedment, or both (USS Steel Sheet Piling Design Manual). Depths are measured from the retained ground surface (z = 0);
the dredge line is at z = H.

Pressures: active behind over the full length, passive in front below the dredge line, both
from ``lateral_pressure`` on the soil profile's design parameters. Water is hydrostatic on
each side: behind from the profile's design GWT, in front from max(GWT, dredge line) unless
``front_water_depth`` is given. Seepage is not modelled.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Literal

import numpy as np
from scipy.optimize import brentq

from geotek.core.constants import GAMMA_W
from geotek.core.errors import GeoTekError
from geotek.core.models.profile import SoilProfile
from geotek.engine.earth_pressure.distribution import PressureDistribution, lateral_pressure

DZ = 0.002
"""Integration step [m]."""


def strength_reduced_profile(profile: SoilProfile, factor: float) -> SoilProfile:
    """Copy of ``profile`` with tan(phi') and c' divided by ``factor`` in every layer.

    This is the way USACE EM 1110-2-2504 (para. 5-2d, Table 5-1) applies its factor of safety on
    passive pressure ("effective" phi and c). Undrained strengths (s_u) are left unchanged: for
    those the pressure is linear in s_u and dividing the whole force by the factor is the
    smaller (safer) value, so ``min`` of the two methods picks it.
    """
    layers = []
    for layer in profile.layers:
        design = layer.design
        update: dict = {"c_eff": design.c_eff / factor}
        if design.phi_eff is not None:
            update["phi_eff"] = math.degrees(math.atan(math.tan(math.radians(design.phi_eff)) / factor))
        layers.append(layer.model_copy(update={"design": design.model_copy(update=update)}))
    return profile.model_copy(update={"layers": layers})


def _evaluate(dist: PressureDistribution, z_query, offset: float = 0.0, which: str = "sigma_h_eff",
              left=None):
    """Value of a piecewise-linear diagram at depths z (absolute); zero outside its range.

    At a jump (duplicate node) the value just below is returned, or just above where the
    boolean array ``left`` is True.
    """
    z_nodes = dist.z + offset
    y = getattr(dist, which)
    zq = np.asarray(z_query, dtype=float)
    out = np.zeros_like(zq)
    inside = (zq >= z_nodes[0]) & (zq <= z_nodes[-1])
    side_right = np.searchsorted(z_nodes, zq[inside], side="right") - 1
    if left is not None:
        side_left = np.searchsorted(z_nodes, zq[inside], side="left") - 1
        side_right = np.where(np.asarray(left)[inside] & (side_left >= 0), side_left, side_right)
    idx = np.clip(side_right, 0, z_nodes.size - 2)
    z0, z1 = z_nodes[idx], z_nodes[idx + 1]
    span = np.where(z1 > z0, z1 - z0, 1.0)
    t = np.where(z1 > z0, (zq[inside] - z0) / span, 1.0)
    out[inside] = y[idx] + t * (y[idx + 1] - y[idx])
    return out


@dataclass
class NetPressure:
    z: np.ndarray
    active: np.ndarray
    """Total pressure behind (effective + water) [kPa]."""
    passive: np.ndarray
    """Factored total pressure in front (reduced effective pressure + water) [kPa]."""
    net: np.ndarray
    """active - passive, positive pushing the wall toward the excavation."""
    warnings: list[str] = field(default_factory=list)
    """Sloping-backfill diagnostics (c' dropped); other pressure diagnostics are not carried."""


def net_pressure(
    profile: SoilProfile,
    H: float,
    *,
    passive_factor: float = 1.0,
    surcharge: float = 0.0,
    drainage: Literal["drained", "undrained"] = "drained",
    front_water_depth: float | None = None,
    passive_method: Literal["rankine", "coulomb", "log_spiral"] = "rankine",
    passive_delta: float = 0.0,
    active_method: Literal["rankine", "coulomb"] = "rankine",
    active_delta: float = 0.0,
    min_efp: float | None = None,
    active_factor: float = 1.0,
    surcharge_factor: float = 1.0,
    water_factor: float = 1.0,
    seismic_increment: float = 0.0,
    seismic_increment_below: float = 0.0,
    passive_seismic_ratio: float = 1.0,
    backfill_slope: float = 0.0,
    passive_width_ratio: float = 1.0,
    passive_strength_reduction: bool = False,
    seismic_dk: float = 0.0,
    seismic_toe: float | None = None,
) -> NetPressure:
    """Net pressure diagram. ``active_factor``, ``surcharge_factor`` and ``water_factor`` are
    load factors on the soil, surcharge and water parts of the driving pressure (partial
    factor design); the passive side is divided by ``passive_factor`` (see the module docstring).

    Seismic (simplified): ``seismic_increment`` [kPa] is a uniform dynamic pressure added
    behind the wall over the retained height H (resultant at H/2, TBDY 16.12.2.8);
    ``seismic_increment_below`` is the horizontal dynamic coefficient increment
    Delta K_h = (1 - kv) K_AE,h - K_A,h (>= 0) applied to the retained effective vertical stress
    plus surcharge below the dredge line, where the M-O active pressure also acts on the
    embedded part (Ebeling & Morrison 1992); ``passive_seismic_ratio`` (K_PE / K_P <= 1) scales the
    passive effective pressure.

    ``backfill_slope`` [deg] is the retained ground slope beta (active side only; the front
    ground stays horizontal). Rankine uses the slope coefficient with the resultant parallel to
    the surface; c' is dropped on sloping ground with a warning. ``surcharge`` is per horizontal
    projection (see ``surcharge_per_horizontal``).

    ``passive_strength_reduction`` applies the global factor of safety the USACE EM 1110-2-2504
    way as well (tan(phi') and c' divided by ``passive_factor``) and takes the smaller passive
    pressure; it is for global-FS (ASD) design, not for partial factors on the resistance
    (EN 1997-1 gamma_R;e, KDYY gamma_Re), which divide the force only.

    ``seismic_dk`` (Delta K_ad = K_AE,total - K_A,static) with ``seismic_toe`` [m] is the KDYY
    handbook increment: a uniform 0.5 Delta K_ad sigma'_v(toe) over the whole wall length
    0..toe (AASHTO 2010) plus a triangular surcharge part 2 q Delta K_ad (1 - z/toe)
    (Kumbasar & Kip). It replaces ``seismic_increment`` and ``seismic_increment_below``; the toe
    depth is part of the solution, so the solvers iterate on it. ``seismic_toe=None`` adds nothing.

    ``passive_width_ratio`` (<= 1) is the effective passive width over the member spacing for
    soldier pile walls; it scales the effective passive pressure only, not the water."""
    if H <= 0:
        raise GeoTekError("Retained height H must be positive")
    if not 0 < passive_width_ratio <= 1:
        raise GeoTekError("passive_width_ratio must be in (0, 1]")
    if passive_factor < 1.0:
        raise GeoTekError("passive_factor must be >= 1")
    bottom = profile.bottom
    if bottom <= H:
        raise GeoTekError("The soil profile must extend below the dredge line")
    act = lateral_pressure(profile, bottom, state="active", method=active_method, delta=active_delta,
                           surcharge=surcharge, drainage=drainage, min_efp=min_efp,
                           beta=backfill_slope, slope_cohesion="ignore")
    act0 = act if surcharge == 0 else lateral_pressure(
        profile, bottom, state="active", method=active_method, delta=active_delta,
        drainage=drainage, min_efp=min_efp, beta=backfill_slope, slope_cohesion="ignore")
    pas = lateral_pressure(profile, bottom - H, state="passive", method=passive_method,
                           delta=passive_delta, drainage=drainage, top=H)
    pas_s = None
    if passive_factor > 1.0 and passive_strength_reduction:
        pas_s = lateral_pressure(strength_reduced_profile(profile, passive_factor), bottom - H,
                                 state="passive", method=passive_method, delta=passive_delta,
                                 drainage=drainage, top=H)
    # Fine grid plus every breakpoint twice (left and right limits) so jumps are exact
    breaks = np.unique(np.concatenate([act.z, act0.z, pas.z + H, [H]]))
    grid = np.arange(0.0, bottom + DZ / 2, DZ)
    grid = grid[np.min(np.abs(grid[:, None] - breaks[None, :]), axis=1) > 1e-9]
    z = np.concatenate([grid, breaks, breaks])
    left = np.concatenate([np.zeros(grid.size, bool), np.ones(breaks.size, bool), np.zeros(breaks.size, bool)])
    order = np.lexsort((~left, z))  # at equal depth the left limit comes first
    z, left = z[order], left[order]
    a_q = _evaluate(act, z, left=left)
    a_0 = _evaluate(act0, z, left=left)
    a_eff = active_factor * a_0 + surcharge_factor * (a_q - a_0)
    p_eff = _evaluate(pas, z, offset=H, left=left) * passive_seismic_ratio * passive_width_ratio
    p_eff[(z < H) | ((z == H) & left)] = 0.0
    p_div = p_eff / passive_factor
    if pas_s is not None:
        # EM 1110-2-2504 divides tan(phi') and c' by the factor; for dense sand that gives a
        # smaller passive pressure than dividing the force. Use the smaller of the two.
        p_s = _evaluate(pas_s, z, offset=H, left=left) * passive_seismic_ratio * passive_width_ratio
        p_s[(z < H) | ((z == H) & left)] = 0.0
        p_div = np.minimum(p_div, p_s)
    if seismic_dk > 0:
        if seismic_toe is not None:
            sv_all = _evaluate(act0, z, which="sigma_v_eff", left=left)
            sv_toe = float(np.interp(seismic_toe, z, sv_all))
            inc = 0.5 * seismic_dk * sv_toe + 2.0 * seismic_dk * surcharge * (1.0 - z / seismic_toe)
            a_eff = a_eff + np.where(z <= seismic_toe, np.maximum(inc, 0.0), 0.0)
    elif seismic_increment:
        a_eff = a_eff + np.where((z < H) | ((z == H) & left), seismic_increment, 0.0)
    if seismic_increment_below > 0 and not seismic_dk > 0:
        sv_eff = _evaluate(act0, z, which="sigma_v_eff", left=left)
        a_eff = a_eff + np.where((z < H) | ((z == H) & left), 0.0,
                                 seismic_increment_below * (sv_eff + surcharge))
    if drainage == "undrained":
        u_back = u_front = np.zeros_like(z)
    else:
        gwt = profile.gwt.depth_for("design")
        u_back = GAMMA_W * np.maximum(0.0, z - gwt)
        fw = max(gwt, H) if front_water_depth is None else front_water_depth
        if fw < H:
            raise GeoTekError("Front water level above the dredge line is not supported")
        u_front = GAMMA_W * np.maximum(0.0, z - fw)
    active = a_eff + water_factor * u_back
    passive = p_div + u_front
    return NetPressure(z=z, active=active, passive=passive, net=active - passive,
                       warnings=[w for w in act.warnings if "sloping backfill" in w])


def _cumulative(z, y):
    """Running integral of y from z[0]."""
    return np.concatenate([[0.0], np.cumsum(0.5 * (y[1:] + y[:-1]) * np.diff(z))])


@dataclass
class SheetPileResult:
    support: str
    H: float
    D0: float
    """Theoretical embedment from equilibrium [m]."""
    D: float
    """Design embedment [m]."""
    anchor_depth: float | None
    anchor_force: float | None
    """Horizontal anchor force per metre [kN/m]."""
    toe_force: float | None
    """Blum counter-force at the toe for cantilever walls [kN/m]."""
    M_max: float
    """Maximum bending moment [kNm/m]."""
    z_M_max: float
    z: np.ndarray
    shear: np.ndarray
    moment: np.ndarray
    net: np.ndarray
    section_modulus_cm3: float | None = None
    warnings: list[str] = field(default_factory=list)


_NO_DRIVE = ("The net pressure above the dredge line does not drive the wall "
             "(e.g. tension crack deeper than H); no embedment is needed for equilibrium")


def _root(fun, z, start_index, no_drive_message=_NO_DRIVE):
    """First sign change of fun on z[start_index:], refined with brentq."""
    values = fun(z)
    if np.all(values[: start_index + 1] <= 1e-9):
        raise GeoTekError(no_drive_message)
    s = np.sign(values[start_index:])
    change = np.flatnonzero(s[:-1] * s[1:] < 0)
    if change.size == 0:
        return None
    i = start_index + change[0]
    f = lambda x: float(np.interp(x, z, values))  # noqa: E731
    return brentq(f, z[i], z[i + 1], xtol=1e-6)


def _internal_forces(z, net, toe, anchor_depth=None, anchor_force=0.0):
    sel = z <= toe + 1e-12
    zz, p = z[sel], net[sel]
    shear = _cumulative(zz, p)
    if anchor_depth is not None:
        shear = shear - anchor_force * (zz >= anchor_depth)
    moment = _cumulative(zz, shear)
    i = int(np.argmax(np.abs(moment)))
    return zz, p, shear, moment, float(abs(moment[i])), float(zz[i])


def _section(m_max, allowable_stress_mpa):
    if allowable_stress_mpa is None:
        return None
    if allowable_stress_mpa <= 0:
        raise GeoTekError("Allowable stress must be positive")
    return m_max / allowable_stress_mpa * 1000.0  # kNm/m / MPa -> cm3/m


def _iterate_toe(solve, toe_of, kwargs: dict):
    """Fixed point on the toe depth for the KDYY seismic increment (it depends on the toe)."""
    if not kwargs.get("seismic_dk", 0.0) > 0:
        return solve(kwargs)
    res = solve({**kwargs, "seismic_toe": None})
    for _ in range(60):
        toe = toe_of(res)
        new = solve({**kwargs, "seismic_toe": toe})
        if abs(toe_of(new) - toe) < 1e-3:
            return new
        res = new
    raise GeoTekError("Seismic toe-depth iteration did not converge; check the seismic parameters")


def _check_design_inputs(depth_increase, allowable_stress_mpa):
    if not math.isfinite(depth_increase) or depth_increase < 0:
        raise GeoTekError("depth_increase must be a finite, non-negative number")
    if allowable_stress_mpa is not None and (
            not math.isfinite(allowable_stress_mpa) or allowable_stress_mpa <= 0):
        raise GeoTekError("Allowable stress must be a finite, positive number")


def cantilever_sheet_pile(
    profile: SoilProfile,
    H: float,
    *,
    depth_increase: float = 0.2,
    allowable_stress_mpa: float | None = None,
    **pressure_kwargs,
) -> SheetPileResult:
    _check_design_inputs(depth_increase, allowable_stress_mpa)
    return _iterate_toe(
        lambda kw: _cantilever_once(profile, H, depth_increase, allowable_stress_mpa, kw),
        lambda r: r.H + r.D0, pressure_kwargs)


def _cantilever_once(profile, H, depth_increase, allowable_stress_mpa, pressure_kwargs):
    np_ = net_pressure(profile, H, **pressure_kwargs)
    z, net = np_.z, np_.net
    F = _cumulative(z, net)                     # shear (net force above z)
    Fz = _cumulative(z, net * z)
    moment_about = lambda zt: np.interp(zt, z, F) * zt - np.interp(zt, z, Fz)  # noqa: E731
    i_h = int(np.searchsorted(z, H))
    toe = _root(lambda zz: moment_about(zz), z, i_h + 1)
    if toe is None:
        raise GeoTekError("No embedment satisfies moment equilibrium within the profile; "
                          "deepen the profile or check parameters")
    d0 = toe - H
    d = d0 * (1 + depth_increase)
    warnings = list(np_.warnings)
    if H + d > profile.bottom:
        warnings.append("Design embedment extends below the soil profile")
    R = float(np.interp(toe, z, F))
    zz, p, shear, moment, m_max, z_m = _internal_forces(z, net, toe)
    return SheetPileResult(
        support="cantilever", H=H, D0=d0, D=d, anchor_depth=None, anchor_force=None,
        toe_force=R, M_max=m_max, z_M_max=z_m, z=zz, shear=shear, moment=moment, net=p,
        section_modulus_cm3=_section(m_max, allowable_stress_mpa), warnings=warnings,
    )


def anchored_sheet_pile(
    profile: SoilProfile,
    H: float,
    anchor_depth: float,
    *,
    depth_increase: float = 0.0,
    allowable_stress_mpa: float | None = None,
    anchor_spacing: float = 1.0,
    anchor_inclination: float = 0.0,
    **pressure_kwargs,
) -> SheetPileResult:
    if not 0 <= anchor_depth < H:
        raise GeoTekError("Anchor must lie between the top of the wall and the dredge line")
    _check_design_inputs(depth_increase, allowable_stress_mpa)
    return _iterate_toe(
        lambda kw: _anchored_once(profile, H, anchor_depth, depth_increase, allowable_stress_mpa,
                                  anchor_spacing, anchor_inclination, kw),
        lambda r: r.H + r.D0, pressure_kwargs)


def _anchored_once(profile, H, anchor_depth, depth_increase, allowable_stress_mpa,
                   anchor_spacing, anchor_inclination, pressure_kwargs):
    np_ = net_pressure(profile, H, **pressure_kwargs)
    z, net = np_.z, np_.net
    F = _cumulative(z, net)
    Fz = _cumulative(z, net * z)
    # moment of net pressure above zt about the anchor
    moment_about_anchor = lambda zt: np.interp(zt, z, Fz) - anchor_depth * np.interp(zt, z, F)  # noqa: E731
    i_h = int(np.searchsorted(z, H))
    toe = _root(lambda zz: moment_about_anchor(zz), z, i_h + 1, no_drive_message=(
        "The anchor is too low for free earth support: the net pressure above the dredge line "
        "gives no overturning moment about the anchor; raise the anchor"))
    if toe is None:
        raise GeoTekError("No embedment satisfies moment equilibrium about the anchor within the profile")
    d0 = toe - H
    T = float(np.interp(toe, z, F))
    if T <= 0:
        raise GeoTekError("Computed anchor force is not tensile; the wall may not need an anchor")
    d = d0 * (1 + depth_increase)
    warnings = list(np_.warnings)
    if H + d > profile.bottom:
        warnings.append("Design embedment extends below the soil profile")
    zz, p, shear, moment, m_max, z_m = _internal_forces(z, net, toe, anchor_depth, T)
    res = SheetPileResult(
        support="anchored", H=H, D0=d0, D=d, anchor_depth=anchor_depth, anchor_force=T,
        toe_force=None, M_max=m_max, z_M_max=z_m, z=zz, shear=shear, moment=moment, net=p,
        section_modulus_cm3=_section(m_max, allowable_stress_mpa), warnings=warnings,
    )
    res.warnings.append(
        f"Anchor load: {T * anchor_spacing / math.cos(math.radians(anchor_inclination)):.1f} kN per anchor "
        f"(spacing {anchor_spacing:g} m, inclination {anchor_inclination:g} deg)"
    )
    return res


# Public names of the integration helpers used by geotek/engine/anchored_wall.py
cumulative_integral = _cumulative
find_root = _root
internal_forces = _internal_forces
