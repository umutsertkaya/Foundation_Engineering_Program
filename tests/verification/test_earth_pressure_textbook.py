"""Textbook limits and independent lateral-pressure calculations.

Angles are degrees; all coefficients are dimensionless. Vertical wall,
horizontal cohesionless fill (theta=beta=0) unless explicitly stated.
Coefficients describe the TOTAL resultant, not its horizontal projection.

Rankine reference: Das, Principles of Foundation Engineering, Ch. 7
(edition-dependent numbering), active/passive earth pressure discussion.
Ka=(1-sin(phi))/(1+sin(phi)); Kp=1/Ka.
phi=30 -> Ka=1/3, Kp=3 exactly; no invented table/example number.

Coulomb: independent hand calculation ("elle bagimsiz hesap"), not a
transcribed Das table. For theta=beta=0, let
R=sqrt(sin(phi+delta)*sin(phi)/cos(delta)).
Ka=cos(phi)^2/[cos(delta)*(1+R)^2],
Kp=cos(phi)^2/[cos(delta)*(1-R)^2].
phi=30, delta=0/10/20 -> Ka=0.333333333333/0.308465786560/0.297313857205,
Kp=3/4.143299513164/6.105357772953.
The task's approximate Ka=0.297 is checked separately at three-decimal
rounding tolerance; it is not attributed to an unverified "Table 7.x".
Coulomb Kp at delta=20 > phi/2 is a planar-wedge FORMULA check only.

Mononobe-Okabe: independent hand calculations, not numbered Kramer/Das
worked examples. Reference background: Kramer, Geotechnical Earthquake
Engineering, Ch. 11, retaining structures; the equations below define the
precise convention tested. psi=atan(kh/(1-kv)), kv positive upward.
For theta=beta=0:
R=sqrt(sin(phi+delta)*sin(phi-psi)/cos(delta+psi));
C=cos(phi-psi)^2/[cos(psi)*cos(delta+psi)];
Kae=C/(1+R)^2; Kpe=C/(1-R)^2.
Force=0.5*gamma*height^2*(1-kv)*K: do not include (1-kv) twice.
phi=35, kh=0.2:
delta  kv    psi [deg]       Kae              Kpe
0      0     11.309932474    0.395585812622   3.285493558357
10     0     11.309932474    0.380976990364   4.578272257971
10     0.1   12.528807709    0.398833116775   4.493493807737
The active equation is also reproduced in FHWA/RD-80/195, Eq. (81):
https://highways.dot.gov/sites/fhwa.dot.gov/files/FHWA-RD-80-195.pdf

Seed-Whitman (1970) approximation: DeltaKae=3*kh/4; kh=0/0.1/0.2/0.3
gives 0/0.075/0.15/0.225. FHWA/RD-80/195, Eq. (82), gives the equivalent
force increment 3*gamma*height^2*kh/8. This checks the approximation itself,
not exact agreement with Mononobe-Okabe.

Log spiral: Das, Ch. 7, curved passive failure surface; at delta=0 the
smooth-wall Rankine limit is Kp(30)=3.0. Only this certain limit is used.
The suggested rough-wall value near 6.5 is omitted: no verified table page
and coefficient convention were available, so no Caquot-Kerisel datum is
invented. H=1,gamma=1 and H=4,gamma=18 must yield the same coefficient.
"""

import math

import pytest

from geotek.engine.earth_pressure.coefficients import (
    coulomb_ka,
    coulomb_kp,
    mononobe_okabe_kae,
    mononobe_okabe_kpe,
    rankine_ka,
    rankine_kp,
    seed_whitman_dkae,
)
from geotek.engine.earth_pressure.log_spiral import log_spiral_kp


def test_rankine_thirty_degree_exact_limits():
    """Das, Ch. 7, Rankine: phi=30,beta=0 -> Ka=1/3,Kp=3.

    rel=1e-12 permits floating trigonometry only; these limits are exact.
    """
    assert rankine_ka(30) == pytest.approx(1 / 3, rel=1e-12, abs=0)
    assert rankine_kp(30) == pytest.approx(3, rel=1e-12, abs=0)


def test_coulomb_active_rounded_reference():
    """Task-supplied Das-style reference: phi=30,delta=20,theta=beta=0, Ka=0.297.

    No unverified Das table number is claimed. abs=0.0005 is half of the
    last printed decimal; rel=0. The full hand result is 0.297313857205.
    """
    assert coulomb_ka(30, delta=20, theta=0, beta=0) == pytest.approx(
        0.297, rel=0, abs=0.0005
    )


@pytest.mark.parametrize(
    "delta,ka,kp",
    [(0, 1 / 3, 3), (10, 0.308465786560, 4.143299513164),
     (20, 0.297313857205, 6.105357772953)],
)
@pytest.mark.parametrize("passive", [False, True], ids=["active", "passive"])
def test_coulomb_independent_hand_formula(delta, ka, kp, passive):
    """Independent hand source: Coulomb equations and expected Ka/Kp above.

    Input phi=30, theta=beta=0. Fixed checkpoints use abs=1e-12 for their
    twelve decimals; API/hand rel=1e-12 is floating arithmetic tolerance.
    """
    p, d = math.pi / 6, math.radians(delta)
    root = math.sqrt(math.sin(p + d) * math.sin(p) / math.cos(d))
    sign = -1 if passive else 1
    expected = math.cos(p) ** 2 / (math.cos(d) * (1 + sign * root) ** 2)
    assert expected == pytest.approx(kp if passive else ka, rel=0, abs=1e-12)
    function = coulomb_kp if passive else coulomb_ka
    assert function(30, delta=delta, theta=0, beta=0) == pytest.approx(
        expected, rel=1e-12, abs=0
    )


@pytest.mark.parametrize(
    "delta,kv,kae,kpe",
    [(0, 0, 0.395585812622, 3.285493558357),
     (10, 0, 0.380976990364, 4.578272257971),
     (10, 0.1, 0.398833116775, 4.493493807737)],
)
@pytest.mark.parametrize("passive", [False, True], ids=["active", "passive"])
def test_mononobe_okabe_independent_hand_formula(delta, kv, kae, kpe, passive):
    """Independent hand source: module M-O equations; phi=35,kh=0.2,theta=beta=0.

    Expected Kae/Kpe is the parameter above. abs=1e-12 covers twelve-decimal
    checkpoints, rel=1e-12 only floating arithmetic in the API comparison.
    """
    p, d = math.radians(35), math.radians(delta)
    psi = math.atan(0.2 / (1 - kv))
    root = math.sqrt(math.sin(p + d) * math.sin(p - psi) / math.cos(d + psi))
    common = math.cos(p - psi) ** 2 / (math.cos(psi) * math.cos(d + psi))
    expected = common / (1 + (-1 if passive else 1) * root) ** 2
    assert expected == pytest.approx(kpe if passive else kae, rel=0, abs=1e-12)
    function = mononobe_okabe_kpe if passive else mononobe_okabe_kae
    assert function(35, delta=delta, theta=0, beta=0, kh=0.2, kv=kv) == pytest.approx(
        expected, rel=1e-12, abs=0
    )


@pytest.mark.parametrize("passive,expected", [(False, 1 / 3), (True, 3)])
def test_mononobe_okabe_zero_acceleration_rankine_limit(passive, expected):
    """Independent hand limit: phi=30, all other inputs zero -> Kae=1/3,Kpe=3.

    M-O equations above at psi=delta=0 reduce to Rankine (Das, Ch. 7).
    rel=1e-12 allows floating arithmetic; no engine function supplies the oracle.
    """
    function = mononobe_okabe_kpe if passive else mononobe_okabe_kae
    assert function(30, delta=0, theta=0, beta=0, kh=0, kv=0) == pytest.approx(
        expected, rel=1e-12, abs=0
    )


@pytest.mark.parametrize("kh,expected", [(0, 0), (0.1, 0.075), (0.2, 0.15), (0.3, 0.225)])
def test_seed_whitman_increment(kh, expected):
    """Seed-Whitman (1970); FHWA/RD-80/195 Eq. (82): DeltaKae=3kh/4.

    Expected values are explicit above; abs=1e-15 covers binary representation,
    including kh=0, with no relative allowance. This is the increment, not Kae.
    """
    assert seed_whitman_dkae(kh) == pytest.approx(expected, rel=0, abs=1e-15)


@pytest.mark.parametrize("height,gamma", [(1, 1), (4, 18)])
def test_log_spiral_smooth_wall_rankine_limit(height, gamma):
    """Das, Ch. 7, smooth-wall limit: phi=30,delta=0 -> total/horizontal Kp=3.

    rel=0.005 is a declared 0.5% numerical acceptance band for discretized
    spiral geometry and minimization, not invented book-rounding uncertainty.
    Its convergence is not claimed here. Both dimensions test normalization.
    """
    actual = log_spiral_kp(30, delta=0, H=height, gamma=gamma)
    assert actual.Kp == pytest.approx(3, rel=0.005, abs=0)
    assert actual.Kp_horizontal == pytest.approx(3, rel=0.005, abs=0)
