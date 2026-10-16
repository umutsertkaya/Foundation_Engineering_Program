import numpy as np
import pytest
from hypothesis import given
from hypothesis import strategies as st

from geotek.core.constants import GAMMA_W
from geotek.core.errors import ProfileError
from geotek.core.models import GroundwaterCondition, SoilLayer, SoilProfile


def test_hand_calculation(two_layer_profile):
    # z = 5 m, GWT 2 m: 18*2 + 19*1 + 20*2 = 95 kPa; u = 9.81*3
    sv, u, se = two_layer_profile.stresses(5.0)
    assert sv == pytest.approx(95.0)
    assert u == pytest.approx(3 * GAMMA_W)
    assert se == pytest.approx(95.0 - 3 * GAMMA_W)


def test_above_water_table_and_surface(two_layer_profile):
    sv, u, se = two_layer_profile.stresses(np.array([0.0, 1.5]))
    assert sv.tolist() == pytest.approx([0.0, 27.0])
    assert u.tolist() == [0.0, 0.0]
    assert se.tolist() == pytest.approx([0.0, 27.0])


def test_gwt_cases(two_layer_profile):
    # design GWT 1 m: 18*1 + 19*2 + 20*2 = 96; seismic GWT 4 m: 18*3 + 17*1 + 20*1 = 91
    assert two_layer_profile.stresses(5.0, "design")[0] == pytest.approx(96.0)
    assert two_layer_profile.stresses(5.0, "seismic")[0] == pytest.approx(91.0)
    assert two_layer_profile.stresses(5.0, "seismic")[1] == pytest.approx(GAMMA_W)


def test_outside_profile_raises(two_layer_profile):
    with pytest.raises(ProfileError):
        two_layer_profile.stresses(12.0)


@given(
    gwt=st.floats(0, 20),
    gamma=st.floats(14, 22),
    z=st.lists(st.floats(0, 20), min_size=2, max_size=20),
)
def test_monotonic_and_consistent(gwt, gamma, z):
    profile = SoilProfile(
        id="H",
        gwt=GroundwaterCondition(depth_insitu=gwt),
        layers=[
            SoilLayer(id="a", top=0, bottom=7, gamma=gamma, gamma_sat=gamma + 1.5),
            SoilLayer(id="b", top=7, bottom=20, gamma=gamma, gamma_sat=gamma + 2.0),
        ],
    )
    z = np.sort(np.asarray(z))
    sv, u, se = profile.stresses(z)
    assert np.all(np.diff(sv) >= -1e-9)
    assert np.allclose(se, sv - u)
    assert np.all(se >= -1e-9)
