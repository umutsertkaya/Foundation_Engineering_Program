import math

import numpy as np
import pytest

from geotek.core.errors import GeoTekError
from geotek.engine.stability import SlopeModel, SoilBand, SurfaceLoad, bishop, search_critical_circle

H = 10.0


def _slope(c=0.0, phi=30.0, **kw):
    """2H:1V slope from (0, 0) to (20, 10)."""
    return SlopeModel(surface=[(-30, 0), (0, 0), (20, H), (60, H)],
                      layers=[SoilBand(top=H, gamma=19, c=c, phi=phi)], **kw)


def _search(model, **kw):
    return search_critical_circle(model, x_range=(-10, 30), y_range=(H, 4 * H),
                                  tangent_range=(-H, H - 0.5), min_width=1.0, **kw)


def test_cohesionless_slope_tends_to_infinite_slope():
    r = _search(_slope())
    assert r.fs == pytest.approx(math.tan(math.radians(30)) / 0.5, rel=0.01)


def test_phi_zero_circle_matches_closed_form_moment_balance():
    """Vertical cut, circle through the toe with centre (0, 6.2): F = c L R / (W d)."""
    Hc, g, c, yc = 5.0, 20.0, 30.0, 6.2
    model = SlopeModel(surface=[(-40, 0), (0, 0), (1e-6, Hc), (40, Hc)], layers=[SoilBand(top=Hc, gamma=g, c=c)])
    r = bishop(model, 0.0, yc, yc, n_slices=2000)
    x_e = math.sqrt(yc**2 - (yc - Hc) ** 2)
    arc = math.pi / 2 + math.atan2(Hc - yc, x_e)
    resisting = c * yc * arc * yc
    # driving moment = gamma * integral of x (H - y_arc(x)) dx, done analytically
    driving = g * (-(yc - Hc) * x_e**2 / 2 + (yc**3 - (yc**2 - x_e**2) ** 1.5) / 3)
    assert r.fs == pytest.approx(resisting / driving, rel=2e-3)


def test_fs_scales_with_cohesion_when_phi_zero():
    m1 = _slope(c=20, phi=0)
    m2 = _slope(c=40, phi=0)
    r1 = bishop(m1, 10, 25, 20)
    r2 = bishop(m2, 10, 25, 20)
    assert r2.fs == pytest.approx(2 * r1.fs, rel=1e-9)


def test_water_load_and_seismic_reduce_fs():
    base = _search(_slope(c=10, phi=25))
    wet = _search(_slope(c=10, phi=25, water_level=6.0))
    loaded = _search(_slope(c=10, phi=25, loads=[SurfaceLoad(20, 30, 50, 50)]))
    shaken = _search(_slope(c=10, phi=25, kh=0.15))
    assert wet.fs < base.fs and loaded.fs < base.fs and shaken.fs < base.fs


def test_boundary_and_exit_constraints():
    m = _slope(c=10, phi=25)
    assert bishop(m, 10, 200, 230) is None  # arc reaches the model boundary below ground
    r = bishop(m, 10, 25, 20)
    assert r is not None
    assert bishop(m, 10, 25, 20, exit_max=r.x_exit - 1.0) is None
    assert bishop(m, 10, 25, 20, entry_min=r.x_entry + 1.0) is None


def test_slice_output():
    r = bishop(_slope(c=10, phi=25), 10, 25, 20, n_slices=30)
    assert len(r.slices["x"]) == 30
    assert np.all(r.slices["weight"] > 0)


def test_flat_ground_has_no_driving_moment():
    # A symmetric circle on flat ground cancels to round-off; it must not return FS ~ 1e16
    model = SlopeModel(surface=[(0, 10), (40, 10)], layers=[SoilBand(top=10, gamma=18, c=10, phi=25)])
    assert bishop(model, 20, 16, 8) is None
    with pytest.raises(GeoTekError):
        search_critical_circle(model, x_range=(10, 30), y_range=(11, 20), tangent_range=(0, 8))
