"""Independent SPT checks of Youd et al. (2001), JGGE 127(10), 817-833.

References and tolerances follow brief T3a. All stresses are in kPa.
Expected values use the published equations, never engine helper functions.
"""

import numpy as np
import pytest

from geotek.core.constants import PA
from geotek.engine.liquefaction import youd2001 as youd
from geotek.engine.liquefaction.common import cyclic_stress_ratio


DEPTHS = [2.0, 5.0, 9.0, 15.0, 20.0, 23.0]
IDRISS_TABLE = [
    (5.5, 2.20), (6.0, 1.76), (6.5, 1.44), (7.0, 1.19),
    (7.5, 1.00), (8.0, 0.84), (8.5, 0.72),
]
ANDRUS_STOKOE_TABLE = [
    (5.5, 2.8), (6.0, 2.1), (6.5, 1.6), (7.0, 1.25),
    (7.5, 1.00), (8.0, 0.8), (8.5, 0.65),
]


def _published_fines_correction(n1_60, fc):
    """Youd et al. (2001), Eqs. (5)-(7): alpha + beta * (N1)60."""
    if fc <= 5.0:
        alpha, beta = 0.0, 1.0
    elif fc < 35.0:
        alpha = np.exp(1.76 - 190.0 / fc**2)
        beta = 0.99 + fc**1.5 / 1000.0
    else:
        alpha, beta = 5.0, 1.2
    return alpha + beta * n1_60


def _published_crr(n):
    """Youd et al. (2001), Eq. (4), applicable to (N1)60cs < 30."""
    return 1.0 / (34.0 - n) + n / 135.0 + 50.0 / (10.0 * n + 45.0)**2 - 1.0 / 200.0


@pytest.mark.parametrize("z", DEPTHS + [9.15, 9.150001])
def test_stress_reduction_eq2(z):
    """Youd et al. (2001), Eqs. (2a)-(2b), including the 9.15 m boundary."""
    expected = 1.0 - 0.00765 * z if z <= 9.15 else 1.174 - 0.0267 * z
    assert youd.stress_reduction(z) == pytest.approx(expected, rel=1e-12)


@pytest.mark.parametrize("z", DEPTHS)
def test_stress_reduction_blake_eq3(z):
    """Youd et al. (2001), Blake Eq. (3) versus Eq. (2); Blake's fit is 'essentially' Eq. (2); tolerance 0.025."""
    numerator = 1.0 - 0.4113 * z**0.5 + 0.04052 * z + 0.001753 * z**1.5
    denominator = (
        1.0 - 0.4177 * z**0.5 + 0.05729 * z
        - 0.006205 * z**1.5 + 0.001210 * z**2
    )
    expected = numerator / denominator
    assert youd.stress_reduction(z) == pytest.approx(expected, abs=0.025, rel=0)


@pytest.mark.parametrize("mw, expected", IDRISS_TABLE)
def test_magnitude_scaling_idriss_table3(mw, expected):
    """Youd et al. (2001), Table 3, column 3 (Idriss), rounded MSF."""
    assert youd.magnitude_scaling(mw) == pytest.approx(expected, abs=0.015, rel=0)  # table is rounded


@pytest.mark.parametrize("mw", [row[0] for row in IDRISS_TABLE])
def test_magnitude_scaling_idriss_eq24(mw):
    """Youd et al. (2001), Eq. (24): MSF = 10^2.24 / M^2.56."""
    expected = 10.0**2.24 / mw**2.56
    assert youd.magnitude_scaling(mw) == pytest.approx(expected, rel=1e-12)


@pytest.mark.parametrize("mw, expected", ANDRUS_STOKOE_TABLE)
def test_magnitude_scaling_andrus_stokoe_table3(mw, expected):
    """Youd et al. (2001), Table 3, column 7; absolute rounding tolerance 0.05."""
    actual = youd.magnitude_scaling(mw, variant="andrus_stokoe")
    assert actual == pytest.approx(expected, abs=0.02, rel=0)


@pytest.mark.parametrize("f", [0.7, 0.8])
@pytest.mark.parametrize("sigma_eff", [200.0, 400.0])
def test_overburden_factor_eq31(sigma_eff, f):
    """Youd et al. (2001), Eq. (31), with Pa = 101.325 kPa."""
    assert PA == 101.325
    expected = (sigma_eff / 101.325)**(f - 1.0)
    assert youd.overburden_factor(sigma_eff, f=f) == pytest.approx(expected, rel=1e-12)


@pytest.mark.parametrize("f", [0.7, 0.8])
@pytest.mark.parametrize("sigma_eff", [50.0, 101.325])
def test_overburden_factor_at_or_below_pa(sigma_eff, f):
    """Youd et al. (2001), Eq. (31) scope: K_sigma = 1 at or below Pa."""
    assert youd.overburden_factor(sigma_eff, f=f) == pytest.approx(1.0, rel=1e-12)


@pytest.mark.parametrize("f", [0.5, 0.9])
def test_overburden_factor_rejects_unsupported_exponent(f):
    """Youd et al. (2001), discussion of Eq. (31): supported f is 0.6-0.8."""
    with pytest.raises(ValueError):
        youd.overburden_factor(200.0, f=f)


@pytest.mark.parametrize("n1_60", [10.0, 20.0])
@pytest.mark.parametrize("fc", [5.0, 15.0, 25.0, 35.0, 50.0])
def test_fines_correction_eq6_eq7(n1_60, fc):
    """Youd et al. (2001), Eqs. (5)-(7), all three fines branches."""
    expected = _published_fines_correction(n1_60, fc)
    assert youd.fines_correction_spt(n1_60, fc) == pytest.approx(expected, rel=1e-12)


@pytest.mark.parametrize("n", [5.0, 10.0, 15.0, 20.0, 25.0])
def test_crr75_spt_rauch_eq4(n):
    """Youd et al. (2001), Rauch Eq. (4), for corrected SPT resistance below 30."""
    assert youd.crr75_spt(n) == pytest.approx(_published_crr(n), rel=1e-12)


@pytest.mark.parametrize("n", [30.0, 35.0, 50.0])
def test_crr75_spt_dense_limit(n):
    """Youd et al. (2001), Eq. (4) domain: N >= 30 has no finite CRR estimate."""
    assert np.isnan(youd.crr75_spt(n))


@pytest.mark.parametrize("n, expected", [(10.0, 0.11), (20.0, 0.21)])
def test_crr75_spt_figure2_clean_sand(n, expected):
    """Youd et al. (2001), Fig. 2 clean-sand curve; graphical tolerance 0.01."""
    assert youd.crr75_spt(n) == pytest.approx(expected, abs=0.01, rel=0)


def test_spt_factor_of_safety_hand_calculation():
    """Youd et al. (2001), Eqs. (1), (2), (4)-(7), (24), (30)-(31), hand chain.

    At z = 6 m, GWT = 2 m, gamma = 18 above water and gamma_sat = 19
    kN/m^3 below it, take gamma_water = 9.81 kN/m^3, amax/g = 0.25,
    M = 7.0, measured (N1)60 = 12 and FC = 15 percent.
    Independent intermediate values are explicitly recorded below.
    """
    sigma_v = 18.0 * 2.0 + 19.0 * (6.0 - 2.0)  # 112 kPa
    pore_pressure = 9.81 * (6.0 - 2.0)  # 39.24 kPa
    sigma_eff = sigma_v - pore_pressure  # 72.76 kPa
    # n60 is not used to derive the supplied, already normalized (N1)60.
    ncs, crr, dense = youd.spt_resistance(
        n60=12.0, n1_60=12.0, fc=15.0, sigma_v_eff_test=sigma_eff,
    )
    rd = youd.stress_reduction(6.0)
    csr = cyclic_stress_ratio(0.25, sigma_v, sigma_eff, rd)
    msf = youd.magnitude_scaling(7.0)
    k_sigma = youd.overburden_factor(sigma_eff, f=0.7)
    fs = (crr / csr) * msf * k_sigma
    # alpha = 2.49816273464324, beta = 1.04809475019311 (Eqs. 6-7).
    expected = [
        112.0, 39.24, 72.76, 0.9541, 15.0752997369606,
        0.160814710050144, 0.238656129741616, 1.1927488803792,
        1.0, 0.803715226457756,
    ]
    actual = [sigma_v, pore_pressure, sigma_eff, rd, ncs, crr, csr, msf, k_sigma, fs]
    np.testing.assert_allclose(actual, expected, rtol=1e-12, atol=1e-12)
    assert not bool(dense)


@pytest.mark.parametrize("f", [0.6, 0.8])
def test_overburden_factor_f_range_boundaries(f):
    """Youd et al. (2001), Eq. (31): f = 0.6 and 0.8 are the accepted bounds."""
    assert youd.overburden_factor(300.0, f=f) == pytest.approx((300.0 / 101.325)**(f - 1.0), rel=1e-12)
