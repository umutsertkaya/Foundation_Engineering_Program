"""Hand-calculated checks of the state / small-strain correlations (Field_Tests_2026 formulae)."""

import math

import pytest

from geotek.engine.correlations import registry

PA = 101.325


def ev(cid, **inputs):
    return registry.evaluate(cid, inputs)


def test_dr_jamiolkowski_cpt_hand_value():
    # qc = 10 MPa = 1000 t/m2, sigma' = 100 kPa = 10 t/m2: -98 + 66 log10(1000 / sqrt(10)) = 67.0
    r = ev("Jamiolkowski1985_Dr_CPT", qc=10000.0, sigma_v_eff=100.0)
    assert r.value == pytest.approx(-98 + 66 * math.log10(1000 / math.sqrt(10)), abs=1e-9)
    assert r.value == pytest.approx(67.0, abs=0.1)
    assert r.validity_ok


def test_ocr_k0_m_hand_values_in_clay():
    ocr = ev("KM1990_OCR_SPT", N60=9.0, sigma_v_eff=100.0, Ic=3.0)
    assert ocr.value == pytest.approx(0.58 * 9 * PA / 100.0)
    assert ev("KM1990_K0_CPT", qt=1500.0, sigma_v=200.0, sigma_v_eff=100.0, Ic=3.0).value == pytest.approx(1.3)
    assert ev("KM1990_M_CPT", qt=1500.0, sigma_v=200.0, Ic=3.0).value == pytest.approx(8.25 * 1300.0)


def test_clay_correlations_flag_sand():
    r = ev("KM1990_OCR_SPT", N60=9.0, sigma_v_eff=100.0, Ic=1.8)
    assert not r.validity_ok


def test_vs_and_gmax_hasancebi():
    assert ev("HU2007_Vs_all_SPT", N60=15.0).value == pytest.approx(104.79 * 15**0.26)
    assert ev("HU2007_Vs_clay_SPT", N60=9.0, Ic=3.0).value == pytest.approx(131.0 * 9**0.205)
    assert ev("HU2007_Vs_sand_SPT", N60=15.0, Ic=1.5).value == pytest.approx(107.63 * 15**0.237)
    vs = 104.79 * 15**0.26
    # G = rho Vs^2 with rho = gamma / g [t/m3] gives kPa
    assert ev("HU2007_Gmax_all_SPT", N60=15.0, gamma_layer=18.0).value == pytest.approx(18.0 / 9.81 * vs**2)
    assert not ev("HU2007_Vs_sand_SPT", N60=15.0, Ic=3.0).validity_ok


def test_new_methods_unverified_and_registered_per_key():
    for cid in ("KM1990_OCR_SPT", "KM1990_K0_CPT", "KM1990_M_CPT", "Jamiolkowski1985_Dr_CPT", "HU2007_Vs_all_SPT"):
        assert registry.get(cid).verified is False
        assert registry.get(cid).reliability == "C"


def test_bounds_mark_unphysical_values_invalid():
    assert not ev("Jamiolkowski1985_Dr_CPT", qc=1000.0, sigma_v_eff=150.0, Ic=2.0).validity_ok  # Dr < 0
    assert not ev("KM1990_K0_CPT", qt=3000.0, sigma_v=40.0, sigma_v_eff=30.0, Ic=3.0).validity_ok  # K0 > 5
