"""Anchored wall analysis: single level vs the sheet pile solver, apparent envelope hand calculations.

Hand calculation (independent of the engine): sand, gamma = 18, phi = 30 (Ka = 1/3), H = 10 m,
anchors at 1.5, 4.5, 7.5 m. Envelope p = 0.65 Ka gamma H = 39 kPa, thrust 390 kN/m.
Hinge model: spans [0, 4.5] (supports 1.5 and 4.5), [4.5, 7.5], [7.5, 10].
  span 1: sum p (z - 1.5) = 39 (4.5^2/2 - 1.5 x 4.5) = 131.625, R(4.5) = 131.625 / 3 = 43.875, R(1.5) = 175.5 - 43.875 = 131.625
  span 2: 117 / 2 = 58.5 each;  span 3: 97.5 / 2 = 48.75 each
  A1 = 131.625, A2 = 43.875 + 58.5 = 102.375, A3 = 58.5 + 48.75 = 107.25, R_B = 48.75.
Tributary (mid-points 3.0 and 6.0, 8.75): 117, 117, 107.25, 48.75.
Source of the envelope: Terzaghi and Peck (1967); FHWA GEC-4 ch. 5 (formula, not a worked example).
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
    inp = _inputs(depths=(2.0,), H=6.0, **extra)
    r = run_analysis(inp)
    from geotek.engine.earth_pressure.coefficients import surcharge_per_horizontal
    ref = anchored_sheet_pile(
        inp.soil.profile, 6.0, 2.0, depth_increase=inp.depth_increase or 0.0,
        passive_factor=inp.passive_factor, backfill_slope=inp.backfill_slope,
        surcharge=surcharge_per_horizontal(inp.surcharge, inp.backfill_slope, inp.surcharge_basis))
    assert r.method == "free_earth_single"
    assert r.levels[0].horizontal_load_per_m == ref.anchor_force
    assert r.embedment_theoretical == ref.D0 and r.embedment == ref.D
    assert r.m_max == ref.M_max and r.z_m_max == ref.z_M_max


def test_sand_hinge_loads_hand_calculation():
    r = run_analysis(_inputs(passive_factor=1.5))
    assert r.method == "apparent_hinge" and r.envelope.kind == "sand"
    assert r.envelope.p_max == pytest.approx(0.65 * KA * G * 10) and r.envelope.p_max == pytest.approx(39.0)
    loads = [lv.horizontal_load_per_m for lv in r.levels]
    assert loads == pytest.approx([131.625, 102.375, 107.25], abs=0.01)
    assert r.base_reaction == pytest.approx(48.75, abs=0.01)
    assert sum(loads) + r.base_reaction == pytest.approx(390.0, abs=0.01)
    # axial load per anchor: T_h s / cos(alpha), vertical component per metre
    assert r.levels[0].axial_load_per_anchor == pytest.approx(131.625 * 2.5)


def test_sand_tributary_loads_hand_calculation():
    r = run_analysis(_inputs(passive_factor=1.5, load_method="tributary"))
    loads = [lv.horizontal_load_per_m for lv in r.levels]
    assert loads == pytest.approx([117.0, 117.0, 107.25], abs=0.01)
    assert r.base_reaction == pytest.approx(48.75, abs=0.01)


def test_hinge_moments_and_embedment_hand_calculation():
    r = run_analysis(_inputs(passive_factor=1.5))
    import numpy as np

    from geotek.engine.anchored_wall import _hinge_model, apparent_envelope
    env = apparent_envelope(_soil().profile, 10.0, drainage="drained", surcharge=0.0, stiff_coefficient=0.3)
    _, z, v, m = _hinge_model(env, [1.5, 4.5, 7.5, 10.0], "hinge")
    # driving-positive: overhang p 1.5^2 / 2 at the first anchor; span 1 sags where V = 0 (z = 3.375)
    assert m[int(np.argmin(np.abs(z - 1.5)))] == pytest.approx(0.5 * 39 * 1.5**2, abs=0.01)
    zv = 131.625 / 39
    i = int(np.argmin(np.abs(z - zv)))
    assert m[i] == pytest.approx(-(131.625 * (zv - 1.5) - 39 * zv**2 / 2), abs=0.05)
    # embedment: independent root of  R_B x + int (Ka g (H + t) - Kp g t / 1.5)(x - t) dt = 0, x = D0
    from scipy.optimize import brentq

    def f(d):
        # moments about the toe of the embedded part, pressure = Ka g (H + t) - Kp g t / FS
        n = 20000
        h = d / n
        s = 48.75 * d
        for i in range(n):
            t = (i + 0.5) * h
            s += (KA * G * (10 + t) - KP * G * t / 1.5) * (d - t) * h
        return s
    d0 = brentq(f, 0.5, 30)
    assert r.embedment_theoretical == pytest.approx(d0, rel=2e-3)
    assert r.embedment == pytest.approx(1.2 * d0, rel=2e-3)


def test_soft_clay_envelope():
    from geotek.engine.anchored_wall import apparent_envelope
    soil = _soil([_clay(15.0)])
    env = apparent_envelope(soil.profile, 8.0, drainage="undrained", surcharge=0.0, stiff_coefficient=0.3)
    # gamma H = 136 > 4 Su = 60 -> soft; p = 136 - 60 = 76, ramp 0.25 H: thrust = 76 (8 - 1)
    assert env.kind == "soft_clay"
    assert env.p_max == pytest.approx(76.0)
    assert env.total_thrust == pytest.approx(532.0)
    # net pressure below the base is gamma H - 4 Su > 0 (driving): no embedment can balance it
    with pytest.raises(AnchoredWallStop) as exc:
        run_analysis(_inputs(depths=(2.0, 5.0), H=8.0, soil=soil, drainage="undrained", passive_factor=1.5))
    assert exc.value.code == "no_embedment_resistance"


def test_stiff_clay_envelope_coefficient():
    r = run_analysis(_inputs(depths=(2.0, 5.0), H=8.0, soil=_soil([_clay(80.0)]), drainage="undrained",
                             stiff_clay_coefficient=0.4, passive_factor=1.5))
    assert r.envelope.kind == "stiff_clay"
    assert r.envelope.p_max == pytest.approx(0.4 * 17 * 8)
    assert any(n.code == "stiff_clay_bottom_ramp_omitted" for n in r.assumptions)


def test_sand_surcharge_adds_ka_q():
    r = run_analysis(_inputs(surcharge=20.0, passive_factor=1.5))
    assert r.envelope.p_max == pytest.approx(39.0 + KA * 20.0)


@pytest.mark.parametrize("kw,code", [
    ({"backfill_slope": 5.0}, "envelope_sloping_ground"),
    ({"soil": _soil(gwt=4.0)}, "envelope_water_in_cut"),
    ({"soil": _soil([_clay(15.0)]), "drainage": "undrained", "surcharge": 5.0}, "envelope_clay_surcharge"),
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
    assert top.design.horizontal_load_per_anchor == pytest.approx(131.625 * 2.5, rel=1e-6)
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


def test_shear_maximum_excludes_unbalanced_toe_force():
    r = run_analysis(_inputs(depths=(2.0, 5.0), H=8.0, passive_factor=1.5))
    assert r.v_max < 120.0
    assert any(n.code == "toe_force_not_balanced" for n in r.assumptions)
