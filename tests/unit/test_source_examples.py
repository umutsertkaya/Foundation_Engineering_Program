"""Regression tests against the worked examples of the source lecture notes (HS-D).

Source: Keleşoğlu, İÜ-C Temel Mühendisliği 2 lecture notes (decks: Gravity Wall / Anchored Wall,
Arazi Deneyleri, Yanal Toprak Basıncı). Only numbers and formulas are kept here; the expected values
were computed by hand in docs/tasks/HS-D-SOURCE-REGRESSION.md and are used as given. Where the program
deliberately differs from the source, the test says so and compares only the unaffected quantity.
Summary and comparison table: docs/qa/hesap-sistemi-denetimi.md.
"""

import datetime as dt
import math

import numpy as np
import pytest

from geotek.core.constants import GAMMA_W, PA
from geotek.core.models import (
    CPTSounding,
    DesignParameters,
    GroundwaterCondition,
    SoilLayer,
    SoilProfile,
)
from geotek.core.models.anchors import AnchorDesignInputs
from geotek.core.models.parameters import ParameterSelection
from geotek.core.models.walls import (
    Backfill,
    CantileverGeometry,
    FoundationSoil,
    WallLoads,
    WallSettings,
)
from geotek.engine.anchored_wall import _hinge_model, apparent_envelope
from geotek.engine.anchors import design_anchor
from geotek.engine.classification.robertson import soil_behaviour_index
from geotek.engine.earth_pressure.coefficients import (
    coulomb_ka,
    coulomb_kp,
    mononobe_okabe_kae,
    rankine_ka,
    rankine_kp,
    tbdy_seismic_coefficients,
)
from geotek.engine.earth_pressure.distribution import lateral_pressure, resultant
from geotek.engine.insitu.cpt import process_cpt, stress_exponent
from geotek.engine.insitu.spt import (
    borehole_diameter_factor,
    n60,
    overburden_factor_liao_whitman,
    rod_length_factor,
    sampler_factor,
)
from geotek.engine.walls.walls import analyze_cantilever_wall
from geotek.services import parameters as svc

# --- D1. Cantilever wall, Problem 1 (Gravity Wall deck, slides 2-12) ---------------------------


def _d1_inputs(**loads):
    geometry = CantileverGeometry(stem_height=5.6, stem_top=0.4, stem_bottom=0.4, toe=0.0, heel=4.1,
                                  base_thickness=0.4)
    backfill = Backfill(gamma=18, phi=30, delta=0)
    foundation = FoundationSoil(phi=35, gamma=19,
                                delta_base=math.degrees(math.atan(0.76 * math.tan(math.radians(35)))))
    return (geometry, backfill, foundation, WallLoads(surcharge=10, **loads),
            WallSettings(concrete_unit_weight=25))


def _force(result, name):
    return next(f for f in result.forces if f.name == name)


def test_d1_cantilever_wall_static_problem1():
    """Source: Keleşoğlu, Gravity Wall deck, Problem 1 (slides 2-12), static case.

    Hand values: W1 413.28 @2.45, W2 56.0 @0.20, W3 45.0 @2.25, P1 20.0 @3.0, P2 108.0 @2.0,
    M_R 1125, M_O 276, FS_ot 4.076, sum V (surcharge excluded) 514.3, FS_sliding 2.138.
    Bearing capacity is NOT compared: the source uses the full B and q_max, the program uses the
    Meyerhof effective width B' (conscious difference); only the eccentricity e = 0.599 m is checked.
    """
    r = analyze_cantilever_wall(*_d1_inputs())
    heel, stem, base = _force(r, "Soil over heel"), _force(r, "Stem"), _force(r, "Base slab")
    assert (-heel.fy, heel.x) == pytest.approx((413.28, 2.45), rel=5e-3)
    assert (-stem.fy, stem.x) == pytest.approx((56.0, 0.20), rel=5e-3)
    assert (-base.fy, base.x) == pytest.approx((45.0, 2.25), rel=5e-3)
    earth, sur = _force(r, "Earth pressure"), _force(r, "Surcharge pressure")
    assert (-earth.fx, earth.y) == pytest.approx((108.0, 2.0), rel=5e-3)
    assert (-sur.fx, sur.y) == pytest.approx((20.0, 3.0), rel=5e-3)
    assert r.m_resisting == pytest.approx(1125.0, rel=5e-3)
    assert r.m_overturning == pytest.approx(276.0, rel=5e-3)
    assert r.checks["overturning"].value == pytest.approx(4.076, rel=5e-3)
    assert r.checks["overturning"].value >= 2.0
    assert r.sum_v == pytest.approx(514.3, rel=5e-3)
    assert r.checks["sliding"].value == pytest.approx(2.138, rel=5e-3)
    assert r.checks["sliding"].value >= 1.5
    assert r.eccentricity == pytest.approx(0.599, rel=5e-3)


def test_d1_cantilever_wall_seismic_coefficients_and_arms():
    """Source: Keleşoğlu, Gravity Wall deck, Problem 1 seismic case (slides 2-12), TBDY 2018.

    kh = 0.4 SDS/r = 0.2667, kv = 0.5 kh = 0.1333 (TBDY 16.22). Source K_a,t = 0.578
    (theta = 17.1 deg, delta = 0, beta = 0, psi = 90 deg). Increment arms (HS-C): soil part H/2 = 3.0 m,
    surcharge part 2H/3 = 4.0 m (H = 6.0 m).
    The source seismic FS values (1.97 and 1.23) are NOT compared: the program also takes the inertia
    of the wall and of the soil on the heel and the (1 - kv) factor in P_AE (AASHTO/GEC-3,
    EN 1998-5 Annex E), which the lecture example omits; the program FS is therefore lower.
    """
    kh, kv = tbdy_seismic_coefficients(1.0, 1.5)
    assert (kh, kv) == pytest.approx((0.2667, 0.1333), abs=1e-4)
    assert mononobe_okabe_kae(phi=30, kh=0.2667, kv=0.1333) == pytest.approx(0.578, abs=1e-3)
    geometry, backfill, foundation, loads, settings = _d1_inputs(kh=kh, kv=kv, seismic_increment_height=0.5)
    r = analyze_cantilever_wall(geometry, backfill, foundation, loads, settings, seismic=True)
    assert _force(r, "Seismic increment").y == pytest.approx(3.0)
    assert _force(r, "Seismic increment (surcharge)").y == pytest.approx(4.0)
    assert _force(r, "Seismic increment").fx < 0 and _force(r, "Seismic increment (surcharge)").fx < 0


# --- D2. Anchored pile wall, Problem 3 (Anchored Wall deck, slides 26-37) ----------------------

H2, H1, ANCHORS = 9.0, 2.1, [2.1, 4.5, 6.9]
KA2 = math.tan(math.radians(45 - 14)) ** 2
PE = 0.65 * KA2 * 17 * H2 ** 2 / (H2 - H1 / 3 - 2.1 / 3)
PS = KA2 * 10


def _d2_envelope():
    profile = SoilProfile(id="P", gwt=GroundwaterCondition(depth_insitu=100), layers=[
        SoilLayer(id="S", top=0, bottom=40, gamma=17, gamma_sat=20, design=DesignParameters(phi_eff=28))])
    return apparent_envelope(profile, H2, drainage="drained", surcharge=10.0, stiff_coefficient=0.3,
                             anchors=ANCHORS)


def test_d2_apparent_envelope_and_tributary_loads():
    """Source: Keleşoğlu, Anchored Wall deck, Problem 3 (slides 26-37), FHWA-IF-99-015 Figure 39.

    Ka = tan^2(31 deg) = 0.36103, ps = Ka q = 3.610. The source uses 0.33 H1 in the denominator
    (pE = 42.44); the program uses the exact 1/3 (pE = 42.519). The test therefore asks for the
    program's exact value and checks the source loads within 0.3 % (rounding only: source
    122.26, 110.52, 101.76, 20.50 kN/m).
    """
    env = _d2_envelope()
    assert env.ka == pytest.approx(0.36103, abs=1e-5)
    assert env.p[0] == pytest.approx(PS, rel=1e-6)
    assert env.p_max - env.p[0] == pytest.approx(42.519, rel=1e-3)
    assert PE == pytest.approx(42.519, rel=1e-3)
    assert env.p_max - env.p[0] == pytest.approx(PE, rel=1e-6)
    assert 0.65 * KA2 * 17 * H2 ** 2 / (H2 - 0.33 * H1 - 0.33 * 2.1) == pytest.approx(42.44, abs=5e-3)
    reactions, *_ = _hinge_model(env, ANCHORS + [H2], "tributary")
    h2, h3, h4 = 2.4, 2.4, 2.1
    expected = [
        (2 / 3 * H1 + h2 / 2) * PE + (H1 + h2 / 2) * PS,
        (h2 / 2 + h3 / 2) * (PE + PS),
        (h3 / 2 + 23 / 48 * h4) * PE + (h3 / 2 + h4 / 2) * PS,
        3 / 16 * h4 * PE + h4 / 2 * PS,
    ]
    assert list(reactions) == pytest.approx(expected, rel=1e-3)
    assert list(reactions) == pytest.approx([122.46, 110.71, 101.93, 20.53], abs=0.01)
    assert list(reactions) == pytest.approx([122.26, 110.52, 101.76, 20.50], rel=3e-3)


def test_d2_anchor_design_loads_bond_length_and_moment():
    """Source: Keleşoğlu, Anchored Wall deck, Problem 3 (slides 26-37).

    DL = T_H sA / cos 15 deg with sA = 1.8 m: source 227.8, 206.0, 189.6 kN (within 0.3 %: the source
    uses the 0.33-rounded T_H). Bond length: 230 kN, tau 250 kPa, d 0.13 m, FS 2.5 gives
    230 * 2.5 / (250 pi 0.13) = 5.63 m. Moment: the source uses the FHWA approximate formulas
    (M1 = 13/54 H1^2 pE + H1^2/2 ps = 53.02, intermediate span pL^2/10); the program evaluates the
    simple-span moment diagram, which is larger (safe side). The test requires M_max >= 53.02 only,
    not equality.
    """
    reactions, z, v, m = _hinge_model(_d2_envelope(), ANCHORS + [H2], "tributary")
    design_loads = [t * 1.8 / math.cos(math.radians(15)) for t in reactions[:3]]
    assert design_loads == pytest.approx([227.8, 206.0, 189.6], rel=3e-3)
    result = design_anchor(AnchorDesignInputs(
        excavation_height=H2, head_depth=2.1, inclination_deg=15.0, phi_deg=28.0, axial_load=230.0,
        ultimate_bond_stress=250.0, hole_diameter=0.13, safety_factor=2.5, lock_off_ratio=1.0,
        tendon={"type": "strand"}))
    assert result.bond_length_calculated == pytest.approx(230 * 2.5 / (250 * math.pi * 0.13), rel=5e-3)
    assert result.bond_length_calculated == pytest.approx(5.63, abs=0.01)
    pe_source = 0.65 * KA2 * 17 * H2 ** 2 / (H2 - 0.33 * H1 - 0.33 * 2.1)
    assert 13 / 54 * H1 ** 2 * pe_source + H1 ** 2 / 2 * PS == pytest.approx(53.02, abs=0.01)
    assert float(np.max(np.abs(m))) >= 53.02


# --- D3. SPT (Arazi Deneyleri deck, slides 22-26) ----------------------------------------------


def test_d3_spt_corrections():
    """Source: Keleşoğlu, Arazi Deneyleri deck, SPT corrections (slides 22-26), Liao & Whitman C_N.

    N = 20, ER = 60 (C_E = 1), rods 5 m (C_R = 0.85), 100 mm hole (C_B = 1.0), standard sampler
    (C_S = 1.0): N60 = 17.0. sigma'_v = 80 kPa: C_N = sqrt(101.325/80) = 1.1254, (N1)60 = 19.13.
    Rods 3.5 m: C_R = 0.75 (Skempton/TBDY; Youd 2001 gives 0.80, HS-A A3.1). sigma'_v = 20 kPa: C_N
    is capped at 1.7 (Youd 2001; the source cap is 2.0 - conscious difference, safe side).
    """
    c_r = rod_length_factor(5.0)
    assert c_r == 0.85 and borehole_diameter_factor(100.0) == 1.0 and sampler_factor("standard") == 1.0
    n60_value = float(n60(20, 60.0, borehole_diameter_factor(100.0), sampler_factor("standard"), c_r))
    assert n60_value == pytest.approx(17.0, rel=5e-3)
    c_n = overburden_factor_liao_whitman(80.0)
    assert c_n == pytest.approx(math.sqrt(PA / 80.0), rel=1e-9)
    assert c_n == pytest.approx(1.1254, rel=5e-4) and c_n <= 1.7
    assert c_n * n60_value == pytest.approx(19.13, rel=5e-3)
    assert rod_length_factor(3.5) == 0.75
    assert overburden_factor_liao_whitman(20.0) == pytest.approx(1.7)


# --- D4. CPT (Arazi Deneyleri deck, slides 45-59) ----------------------------------------------


def _d4_processed():
    """One reading at 12 m: sigma_v0 = 200, u0 = 100 and sigma'_v0 = 100 kPa by construction."""
    depth = 12.0
    gwt = depth - 100.0 / GAMMA_W
    gamma = 200.0 / depth
    profile = SoilProfile(id="P", gwt=GroundwaterCondition(depth_insitu=gwt),
                          layers=[SoilLayer(id="S", top=0, bottom=20, gamma=gamma, gamma_sat=gamma)])
    sounding = CPTSounding(id="C", depth=[depth], qc=[5000.0], fs=[50.0], u2=[300.0], area_ratio=0.8,
                           gwt_depth=gwt)
    return process_cpt(sounding, profile)


def test_d4_cpt_normalised_quantities():
    """Source: Keleşoğlu, Arazi Deneyleri deck, CPT interpretation (slides 45-59).

    qc 5000, u2 300, a 0.8, fs 50, sigma_v0 200, u0 100, sigma'_v0 100 kPa:
    q_t = 5060, R_f = 0.988 %, Q_t = Q_t1 = 48.6, F_r = 1.0288 %, B_q = 0.04115.
    The source I_c = 2.1677 uses Robertson (1990) with Q_t; the program uses Q_tn with an iterated
    stress exponent n (Robertson 2009), so its I_c differs. The test checks the source value through
    soil_behaviour_index(48.6, 1.0288) and, for the program result, only the self-consistency
    n = 0.381 I_c + 0.05 sigma'_v/Pa - 0.15 (not equality with the source I_c).
    """
    r = _d4_processed()
    assert (r.sigma_v[0], r.u0[0], r.sigma_v_eff[0]) == pytest.approx((200.0, 100.0, 100.0), rel=1e-3)
    assert r.qt[0] == pytest.approx(5060.0)
    assert r.Rf[0] == pytest.approx(0.988, abs=5e-4)
    assert r.Qt1[0] == pytest.approx(48.6, rel=5e-3)
    assert r.Fr[0] == pytest.approx(1.0288, rel=5e-3)
    assert r.Bq[0] == pytest.approx(0.04115, rel=5e-3)
    assert float(soil_behaviour_index(48.6, 1.0288)) == pytest.approx(2.1677, rel=5e-4)
    assert bool(r.converged[0])
    assert r.n[0] == pytest.approx(float(stress_exponent(r.Ic[0], r.sigma_v_eff[0])), abs=2e-3)
    assert r.n[0] == pytest.approx(0.381 * r.Ic[0] + 0.05 * 100.0 / PA - 0.15, abs=2e-3)
    qtn = (r.qt[0] - r.sigma_v[0]) / PA * (PA / r.sigma_v_eff[0]) ** r.n[0]
    assert r.Qtn[0] == pytest.approx(qtn, rel=5e-3)


# --- D5. Lateral earth pressure (Yanal Toprak Basıncı deck, slides 5-31) -----------------------


def _cohesive_profile(phi, c):
    return SoilProfile(id="P", gwt=GroundwaterCondition(depth_insitu=50), layers=[
        SoilLayer(id="C", top=0, bottom=20, gamma=18, gamma_sat=18,
                  design=DesignParameters(phi_eff=phi, c_eff=c))])


def test_d5_rankine_and_coulomb_coefficients():
    """Source: Keleşoğlu, Yanal Toprak Basıncı deck (slides 5-31); Das, Coulomb table pattern.

    Rankine phi = 30: Ka = 1/3, Kp = 3. Coulomb phi = 30, delta = 20, alpha = 0, i = 0: Ka = 0.2973;
    Kp (delta = 0) = 3.0.
    """
    assert rankine_ka(30) == pytest.approx(1 / 3)
    assert rankine_kp(30) == pytest.approx(3.0)
    assert coulomb_ka(30, 20) == pytest.approx(0.2973, abs=5e-4)
    assert coulomb_kp(30, 0) == pytest.approx(3.0, rel=1e-6)


def test_d5_cohesive_active_and_passive_rankine():
    """Source: Keleşoğlu, Yanal Toprak Basıncı deck, cohesive backfill (slides 5-31).

    gamma 18, phi 20, c 10, H 6: Ka = 0.4903, z_c = 2c/(gamma sqrt(Ka)) = 1.587 m,
    sigma_a(H) = 52.95 - 14.00 = 38.95 kPa, Pa = 1/2 sigma_a(H) (H - z_c) = 85.94 kN/m (tension zone zero).
    Passive: Pp = 1/2 gamma H^2 Kp + 2 c H sqrt(Kp), Kp = 2.0396: 660.83 + 171.38 = 832.21 kN/m.
    """
    ka, kp = rankine_ka(20), rankine_kp(20)
    assert ka == pytest.approx(0.4903, abs=5e-5) and kp == pytest.approx(2.0396, abs=5e-5)
    zc = 2 * 10 / (18 * math.sqrt(ka))
    assert zc == pytest.approx(1.587, abs=5e-4)
    sigma_a = ka * 18 * 6 - 2 * 10 * math.sqrt(ka)
    assert sigma_a == pytest.approx(38.95, abs=5e-3)
    assert 0.5 * sigma_a * (6 - zc) == pytest.approx(85.94, rel=5e-3)
    profile = _cohesive_profile(20, 10)
    active = lateral_pressure(profile, 6.0, state="active", method="rankine")
    assert active.force == pytest.approx(85.94, rel=5e-3)
    assert resultant(active.z, active.sigma_h_eff)[0] == pytest.approx(active.force, rel=1e-9)
    assert np.all(active.sigma_h_eff[active.z < zc - 0.05] == 0)
    passive_hand = 0.5 * 18 * 36 * kp + 2 * 10 * 6 * math.sqrt(kp)
    assert passive_hand == pytest.approx(832.21, rel=5e-4)
    passive = lateral_pressure(profile, 6.0, state="passive", method="rankine")
    assert passive.force == pytest.approx(832.21, rel=5e-3)


def _approved_layer(phi, ocr=None):
    selections = {}
    for key, value in (("phi_eff", phi), ("OCR", ocr)):
        if value is not None:
            selections[key] = ParameterSelection(parameter=key, mode="manual", manual_value=value)
    layer = SoilLayer(id="L", top=0, bottom=4, gamma=18, selections=selections)
    return svc.approve(layer, list(selections), [], [], dt.datetime(2026, 10, 23))


def test_d5_k0_candidates_from_approved_parameters():
    """Source: Keleşoğlu, Yanal Toprak Basıncı deck, at-rest coefficient (slides 5-31).

    Jaky phi = 30: K0 = 1 - sin phi = 0.5. Mayne & Kulhawy with OCR = 4: 0.5 * 4^0.5 = 1.0.
    Since HS-C the at-rest pressure needs an approved K0 (no silent Jaky), so the values are taken from
    the parameter-service candidates built on approved phi' and OCR (HS-A A3.6). The at-rest pressure
    example is covered by the HS-C tests and is not repeated here.
    """
    candidates = {c.method_id: c for c in svc.k0_candidates(_approved_layer(30.0, ocr=4.0))}
    assert candidates["JAKY_K0"].value == pytest.approx(0.5, rel=1e-9)
    assert candidates["MK1982_K0"].value == pytest.approx(1.0, rel=1e-9)
