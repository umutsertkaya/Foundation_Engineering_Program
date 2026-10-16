import math

import pytest

from geotek.core.errors import GeoTekError
from geotek.engine.bearing import bearing_capacity, bearing_factors


@pytest.mark.parametrize(
    "phi, nc, nq, ng_m, ng_h, ng_v",
    [
        # Bowles, Foundation Analysis and Design, Table 4-4
        (20, 14.83, 6.40, 2.87, 2.95, 5.39),
        (30, 30.14, 18.40, 15.67, 15.07, 22.40),
        (40, 75.31, 64.20, 93.69, 79.54, 109.41),
    ],
)
def test_factor_table(phi, nc, nq, ng_m, ng_h, ng_v):
    for method, ng in (("meyerhof", ng_m), ("hansen", ng_h), ("vesic", ng_v)):
        f = bearing_factors(phi, method)
        assert f[0] == pytest.approx(nc, rel=2e-3)
        assert f[1] == pytest.approx(nq, rel=2e-3)
        assert f[2] == pytest.approx(ng, rel=5e-3)


def test_undrained_factors():
    assert bearing_factors(0, "vesic") == (5.14, 1.0, 0.0)


@pytest.mark.parametrize("method", ["meyerhof", "hansen", "vesic"])
def test_surface_strip_reduces_to_basic_terms(method):
    nc, nq, ng = bearing_factors(30, method)
    r = bearing_capacity(method=method, B=2, D=0, phi=30, gamma=18, q=0)
    assert r.q_ult == pytest.approx(0.5 * 18 * 2 * ng)
    assert r.Q_ult == pytest.approx(r.q_ult * 2)
    r0 = bearing_capacity(method=method, B=2, D=0, phi=0, gamma=18, q=20, c=50)
    assert r0.q_ult == pytest.approx(5.14 * 50 + 20)


def test_vesic_square_hand_calc():
    r = bearing_capacity(method="vesic", B=2, L=2, D=1, phi=30, gamma=18, q=18)
    nq, ng = bearing_factors(30, "vesic")[1:]
    sq = 1 + math.tan(math.radians(30))
    dq = 1 + 2 * math.tan(math.radians(30)) * (1 - 0.5) ** 2 * 0.5
    assert r.factors["sq"] == pytest.approx(sq)
    assert r.factors["dq"] == pytest.approx(dq)
    assert r.q_ult == pytest.approx(18 * nq * sq * dq + 0.5 * 18 * 2 * ng * 0.6)


@pytest.mark.parametrize("method", ["meyerhof", "hansen", "vesic"])
def test_inclination_and_eccentricity_reduce_capacity(method):
    base = bearing_capacity(method=method, B=3, D=1, phi=32, gamma=19, q=19, V=500)
    inclined = bearing_capacity(method=method, B=3, D=1, phi=32, gamma=19, q=19, V=500, H=100)
    eccentric = bearing_capacity(method=method, B=3, D=1, phi=32, gamma=19, q=19, V=500, e_B=0.3)
    assert inclined.q_ult < base.q_ult
    assert eccentric.B_eff == pytest.approx(2.4)
    assert eccentric.Q_ult < base.Q_ult


def test_vesic_inclination_hand_calc():
    r = bearing_capacity(method="vesic", B=2, D=0, phi=30, gamma=18, q=0, V=400, H=80)
    m = 2.0  # strip footing, load parallel to B
    assert r.factors["iq"] == pytest.approx((1 - 0.2) ** m)
    assert r.factors["ig"] == pytest.approx((1 - 0.2) ** (m + 1))


def test_meyerhof_inclination_hand_calc():
    r = bearing_capacity(method="meyerhof", B=2, D=0, phi=30, gamma=18, q=0, V=400, H=400 * math.tan(math.radians(10)))
    assert r.factors["iq"] == pytest.approx((1 - 10 / 90) ** 2)
    assert r.factors["ig"] == pytest.approx((1 - 10 / 30) ** 2)


def test_errors():
    with pytest.raises(GeoTekError, match="V is required"):
        bearing_capacity(method="vesic", B=2, D=0, phi=30, gamma=18, q=0, H=10)
    with pytest.raises(GeoTekError, match="effective width"):
        bearing_capacity(method="vesic", B=2, D=0, phi=30, gamma=18, q=0, e_B=1.0)
    with pytest.raises(GeoTekError, match="exceeds"):
        bearing_capacity(method="hansen", B=2, D=0, phi=0, c=10, gamma=18, q=0, V=100, H=50)
