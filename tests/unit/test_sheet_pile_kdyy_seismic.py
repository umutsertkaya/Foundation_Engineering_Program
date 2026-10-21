"""KDYY handbook seismic increment for sheet piles (2026-10-21).

Hand numbers: phi 30, gamma 18, no water, kh 0.2, kv 0.1, q 10 kPa, toe 8 m:
increment(z) = 0.5 dK 18 * 8 + 2 dK 10 (1 - z/8) for z <= toe, zero below.
"""

import numpy as np
import pytest

from geotek.core.models.profile import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.engine.earth_pressure.coefficients import mononobe_okabe_kae, rankine_ka
from geotek.engine.sheet_pile import anchored_sheet_pile, cantilever_sheet_pile, net_pressure

H = 5.0
DK = 0.9 * mononobe_okabe_kae(30, kh=0.2, kv=0.1) - rankine_ka(30)


def _profile(phi=30.0):
    return SoilProfile(id="p", gwt=GroundwaterCondition(depth_insitu=100.0), layers=[
        SoilLayer(id="s", top=0, bottom=40, gamma=18, design=DesignParameters(phi_eff=phi))])


def test_kdyy_increment_by_hand():
    base = net_pressure(_profile(), H, surcharge=10)
    seis = net_pressure(_profile(), H, surcharge=10, seismic_dk=DK, seismic_toe=8.0)
    for depth in (1.0, 3.0, 6.0, 7.5):
        i = int(np.searchsorted(base.z, depth))
        hand = 0.5 * DK * 18 * 8.0 + 2 * DK * 10 * (1 - base.z[i] / 8.0)
        assert seis.active[i] - base.active[i] == pytest.approx(hand, rel=1e-9)
    i = int(np.searchsorted(base.z, 9.0))
    assert seis.active[i] == pytest.approx(base.active[i])


def test_kdyy_toe_iteration_is_a_fixed_point_and_not_smaller_than_static():
    static = cantilever_sheet_pile(_profile(), H, passive_factor=1.5)
    seis = cantilever_sheet_pile(_profile(), H, passive_factor=1.5, seismic_dk=DK)
    assert seis.D0 > static.D0 and seis.M_max > static.M_max
    again = net_pressure(_profile(), H, passive_factor=1.5, seismic_dk=DK, seismic_toe=H + seis.D0)
    # the solved toe satisfies equilibrium with the increment evaluated at that toe
    from geotek.engine.sheet_pile import cumulative_integral
    F = cumulative_integral(again.z, again.net)
    Fz = cumulative_integral(again.z, again.net * again.z)
    toe = H + seis.D0
    assert abs(np.interp(toe, again.z, F) * toe - np.interp(toe, again.z, Fz)) < 1.0


def test_kdyy_anchored_force_exceeds_uniform_h_convention():
    # The KDYY distribution loads the whole wall length, so T grows well above the static value.
    static = anchored_sheet_pile(_profile(), H, 1.0, passive_factor=1.5)
    seis = anchored_sheet_pile(_profile(), H, 1.0, passive_factor=1.5, seismic_dk=DK)
    assert seis.anchor_force > static.anchor_force * 1.15
