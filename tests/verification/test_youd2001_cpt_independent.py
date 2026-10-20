"""Independent CPT checks of Youd et al. (2001), JGGE 127(10), 817-833.

The reference calculation follows brief T3a, including the intermediate
exponent n = 0.7 and an Ic-only Eq. (19). All input stresses are in kPa.
"""

import numpy as np
import pytest

from geotek.core.constants import PA
from geotek.engine.liquefaction import youd2001 as youd


CPT_CASES = [
    pytest.param(10000.0, 40.0, 100.0, 60.0, 0.5, id="clean-sand"),
    pytest.param(4000.0, 60.0, 100.0, 60.0, 0.5, id="silty-sand"),
    pytest.param(800.0, 40.0, 100.0, 60.0, 1.0, id="clay"),
]


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


def _published_ic_procedure(qc, fs, sigma_v, sigma_eff):
    """Youd et al. (2001), Eqs. (14)-(17), n = 1, 0.5, then 0.7 procedure."""
    friction = fs / (qc - sigma_v) * 100.0  # Eq. (16), percent.

    def ic_from_q(q):
        return np.sqrt((3.47 - np.log10(q))**2 + (1.22 + np.log10(friction))**2)

    ic_clay = ic_from_q((qc - sigma_v) / sigma_eff)  # Eq. (17), n = 1.
    if ic_clay > 2.6:
        return ic_clay, 1.0, friction
    q_sand = ((qc - sigma_v) / 101.325) * (101.325 / sigma_eff)**0.5
    ic_sand = ic_from_q(q_sand)
    if ic_sand <= 2.6:
        return ic_sand, 0.5, friction
    q_intermediate = ((qc - sigma_v) / 101.325) * (101.325 / sigma_eff)**0.7
    return ic_from_q(q_intermediate), 0.7, friction


@pytest.mark.parametrize("qc, fs, sigma_v, sigma_eff, expected_n", CPT_CASES)
def test_robertson_wride_ic_eq14_to_eq17(qc, fs, sigma_v, sigma_eff, expected_n):
    """Youd et al. (2001), Eqs. (14)-(17), independent exponent selection."""
    expected_ic, n, friction = _published_ic_procedure(qc, fs, sigma_v, sigma_eff)
    assert n == expected_n
    actual = youd.robertson_wride_ic(qc, fs, sigma_v, sigma_eff)
    np.testing.assert_allclose(actual, [expected_ic, n, friction], rtol=1e-12, atol=0)


@pytest.mark.parametrize("field", ["resistance", "crr75", "ic", "kc"])
@pytest.mark.parametrize("qc, fs, sigma_v, sigma_eff, expected_n", CPT_CASES)
def test_cpt_resistance_independent_chain(qc, fs, sigma_v, sigma_eff, expected_n, field):
    """Youd et al. (2001), Eqs. (11)-(19), independent qc1N and qc1Ncs chain."""
    assert PA == 101.325
    ic, n, _ = _published_ic_procedure(qc, fs, sigma_v, sigma_eff)
    assert n == expected_n
    cq = min((101.325 / sigma_eff)**n, 1.7)  # Eq. (13), including the cap.
    qc1n = cq * qc / 101.325  # Eq. (12) uses qc, not net cone resistance.
    kc = _published_kc(ic)
    qc1ncs = kc * qc1n  # Eq. (18).
    expected = {
        "resistance": qc1ncs, "crr75": _published_crr(qc1ncs), "ic": ic, "kc": kc,
    }
    actual = youd.cpt_resistance(qc, fs, sigma_v, sigma_eff)
    if np.isnan(expected[field]):
        assert np.isnan(actual[field])
    else:
        assert actual[field] == pytest.approx(expected[field], rel=1e-12)


def test_kc_eq19_low_friction_ratio():
    """Youd et al. (2001), Eq. (19b) as specified by T3a: no F < 0.5 override."""
    expected = _published_kc_polynomial(2.0)  # 1.3, even when F = 0.3 percent.
    assert youd.kc_factor(2.0, F=0.3) == pytest.approx(expected, rel=1e-12)
