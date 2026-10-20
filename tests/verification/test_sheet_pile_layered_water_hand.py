"""Layered wet sand: exact piecewise-polynomial pressure and equilibrium.

Source: US Army Corps of Engineers (1994), EM 1110-2-2504, Design of Sheet
Pile Walls, sections 4-3b (layered effective stresses), 4-4a (surcharge),
4-5a (hydrostatic water), 5-2e/f/g and 6-1:
https://vulcanhammer.info/wp-content/uploads/2021/09/em_1110-2-2504.pdf
This is a constructed worked application, not a reproduced numbered example.
Cantilever equilibrium is the simplified Blum toe-reaction idealization,
not USACE's finite pressure-reversal zone. Anchored equilibrium is free-earth.

Inputs, per metre wall: H=4 m, anchor a=1 m where present, q=12 kPa,
retained GWT z=1 m, front water z=4 m, gamma_w=9.81 kN/m^3.
Upper z=0..2 m: phi=20 degrees, gamma=18, gamma_sat=20 kN/m^3.
Lower z=2..30 m: phi=30 degrees, gamma=19, gamma_sat=21 kN/m^3.
Both c=0 kPa; all load/resistance factors=1, no seepage.

Hand steps: Ka1=tan(35 deg)^2=0.4902905965657021, Ka2=1/3, Kp2=3.
Retained effective vertical stress at z=1,2,4 m is 18,28.19,50.57 kPa;
below z=2 it increases by 11.19 kPa/m. Front effective stress starts at
zero at dredge and is 11.19*(z-4). Add q only behind, then add water
9.81*max(z-1,0) behind and 9.81*max(z-4,0) in front.
Net pressure segments [left,right,p(left+),slope], units m,kPa,kPa/m:
[0,1,12*Ka1,18*Ka1], [1,2,30*Ka1,10.19*Ka1+9.81],
[2,4,23.206666666667,13.54], [4,30,50.286666666667,-29.84].
At z=2: p(left)=29.514779075976, p(right)=23.206666666667 kPa.
At z=6: active=77.366666666667, passive=86.76, net=-9.393333333333 kPa.

For each segment starting at a, width l, pressure p+s*(z-a):
F=p*l+s*l^2/2; J=a*F+p*l^2/2+s*l^3/3. Sum these exact integrals.
Cantilever: solve z*F-J=0; D0=8.138844162036 m,
signed R=-473.135973889141 kN/m, Mmax=691.496728267660 kNm/m,
zM=8.837648332199 m (F=0). Use zero embedment increase here.
Anchor: solve J-F=0; D0=3.569680284609 m, T=95.288656298233 kN/m;
zM=3.782596290874 m (F=T), Mmax=133.194853838593 kNm/m.
M=z*F-J-T*max(z-a,0); endpoints and the anchor are also checked
as candidates to ensure the zero-shear extremum is the global maximum.

Tolerances: pressure 1e-8 kPa (linear formulas); D0 and zM 0.002 m
(one integration step); reaction/anchor force 0.03 kN/m; Mmax
0.3 kNm/m (anchor jump contributes at most T*0.002=0.191 kNm/m,
plus smooth quadrature). They are chosen before observing motor output.
"""

import math

import numpy as np
import pytest
from scipy.optimize import brentq

from geotek.core.models import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.engine.sheet_pile import anchored_sheet_pile, cantilever_sheet_pile, net_pressure


KA_UPPER = math.tan(math.radians(35)) ** 2
SEGMENTS = (
    (0, 1, 12 * KA_UPPER, 18 * KA_UPPER),
    (1, 2, 30 * KA_UPPER, 10.19 * KA_UPPER + 9.81),
    (2, 4, 40.19 / 3 + 9.81, 13.54),
    (4, 30, 62.57 / 3 + 29.43, -29.84),
)


def _profile():
    return SoilProfile(
        id="layered-water-hand",
        gwt=GroundwaterCondition(depth_insitu=1),
        layers=[
            SoilLayer(
                id="upper", top=0, bottom=2, gamma=18, gamma_sat=20,
                design=DesignParameters(phi_eff=20, c_eff=0),
            ),
            SoilLayer(
                id="lower", top=2, bottom=30, gamma=19, gamma_sat=21,
                design=DesignParameters(phi_eff=30, c_eff=0),
            ),
        ],
    )


def _integrals(z):
    """Exact force and first moment of the independently derived pressure."""
    force = first_moment = 0.0
    for left, right, pressure, slope in SEGMENTS:
        width = max(0.0, min(z, right) - left)
        area = pressure * width + slope * width**2 / 2
        force += area
        first_moment += left * area + pressure * width**2 / 2 + slope * width**3 / 3
    return force, first_moment


def _reference(anchor):
    def equilibrium(z):
        force, first_moment = _integrals(z)
        return z * force - first_moment if anchor is None else first_moment - anchor * force

    toe = brentq(equilibrium, 4, 30, xtol=1e-12)
    reaction = _integrals(toe)[0]
    tension = 0.0 if anchor is None else reaction
    z_max = brentq(lambda z: _integrals(z)[0] - tension,
                  4 if anchor is None else anchor, toe - 1e-5)

    def moment(z):
        force, first_moment = _integrals(z)
        anchor_moment = 0.0 if anchor is None else tension * max(z - anchor, 0.0)
        return abs(z * force - first_moment - anchor_moment)

    candidates = [0, 1, 2, 4, z_max, toe]
    assert moment(z_max) == max(moment(z) for z in candidates)
    return toe - 4, reaction, moment(z_max), z_max


def test_layered_hydrostatic_pressure_and_interface_jump():
    result = net_pressure(_profile(), 4, surcharge=12, front_water_depth=4)
    for left, right, pressure, slope in SEGMENTS:
        inside = (result.z > left) & (result.z < right)
        assert inside.any()
        np.testing.assert_allclose(
            result.net[inside], pressure + slope * (result.z[inside] - left),
            rtol=0, atol=1e-8,
        )
    interface = np.isclose(result.z, 2, rtol=0, atol=1e-10)
    np.testing.assert_allclose(
        result.net[interface], [29.514779075976, 23.206666666667],
        rtol=0, atol=1e-8,
    )
    below = np.isclose(result.z, 6, rtol=0, atol=1e-10)
    assert below.any()
    np.testing.assert_allclose(result.active[below], 77.366666666667, rtol=0, atol=1e-8)
    np.testing.assert_allclose(result.passive[below], 86.76, rtol=0, atol=1e-8)


@pytest.mark.parametrize(
    "anchor, expected",
    [
        (None, (8.138844162036, -473.135973889141, 691.496728267660, 8.837648332199)),
        (1.0, (3.569680284609, 95.288656298233, 133.194853838593, 3.782596290874)),
    ],
    ids=["cantilever", "free-earth-anchor"],
)
def test_layered_water_embedment_force_and_moment(anchor, expected):
    reference = _reference(anchor)
    assert reference == pytest.approx(expected, abs=1e-8)
    if anchor is None:
        result = cantilever_sheet_pile(
            _profile(), 4, depth_increase=0, surcharge=12, front_water_depth=4,
        )
        force = result.toe_force
    else:
        result = anchored_sheet_pile(
            _profile(), 4, anchor_depth=anchor, surcharge=12, front_water_depth=4,
        )
        force = result.anchor_force
    depth, expected_force, moment, z_max = reference
    assert result.D0 == pytest.approx(depth, abs=1e-4)
    assert result.D == pytest.approx(depth, abs=1e-4)
    assert force == pytest.approx(expected_force, abs=2e-3)
    assert result.M_max == pytest.approx(moment, abs=0.3)
    assert result.z_M_max == pytest.approx(z_max, abs=0.002)
