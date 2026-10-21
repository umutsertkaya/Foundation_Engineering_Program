"""Anchored (tied-back) excavation wall analysis, per metre of wall.

Method: FHWA GEC-4 (FHWA-IF-99-015, Sabatini, Pass and Bachus 1999), chapter 5.

Apparent earth pressure envelopes over the excavation height H, level ground only
(H1 = depth of the top anchor, H_n+1 = height of the lowest anchor above the base):

* sand (5.2.4, figure 24): trapezoid, zero at the top and the base, full ordinate from 2/3 H1
  down to 2/3 H_n+1 above the base, total load 0.65 Ka gamma H^2, so
  ``p = 0.65 Ka gamma H^2 / (H - H1/3 - H_n+1/3)``; a uniform surcharge adds ``Ka q`` (added
  explicitly, 5.2.4);
* stiff to hard clay, N_s = gamma H / Su,b <= 4 (5.2.5, figure 27): same trapezoid with
  ``p = c gamma H``, c = 0.2-0.4 chosen by the user; the total load is raised to at least
  3 H^2 kN/m; permanent works also take 0.65 Ka gamma H^2 with the drained phi' when larger;
* soft to medium clay, N_s > 4 (5.2.6, figure 23c): ``p = Ka gamma H``, zero at the top, full from
  0.25 H; ``Ka = 0.22`` for 4 < N_s < 5.14, Henkel (eq. 12) for N_s >= 5.14:
  ``Ka = 1 - 4 Su / (gamma H) + 2 sqrt(2) (d / H) (1 - 5.14 Su,b / (gamma H))``.

Su is averaged over the retained height; Su,b is the lowest Su from the base to B' below it
(the basal heave depth). Anchor loads: hinge or tributary method (5.3.3, figures 33-34); the
support at the excavation base takes the reaction R handed to the embedded part.

One anchor level: free earth support on the actual earth pressures (``anchored_sheet_pile`` in
``sheet_pile.py``, USS manual / USACE EM 1110-2-2504) and, where the envelope applies, the GEC-4
envelope with the hinge method (figure 33); the larger anchor force and bending moment govern.

Embedment (several levels): moments about the toe of the embedded part under R and the net
active/passive pressure below the base, passive divided by the input factor (GEC-4 5.5.3
suggests 1.5). This is deeper than the GEC-4 force criterion (passive / FS >= R + active), so it
is on the safe side; the unbalanced toe force is reported. D = D0 (1 + increase).

Basal heave in clay (5.8.2.2, eq. 34-36): ``FS = Nc Su,b / (gamma H + q - Su H / B')`` with
``B' = B / sqrt(2)`` or the depth D of a stiff stratum when smaller, with Nc taken without depth
credit (H/B = 0) because the side shear is counted; and eq. 37 ``FS = Nc Su,b / (gamma H + q)``
with the depth-dependent Nc of figure 51c. The smaller FS governs. Nc is the lower of Skempton
(1951) ``5 (1 + 0.2 H/B)(1 + 0.2 B/L)``, H/B <= 2.5, and the digitised figure 51c chart; required
FS 1.5 temporary, 2.5 permanent. Henkel's d defaults to B'. External (global) stability is not analysed and is always
flagged (5.8.3). No section design: V and M demands, and M/W against a given stress.
"""

from __future__ import annotations

import hashlib
import json
import math

import numpy as np
from pydantic import ValidationError

from geotek.core.errors import GeoTekError
from geotek.core.models.anchors import (
    AnalysisResult,
    AnchorCheck,
    AnchorDesignInputs,
    AnchoredWallAnalysisInputs,
    BasalHeaveResult,
    EnvelopeResult,
    LevelResult,
    Notice,
)
from geotek.core.models.profile import SoilProfile
from geotek.engine import anchors as anchor_engine
from geotek.engine.anchors import MissingAnchorInputsError, design_anchor
from geotek.engine.earth_pressure.coefficients import rankine_ka, surcharge_per_horizontal
from geotek.engine.sheet_pile import (
    anchored_sheet_pile,
    cumulative_integral,
    find_root,
    net_pressure,
)

ENGINE_VERSION = "2"
"""Part of the inputs hash: bump when a formula or table value changes."""
SAND_FACTOR = 0.65
STIFF_CLAY_LIMIT = 4.0
HENKEL_LIMIT = 5.14
TRANSITION_KA = 0.22
"""GEC-4 5.2.6, p. 59: Ka for 4 < N_s < 5.14 (and the floor of the soft clay envelope)."""
STIFF_MIN_TOTAL = 3.0
"""GEC-4 5.2.5, p. 55: minimum total load 3 H^2 kN/m per metre (H in m)."""
STIFF_CRITICAL_TOTAL = 4.0
"""GEC-4 5.2.5, p. 55: at or below 3-4 H^2 critical temporary walls need performance data."""
SOFT_RAMP = 0.25
BASAL_FS = {"temporary": 1.5, "permanent": 2.5}
"""GEC-4 5.8.2.2, p. 107: minimum FS against basal heave."""
MAX_POINTS = 500
NC_CHART_H_OVER_B = (0.0, 1.0, 2.0, 2.5, 3.0, 4.0)
NC_CHART = {0.0: (5.19, 6.31, 6.97, 7.18, 7.32, 7.46),
            0.5: (5.69, 6.94, 7.65, 7.87, 8.02, 8.15),
            1.0: (6.18, 7.56, 8.34, 8.59, 8.76, 8.94)}
"""Nc read from GEC-4 figure 51c (Janbu et al. 1956) at 400 dpi for B/L = 0, 0.5, 1; flat beyond
H/B = 4. Used as an upper bound on the Skempton value, which exceeds the chart by up to 5 % for
H/B >= 2."""

GEC4 = "FHWA GEC-4 (FHWA-IF-99-015)"
SOURCES_ENVELOPE = [
    f"{GEC4} 5.2.4-5.2.6, figures 23, 24, 27-29, eq. 9-12 (apparent earth pressure envelopes)",
    f"{GEC4} 5.3.3, figures 33-34 (hinge and tributary methods), 5.4.1 (wall moments)",
    f"{GEC4} 5.5.3 (embedment; passive factor of safety)",
]
SOURCES_SINGLE = [
    "USS Steel Sheet Piling Design Manual; USACE EM 1110-2-2504 (free earth support)",
]
SOURCES_BASAL = [
    f"{GEC4} 5.8.2.2, eq. 34-36, figure 51 (basal heave; Terzaghi, Peck and Mesri 1996)",
    "Skempton (1951) bearing capacity factor Nc for the base of a cut",
]
SOURCE_EXTERNAL = f"{GEC4} 5.8.3 (external stability: not analysed, check separately)"


class AnchoredWallStop(GeoTekError):
    """The case is outside what the method supports; ``code`` selects a translated message."""

    def __init__(self, code: str, message: str, **params):
        self.code = code
        self.params = params
        super().__init__(message)


def inputs_hash(inputs: AnchoredWallAnalysisInputs) -> str:
    payload = json.dumps([ENGINE_VERSION, anchor_engine.ENGINE_VERSION, inputs.model_dump(mode="json")],
                         sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def missing_inputs(inputs: AnchoredWallAnalysisInputs) -> list[str]:
    """Required engineering inputs without a value (empty when the analysis can run)."""
    missing = []
    if inputs.passive_factor is None:
        missing.append("passive_factor")
    if inputs.drainage == "undrained":
        if inputs.service is None:
            missing.append("service")
        if inputs.excavation_width is None:
            missing.append("excavation_width")
    return missing


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


def su_below_base(profile: SoilProfile, H: float, depth: float) -> float:
    """Lowest design Su of the layers between the base and ``depth`` below it."""
    values = []
    for layer in profile.layers:
        if layer.bottom > H + 1e-9 and layer.top < H + depth - 1e-9:
            if layer.design.su is None:
                raise AnchoredWallStop("missing_soil_parameter", f"Layer {layer.id} has no design su",
                                       layer=layer.id, parameter="su")
            values.append(layer.design.su)
    if not values or min(values) <= 0:
        raise AnchoredWallStop("missing_soil_parameter", "No undrained strength below the base",
                               layer="-", parameter="su")
    return min(values)


def basal_heave(profile: SoilProfile, H: float, *, width: float, length: float | None,
                stiff_depth: float | None, surcharge: float, service: str,
                warns: list[Notice]) -> BasalHeaveResult:
    """Bottom heave of a cut in clay (GEC-4 eq. 34-36, see module docstring)."""
    b_eff, basis = width / math.sqrt(2.0), "width"
    if stiff_depth is not None and stiff_depth < b_eff:
        b_eff, basis = stiff_depth, "stiff_layer"
    if profile.bottom < H + b_eff - 1e-9:
        warns.append(Notice(code="basal_profile_short", params={"depth": round(H + b_eff, 2)}))
    su_b = su_below_base(profile, H, b_eff)
    avg = retained_averages(profile, H, False)
    b_over_l = 0.0 if length is None else min(width / length, 1.0)

    def bearing_factor(h_over_b: float) -> float:
        skempton = 5.0 * (1.0 + 0.2 * min(h_over_b, 2.5)) * (1.0 + 0.2 * b_over_l)
        rows = [float(np.interp(h_over_b, NC_CHART_H_OVER_B, v)) for v in NC_CHART.values()]
        return min(skempton, float(np.interp(b_over_l, list(NC_CHART), rows)))

    # Two mechanisms, the smaller FS governs: eq. 37 with the depth-dependent Nc of figure 51c (no
    # side shear), and eq. 34-36 with the side shear Su H / B' but Nc without depth credit (H/B = 0),
    # so the shear above the base is never counted twice.
    nc = bearing_factor(H / width)
    load = avg["gamma"] * H + surcharge
    fs = nc * su_b / load
    demand = load - avg["su"] * H / b_eff
    if demand > 0:
        fs = min(fs, bearing_factor(0.0) * su_b / demand)
    required = BASAL_FS[service]
    return BasalHeaveResult(b_eff=b_eff, b_eff_basis=basis, nc=nc, su_below=su_b, su_retained=avg["su"],
                            gamma=avg["gamma"], surcharge=surcharge, fs=fs, fs_required=required,
                            ok=fs >= required)


def _trapezoid(H: float, anchors: list[float], p: float) -> tuple[list[float], list[float], float]:
    """GEC-4 figures 24 and 27: points, ordinates and the length that multiplies p."""
    h1, hn1 = anchors[0], H - anchors[-1]
    top, bottom = 2.0 / 3.0 * h1, H - 2.0 / 3.0 * hn1
    return [0.0, top, bottom, H], [0.0, p, p, 0.0], H - h1 / 3.0 - hn1 / 3.0


def apparent_envelope(profile: SoilProfile, H: float, *, drainage: str, surcharge: float,
                      stiff_coefficient: float, anchors: list[float], su_b: float | None = None,
                      henkel_depth: float | None = None, henkel_default: float | None = None,
                      service: str | None = None,
                      notes: list[Notice] | None = None,
                      warns: list[Notice] | None = None) -> EnvelopeResult:
    """GEC-4 apparent pressure envelope over 0..H for level ground (see module docstring)."""
    notes = [] if notes is None else notes
    warns = [] if warns is None else warns
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
        total = SAND_FACTOR * ka * avg["gamma"] * H ** 2
        z, p, length = _trapezoid(H, anchors, 0.0)
        p_soil = total / length
        kq = ka * surcharge
        ps = [kq, p_soil + kq, p_soil + kq, kq]
        return EnvelopeResult(kind="sand", p_max=p_soil + kq, total_thrust=total + kq * H,
                              gamma=avg["gamma"], phi_deg=avg["phi_eff"], su=None, ka=ka, z=z, p=ps)
    if surcharge > 0:
        raise AnchoredWallStop("envelope_clay_surcharge",
                               "Surcharge on clay is not covered by the apparent pressure envelope")
    if su_b is None:
        raise GeoTekError("su_b is required for clay envelopes")
    avg = retained_averages(profile, H, False)
    gamma, su = avg["gamma"], avg["su"]
    gamma_h = gamma * H
    ns = gamma_h / su_b
    if ns <= STIFF_CLAY_LIMIT:
        z, _, length = _trapezoid(H, anchors, 0.0)
        p = stiff_coefficient * gamma_h
        total = p * length
        minimum = STIFF_MIN_TOTAL * H ** 2
        if total < minimum:
            total = minimum
            notes.append(Notice(code="stiff_clay_min_total_load", params={"total": round(total, 1)}))
        if service == "permanent":
            phis = [layer.design.phi_eff for layer, _ in layers]
            if any(phi is None for phi in phis):
                raise AnchoredWallStop("stiff_clay_permanent_phi_missing",
                                       "Permanent walls in stiff clay need the drained friction angle "
                                       "of every retained layer (GEC-4 5.2.5)")
            phi = retained_averages(profile, H, True)["phi_eff"]
            long_term = SAND_FACTOR * rankine_ka(phi) * gamma * H ** 2
            if long_term > total:
                total = long_term
                notes.append(Notice(code="stiff_clay_long_term_governs",
                                    params={"phi": round(phi, 1), "total": round(total, 1)}))
            else:
                notes.append(Notice(code="stiff_clay_long_term_checked", params={"phi": round(phi, 1)}))
        else:
            notes.append(Notice(code="stiff_clay_temporary_only"))
        if total <= STIFF_CRITICAL_TOTAL * H ** 2 * (1 + 1e-9):
            warns.append(Notice(code="stiff_clay_low_total_load",
                                params={"total": round(total, 1), "limit": round(STIFF_CRITICAL_TOTAL * H ** 2, 1)}))
        p = total / length
        notes.append(Notice(code="stiff_clay_coefficient", params={"value": stiff_coefficient}))
        return EnvelopeResult(kind="stiff_clay", p_max=p, total_thrust=total, gamma=gamma, phi_deg=None,
                              su=su, ka=None, z=z, p=[0.0, p, p, 0.0], ns=ns, su_below=su_b)
    if ns < HENKEL_LIMIT:
        ka = TRANSITION_KA
        notes.append(Notice(code="soft_clay_transition_ka", params={"ns": round(ns, 2)}))
    else:
        d = henkel_depth if henkel_depth is not None else henkel_default
        if d is None:
            raise AnchoredWallStop("henkel_depth_missing",
                                   "Soft clay with N_s >= 5.14 needs the Henkel failure depth d "
                                   "(GEC-4 eq. 12, figure 28)", ns=round(ns, 2))
        if henkel_depth is not None and henkel_default is not None and henkel_depth < henkel_default - 1e-9:
            warns.append(Notice(code="henkel_depth_below_b_eff",
                                params={"d": henkel_depth, "b_eff": round(henkel_default, 2)}))
        ka = (1.0 - 4.0 * su / gamma_h
              + 2.0 * math.sqrt(2.0) * d / H * (1.0 - HENKEL_LIMIT * su_b / gamma_h))
        notes.append(Notice(code="soft_clay_henkel", params={"ns": round(ns, 2), "d": round(d, 2)}))
        if ka < TRANSITION_KA:
            notes.append(Notice(code="soft_clay_ka_floor", params={"ka": round(ka, 3)}))
            ka = TRANSITION_KA
    p = ka * gamma_h
    return EnvelopeResult(kind="soft_clay", p_max=p, total_thrust=p * (H - 0.5 * SOFT_RAMP * H),
                          gamma=gamma, phi_deg=None, su=su, ka=ka, z=[0.0, SOFT_RAMP * H, H],
                          p=[0.0, p, p], ns=ns, su_below=su_b)


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


def _envelope_moment(z, moment) -> tuple[float, float]:
    i = int(np.argmax(np.abs(moment)))
    return float(abs(moment[i])), float(z[i])


def run_analysis(inputs: AnchoredWallAnalysisInputs) -> AnalysisResult:
    missing = missing_inputs(inputs)
    if missing:
        raise AnchoredWallStop("missing_inputs", "Missing analysis inputs: " + ", ".join(missing),
                               fields=", ".join(missing))
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
    warnings: list[Notice] = [Notice(code="external_stability_not_checked")]
    assumptions: list[Notice] = []
    checks: list[AnchorCheck] = []
    sources = list(SOURCES_ENVELOPE)
    single = len(inputs.levels) == 1
    anchors = [lv.depth for lv in inputs.levels]
    if inputs.passive_factor == 1.0:
        warnings.append(Notice(code="passive_factor_unity"))
    if soldier and inputs.passive_width > inputs.pile_spacing:
        warnings.append(Notice(code="passive_width_capped"))
    if soldier:
        assumptions.append(Notice(code="soldier_passive_width", params={
            "width": inputs.passive_width, "spacing": inputs.pile_spacing, "ratio": round(ratio, 3)}))
    if inputs.surcharge and inputs.surcharge_basis == "inclined" and inputs.backfill_slope:
        assumptions.append(Notice(code="surcharge_inclined", params={"q_h": round(q_h, 3)}))
    if drained and inputs.front_water_depth is None and profile.gwt.depth_for("design") < profile.bottom:
        assumptions.append(Notice(code="front_water_default"))

    basal = None
    su_b = None
    if not drained:
        basal = basal_heave(profile, H, width=inputs.excavation_width, length=inputs.excavation_length,
                            stiff_depth=inputs.stiff_layer_depth, surcharge=q_h, service=inputs.service,
                            warns=warnings)
        su_b = basal.su_below
        checks.append(AnchorCheck(id="basal_heave", demand=basal.fs_required, limit=basal.fs, ok=basal.ok))
        if not basal.ok:
            warnings.append(Notice(code="basal_heave_low", params={
                "fs": round(basal.fs, 2), "required": basal.fs_required}))
        assumptions += [Notice(code="basal_heave_nc_skempton"), Notice(code="ns_from_lowest_su_below")]
        if inputs.excavation_length is None:
            assumptions.append(Notice(code="basal_heave_long_cut"))
        sources += SOURCES_BASAL
    envelope_kw = dict(drainage=inputs.drainage, surcharge=q_h, stiff_coefficient=inputs.stiff_clay_coefficient,
                       anchors=anchors, su_b=su_b, henkel_depth=inputs.henkel_depth,
                       henkel_default=None if basal is None else basal.b_eff, service=inputs.service)
    envelope = None
    base_reaction = None

    if single:
        sources += SOURCES_SINGLE
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
        v_max = float(np.max(np.abs(shear)))
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
        # GEC-4 figure 24 / 27 / 33: envelope with the hinge method; the larger anchor force governs
        env_notes: list[Notice] = []
        env_warns: list[Notice] = []
        try:
            if inputs.backfill_slope > 0:
                raise AnchoredWallStop("envelope_sloping_ground", "level ground only")
            envelope = apparent_envelope(profile, H, notes=env_notes, warns=env_warns, **envelope_kw)
        except AnchoredWallStop as exc:
            if exc.code in ("stiff_clay_permanent_phi_missing", "missing_soil_parameter", "henkel_depth_missing"):
                raise  # a required input, never a silent fall-back
            envelope = None
            warnings.append(Notice(code="envelope_check_not_possible", params={"reason": exc.code}))
        if envelope is not None:
            assumptions += env_notes
            warnings += env_warns
            reactions, zh, vh, mh = _hinge_model(envelope, [level.depth, H], "hinge")
            t_env = float(reactions[0])
            params = {"free_earth": round(res.anchor_force, 2), "envelope": round(t_env, 2)}
            if t_env > res.anchor_force:
                loads = [t_env]
                assumptions.append(Notice(code="anchor_load_from_envelope", params=params))
            else:
                assumptions.append(Notice(code="anchor_load_free_earth", params=params))
            m_env, z_env = _envelope_moment(zh, mh)
            if m_env > m_max:
                assumptions.append(Notice(code="moment_from_envelope", params={
                    "free_earth": round(m_max, 2), "envelope": round(m_env, 2)}))
                m_max, z_m = m_env, z_env
            v_max = max(v_max, float(np.max(np.abs(vh))))
    else:
        if inputs.backfill_slope > 0:
            raise AnchoredWallStop("envelope_sloping_ground",
                                   "The apparent pressure envelope is empirical for level ground; "
                                   "sloping ground with several anchor levels is not supported")
        increase = 0.2 if inputs.depth_increase is None else inputs.depth_increase
        envelope = apparent_envelope(profile, H, notes=assumptions, warns=warnings, **envelope_kw)
        supports = anchors + [H]
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
        v_max = float(max(np.max(np.abs(vh)), np.max(np.abs(vb[:n_keep]))))
        toe_residual = float(abs(vb[-1])) if crossing.size else 0.0
        if toe_residual > 1e-6:
            warnings.append(Notice(code="toe_force_not_balanced",
                                   params={"value": round(toe_residual, 1)}))
        z = np.concatenate([zh, zb])
        shear = np.concatenate([vh, vb])
        moment = np.concatenate([mh, mb])
        m_max, z_m = _envelope_moment(z, moment)
        assumptions += [
            Notice(code="apparent_envelope_empirical", params={"kind": envelope.kind}),
            Notice(code=f"load_method_{inputs.load_method}"),
            Notice(code="embedment_from_base_reaction"),
        ]
        if envelope.kind == "sand" and inputs.surcharge:
            assumptions.append(Notice(code="sand_surcharge_uniform"))
        if inputs.depth_increase is None:
            assumptions.append(Notice(code="depth_increase_default", params={"value": increase}))
    if envelope is not None and envelope.kind == "sand" and retained_averages(profile, H, True)["cohesion_ignored"]:
        warnings.append(Notice(code="cohesion_ignored"))

    phi = retained_averages(profile, H, True)["phi_eff"] if drained else 0.0
    if inputs.anchor_design is not None:
        if inputs.backfill_slope > 0:
            warnings.append(Notice(code="anchor_design_level_ground"))
        if not drained or len(_layers_over(profile, H)) > 1 or q_h > 0:
            warnings.append(Notice(code="anchor_wedge_simplified"))
    levels = _design_levels(inputs, loads, phi, assumptions)
    vertical = sum(lv.vertical_load_per_m for lv in levels)
    if vertical > 0:
        warnings.append(Notice(code="vertical_load_not_checked", params={
            "per_m": round(vertical, 1), "per_member": round(vertical * spacing, 1)}))
    m_member, v_member = m_max * spacing, v_max * spacing
    section = inputs.section
    required_w = m_member / section.allowable_stress_mpa * 1000.0 if section.allowable_stress_mpa else None
    if section.w_cm3 and section.allowable_stress_mpa:
        stress = m_member / section.w_cm3 * 1000.0
        checks.append(AnchorCheck(id="bending_stress", demand=stress, limit=section.allowable_stress_mpa,
                                  ok=stress <= section.allowable_stress_mpa))
    if section.ei_knm2 is not None:
        assumptions.append(Notice(code="ei_not_used"))
    assumptions.append(Notice(code="no_section_design"))
    sources.append(SOURCE_EXTERNAL)
    zt, st, mt = _thin(z, shear, moment)
    return AnalysisResult(
        method=method, wall_type=inputs.wall_type, excavation_height=H,
        embedment_theoretical=d0, embedment=d, wall_length=H + d, base_reaction=base_reaction,
        envelope=envelope, levels=levels, m_max=m_max, z_m_max=z_m, v_max=v_max,
        member_spacing=spacing, m_max_member=m_member, v_max_member=v_member,
        required_section_modulus_cm3=required_w, checks=checks, basal_heave=basal, z=zt, shear=st,
        moment=mt, warnings=warnings, assumptions=assumptions, sources=sources)
