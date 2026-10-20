"""Dry Rankine sand: independent Blum and free-earth worked calculations.

Source: US Army Corps of Engineers (1994), EM 1110-2-2504, Design of Sheet
Pile Walls, sections 4-3a/b, 5-2e/f/g (earth pressures, net diagrams,
cantilever and anchored equilibrium), and 6-1 (structural forces):
https://vulcanhammer.info/wp-content/uploads/2021/09/em_1110-2-2504.pdf
Inputs are constructed SI worked examples, not a numbered USACE example.
The cantilever uses the engine's simplified Blum toe-concentrated reaction,
whereas USACE section 5-2f includes a finite reversed-pressure zone.
Its D0 is therefore not asserted to equal that full USACE solution.
All pressure factors are 1; no USACE strength-reduction factor is implied.

Inputs: H=5 m, gamma=18 kN/m^3, phi=30 degrees, c=0 kPa,
smooth vertical wall, level dry sand to z=40 m, q=0, GWT=100 m.
Rankine Ka=tan(45-phi/2)^2=1/3, Kp=3 (equal to Coulomb only for delta=0, vertical wall, level surface; USACE EM 1110-2-2504 4-3a is Coulomb-based). Per metre of wall:
p(z)=6z-54*max(z-5,0) kPa;
F(z)=3z^2-27*max(z-5,0)^2 kN/m;
J(z)=2z^3-54*[d^3/3+5d^2/2] kNm/m, d=max(z-5,0).

Cantilever: solve z*F-J=0, or Ka*(H+D0)^3=Kp*D0^3.
D0=4.629270333734 m, D=1.2D0=5.555124400481 m;
signed net toe force R=F(H+D0)=-300.445341734901 kN/m.
The balancing support reaction is -R. Shear zero at z=7.5 m;
Mmax=z*F-J=281.25 kNm/m.
Anchor at a=1 m: solve J-a*F=0 below dredge;
D0=1.902340358391 m, T=F(H+D0)=45.216638611829 kN/m.
Shear zero above dredge at z=sqrt(T/3)=3.882294794398 m;
Mmax=abs(z*F-J-T*(z-a))=71.812908523422 kNm/m.
The small positive moment above the anchor is only 1 kNm/m.

Tolerances fixed independently of results: 0.002 m for depths (one 2 mm
integration interval); 0.02 kN/m for forces; 0.15 kNm/m for moments.
The moment allowance covers integrating the concentrated anchor jump
(T*0.002=0.0905 kNm/m) and smooth trapezoidal quadrature.
Pressure checks use 1e-9 kPa, because they require only linear evaluation.
"""

import math

import numpy as np
import pytest
from scipy.optimize import brentq

from geotek.core.models import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.engine.sheet_pile import anchored_sheet_pile, cantilever_sheet_pile, net_pressure


def _profile():
    return SoilProfile(
        id="dry-hand",
        gwt=GroundwaterCondition(depth_insitu=100),
        layers=[SoilLayer(
            id="sand", top=0, bottom=40, gamma=18, gamma_sat=20,
            design=DesignParameters(phi_eff=30, c_eff=0),
        )],
    )


def _force(z):
    return 3 * z**2 - 27 * max(z - 5, 0)**2


def _first_moment(z):
    d = max(z - 5, 0)
    return 2 * z**3 - 54 * (d**3 / 3 + 5 * d**2 / 2)


def test_dry_rankine_net_pressure():
    result = net_pressure(_profile(), 5)
    np.testing.assert_allclose(result.active, 6 * result.z, rtol=0, atol=1e-9)
    np.testing.assert_allclose(
        result.passive, 54 * np.maximum(result.z - 5, 0), rtol=0, atol=1e-9,
    )
    np.testing.assert_allclose(
        result.net, 6 * result.z - 54 * np.maximum(result.z - 5, 0),
        rtol=0, atol=1e-9,
    )


def test_dry_cantilever_embedment_reaction_and_maximum_moment():
    ratio = (1 / 9) ** (1 / 3)
    depth = 5 * ratio / (1 - ratio)
    assert depth == pytest.approx(4.629270333734, abs=1e-10)
    expected_reaction = _force(5 + depth)
    assert expected_reaction == pytest.approx(-300.445341734901, abs=1e-9)
    result = cantilever_sheet_pile(_profile(), 5, depth_increase=0.2)
    assert result.D0 == pytest.approx(depth, abs=1e-4)
    assert result.D == pytest.approx(1.2 * depth, rel=1e-4)
    assert result.toe_force == pytest.approx(expected_reaction, abs=1e-3)
    assert result.M_max == pytest.approx(281.25, abs=0.15)
    assert result.z_M_max == pytest.approx(7.5, abs=0.002)


def test_dry_free_earth_anchor_below_surface():
    toe = brentq(lambda z: _first_moment(z) - _force(z), 5, 20, xtol=1e-12)
    force = _force(toe)
    z_max = math.sqrt(force / 3)
    moment = abs(z_max * _force(z_max) - _first_moment(z_max) - force * (z_max - 1))
    assert toe - 5 == pytest.approx(1.902340358391, abs=1e-10)
    assert force == pytest.approx(45.216638611829, abs=1e-9)
    assert moment == pytest.approx(71.812908523422, abs=1e-9)
    result = anchored_sheet_pile(_profile(), 5, anchor_depth=1)
    assert result.D0 == pytest.approx(toe - 5, abs=1e-4)
    assert result.D == pytest.approx(toe - 5, abs=1e-4)
    assert result.anchor_force == pytest.approx(force, abs=1e-3)
    assert result.M_max == pytest.approx(moment, abs=0.15)
    assert result.z_M_max == pytest.approx(z_max, abs=0.002)
