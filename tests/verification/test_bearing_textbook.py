"""Bearing factors and independent worked calculations (SI: m, kN, kPa).

Table reference: Bowles, Foundation Analysis and Design, 5th ed., Table 4-4.
The following two-decimal rows are supplied in the task brief, not transcribed
from a newly inspected book page. No unverified 25/35-degree rows are included.
phi    Nc     Nq      Ng(Meyerhof)  Ng(Hansen)  Ng(Vesic)
20     14.83   6.40     2.87          2.95        5.39
30     30.14  18.40    15.67         15.07       22.40
40     75.31  64.20    93.69         79.54      109.41

Worked cases: independent hand calculation ("elle bagimsiz hesap"), not a
claimed Bowles/Das numbered example. Horizontal base and ground; no water.
All cases: B=2, D=1, phi=30 deg, gamma=18, q=18, c=10, V=1000.
case         L       e_B    e_L     H
strip        None    0      0       0       (V,H per metre)
square       2       0      0       0
rectangle    4       0      0       0
eccentric    4       0.2    0.3     0
inclined     4       0.2    0.3     100     (H parallel to B)

Steps (all evaluated below with math, without engine factor helpers):
1. p=phi*pi/180; Nq=exp(pi*tan(p))*tan(pi/4+p/2)^2;
   Nc=(Nq-1)/tan(p). Ng=(Nq-1)*tan(1.4p), 1.5*(Nq-1)*tan(p),
   or 2*(Nq+1)*tan(p), for Meyerhof, Hansen, or Vesic respectively.
2. B'=B-2e_B, L'=L-2e_L; r=B'/L' (0 for strip), A'=B'L'
   (B' per metre for strip). Depth ratio k=D/B=0.5 uses physical B.
3. Meyerhof: Kp=tan(pi/4+p/2)^2, sc=1+0.2*Kp*r,
   sq=sg=1+0.1*Kp*r, dc=1+0.2*sqrt(Kp)*k,
   dq=dg=1+0.1*sqrt(Kp)*k. a=atan(H/V) in degrees;
   ic=iq=(1-a/90)^2, ig=(1-a/phi)^2.
4. Hansen/Vesic: sc=1+r*Nq/Nc, sg=1-0.4*r, dg=1,
   dq=1+2*tan(p)*(1-sin(p))^2*k.
   Hansen: sq=1+r*sin(p), dc=1+0.4*k.
   Vesic: sq=1+r*tan(p), dc=dq+(dq-1)/(Nq-1).
   This explicitly selects the latter Vesic depth-factor convention, not
   the alternative dc=1+0.4*k convention; equivalence is not asserted.
5. R=V+A'*c*cot(p). Hansen iq=(1-0.5H/R)^5, ig=(1-0.7H/R)^5.
   Vesic m=(2+r)/(1+r), iq=(1-H/R)^m, ig=(1-H/R)^(m+1).
   Both: ic=(Nq*iq-1)/(Nq-1).
6. qult=c*Nc*sc*dc*ic + q*Nq*sq*dq*iq
        + 0.5*gamma*B'*Ng*sg*dg*ig; Qult=A'*qult.

Expected qult [kPa], in the case order above:
Meyerhof: 1019.953148507, 1432.018986431, 1225.986067469,
          1143.924053539, 941.367385884.
Hansen:   1011.959901457, 1313.784566950, 1162.872234204,
          1109.955723198, 860.072547763.
Vesic:    1129.671554177, 1399.302685249, 1264.487119713,
          1191.088820685, 989.761028175.

No Terzaghi API is assumed. These are gross ultimate pressures, not allowable
or net pressures. No production code is used to construct expected values.
"""

import math

import pytest

from geotek.engine.bearing import bearing_capacity, bearing_factors


@pytest.mark.parametrize(
    "phi,nc,nq,ng_m,ng_h,ng_v",
    [
        (20, 14.83, 6.40, 2.87, 2.95, 5.39),
        (30, 30.14, 18.40, 15.67, 15.07, 22.40),
        (40, 75.31, 64.20, 93.69, 79.54, 109.41),
    ],
)
@pytest.mark.parametrize("method", ["meyerhof", "hansen", "vesic"])
def test_bearing_factors_bowles_table_4_4(phi, nc, nq, ng_m, ng_h, ng_v, method):
    """Bowles 5th ed., Table 4-4: expected (Nc,Nq,Ng) is the row above.

    abs=0.0051 accommodates rounding to two decimal places and a small
    decimal arithmetic margin; rel=0 prevents a larger allowance at phi=40.
    Source provenance is the task-supplied transcription (module docstring).
    """
    ng = {"meyerhof": ng_m, "hansen": ng_h, "vesic": ng_v}[method]
    assert bearing_factors(phi, method) == pytest.approx(
        (nc, nq, ng), rel=0, abs=0.0051
    )


def _hand_ultimate(method, length, e_b, e_l, horizontal):
    """Independent hand calculation: steps 1-6 and all inputs are above."""
    p = math.pi / 6
    nq = math.exp(math.pi * math.tan(p)) * math.tan(math.pi / 4 + p / 2) ** 2
    nc = (nq - 1) / math.tan(p)
    b = 2 - 2 * e_b
    l = None if length is None else length - 2 * e_l
    r = 0 if l is None else b / l
    area = b if l is None else b * l
    if method == "meyerhof":
        ng = (nq - 1) * math.tan(1.4 * p)
        kp = math.tan(math.pi / 4 + p / 2) ** 2
        sc, sq, sg = 1 + 0.2 * kp * r, 1 + 0.1 * kp * r, 1 + 0.1 * kp * r
        dc = 1 + 0.2 * math.sqrt(kp) * 0.5
        dq = dg = 1 + 0.1 * math.sqrt(kp) * 0.5
        angle = math.degrees(math.atan(horizontal / 1000))
        ic = iq = (1 - angle / 90) ** 2
        ig = (1 - angle / 30) ** 2
    else:
        sc, sg, dg = 1 + r * nq / nc, 1 - 0.4 * r, 1
        dq = 1 + 2 * math.tan(p) * (1 - math.sin(p)) ** 2 * 0.5
        resistance = 1000 + area * 10 / math.tan(p)
        if method == "hansen":
            ng = 1.5 * (nq - 1) * math.tan(p)
            sq, dc = 1 + r * math.sin(p), 1.2
            iq = (1 - 0.5 * horizontal / resistance) ** 5
            ig = (1 - 0.7 * horizontal / resistance) ** 5
        else:
            assert method == "vesic"
            ng = 2 * (nq + 1) * math.tan(p)
            sq, dc = 1 + r * math.tan(p), dq + (dq - 1) / (nq - 1)
            exponent = (2 + r) / (1 + r)
            iq = (1 - horizontal / resistance) ** exponent
            ig = (1 - horizontal / resistance) ** (exponent + 1)
        ic = (nq * iq - 1) / (nq - 1)
    terms = (10 * nc * sc * dc * ic, 18 * nq * sq * dq * iq,
             0.5 * 18 * b * ng * sg * dg * ig)
    return math.fsum(terms), b, l, area


@pytest.mark.parametrize(
    "length,e_b,e_l,horizontal,expected_by_method",
    [
        pytest.param(None, 0, 0, 0,
                     (1019.953148507, 1011.959901457, 1129.671554177), id="strip"),
        pytest.param(2, 0, 0, 0,
                     (1432.018986431, 1313.784566950, 1399.302685249), id="square"),
        pytest.param(4, 0, 0, 0,
                     (1225.986067469, 1162.872234204, 1264.487119713), id="rectangle"),
        pytest.param(4, 0.2, 0.3, 0,
                     (1143.924053539, 1109.955723198, 1191.088820685), id="eccentric"),
        pytest.param(4, 0.2, 0.3, 100,
                     (941.367385884, 860.072547763, 989.761028175), id="inclined"),
    ],
)
@pytest.mark.parametrize("method_index,method", list(enumerate(("meyerhof", "hansen", "vesic"))))
def test_ultimate_independent_hand_calculation(
    length, e_b, e_l, horizontal, expected_by_method, method_index, method
):
    """Source: independent hand calculation, module steps 1-6; not a book example.

    Expected qult is the explicit parameter in kPa, Qult=qult*effective area.
    The hand result must reproduce its nine-decimal checkpoint within 1e-8 kPa.
    API/hand rel=1e-10 only allows floating arithmetic, not table rounding.
    """
    expected, b, l, area = _hand_ultimate(method, length, e_b, e_l, horizontal)
    assert expected == pytest.approx(expected_by_method[method_index], rel=0, abs=1e-8)
    actual = bearing_capacity(
        method=method, B=2, D=1, phi=30, gamma=18, q=18, c=10,
        L=length, V=1000, H=horizontal, e_B=e_b, e_L=e_l,
    )
    assert actual.q_ult == pytest.approx(expected, rel=1e-10, abs=0)
    assert actual.Q_ult == pytest.approx(area * expected, rel=1e-10, abs=0)
    assert actual.B_eff == pytest.approx(b, rel=0, abs=1e-12)
    if l is None:
        assert actual.L_eff is None
    else:
        assert actual.L_eff == pytest.approx(l, rel=0, abs=1e-12)
