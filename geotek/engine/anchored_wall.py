"""Anchored (tied-back) excavation wall analysis, per metre of wall.

One anchor level - free earth support on the actual earth pressures: delegated to
``anchored_sheet_pile`` in ``sheet_pile.py`` (same pressures, roots and internal forces; the
only addition is the soldier-pile passive width ratio). The anchor force is T_h [kN/m].

Several anchor levels - apparent earth pressure envelope over the excavation height H
(Terzaghi and Peck 1967; Peck 1969; FHWA GEC-4 FHWA-IF-99-015 ch. 5), level ground only:

* sand, ``p = 0.65 Ka gamma H`` uniform, ``Ka = tan^2(45 - phi/2)``; a uniform surcharge adds ``Ka q``;
* soft to medium clay (``gamma H / Su > 4``), ``p = gamma H - 4 Su`` (m = 1), zero at the
  top and full from 0.25 H;
* stiff clay (``gamma H / Su <= 4``), ``p = c gamma H`` with c = 0.2..0.4 chosen by the user,
  zero at the top and full from 0.25 H (the bottom ramp of the published figure is left out,
  conservative).

Anchor loads: *hinge method* - the wall is a beam on the supports (anchors and the excavation
base), hinged at every anchor except the first, so every span is statically determinate and
a support takes the reactions of the spans on both sides; *tributary method* - each support
takes the envelope between the mid-points to its neighbours. The support at the excavation
base is the force R_B that the embedded part must hand to the soil. Embedment: moments about
the toe of the embedded part under R_B and the net active/passive pressure below the base
(factored passive, soldier piles with the effective passive width).

Bending moments above the base always come from the hinge model. The embedment length is
D = D0 (1 + increase). No section design: V and M demands, and M/W against a given stress.
"""

from __future__ import annotations

import hashlib
import json
import math

import numpy as np
from pydantic import ValidationError

from geotek.core.constants import GAMMA_W
from geotek.core.errors import GeoTekError
from geotek.core.models.anchors import (
    AnalysisResult,
    AnchorCheck,
    AnchorDesignInputs,
    AnchoredWallAnalysisInputs,
    EnvelopeResult,
    LevelResult,
    Notice,
)
from geotek.core.models.profile import SoilProfile
from geotek.engine.anchors import MissingAnchorInputsError, design_anchor
from geotek.engine.earth_pressure.coefficients import rankine_ka, surcharge_per_horizontal
from geotek.engine.sheet_pile import (
    anchored_sheet_pile,
    cumulative_integral,
    find_root,
    net_pressure,
)

ENGINE_VERSION = "1"
"""Part of the inputs hash: bump when a formula or table value changes."""
SAND_FACTOR = 0.65
SOFT_CLAY_M = 1.0
STIFF_CLAY_LIMIT = 4.0
RAMP = 0.25
MAX_POINTS = 500

SOURCES = [
    "Terzaghi and Peck (1967) Soil Mechanics in Engineering Practice; Peck (1969) 7th ICSMFE",
    "FHWA GEC-4 (FHWA-IF-99-015) ch. 5, apparent pressure envelopes and hinge/tributary methods",
    "USS Steel Sheet Piling Design Manual; USACE EM 1110-2-2504 (free earth support)",
]


class AnchoredWallStop(GeoTekError):
    """The case is outside what the method supports; ``code`` selects a translated message."""

    def __init__(self, code: str, message: str, **params):
        self.code = code
        self.params = params
        super().__init__(message)


def inputs_hash(inputs: AnchoredWallAnalysisInputs) -> str:
    payload = json.dumps([ENGINE_VERSION, inputs.model_dump(mode="json")], sort_keys=True,
                         separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _layers_over(profile: SoilProfile, H: float):
    out = []
    for layer in profile.layers:
        thickness = min(layer.bottom, H) - layer.top
        if thickness > 1e-9:
            out.append((layer, thickness))
    return out


def retained_averages(profile: SoilProfile, H: float, drained: bool) -> dict:
    """Thickness-weighted gamma and phi' (drained) or Su (undrained) over 0..H."""
    layers = _layers_over(profile, H)
    total = sum(t for _, t in layers)
    gamma = sum(layer.gamma * t for layer, t in layers) / total
    key = "phi_eff" if drained else "su"
    values = []
    for layer, t in layers:
        value = getattr(layer.design, key)
        if value is None:
            raise AnchoredWallStop("missing_soil_parameter", f"Layer {layer.id} has no design {key}",
                                   layer=layer.id, parameter=key)
        values.append(value * t)
    mean = sum(values) / total
    cohesion = any(layer.design.c_eff > 0 for layer, _ in layers) if drained else False
    return {"gamma": gamma, key: mean, "cohesion_ignored": cohesion}


def apparent_envelope(profile: SoilProfile, H: float, *, drainage: str, surcharge: float,
                      stiff_coefficient: float) -> EnvelopeResult:
    """Apparent pressure envelope over 0..H for level ground (see module docstring)."""
    layers = _layers_over(profile, H)
    drained = drainage == "drained"
    if any((layer.behaviour == "drained") != drained for layer, _ in layers):
        raise AnchoredWallStop("envelope_mixed_layers",
                               "Sand and clay layers within the excavation height: the apparent "
                               "pressure envelope applies to a uniform soil type only")
    if profile.gwt.depth_for("design") < H - 1e-9:
        raise AnchoredWallStop("envelope_water_in_cut",
                               "Groundwater above the excavation base is not covered by the "
                               "apparent pressure envelope")
    if drained:
        avg = retained_averages(profile, H, True)
        ka = rankine_ka(avg["phi_eff"])
        gamma_h = avg["gamma"] * H
        p = SAND_FACTOR * ka * gamma_h + ka * surcharge
        return EnvelopeResult(kind="sand", p_max=p, total_thrust=p * H, gamma=avg["gamma"],
                              phi_deg=avg["phi_eff"], su=None, ka=ka, z=[0.0, H], p=[p, p])
    if surcharge > 0:
        raise AnchoredWallStop("envelope_clay_surcharge",
                               "Surcharge on clay is not covered by the apparent pressure envelope")
    avg = retained_averages(profile, H, False)
    gamma_h, su = avg["gamma"] * H, avg["su"]
    if gamma_h / su > STIFF_CLAY_LIMIT:
        p, kind = gamma_h - SOFT_CLAY_M * 4 * su, "soft_clay"
    else:
        p, kind = stiff_coefficient * gamma_h, "stiff_clay"
    zs, ps = [0.0, RAMP * H, H], [0.0, p, p]
    return EnvelopeResult(kind=kind, p_max=p, total_thrust=p * (H - 0.5 * RAMP * H),
                          gamma=avg["gamma"], phi_deg=None, su=su, ka=None, z=zs, p=ps)


def _hinge_model(env: EnvelopeResult, supports: list[float], method: str):
    """Support reactions [kN/m] and the shear/moment diagram of the hinge model above the base."""
    H = supports[-1]
    zg = np.unique(np.concatenate([np.arange(0.0, H, 0.002), env.z, supports, [H]]))
    p = np.interp(zg, env.z, env.p)
    c0, c1 = cumulative_integral(zg, p), cumulative_integral(zg, p * zg)
    C0 = lambda x: float(np.interp(x, zg, c0))  # noqa: E731
    C1 = lambda x: float(np.interp(x, zg, c1))  # noqa: E731
    load = lambda a, b: C0(b) - C0(a)  # noqa: E731
    moment_about = lambda a, b, c: (C1(b) - C1(a)) - c * (C0(b) - C0(a))  # noqa: E731
    m = len(supports)
    # spans: first covers 0..s[1] (supports s0, s1); then s[j]..s[j+1] for j >= 1
    spans = [(0.0, supports[1], supports[0], supports[1])]
    spans += [(supports[j], supports[j + 1], supports[j], supports[j + 1]) for j in range(1, m - 1)]
    reactions = np.zeros(m)
    seg_arrays = []
    for k, (a, b, s_lo, s_hi) in enumerate(spans):
        r_hi = moment_about(a, b, s_lo) / (s_hi - s_lo)
        r_lo = load(a, b) - r_hi
        i_lo, i_hi = (0, 1) if k == 0 else (k, k + 1)
        reactions[i_lo] += r_lo
        reactions[i_hi] += r_hi
        sel = (zg >= a - 1e-12) & (zg <= b + 1e-12)
        z = zg[sel]
        cz0 = np.interp(z, zg, c0) - C0(a)
        cz1 = np.interp(z, zg, c1) - C1(a)
        v = r_lo * (z >= s_lo - 1e-12) + r_hi * (z >= s_hi - 1e-12) - cz0
        mom = r_lo * np.maximum(z - s_lo, 0) * (z >= s_lo - 1e-12) \
            + r_hi * np.maximum(z - s_hi, 0) * (z >= s_hi - 1e-12) - (z * cz0 - cz1)
        seg_arrays.append((z, v, mom))
    if method == "tributary":
        mids = [0.0] + [0.5 * (supports[i] + supports[i + 1]) for i in range(m - 1)] + [H]
        reactions = np.array([load(mids[i], mids[i + 1]) for i in range(m)])
    z = np.concatenate([a[0] for a in seg_arrays])
    # driving-positive like the part below the base and anchored_sheet_pile (loads toward the excavation)
    return reactions, z, -np.concatenate([a[1] for a in seg_arrays]), -np.concatenate([a[2] for a in seg_arrays])


def _thin(*arrays, limit=MAX_POINTS):
    """Down-sample diagrams for transport; the extremes of every series are always kept."""
    n = len(arrays[0])
    if n <= limit:
        return [[float(x) for x in a] for a in arrays]
    keep = [i for a in arrays[1:] for i in (int(np.argmax(a)), int(np.argmin(a)))]
    idx = np.unique(np.concatenate([np.linspace(0, n - 1, limit).round().astype(int), keep]))
    return [[float(a[i]) for i in idx] for a in arrays]


def _design_levels(inputs: AnchoredWallAnalysisInputs, loads: list[float], phi: float,
                   notices: list[Notice]) -> list[LevelResult]:
    out = []
    template = inputs.anchor_design
    for level, t_h in zip(inputs.levels, loads):
        axial = t_h * level.spacing / math.cos(math.radians(level.inclination_deg))
        row = LevelResult(
            depth=level.depth, inclination_deg=level.inclination_deg, spacing=level.spacing,
            horizontal_load_per_m=t_h, horizontal_load_per_anchor=t_h * level.spacing,
            axial_load_per_anchor=axial,
            vertical_load_per_m=t_h * math.tan(math.radians(level.inclination_deg)))
        if template is not None:
            try:
                design_in = AnchorDesignInputs(
                    excavation_height=inputs.excavation_height, head_depth=level.depth,
                    inclination_deg=level.inclination_deg, phi_deg=phi,
                    horizontal_load_per_m=t_h, spacing=level.spacing, **template.model_dump())
                row.design = design_anchor(design_in)
            except MissingAnchorInputsError as exc:
                row.design_missing = exc.missing
            except (GeoTekError, ValidationError, ValueError) as exc:
                row.design_error = str(exc)
        out.append(row)
    if template is None:
        notices.append(Notice(code="anchor_design_not_requested"))
    return out


def run_analysis(inputs: AnchoredWallAnalysisInputs) -> AnalysisResult:
    H = inputs.excavation_height
    profile = inputs.soil.profile
    if profile.bottom <= H:
        raise GeoTekError("The soil profile must extend below the excavation base")
    drained = inputs.drainage == "drained"
    if any((layer.behaviour == "drained") != drained for layer in profile.layers):
        raise AnchoredWallStop("layer_behaviour_mismatch",
                               "A layer's drained/undrained behaviour differs from the analysis "
                               "drainage setting; mixed profiles are not supported")
    soldier = inputs.wall_type == "soldier_pile"
    spacing = inputs.pile_spacing if soldier else 1.0
    ratio = min(1.0, inputs.passive_width / inputs.pile_spacing) if soldier else 1.0
    q_h = surcharge_per_horizontal(inputs.surcharge, inputs.backfill_slope, inputs.surcharge_basis)
    pressure = dict(passive_factor=inputs.passive_factor, surcharge=q_h, drainage=inputs.drainage,
                    front_water_depth=inputs.front_water_depth, backfill_slope=inputs.backfill_slope,
                    passive_width_ratio=ratio)
    warnings: list[Notice] = []
    assumptions: list[Notice] = []
    single = len(inputs.levels) == 1
    if inputs.passive_factor == 1.0:
        warnings.append(Notice(code="passive_factor_unity"))
    if soldier and inputs.passive_width > inputs.pile_spacing:
        warnings.append(Notice(code="passive_width_capped"))
    if soldier:
        assumptions.append(Notice(code="soldier_passive_width", params={
            "width": inputs.passive_width, "spacing": inputs.pile_spacing, "ratio": round(ratio, 3)}))
    if inputs.surcharge and inputs.surcharge_basis == "inclined" and inputs.backfill_slope:
        assumptions.append(Notice(code="surcharge_inclined", params={"q_h": round(q_h, 3)}))
    envelope = None
    base_reaction = None

    if single:
        increase = 0.0 if inputs.depth_increase is None else inputs.depth_increase
        level = inputs.levels[0]
        res = anchored_sheet_pile(profile, H, level.depth, depth_increase=increase,
                                  anchor_spacing=level.spacing,
                                  anchor_inclination=level.inclination_deg, **pressure)
        loads = [res.anchor_force]
        method = "free_earth_single"
        d0, d = res.D0, res.D
        z, shear, moment = res.z, res.shear, res.moment
        m_max, z_m = res.M_max, res.z_M_max
        for text in res.warnings:
            if text.startswith("Anchor load:"):
                continue
            if "extends below the soil profile" in text:
                warnings.append(Notice(code="embedment_below_profile"))
            else:
                warnings.append(Notice(code="engine_message", params={"text": text}))
        assumptions.append(Notice(code="free_earth_support"))
        if inputs.depth_increase is None:
            assumptions.append(Notice(code="depth_increase_zero"))
    else:
        if inputs.backfill_slope > 0:
            raise AnchoredWallStop("envelope_sloping_ground",
                                   "The apparent pressure envelope is empirical for level ground; "
                                   "sloping ground with several anchor levels is not supported")
        increase = 0.2 if inputs.depth_increase is None else inputs.depth_increase
        envelope = apparent_envelope(profile, H, drainage=inputs.drainage, surcharge=q_h,
                                     stiff_coefficient=inputs.stiff_clay_coefficient)
        supports = [lv.depth for lv in inputs.levels] + [H]
        reactions, zh, vh, mh = _hinge_model(envelope, supports, inputs.load_method)
        loads = [float(r) for r in reactions[:-1]]
        base_reaction = float(reactions[-1])
        if min(loads) <= 0:
            raise AnchoredWallStop("non_positive_anchor_load",
                                   "The hinge model gives a zero or compressive anchor load; change "
                                   "the anchor levels (spacing too uneven) or use the tributary method")
        method = "apparent_hinge" if inputs.load_method == "hinge" else "apparent_tributary"
        if base_reaction <= 0:
            raise GeoTekError("The base reaction is not positive; check the anchor levels")
        np_ = net_pressure(profile, H, **pressure)
        zz, net = np_.z, np_.net
        F, Fz = cumulative_integral(zz, net), cumulative_integral(zz, net * zz)
        f_h, fz_h = float(np.interp(H, zz, F)), float(np.interp(H, zz, Fz))
        toe_moment = lambda zt: (base_reaction * (zt - H) + (np.interp(zt, zz, F) - f_h) * zt  # noqa: E731
                                 - (np.interp(zt, zz, Fz) - fz_h))
        first_below = int(np.searchsorted(zz, H, side="right"))
        try:
            toe = find_root(toe_moment, zz, first_below, no_drive_message="no_resistance")
        except GeoTekError as exc:
            if str(exc) != "no_resistance":
                raise
            raise AnchoredWallStop(
                "no_embedment_resistance",
                "The net pressure below the excavation base is not resisted by the soil, so no "
                "embedment balances the base reaction (e.g. undrained clay with gamma H > 4 Su)") from exc
        if toe is None:
            raise AnchoredWallStop(
                "no_embedment_resistance",
                "No embedment within the profile balances the base reaction; the passive "
                "resistance below the base is too small (deepen the profile or check parameters)")
        d0, d = toe - H, (toe - H) * (1 + increase)
        if H + d > profile.bottom:
            warnings.append(Notice(code="embedment_below_profile"))
        below = (zz >= H) & (zz <= toe)
        zb = zz[below]
        vb = base_reaction + (F[below] - f_h)
        mb = base_reaction * (zb - H) + (F[below] - f_h) * zb - (Fz[below] - fz_h)
        crossing = np.flatnonzero(np.sign(vb) != np.sign(base_reaction))
        n_keep = int(crossing[0]) + 1 if crossing.size else len(vb)
        v_checked = float(max(np.max(np.abs(vh)), np.max(np.abs(vb[:n_keep]))))
        toe_residual = float(abs(vb[-1])) if crossing.size else 0.0
        if toe_residual > 1e-6:
            assumptions.append(Notice(code="toe_force_not_balanced",
                                      params={"value": round(toe_residual, 1)}))
        z = np.concatenate([zh, zb])
        shear = np.concatenate([vh, vb])
        moment = np.concatenate([mh, mb])
        i_m = int(np.argmax(np.abs(moment)))
        m_max, z_m = float(abs(moment[i_m])), float(z[i_m])
        assumptions += [
            Notice(code="apparent_envelope_empirical", params={"kind": envelope.kind}),
            Notice(code="envelope_source_unverified"),
            Notice(code=f"load_method_{inputs.load_method}"),
            Notice(code="embedment_from_base_reaction"),
        ]
        if envelope.kind == "sand" and inputs.surcharge:
            assumptions.append(Notice(code="sand_surcharge_uniform"))
        if envelope.kind == "stiff_clay":
            assumptions += [Notice(code="stiff_clay_coefficient",
                                   params={"value": inputs.stiff_clay_coefficient}),
                            Notice(code="stiff_clay_bottom_ramp_omitted")]
        if envelope.kind == "soft_clay":
            assumptions.append(Notice(code="soft_clay_m_unity"))
        if envelope.kind == "sand" and retained_averages(profile, H, True)["cohesion_ignored"]:
            warnings.append(Notice(code="cohesion_ignored"))
        if inputs.depth_increase is None:
            assumptions.append(Notice(code="depth_increase_default", params={"value": increase}))

    phi = retained_averages(profile, H, True)["phi_eff"] if drained else 0.0
    if inputs.backfill_slope > 0 and inputs.anchor_design is not None:
        warnings.append(Notice(code="anchor_design_level_ground"))
    levels = _design_levels(inputs, loads, phi, assumptions)
    v_max = float(np.max(np.abs(shear))) if single else v_checked
    m_member, v_member = m_max * spacing, v_max * spacing
    section = inputs.section
    required_w = m_member / section.allowable_stress_mpa * 1000.0 if section.allowable_stress_mpa else None
    checks = []
    if section.w_cm3 and section.allowable_stress_mpa:
        stress = m_member / section.w_cm3 * 1000.0
        checks.append(AnchorCheck(id="bending_stress", demand=stress, limit=section.allowable_stress_mpa,
                                  ok=stress <= section.allowable_stress_mpa))
    if section.ei_knm2 is not None:
        assumptions.append(Notice(code="ei_not_used"))
    assumptions.append(Notice(code="no_section_design"))
    zt, st, mt = _thin(z, shear, moment)
    return AnalysisResult(
        method=method, wall_type=inputs.wall_type, excavation_height=H,
        embedment_theoretical=d0, embedment=d, wall_length=H + d, base_reaction=base_reaction,
        envelope=envelope, levels=levels, m_max=m_max, z_m_max=z_m, v_max=v_max,
        member_spacing=spacing, m_max_member=m_member, v_max_member=v_member,
        required_section_modulus_cm3=required_w, checks=checks, z=zt, shear=st, moment=mt,
        warnings=warnings, assumptions=assumptions, sources=SOURCES)
