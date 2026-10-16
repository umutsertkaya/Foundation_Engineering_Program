"""Sheet piles checked against closed-form solutions for homogeneous dry sand."""

import math

import numpy as np
import pytest
from scipy.optimize import brentq

from geotek.core.errors import GeoTekError
from geotek.core.models import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.engine.earth_pressure.coefficients import rankine_ka, rankine_kp
from geotek.engine.sheet_pile import anchored_sheet_pile, cantilever_sheet_pile, net_pressure

G, PHI, H = 18.0, 30.0, 5.0
KA, KP = rankine_ka(PHI), rankine_kp(PHI)


def _profile(gwt=100.0, phi=PHI, c=0.0, su=None, bottom=40.0):
    layer = SoilLayer(id="S", top=0, bottom=bottom, gamma=G, gamma_sat=20.0,
                      design=DesignParameters(phi_eff=phi, c_eff=c, su=su))
    return SoilProfile(id="SP", gwt=GroundwaterCondition(depth_insitu=gwt), layers=[layer])


def test_cantilever_closed_form():
    # Moments about the toe: Ka (H+D)^3 = Kp D^3  ->  D / (H + D) = (Ka / Kp)^(1/3)
    r = cantilever_sheet_pile(_profile(), H)
    ratio = (KA / KP) ** (1 / 3)
    d0 = H * ratio / (1 - ratio)
    assert r.D0 == pytest.approx(d0, rel=1e-3)
    assert r.D == pytest.approx(1.2 * d0, rel=1e-3)
    # Blum counter-force = net horizontal force at D0
    R = 0.5 * G * (KA * (H + d0) ** 2 - KP * d0**2)
    assert r.toe_force == pytest.approx(R, rel=2e-3)
    # Max moment where shear = 0 below the dredge line
    z0 = H * math.sqrt(KP) / (math.sqrt(KP) - math.sqrt(KA))
    m = G * (KA * z0**3 - KP * (z0 - H) ** 3) / 6
    assert r.M_max == pytest.approx(m, rel=2e-3)
    assert r.z_M_max == pytest.approx(z0, abs=0.01)


def test_anchored_at_top_closed_form():
    r = anchored_sheet_pile(_profile(), H, anchor_depth=0.0)
    # Moments about the anchor: Ka (H+D)^3 / 3 = Kp (D^3 / 3 + H D^2 / 2)
    d = brentq(lambda d: KA * (H + d) ** 3 / 3 - KP * (d**3 / 3 + H * d**2 / 2), 0.01, 20)
    T = 0.5 * G * (KA * (H + d) ** 2 - KP * d**2)
    assert r.D0 == pytest.approx(d, rel=1e-3)
    assert r.anchor_force == pytest.approx(T, rel=2e-3)
    z0 = math.sqrt(2 * T / (KA * G))  # shear zero above the dredge line
    assert z0 < H
    assert r.M_max == pytest.approx(T * z0 - KA * G * z0**3 / 6, rel=3e-3)


def test_anchor_needs_less_embedment_than_cantilever():
    c = cantilever_sheet_pile(_profile(), H)
    a = anchored_sheet_pile(_profile(), H, anchor_depth=1.0)
    assert a.D0 < c.D0 and a.M_max < c.M_max


def test_passive_factor_and_water_increase_embedment():
    base = cantilever_sheet_pile(_profile(), H)
    factored = cantilever_sheet_pile(_profile(), H, passive_factor=1.5)
    wet = cantilever_sheet_pile(_profile(gwt=2.0), H)
    assert factored.D0 > base.D0
    assert wet.D0 > base.D0


def test_unbalanced_water():
    p = _profile(gwt=1.0)
    n = net_pressure(p, H)  # front water at the dredge line (pumped excavation)
    z = 4.0
    i = int(np.argmin(np.abs(n.z - z)))
    assert n.z[i] == pytest.approx(z)
    u = 9.81 * (z - 1.0)
    assert n.active[i] == pytest.approx(KA * (G * 1.0 + (20 - 9.81) * (z - 1.0)) + u, rel=1e-6)
    j = int(np.argmin(np.abs(n.z - 7.0)))
    # Below the dredge line the front water starts at H: unbalanced head = H - 1 m
    passive_water = 9.81 * (7.0 - H)
    assert n.passive[j] == pytest.approx(KP * (20 - 9.81) * (7.0 - H) + passive_water, rel=1e-6)


def test_section_modulus_and_anchor_note():
    r = anchored_sheet_pile(_profile(), H, anchor_depth=1.0, allowable_stress_mpa=210,
                            anchor_spacing=2.5, anchor_inclination=15)
    assert r.section_modulus_cm3 == pytest.approx(r.M_max / 210 * 1000)
    assert any("per anchor" in w for w in r.warnings)


def test_undrained_clay_closed_form():
    # Above the dredge line: sigma_a = gamma z - 2 su (tension crack to z_c = 2 su / gamma).
    # Below it the net pressure is constant: (gamma H - 2 su) - (2 su) = gamma H - 4 su.
    su, h = 20.0, 3.0
    r = cantilever_sheet_pile(_profile(phi=None, su=su), h, drainage="undrained")
    zc = 2 * su / G
    P = 0.5 * (G * h - 2 * su) * (h - zc)        # driving force above the dredge line
    ybar = (h - zc) / 3                          # its height above the dredge line
    q = 4 * su - G * h                           # net resisting pressure below
    # Moments about the toe: P (D + ybar) = q D^2 / 2
    d0 = (P + math.sqrt(P**2 + 2 * q * P * ybar)) / q
    assert r.D0 == pytest.approx(d0, rel=2e-3)


def test_undrained_no_driving_pressure():
    with pytest.raises(GeoTekError, match="does not drive"):
        cantilever_sheet_pile(_profile(phi=None, su=40), 3.0, drainage="undrained")


def test_errors():
    with pytest.raises(GeoTekError):
        cantilever_sheet_pile(_profile(bottom=6.0), H)  # profile too short for equilibrium
    with pytest.raises(GeoTekError):
        anchored_sheet_pile(_profile(), H, anchor_depth=6.0)
    with pytest.raises(GeoTekError):
        net_pressure(_profile(), H, passive_factor=0.8)
