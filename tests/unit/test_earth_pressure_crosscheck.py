"""Closed-form coefficients cross-checked against the independent numerical trial wedge."""

import itertools

import pytest

from geotek.engine.earth_pressure.coefficients import (
    coulomb_ka,
    coulomb_kp,
    mononobe_okabe_kae,
    mononobe_okabe_kpe,
)
from geotek.engine.earth_pressure.wedge import trial_wedge

CASES = list(itertools.product([25, 30, 38], [0, 15], [-10, 0, 10], [0, 10]))


@pytest.mark.parametrize("phi, delta, theta, beta", CASES)
def test_coulomb_active_matches_wedge(phi, delta, theta, beta):
    w = trial_wedge(H=6, gamma=18, phi=phi, delta=delta, theta=theta, beta=beta)
    assert w.K == pytest.approx(coulomb_ka(phi, delta, theta, beta), rel=1e-4)


@pytest.mark.parametrize("phi, delta, theta, beta", CASES)
def test_coulomb_passive_matches_wedge(phi, delta, theta, beta):
    w = trial_wedge(H=6, gamma=18, phi=phi, delta=delta, theta=theta, beta=beta, state="passive")
    assert w.K == pytest.approx(coulomb_kp(phi, delta, theta, beta), rel=1e-4)


@pytest.mark.parametrize("kh, kv", [(0.1, 0.0), (0.2, 0.0), (0.2, 0.1), (0.3, -0.1)])
@pytest.mark.parametrize("phi, delta, theta, beta", [(30, 0, 0, 0), (35, 17.5, 5, 5), (34, 20, -8, 0)])
def test_mononobe_okabe_matches_wedge(kh, kv, phi, delta, theta, beta):
    wa = trial_wedge(H=6, gamma=18, phi=phi, delta=delta, theta=theta, beta=beta, kh=kh, kv=kv)
    assert wa.K == pytest.approx(mononobe_okabe_kae(phi, delta, theta, beta, kh, kv), rel=1e-4)
    wp = trial_wedge(H=6, gamma=18, phi=phi, delta=delta, theta=theta, beta=beta, kh=kh, kv=kv,
                     state="passive")
    assert wp.K == pytest.approx(mononobe_okabe_kpe(phi, delta, theta, beta, kh, kv), rel=1e-4)
