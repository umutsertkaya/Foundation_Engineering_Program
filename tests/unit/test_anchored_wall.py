"""Anchored wall analysis: single level vs the sheet pile solver, apparent envelope hand calculations.

Hand calculation (independent of the engine): sand, gamma = 18, phi = 30 (Ka = 1/3), H = 10 m,
anchors at 1.5, 4.5, 7.5 m. GEC-4 figure 24 (FHWA-IF-99-015 p. 51): total load
0.65 Ka gamma H^2 = 390 kN/m, p = 390 / (10 - 1.5/3 - 2.5/3) = 45.0 kPa, zero at 0 and 10 m,
full from 2/3 H1 = 1.0 m to 10 - 2/3 x 2.5 = 8.3333 m.
Hinge model: spans [0, 4.5] (supports 1.5 and 4.5), [4.5, 7.5], [7.5, 10].
  span 1: triangle 22.5 at 0.6667, block 157.5 at 2.75: moment about 1.5 = -18.75 + 196.875
          = 178.125, R(4.5) = 59.375, R(1.5) = 180 - 59.375 = 120.625
  span 2: 135 / 2 = 67.5 each
  span 3: block 37.5 at 7.9167, triangle 37.5 at 8.8889: moment about 7.5 = 67.708,
          R_B = 27.083, R(7.5) = 47.917
  A1 = 120.625, A2 = 126.875, A3 = 115.417, R_B = 27.083 (sum 390).
Tributary (mid-points 3.0, 6.0, 8.75): 112.5, 135, 121.406, R_B = 21.094.
The same loads were found independently from the Caltrans Trenching and Shoring Manual
eq. 8-2-6 (sigma_a = 1.3 P / (H - (H1 + H_n+1)/3)).
"""

import pytest

from geotek.core.errors import GeoTekError
from geotek.core.models import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.core.models.anchors import (
    AnchorDesignCommon,
    AnchoredWallAnalysisInputs,
    AnchorLevel,
    TendonSpec,
)
from geotek.core.models.structures import StructureSoilModel
from geotek.engine.anchored_wall import AnchoredWallStop, run_analysis
from geotek.engine.earth_pressure.coefficients import rankine_ka, rankine_kp
from geotek.engine.sheet_pile import anchored_sheet_pile

G, PHI = 18.0, 30.0
KA, KP = rankine_ka(PHI), rankine_kp(PHI)


def _soil(layers=None, gwt=100.0):
    layers = layers or [SoilLayer(id="S", top=0, bottom=40, gamma=G, gamma_sat=20.0,
                                  design=DesignParameters(phi_eff=PHI))]
    return StructureSoilModel(profile=SoilProfile(
        id="SP", gwt=GroundwaterCondition(depth_insitu=gwt), layers=layers))


CLAY = {"drainage": "undrained", "service": "temporary", "excavation_width": 10.0}


def _clay(su, gamma=17.0):
    return SoilLayer(id="C", top=0, bottom=40, gamma=gamma, behaviour="undrained",
                     design=DesignParameters(su=su))


def _inputs(depths=(1.5, 4.5, 7.5), H=10.0, soil=None, **kw):
    levels = [AnchorLevel(depth=d, spacing=2.5) for d in depths]
    return AnchoredWallAnalysisInputs(excavation_height=H, soil=soil or _soil(), levels=levels, **kw)


@pytest.mark.parametrize("extra", [
    {}, {"passive_factor": 1.5, "surcharge": 10.0},
    {"backfill_slope": 10.0, "surcharge": 10.0, "surcharge_basis": "inclined", "depth_increase": 0.1},
])
def test_single_level_equals_anchored_sheet_pile(extra):
    extra = {"passive_factor": 1.0, **extra}
    inp = _inputs(depths=(2.0,), H=6.0, **extra)
    r = run_analysis(inp)
    from geotek.engine.earth_pressure.coefficients import surcharge_per_horizontal
    ref = anchored_sheet_pile(
        inp.soil.profile, 6.0, 2.0, depth_increase=inp.depth_increase or 0.0,
        passive_factor=inp.passive_factor, backfill_slope=inp.backfill_slope,
        surcharge=surcharge_per_horizontal(inp.surcharge, inp.backfill_slope, inp.surcharge_basis))
    assert r.method == "free_earth_single"
    assert r.embedment_theoretical == ref.D0 and r.embedment == ref.D
    codes = {n.code for n in r.assumptions}
    if inp.backfill_slope:
        # sloping ground: no envelope comparison, free earth support only
        assert r.levels[0].horizontal_load_per_m == ref.anchor_force
        assert r.m_max == ref.M_max
        assert "envelope_check_not_possible" in {n.code for n in r.warnings}
    else:
        # GEC-4 figure 24a: total 0.65 Ka g H^2 = 140.4, p = 140.4 / (2/3 x 6) = 35.1 (+ Ka q);
        # hinge about the base: without surcharge T = 140.4 - 101.4 / 4 = 115.05 kN/m
        assert r.levels[0].horizontal_load_per_m == pytest.approx(max(ref.anchor_force, r.levels[0].horizontal_load_per_m))
        assert r.levels[0].horizontal_load_per_m >= ref.anchor_force - 1e-9
        assert r.m_max >= ref.M_max - 1e-9
        assert codes & {"anchor_load_from_envelope", "anchor_load_free_earth"}
        if not inp.surcharge:
            assert r.envelope.p_max == pytest.approx(35.1)
            t = r.levels[0].horizontal_load_per_m
            assert t == pytest.approx(max(ref.anchor_force, 115.05), abs=0.02)


def test_sand_hinge_loads_hand_calculation():
    r = run_analysis(_inputs(passive_factor=1.5))
    assert r.method == "apparent_hinge" and r.envelope.kind == "sand"
    assert r.envelope.p_max == pytest.approx(0.65 * KA * G * 100 / (10 - 1.5 / 3 - 2.5 / 3))
    assert r.envelope.p_max == pytest.approx(45.0)
    assert r.envelope.total_thrust == pytest.approx(390.0)
    loads = [lv.horizontal_load_per_m for lv in r.levels]
    assert loads == pytest.approx([120.625, 126.875, 115.417], abs=0.01)
    assert r.base_reaction == pytest.approx(27.083, abs=0.01)
    assert sum(loads) + r.base_reaction == pytest.approx(390.0, abs=0.01)
    # axial load per anchor: T_h s / cos(alpha), vertical component per metre
    assert r.levels[0].axial_load_per_anchor == pytest.approx(120.625 * 2.5, rel=1e-4)


def test_sand_tributary_loads_hand_calculation():
    r = run_analysis(_inputs(passive_factor=1.5, load_method="tributary"))
    loads = [lv.horizontal_load_per_m for lv in r.levels]
    assert loads == pytest.approx([112.5, 135.0, 121.406], abs=0.01)
    assert r.base_reaction == pytest.approx(21.094, abs=0.01)


def test_hinge_moments_and_embedment_hand_calculation():
    r = run_analysis(_inputs(passive_factor=1.5))
    import numpy as np

    from geotek.engine.anchored_wall import _hinge_model, apparent_envelope
    env = apparent_envelope(_soil().profile, 10.0, drainage="drained", surcharge=0.0, stiff_coefficient=0.3,
                            anchors=[1.5, 4.5, 7.5])
    _, z, v, m = _hinge_model(env, [1.5, 4.5, 7.5, 10.0], "hinge")
    # driving-positive overhang moment at the first anchor: triangle 22.5 at 2/3 m plus block
    # 45 x 0.5 at 1.25 m -> 22.5 (1.5 - 0.6667) + 22.5 x 0.25 = 24.375
    assert m[int(np.argmin(np.abs(z - 1.5)))] == pytest.approx(24.375, abs=0.01)
    # span 1 sags where V = 0: 22.5 + 45 (zv - 1) = 120.625 -> zv = 3.1806
    zv = 1 + (120.625 - 22.5) / 45
    i = int(np.argmin(np.abs(z - zv)))
    m_hand = 120.625 * (zv - 1.5) - 22.5 * (zv - 2 / 3) - 45 * (zv - 1) ** 2 / 2
    assert m[i] == pytest.approx(-m_hand, abs=0.05)
    # embedment: independent root of  R_B x + int (Ka g (H + t) - Kp g t / 1.5)(x - t) dt = 0, x = D0
    from scipy.optimize import brentq

    def f(d):
        # moments about the toe of the embedded part, pressure = Ka g (H + t) - Kp g t / FS
        n = 20000
        h = d / n
        s = 27.0833 * d
        for i in range(n):
            t = (i + 0.5) * h
            s += (KA * G * (10 + t) - KP * G * t / 1.5) * (d - t) * h
        return s
    d0 = brentq(f, 0.5, 30)
    assert r.embedment_theoretical == pytest.approx(d0, rel=2e-3)
    assert r.embedment == pytest.approx(1.2 * d0, rel=2e-3)


def _env(su, H=8.0, **kw):
    from geotek.engine.anchored_wall import apparent_envelope
    soil = _soil([_clay(su)])
    args = {"drainage": "undrained", "surcharge": 0.0, "stiff_coefficient": 0.3, "anchors": [2.0, 5.0],
            "su_b": su, "service": "temporary"}
    args.update(kw)
    return apparent_envelope(soil.profile, H, **args)


def test_soft_clay_envelope_gec4():
    # GEC-4 5.2.6: gamma H = 136. Su = 30 -> N_s = 4.533 (4 < N_s < 5.14): Ka = 0.22, p = 29.92
    # (Terzaghi-Peck m = 1 would give 136 - 120 = 16 kPa, unconservative).
    env = _env(30.0)
    assert env.kind == "soft_clay" and env.ns == pytest.approx(136 / 30)
    assert env.ka == 0.22 and env.p_max == pytest.approx(0.22 * 136)
    assert env.total_thrust == pytest.approx(0.22 * 136 * 7.0)
    # Su = 15 -> N_s = 9.07: Henkel eq. 12 needs d
    with pytest.raises(AnchoredWallStop) as exc:
        _env(15.0)
    assert exc.value.code == "henkel_depth_missing"
    # d = 4 m: Ka = 1 - 60/136 + 2 sqrt2 (4/8)(1 - 5.14 x 15/136) = 0.55882 + 0.61249 = 1.17131
    henkel = _env(15.0, henkel_depth=4.0)
    assert henkel.ka == pytest.approx(1.17131, abs=1e-4)
    assert henkel.p_max == pytest.approx(1.17131 * 136, abs=0.02)
    # net pressure below the base is gamma H - 4 Su > 0 (driving): no embedment can balance it
    with pytest.raises(AnchoredWallStop) as exc:
        run_analysis(_inputs(depths=(2.0, 5.0), H=8.0, soil=_soil([_clay(30.0)]), passive_factor=1.5, **CLAY))
    assert exc.value.code == "no_embedment_resistance"


def test_clay_envelope_is_continuous_at_ns_4():
    # N_s = 4 (Su = 34): stiff branch; just above (Su = 33.9): soft with Ka = 0.22 -> ~30 kPa, no drop to ~0
    stiff = _env(34.0, stiff_coefficient=0.2)
    soft = _env(33.9)
    assert stiff.kind == "stiff_clay" and soft.kind == "soft_clay"
    assert soft.p_max > 0.2 * 136


def test_stiff_clay_envelope_gec4_trapezoid():
    # GEC-4 figure 27: anchors 2 and 5 m, H = 8: length 8 - 2/3 - 3/3 = 6.3333;
    # p = 0.4 x 17 x 8 = 54.4, total 344.53 >= 3 H^2 = 192
    r = run_analysis(_inputs(depths=(2.0, 5.0), H=8.0, soil=_soil([_clay(80.0)]),
                             stiff_clay_coefficient=0.4, passive_factor=1.5, **CLAY))
    assert r.envelope.kind == "stiff_clay"
    assert r.envelope.p_max == pytest.approx(54.4)
    assert r.envelope.total_thrust == pytest.approx(54.4 * (8 - 2 / 3 - 1), rel=1e-9)
    assert r.envelope.z == pytest.approx([0.0, 4 / 3, 6.0, 8.0])
    # c = 0.2: p = 27.2, total 172.27 < 192 -> raised to 3 H^2 = 192, p = 30.316; <= 4 H^2: warning
    low = _env(80.0, stiff_coefficient=0.2)
    assert low.total_thrust == pytest.approx(192.0) and low.p_max == pytest.approx(192 / (8 - 2 / 3 - 1))
    r2 = run_analysis(_inputs(depths=(2.0, 5.0), H=8.0, soil=_soil([_clay(80.0)]),
                              stiff_clay_coefficient=0.2, passive_factor=1.5, **CLAY))
    assert "stiff_clay_min_total_load" in {n.code for n in r2.assumptions}
    assert "stiff_clay_low_total_load" in {n.code for n in r2.warnings}


def test_stiff_clay_permanent_needs_drained_phi():
    with pytest.raises(AnchoredWallStop) as exc:
        _env(80.0, service="permanent")
    assert exc.value.code == "stiff_clay_permanent_phi_missing"


def test_basal_heave_hand_calculation():
    from geotek.engine.anchored_wall import basal_heave
    warns = []
    prof = _soil([_clay(20.0)]).profile
    # H = 6, B = 10 (H/B = 0.6), Su = 20, gamma = 17, long cut.
    # Nc: Skempton 5 (1 + 0.2 x 0.6) = 5.6; GEC-4 fig. 51c chart 5.19 + 0.6 (6.31 - 5.19) = 5.862 -> 5.6
    # eq. 37: 5.6 x 20 / 102 = 1.0980; eq. 35 (B' = 7.0711, Nc at H/B = 0: 5.0):
    # 5.0 x 20 / (102 - 20 x 6 / 7.0711) = 100 / 85.029 = 1.1761 -> FS = 1.0980 < 1.5
    b = basal_heave(prof, 6.0, width=10.0, length=None, stiff_depth=None, surcharge=0.0,
                    service="temporary", warns=warns)
    assert b.b_eff == pytest.approx(7.0711, abs=1e-4) and b.nc == pytest.approx(5.6)
    assert b.fs == pytest.approx(1.0980, abs=1e-4) and not b.ok
    # eq. 36 with a stiff layer 2 m below the base: 100 / 42 = 2.381 > eq. 37, so eq. 37 governs
    b2 = basal_heave(prof, 6.0, width=10.0, length=None, stiff_depth=2.0, surcharge=0.0,
                     service="temporary", warns=warns)
    assert b2.b_eff_basis == "stiff_layer" and b2.fs == pytest.approx(1.0980, abs=1e-4)
    # B/L = 0.5: Skempton 6.16, chart 5.69 + 0.6 (6.94 - 5.69) = 6.44 -> 6.16; FS 1.2078, permanent 2.5
    b3 = basal_heave(prof, 6.0, width=10.0, length=20.0, stiff_depth=2.0, surcharge=0.0,
                     service="permanent", warns=warns)
    assert b3.nc == pytest.approx(6.16) and b3.fs_required == 2.5 and not b3.ok
    assert b3.fs == pytest.approx(6.16 * 20 / 102, abs=1e-4)
    # narrow deep cut (independent review): H = 10, B = 2, Su = 30, gamma = 18; the side shear would
    # cancel the load, eq. 37 governs with the chart Nc 7.46 (Skempton 7.5): FS = 7.46 x 30 / 180 = 1.2433
    deep = basal_heave(_soil([_clay(30.0, gamma=18.0)]).profile, 10.0, width=2.0, length=None,
                       stiff_depth=None, surcharge=0.0, service="temporary", warns=warns)
    assert deep.nc == pytest.approx(7.46) and deep.fs == pytest.approx(1.2433, abs=1e-4) and not deep.ok
    # in the analysis a failing basal check is a failed check row and a warning
    r = run_analysis(_inputs(depths=(2.0,), H=6.0, soil=_soil([_clay(40.0)]), passive_factor=1.5,
                             drainage="undrained", service="temporary", excavation_width=40.0))
    row = next(c for c in r.checks if c.id == "basal_heave")
    assert row.ok == r.basal_heave.ok
    # profile shorter than H + B' is a warning, not a silent assumption
    short = _soil([SoilLayer(id="C", top=0, bottom=8, gamma=17.0, behaviour="undrained",
                             design=DesignParameters(su=20.0))]).profile
    basal_heave(short, 6.0, width=10.0, length=None, stiff_depth=None, surcharge=0.0,
                service="temporary", warns=warns)
    assert warns[-1].code == "basal_profile_short"


def test_henkel_depth_defaults_to_basal_width():
    # no d given: d = B' = 10 / sqrt2 = 7.0711 from the basal heave block
    env = _env(15.0, henkel_default=10 / 2 ** 0.5)
    ka = 1 - 60 / 136 + 2 * 2 ** 0.5 * (10 / 2 ** 0.5) / 8 * (1 - 5.14 * 15 / 136)
    assert env.ka == pytest.approx(ka)
    warns = []
    _env(15.0, henkel_depth=1.0, henkel_default=7.0711, warns=warns)
    assert warns[0].code == "henkel_depth_below_b_eff"


def test_undrained_requires_basal_inputs_and_passive_factor_required():
    with pytest.raises(AnchoredWallStop) as exc:
        run_analysis(_inputs(depths=(2.0,), H=6.0, soil=_soil([_clay(40.0)]), passive_factor=1.5,
                             drainage="undrained"))
    assert exc.value.code == "missing_inputs"
    assert "service" in exc.value.params["fields"] and "excavation_width" in exc.value.params["fields"]
    with pytest.raises(AnchoredWallStop) as exc:
        run_analysis(_inputs())
    assert exc.value.params["fields"] == "passive_factor"


def test_external_stability_always_flagged():
    r = run_analysis(_inputs(passive_factor=1.5))
    assert r.warnings[0].code == "external_stability_not_checked"


def test_sand_surcharge_adds_ka_q():
    r = run_analysis(_inputs(surcharge=20.0, passive_factor=1.5))
    assert r.envelope.p_max == pytest.approx(45.0 + KA * 20.0)
    assert r.envelope.total_thrust == pytest.approx(390.0 + KA * 20.0 * 10)


@pytest.mark.parametrize("kw,code", [
    ({"backfill_slope": 5.0}, "envelope_sloping_ground"),
    ({"soil": _soil(gwt=4.0)}, "envelope_water_in_cut"),
    ({"soil": _soil([_clay(80.0)]), **CLAY, "surcharge": 5.0}, "envelope_clay_surcharge"),
    ({"soil": _soil([_clay(15.0)])}, "layer_behaviour_mismatch"),
])
def test_multi_level_stops(kw, code):
    with pytest.raises(AnchoredWallStop) as exc:
        run_analysis(_inputs(passive_factor=1.5, **kw))
    assert exc.value.code == code


def test_soldier_pile_passive_width_and_member_demands():
    kw = dict(passive_factor=1.5, depth_increase=0.0)
    sheet = run_analysis(_inputs(**kw))
    pile = run_analysis(_inputs(wall_type="soldier_pile", pile_spacing=2.5, passive_width=1.2,
                                section={"w_cm3": 2000.0, "allowable_stress_mpa": 150.0}, **kw))
    assert pile.embedment_theoretical > sheet.embedment_theoretical
    assert pile.m_max_member == pytest.approx(pile.m_max * 2.5)
    assert pile.checks[0].id == "bending_stress"
    assert pile.checks[0].demand == pytest.approx(pile.m_max_member / 2000.0 * 1000.0)
    assert pile.required_section_modulus_cm3 == pytest.approx(pile.m_max_member / 150.0 * 1000.0)


def test_input_validation():
    with pytest.raises(ValueError):
        _inputs(wall_type="soldier_pile")
    with pytest.raises(ValueError):
        _inputs(pile_spacing=2.0, passive_width=0.5)
    with pytest.raises(ValueError):
        _inputs(depths=(4.5, 1.5))
    with pytest.raises(ValueError):
        _inputs(depths=(1.5, 11.0))


def test_anchor_design_is_fed_per_level_and_missing_inputs_listed():
    common = AnchorDesignCommon(tendon=TendonSpec(type="strand"), safety_factor=2.0,
                                ultimate_transfer_load=100.0, lock_off_ratio=1.0)
    r = run_analysis(_inputs(passive_factor=1.5, anchor_design=common))
    top = r.levels[0]
    assert top.design.horizontal_load_per_anchor == pytest.approx(120.625 * 2.5, rel=1e-4)
    assert top.design.bond_length == pytest.approx(top.design.design_load * 2.0 / 100.0, rel=1e-3) or top.design.bond_length_governing == "minimum"
    partial = AnchorDesignCommon(tendon=TendonSpec(type="strand"))
    r2 = run_analysis(_inputs(passive_factor=1.5, anchor_design=partial))
    assert r2.levels[0].design is None
    assert "safety_factor" in r2.levels[0].design_missing


def test_profile_too_short():
    with pytest.raises(GeoTekError):
        run_analysis(_inputs(soil=_soil([SoilLayer(id="S", top=0, bottom=10, gamma=G,
                                                    design=DesignParameters(phi_eff=PHI))])))


def test_diagram_sign_is_continuous_across_the_base():
    r = run_analysis(_inputs(depths=(2.0, 5.0), H=8.0, passive_factor=1.5))
    import numpy as np
    z, v = np.array(r.z), np.array(r.shear)
    assert abs(np.interp(7.99, z, v) - np.interp(8.01, z, v)) < 5.0


def test_hinge_negative_load_stops_and_tributary_runs():
    with pytest.raises(AnchoredWallStop) as exc:
        run_analysis(_inputs(depths=(3.0, 4.0, 7.0), passive_factor=1.5))
    assert exc.value.code == "non_positive_anchor_load"
    r = run_analysis(_inputs(depths=(3.0, 4.0, 7.0), passive_factor=1.5, load_method="tributary"))
    assert all(lv.horizontal_load_per_m > 0 for lv in r.levels)


def test_mixed_behaviour_profile_stops_in_both_paths():
    mixed = _soil([SoilLayer(id="A", top=0, bottom=7, gamma=G, design=DesignParameters(phi_eff=PHI)),
                   SoilLayer(id="B", top=7, bottom=40, gamma=G, behaviour="undrained",
                             design=DesignParameters(su=40.0))])
    for depths in ((2.0,), (2.0, 5.0)):
        with pytest.raises(AnchoredWallStop) as exc:
            run_analysis(_inputs(depths=depths, H=6.0, soil=mixed, passive_factor=1.5))
        assert exc.value.code == "layer_behaviour_mismatch"


def test_shear_maximum_covers_whole_returned_diagram_including_unbalanced_toe_force():
    """ENG-C-004. The unbalanced toe force is the shear still carried at the toe, so the largest |V|
    of the returned diagram is that residual (195.7 kN/m here, read from the warning), not the
    ~120 kN/m the older code reported by dropping the part below the sign change."""
    import numpy as np
    r = run_analysis(_inputs(depths=(2.0, 5.0), H=8.0, passive_factor=1.5))
    warning = next(n for n in r.warnings if n.code == "toe_force_not_balanced")
    assert r.v_max == pytest.approx(float(np.max(np.abs(r.shear))))
    assert r.v_max >= warning.params["value"] - 0.1
    assert r.v_max == pytest.approx(195.7, abs=0.1)


def test_every_engine_code_has_tr_and_en_text():
    import json
    import re
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    src = "".join((root / f"geotek/engine/{n}.py").read_text(encoding="utf-8")
                  for n in ("anchors", "anchored_wall"))
    codes = set(re.findall(r'code="([a-z0-9_]+)"', src))
    codes |= set(re.findall(r'AnchoredWallStop\(\s*"([a-z0-9_]+)"', src))
    codes |= {"load_method_hinge", "load_method_tributary"}
    for lang in ("tr", "en"):
        cat = json.loads((root / f"geotek/modules/anchored_wall/i18n/{lang}.json").read_text(encoding="utf-8"))
        missing = [c for c in codes
                   if not any(f"anchored_wall.{k}.{c}" in cat for k in ("warning", "assumption", "error"))]
        assert not missing, (lang, missing)
