import math

import pytest

from geotek.engine.correlations import REGISTRY, applicable, combine, evaluate, evaluate_all

# (id, inputs, expected value) - hand calculations
HAND_CALCS = [
    ("KM1990_phi_SPT", {"N60": 20, "sigma_v_eff": 100}, 40.37),
    ("HU1996_phi_SPT", {"N1_60": 20}, 40.0),
    ("PHT1974_phi_SPT", {"N1_60": 20}, 32.884),
    ("RC1983_phi_CPT", {"qc": 10000, "sigma_v_eff": 100}, 40.51),
    ("KM1990_phi_CPT", {"qt": 10000, "sigma_v_eff": 100}, 39.57),
    ("TPM1996_phi_PI", {"PI": 20}, 31.23),
    ("CPT_su_Nkt", {"qt": 1000, "sigma_v": 100}, 900 / 14),
    ("CPTu_su_Ndu", {"u2": 450, "u0": 100}, 50.0),
    # f1 by PI (lower bound of each Stroud band): 6.0 (PI < 20), 4.0 (20-30), 4.0 (>= 20) kPa, linear 15-20.
    ("Stroud1974_su_SPT", {"N60": 10, "PI": 10}, 60.0),
    ("Stroud1974_su_SPT", {"N60": 10, "PI": 25}, 40.0),
    ("Stroud1974_su_SPT", {"N60": 10, "PI": 17.5}, 50.0),
    ("Stroud1974_su_SPT", {"N60": 10, "PI": 40}, 40.0),
    ("Stroud1974_su_SPT_noPI", {"N60": 10}, 40.0),
    # Sowers: su = 12.5 / 7.5 / 3.75 * N60 with N60 = 8.
    ("Sowers1979_su_high_SPT", {"N60": 8}, 100.0),
    ("Sowers1979_su_medium_SPT", {"N60": 8}, 60.0),
    ("Sowers1979_su_low_SPT", {"N60": 8}, 30.0),
    # Shioi & Fukui: N'70 = 20 * 60/70 = 17.142857 -> sqrt(18 * 17.142857) + 15 = 32.566;
    # N70 = 14 * 60/70 = 12 -> 0.36 * 12 + 27 = 31.32.
    ("SF1982_phi_roads_SPT", {"N1_60": 20}, 32.5662),
    ("SF1982_phi_buildings_SPT", {"N1_60": 14}, 31.32),
    ("Hara1974_su_SPT", {"N60": 10}, 29 * 10**0.72),
    ("KM1990_E_SPT", {"N60": 10}, 10132.5),
    ("R2009_E_CPT", {"qt": 10000, "sigma_v": 100, "Ic": 2.0}, 0.015 * 10**2.78 * 9900),
    ("RC2010_gamma_CPT", {"qt": 10000, "fs": 50}, 18.37),
    ("RC2010_gamma_sat_CPT", {"qt": 10000, "fs": 50}, 18.37),
    ("Skempton1986_Dr_SPT", {"N1_60": 15}, 50.0),
    ("Mayne_sigp_CPT", {"qt": 1000, "sigma_v": 100}, 297.0),
    ("BI2014_FC_CPT", {"Ic": 2.0}, 23.0),
    ("Jamiolkowski1985_Dr_CPT", {"qc": 10000, "sigma_v_eff": 100}, 67.0),
    ("KM1990_OCR_SPT", {"N60": 9, "sigma_v_eff": 100, "Ic": 3.0}, 5.2893),
    ("KM1990_K0_CPT", {"qt": 1500, "sigma_v": 200, "sigma_v_eff": 100, "Ic": 3.0}, 1.3),
    ("KM1990_M_CPT", {"qt": 1500, "sigma_v": 200, "Ic": 3.0}, 10725.0),
    ("HU2007_Vs_all_SPT", {"N60": 15}, 211.9),
    ("HU2007_Vs_clay_SPT", {"N60": 9, "Ic": 3.0}, 205.5),
    ("HU2007_Vs_sand_SPT", {"N60": 15, "Ic": 1.5}, 204.5),
    ("HU2007_Gmax_all_SPT", {"N60": 15, "gamma_point": 18}, 82377.9),
    ("HU2007_Gmax_clay_SPT", {"N60": 9, "gamma_point": 18, "Ic": 3.0}, 77515.0),
    ("HU2007_Gmax_sand_SPT", {"N60": 15, "gamma_point": 18, "Ic": 1.5}, 76725.1),
    # FHWA (2002a): 400 / 700 / 1200 (N1)60 with (N1)60 = 10.
    ("FHWA2002_E_silt_SPT", {"N1_60": 10}, 4000.0),
    ("FHWA2002_E_sand_SPT", {"N1_60": 10}, 7000.0),
    ("FHWA2002_E_gravel_SPT", {"N1_60": 10}, 12000.0),
    # Bowles (1996) with N60 = 22, so N55 = 22 * 60/55 = 24.
    ("Bowles1996_E_sand_SPT", {"N60": 22}, 500 * (24 + 15)),
    ("Bowles1996_E_sand_sat_SPT", {"N60": 22}, 250 * (24 + 15)),
    ("Bowles1996_E_clayey_sand_SPT", {"N60": 22}, 320 * (24 + 15)),
    ("Bowles1996_E_silt_SPT", {"N60": 22}, 300 * (24 + 6)),
    ("Bowles1996_E_sand_sqrt_SPT", {"N60": 22}, 7000 * 24 ** 0.5),
    ("Bowles1996_E_sand_lin_SPT", {"N60": 22}, 6000 * 24),
    ("Bowles1996_E_sand_ln_SPT", {"N60": 22}, 15000 * math.log(24)),
    ("Bowles1996_E_sand_lin2_SPT", {"N60": 22}, 2600 * 24),
]


@pytest.mark.parametrize("cid, inputs, expected", HAND_CALCS)
def test_hand_calculations(cid, inputs, expected):
    result = evaluate(cid, inputs)
    assert result.value == pytest.approx(expected, rel=2e-3)
    assert result.method_id == cid and result.reference


def test_every_correlation_has_a_hand_calc():
    assert {c[0] for c in HAND_CALCS} == set(REGISTRY)


def test_metadata_complete():
    for c in REGISTRY.values():
        assert c.reference and c.validity and c.unit and c.inputs


def test_validity_flag_from_context():
    sand = evaluate("KM1990_phi_CPT", {"qt": 10000, "sigma_v_eff": 100, "Ic": 1.8})
    clay = evaluate("KM1990_phi_CPT", {"qt": 10000, "sigma_v_eff": 100, "Ic": 3.0})
    assert sand.validity_ok and not clay.validity_ok
    assert "2.6" in clay.warnings[0]


def test_options_and_errors():
    assert evaluate("CPT_su_Nkt", {"qt": 1000, "sigma_v": 100}, Nkt=18).value == pytest.approx(50.0)
    assert not evaluate("CPT_su_Nkt", {"qt": 1000, "sigma_v": 100}, Nkt=25).validity_ok
    with pytest.raises(ValueError, match="unknown option"):
        evaluate("CPT_su_Nkt", {"qt": 1000, "sigma_v": 100}, alpha=3)
    with pytest.raises(ValueError, match="missing"):
        evaluate("CPT_su_Nkt", {"qt": 1000})
    with pytest.raises(KeyError):
        evaluate("nope", {})


def test_out_of_range_input_is_flagged():
    r = evaluate("HU1996_phi_SPT", {"N1_60": 45})
    assert not r.validity_ok


def test_applicable_and_combine():
    inputs = {"N60": 20, "N1_60": 20, "sigma_v_eff": 100, "qc": None, "qt": math.nan}
    ids = {c.id for c in applicable("phi_eff", inputs)}
    assert ids == {"KM1990_phi_SPT", "HU1996_phi_SPT", "PHT1974_phi_SPT",
                   "SF1982_phi_roads_SPT", "SF1982_phi_buildings_SPT"}
    results = evaluate_all("phi_eff", inputs)
    combined = combine(results)
    assert combined.stats.n == 5
    # Lowest: Shioi & Fukui roads, N'70 = 20 * 60/70 -> sqrt(18 * 17.142857) + 15 = 32.566;
    # highest: Kulhawy & Mayne 40.37 (buildings: 0.36 * 17.142857 + 27 = 33.171).
    assert combined.stats.min == pytest.approx(32.5662, rel=1e-3)
    assert combined.stats.max == pytest.approx(40.37, rel=1e-3)
    assert combined.source == "SPT" and combined.validity_ok
    # The weakest grade wins: the Shioi & Fukui records are grade C.
    assert combined.reliability == "C"
    assert combined.based_on == [r.method_id for r in results]


def test_combine_excludes_invalid_then_falls_back():
    a = evaluate("HU1996_phi_SPT", {"N1_60": 45})  # out of range
    b = evaluate("PHT1974_phi_SPT", {"N1_60": 45})
    assert combine([a, b]).value == pytest.approx(b.value)
    only_bad = combine([a])
    assert not only_bad.validity_ok and only_bad.warnings


def test_negative_strength_and_dr_above_100_are_marked_invalid():
    from geotek.engine.correlations.registry import evaluate
    # su = (q_t - sigma_v0) / N_kt = (50 - 100) / 14 = -3.571 kPa -> not physical
    neg = evaluate("CPT_su_Nkt", {"qt": 50.0, "sigma_v": 100.0, "Ic": 3.0})
    assert neg.value == pytest.approx(-50.0 / 14.0)
    assert not neg.validity_ok and any("Negative su" in w for w in neg.warnings)
    # Dr = 100 sqrt(N1_60 / Cd) = 100 sqrt(90 / 60) = 122.47 % -> above 100 %
    dr = evaluate("Skempton1986_Dr_SPT", {"N1_60": 90.0})
    assert dr.value == pytest.approx(100 * (90 / 60) ** 0.5)
    assert not dr.validity_ok and any("exceeds 100" in w for w in dr.warnings)
    ok = evaluate("Skempton1986_Dr_SPT", {"N1_60": 30.0})
    assert ok.value == pytest.approx(100 * 0.5 ** 0.5) and ok.validity_ok
