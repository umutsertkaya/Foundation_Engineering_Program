"""Independent CPT checks of Youd et al. (2001), JGGE 127(10), 817-833.

The reference calculation follows brief T3a, using Eqs. (11) and (19). The Ic/qc1N procedure (Eqs. 12-17) is checked in
test_youd2001_cpt_discrepancy.py. All input stresses are in kPa.
"""

import numpy as np
import pytest

from geotek.engine.liquefaction import youd2001 as youd




def _published_kc_polynomial(ic):
    """Youd et al. (2001), Eq. (19b), without a friction-ratio override."""
    return -0.403 * ic**4 + 5.581 * ic**3 - 21.63 * ic**2 + 33.75 * ic - 17.88


def _published_kc(ic):
    """Youd et al. (2001), Eq. (19a)-(19b): Kc depends only on Ic."""
    return 1.0 if ic <= 1.64 else _published_kc_polynomial(ic)


def _published_crr(q):
    """Youd et al. (2001), Eq. (11a)-(11b), with the q < 160 domain."""
    if q < 50.0:
        return 0.833 * (q / 1000.0) + 0.05
    if q < 160.0:
        return 93.0 * (q / 1000.0)**3 + 0.08
    return np.nan


@pytest.mark.parametrize("ic", [1.64, 1.8, 2.0, 2.2, 2.4, 2.6])
def test_kc_eq19_without_friction_ratio(ic):
    """Youd et al. (2001), Eq. (19a)-(19b), no F input."""
    assert youd.kc_factor(ic) == pytest.approx(_published_kc(ic), rel=1e-12)


def test_kc_continuity_at_164():
    """Youd et al. (2001), Eq. (19) branches at Ic = 1.64; tolerance 0.01."""
    right = np.nextafter(1.64, np.inf)
    # Check the polynomial limit as well as the engine's two sides.
    assert abs(_published_kc_polynomial(1.64) - 1.0) < 0.01
    assert youd.kc_factor(1.64) == pytest.approx(1.0, rel=1e-12)
    assert abs(float(youd.kc_factor(right)) - 1.0) < 0.01


@pytest.mark.parametrize("q", [20.0, 49.99, 50.0, 100.0, 150.0, 159.9])
def test_crr75_cpt_eq11(q):
    """Youd et al. (2001), Eq. (11a)-(11b), both sides of q = 50."""
    assert youd.crr75_cpt(q) == pytest.approx(_published_crr(q), rel=1e-12)


@pytest.mark.parametrize("q", [160.0, 180.0, 200.0])
def test_crr75_cpt_dense_limit(q):
    """Youd et al. (2001), Eq. (11) domain: q >= 160 has no finite CRR."""
    assert np.isnan(youd.crr75_cpt(q))


def test_crr75_cpt_continuity_at_50():
    """Youd et al. (2001), Eq. (11) branches at q = 50; tolerance 1e-3."""
    left_limit = 0.833 * (50.0 / 1000.0) + 0.05
    right_limit = 93.0 * (50.0 / 1000.0)**3 + 0.08
    assert abs(left_limit - right_limit) < 1e-3
    actual_left = youd.crr75_cpt(np.nextafter(50.0, -np.inf))
    actual_right = youd.crr75_cpt(50.0)
    assert actual_left == pytest.approx(left_limit, rel=1e-12)
    assert actual_right == pytest.approx(right_limit, rel=1e-12)
    assert abs(float(actual_left - actual_right)) < 1e-3


def test_clay_branch_ic_eq17():
    """Youd et al. (2001), Eq. (17): n = 1 clay branch, Ic = 3.1118 for qc=800, fs=40, sv=100, sv'=60 kPa."""
    ic, n, f = youd.robertson_wride_ic(800.0, 40.0, 100.0, 60.0)
    q = (800.0 - 100.0) / 60.0
    ff = 40.0 / 700.0 * 100.0
    expected = np.sqrt((3.47 - np.log10(q))**2 + (1.22 + np.log10(ff))**2)
    assert float(n) == 1.0
    assert float(ic) == pytest.approx(expected, rel=1e-12)


def test_intermediate_exponent_hand_calculation():
    """Youd et al. (2001), Eqs. (12)-(19), n = 0.7 near the clay cutoff.

    qc = 900, fs = 5, sigma_v = 100, sigma'_v = 60 kPa gives F = 0.625%.
    Ic(n=1) = 2.5556456207188187 and Ic(n=0.5) = 2.6604371356197674,
    selecting n = 0.7. Eq. (15) then gives Q = 11.393814066248634;
    Eq. (12) still uses gross qc: qc1N = 12.818040824529712.
    """
    args = (900.0, 5.0, 100.0, 60.0)
    ic, n, f = youd.robertson_wride_ic(*args)
    assert float(n) == 0.7
    assert float(f) == pytest.approx(0.625, rel=1e-12)
    assert float(ic) == pytest.approx(2.61843046640364, rel=1e-12)

    result = youd.cpt_resistance(*args)
    assert float(result["kc"]) == pytest.approx(3.4414904413807754, rel=1e-12)
    assert float(result["resistance"]) == pytest.approx(44.11316497484756, rel=1e-12)
    assert float(result["crr75"]) == pytest.approx(0.08674626642404802, rel=1e-12)
    assert result["clay_like"]
    assert not result["dense"]
