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


def test_reversed_slope_gives_explicit_direction_error():
    bands = [SoilBand(top=20, gamma=18, c=15, phi=20)]
    normal = SlopeModel(surface=[(0, 0), (10, 0), (20, 10), (40, 10)], layers=bands)
    reversed_ = SlopeModel(surface=[(0, 10), (20, 10), (30, 0), (40, 0)], layers=bands)
    domain = dict(x_range=(0, 40), y_range=(12, 30), tangent_range=(-8, 0))
    assert search_critical_circle(normal, **domain).fs > 1.0
    with pytest.raises(GeoTekError, match="mirror the x coordinates"):
        search_critical_circle(reversed_, **domain)


def test_seismic_moment_arm_uses_layered_column_centroid():
    """ENG-B-002: two bands with a heavy lower band; arm = true weight centroid, not mid-height."""
    model = SlopeModel(surface=[(-30, 0), (0, 0), (20, 10), (50, 10)],
                       layers=[SoilBand(top=10, gamma=10, c=10, phi=20), SoilBand(top=3, gamma=30, c=10, phi=20)],
                       kh=0.2)
    xc, yc, R = 5.0, 15.0, math.sqrt(250)
    r = bishop(model, xc, yc, R, n_slices=160)
    assert r.fs == pytest.approx(1.2113, abs=5e-4)  # report reference (old mid-height arm: 1.2228)
    assert abs(r.fs - 1.2228) > 5e-3

    # Independent check of the column integrals for one slice at x = 10: surface 5, arc bottom 0.
    ybot, ytop = 0.0, 5.0
    w = 30.0 * (3 - 0) + 10.0 * (5 - 3)               # 110 kPa
    m = 30.0 * (3**2 - 0) / 2 + 10.0 * (5**2 - 3**2) / 2  # 135 + 80 = 215
    assert model.column_weight(ybot, ytop) == pytest.approx(w)
    assert model.column_moment(ybot, ytop) == pytest.approx(m)
    assert m / w == pytest.approx(1.9545, abs=1e-4)   # centroid, vs mid-height 2.5


def test_seismic_surface_load_inertia_acts_at_surface():
    """Surface load inertia arm is yc - ytop (larger moment than at mid-height of the column)."""
    base = dict(surface=[(-30, 0), (0, 0), (20, 10), (50, 10)], layers=[SoilBand(top=10, gamma=18, c=10, phi=20)])
    loaded = SlopeModel(**base, loads=[SurfaceLoad(x1=10, x2=50, q1=30, q2=30)], kh=0.2)
    still = SlopeModel(**base, loads=[SurfaceLoad(x1=10, x2=50, q1=30, q2=30)], kh=0.0)
    a = bishop(loaded, 5, 15, math.sqrt(250), n_slices=80)
    b = bishop(still, 5, 15, math.sqrt(250), n_slices=80)
    assert a.fs < b.fs


def test_circle_reemerging_at_a_narrow_surface_notch_is_rejected():
    """ENG-B-004: the arc rises above a 0.2 m wide notch between two surface vertices.

    Circle centre (0, 10), R = 10: arc bottom y = 10 - sqrt(100 - x^2); at x = 5 it is 1.34.
    The surface sits at y = 1.0 only in the notch x in [4.9, 5.1] (< one probe spacing), so
    the arc is above the ground at the notch vertices while below it everywhere else.
    """
    surface = [(-20, 5), (4.8, 5), (4.9, 1.0), (5.1, 1.0), (5.2, 5), (20, 5)]
    model = SlopeModel(surface=surface, layers=[SoilBand(top=5, gamma=18, c=5, phi=25)])
    # arc at x=4.9..5.1 is 1.28..1.34 > 1.0 (re-emerged); elsewhere ybot < 5
    assert 10 - math.sqrt(100 - 4.9**2) > 1.0
    assert 10 - math.sqrt(100 - 5.1**2) > 1.0
    from geotek.engine.stability import _slip_interval
    assert _slip_interval(model, 0.0, 10.0, 10.0, n_probe=40) is None
