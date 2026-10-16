import math

import numpy as np
import pytest

from geotek.core.constants import GAMMA_W
from geotek.core.errors import GeoTekError
from geotek.core.models import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.engine.earth_pressure.coefficients import (
    coulomb_ka,
    coulomb_kp,
    mononobe_okabe_kae,
    rankine_ka,
    rankine_kp,
    seed_whitman_dkae,
    seismic_coefficient,
)
from geotek.engine.earth_pressure.distribution import lateral_pressure
from geotek.engine.earth_pressure.log_spiral import log_spiral_kp

# --- coefficients ------------------------------------------------------------------------


def test_rankine_values():
    assert rankine_ka(30) == pytest.approx(1 / 3)
    assert rankine_kp(30) == pytest.approx(3.0)
    with pytest.raises(GeoTekError):
        rankine_ka(25, beta=30)


@pytest.mark.parametrize("phi, beta", [(30, 10), (35, 20), (28, 28)])
def test_sloping_rankine_equals_coulomb_with_delta_beta(phi, beta):
    # Known identity for a vertical plane: Rankine (resultant parallel to the slope)
    # equals Coulomb with delta = beta.
    assert rankine_ka(phi, beta) == pytest.approx(coulomb_ka(phi, beta, 0, beta), rel=1e-9)


def test_coulomb_table_value():
    assert coulomb_ka(30, 20) == pytest.approx(0.2973, abs=5e-4)  # Das, Table 7.x (delta = 2/3 phi)
    assert coulomb_ka(30, 0) == pytest.approx(1 / 3)
    assert coulomb_kp(30, 0) == pytest.approx(3.0)


def test_mononobe_okabe():
    assert mononobe_okabe_kae(30, kh=0.2) == pytest.approx(0.4732, abs=5e-4)
    assert mononobe_okabe_kae(32, 15, 5, 5) == pytest.approx(coulomb_ka(32, 15, 5, 5))
    with pytest.raises(GeoTekError, match="no solution"):
        mononobe_okabe_kae(30, beta=25, kh=0.2)


def test_seismic_helpers():
    assert seed_whitman_dkae(0.2) == pytest.approx(0.15)
    assert seismic_coefficient(0.4, f_pga=1.0) == pytest.approx(0.2)
    with pytest.raises(GeoTekError):
        seismic_coefficient(0.4, displacement_factor=1.5)


# --- log spiral --------------------------------------------------------------------------


@pytest.mark.parametrize("phi", [20, 30, 40])
def test_log_spiral_reduces_to_rankine(phi):
    assert log_spiral_kp(phi, 0).Kp == pytest.approx(rankine_kp(phi), rel=1e-4)


@pytest.mark.parametrize("phi", [25, 30, 35, 40])
def test_log_spiral_bounds(phi):
    # Coulomb (planar) is close for small delta but drifts above as phi grows
    third = log_spiral_kp(phi, phi / 3).Kp
    assert 0.96 * coulomb_kp(phi, phi / 3) < third <= coulomb_kp(phi, phi / 3)
    values = [log_spiral_kp(phi, phi * f).Kp for f in (0, 0.25, 0.5, 0.75, 1.0)]
    assert all(np.diff(values) > 0)
    assert values[-1] < coulomb_kp(phi, phi)


def test_log_spiral_independent_of_scale():
    assert log_spiral_kp(32, 20, H=7.0, gamma=19.0).Kp == pytest.approx(log_spiral_kp(32, 20).Kp, rel=1e-6)


def test_log_spiral_near_chart_value():
    # Caquot & Kerisel charts give about 6.4 for phi = delta = 30 deg; the log-spiral
    # mechanism (an upper bound) should be close and slightly above it.
    assert 6.2 < log_spiral_kp(30, 30).Kp < 6.9


# --- distribution ------------------------------------------------------------------------


def _profile(layers, gwt=50.0):
    out = []
    for i, (top, bot, phi, c, gamma, gsat, su) in enumerate(layers):
        out.append(SoilLayer(id=f"L{i}", top=top, bottom=bot, gamma=gamma, gamma_sat=gsat,
                             design=DesignParameters(phi_eff=phi, c_eff=c, su=su)))
    return SoilProfile(id="W", gwt=GroundwaterCondition(depth_insitu=gwt), layers=out)


def test_uniform_dry_sand():
    p = _profile([(0, 10, 30, 0, 18, 20, None)])
    d = lateral_pressure(p, 6.0)
    assert d.force == pytest.approx(0.5 * 18 * 36 / 3, rel=1e-6)
    assert d.z_resultant == pytest.approx(4.0, rel=1e-6)
    d2 = lateral_pressure(p, 6.0, surcharge=10)
    assert d2.force == pytest.approx(108 + 10 * 6 / 3, rel=1e-6)


def test_water_table():
    p = _profile([(0, 10, 30, 0, 18, 20, None)], gwt=2.0)
    d = lateral_pressure(p, 6.0)
    eff = (0.5 * 36 * 2 + 36 * 4 + 0.5 * (20 - GAMMA_W) * 4 * 4) / 3
    water = 0.5 * GAMMA_W * 16
    assert d.force == pytest.approx(eff + water, rel=1e-6)
    assert d.component("water")[0] == pytest.approx(water, rel=1e-6)


def test_layer_boundary_jump():
    p = _profile([(0, 3, 30, 0, 18, 18, None), (3, 10, 20, 0, 18, 18, None)])
    d = lateral_pressure(p, 6.0)
    ka1, ka2 = rankine_ka(30), rankine_ka(20)
    expected = ka1 * 0.5 * 18 * 9 + ka2 * (54 * 3 + 0.5 * 18 * 9)
    assert d.force == pytest.approx(expected, rel=1e-6)
    at3 = d.sigma_h_eff[np.isclose(d.z, 3.0)]
    assert sorted(at3) == pytest.approx(sorted([ka1 * 54, ka2 * 54]))


def test_cohesion_tension_crack_and_min_efp():
    p = _profile([(0, 10, 20, 10, 18, 18, None)])
    d = lateral_pressure(p, 6.0)
    ka = rankine_ka(20)
    zc = 2 * 10 / (18 * math.sqrt(ka))
    assert any("Tension" in w for w in d.warnings)
    assert np.all(d.sigma_h_eff[d.z < zc - 0.05] == 0)
    expected = 0.5 * (ka * 18 * 6 - 2 * 10 * math.sqrt(ka)) * (6 - zc)
    assert d.force == pytest.approx(expected, rel=2e-3)
    d_min = lateral_pressure(p, 6.0, min_efp=5.0)
    assert d_min.force > d.force
    assert np.all(d_min.sigma_h_eff >= 5.0 * d_min.z - 1e-9)


def test_undrained_total_stress():
    p = _profile([(0, 10, None, 0, 18, 18, 30)], gwt=1.0)
    d = lateral_pressure(p, 6.0, drainage="undrained")
    assert d.force == pytest.approx(0.5 * (108 - 60) * (6 - 60 / 18), rel=2e-3)
    assert np.all(d.u == 0)


def test_passive_below_dredge_line():
    p = _profile([(0, 10, 30, 0, 18, 18, None)])
    d = lateral_pressure(p, 3.0, state="passive", top=2.0)
    assert d.sigma_h_eff[0] == pytest.approx(0.0, abs=1e-9)
    assert d.force == pytest.approx(0.5 * 3.0 * 18 * 9, rel=1e-6)


def test_at_rest_and_methods():
    p = _profile([(0, 10, 30, 0, 18, 18, None)])
    assert lateral_pressure(p, 4, state="at_rest").force == pytest.approx(0.5 * 0.5 * 18 * 16, rel=1e-6)
    coul = lateral_pressure(p, 4, method="coulomb", delta=20)
    assert coul.force == pytest.approx(0.5 * 18 * 16 * coulomb_ka(30, 20) * math.cos(math.radians(20)), rel=1e-6)
    ls = lateral_pressure(p, 4, state="passive", method="log_spiral", delta=20)
    assert ls.force == pytest.approx(0.5 * 18 * 16 * log_spiral_kp(30, 20).Kp_horizontal, rel=1e-6)
    warn = lateral_pressure(p, 4, state="passive", method="coulomb", delta=20)
    assert any("unconservative" in w for w in warn.warnings)


def test_errors():
    p = _profile([(0, 5, None, 0, 18, 18, None)])
    with pytest.raises(GeoTekError, match="phi"):
        lateral_pressure(p, 3)
    with pytest.raises(GeoTekError, match="Profile ends"):
        lateral_pressure(_profile([(0, 5, 30, 0, 18, 18, None)]), 6)
