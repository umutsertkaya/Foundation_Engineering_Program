import math

import pytest
from pydantic import ValidationError

from geotek.core.errors import GeoTekError
from geotek.core.models.walls import (
    Backfill,
    CantileverGeometry,
    FoundationSoil,
    GravityGeometry,
    WallLoads,
    WallSettings,
)
from geotek.engine.earth_pressure.coefficients import coulomb_ka, mononobe_okabe_kae, rankine_ka
from geotek.engine.stability import SoilBand
from geotek.engine.walls.global_stability import wall_global_stability
from geotek.engine.walls.walls import analyze_cantilever_wall, analyze_gravity_wall

SAND = FoundationSoil(phi=30, gamma=18, overburden=18)


def _gravity():
    return GravityGeometry(height=4, base_width=2.5, top_width=0.6, back_offset=0.0, embedment=1.0)


def test_gravity_wall_hand_calc():
    r = analyze_gravity_wall(_gravity(), Backfill(gamma=18, phi=30, delta=20), SAND)
    pa = 0.5 * 18 * 16 * coulomb_ka(30, 20)
    ph, pv = pa * math.cos(math.radians(20)), pa * math.sin(math.radians(20))
    w = 24 * (2.5 + 0.6) / 2 * 4
    xw = (2.4 * 2.2 + 3.8 * (1.9 * 2 / 3)) / 6.2
    m_r, m_o = w * xw + pv * 2.5, ph * 4 / 3
    assert r.sum_v == pytest.approx(w + pv, rel=1e-4)
    assert r.sum_h == pytest.approx(ph, rel=1e-4)
    assert r.checks["overturning"].value == pytest.approx(m_r / m_o, rel=1e-4)
    assert r.checks["sliding"].value == pytest.approx((w + pv) * math.tan(math.radians(30)) / ph, rel=1e-4)
    assert r.eccentricity == pytest.approx(1.25 - (m_r - m_o) / (w + pv), rel=1e-4)
    assert r.checks["overturning"].required == 2.0
    assert r.checks["overturning"].passed and r.checks["sliding"].passed


def test_cantilever_hand_calc():
    g = CantileverGeometry(stem_height=5.3, stem_top=0.3, stem_bottom=0.5, toe=0.8, heel=2.2,
                           base_thickness=0.7, embedment=1.5)
    r = analyze_cantilever_wall(g, Backfill(gamma=18, phi=32), SAND, WallLoads(surcharge=10))
    ka = rankine_ka(32)
    forces = {f.name: f for f in r.forces}
    assert -forces["Earth pressure"].fx == pytest.approx(0.5 * 18 * 36 * ka, rel=1e-4)
    assert -forces["Surcharge pressure"].fx == pytest.approx(10 * 6 * ka, rel=1e-4)
    assert forces["Earth pressure"].y == pytest.approx(2.0)
    assert forces["Surcharge pressure"].y == pytest.approx(3.0)
    assert -forces["Base slab"].fy == pytest.approx(3.5 * 0.7 * 24)
    assert -forces["Stem"].fy == pytest.approx(0.4 * 5.3 * 24)
    assert -forces["Soil over heel"].fy == pytest.approx(2.2 * 5.3 * 18)
    total_v = 3.5 * 0.7 * 24 + 0.4 * 5.3 * 24 + 2.2 * 5.3 * 18
    assert r.sum_v == pytest.approx(total_v, rel=1e-6)
    # base pressure integrates back to V
    assert (r.q_max + r.q_min) / 2 * 3.5 == pytest.approx(total_v, rel=1e-6)


def test_cantilever_sloping_backfill_virtual_back():
    g = CantileverGeometry(stem_height=4.3, stem_top=0.3, stem_bottom=0.4, toe=0.6, heel=2.0,
                           base_thickness=0.6)
    r = analyze_cantilever_wall(g, Backfill(gamma=18, phi=34, slope=15), SAND)
    hv = 4.9 + 2.0 * math.tan(math.radians(15))
    p = 0.5 * 18 * hv**2 * rankine_ka(34, 15)  # resultant parallel to the slope
    thrust = next(f for f in r.forces if f.name == "Earth pressure")
    assert math.hypot(thrust.fx, thrust.fy) == pytest.approx(p, rel=1e-4)
    assert math.degrees(math.atan2(-thrust.fy, -thrust.fx)) == pytest.approx(15, abs=1e-6)


def test_seismic_case_adds_increment_and_inertia():
    g = _gravity()
    loads = WallLoads(kh=0.2)
    bf = Backfill(gamma=18, phi=30, delta=20)
    st = analyze_gravity_wall(g, bf, SAND, loads)
    eq = analyze_gravity_wall(g, bf, SAND, loads, seismic=True)
    names = {f.name for f in eq.forces}
    assert {"Wall (inertia)", "Seismic increment"} <= names
    p_ae = 0.5 * 18 * 16 * mononobe_okabe_kae(30, 20, 0, 0, 0.2)
    thrust_total = sum(math.hypot(f.fx, f.fy) for f in eq.forces if "pressure" in f.name or "increment" in f.name)
    assert thrust_total == pytest.approx(p_ae, rel=1e-4)
    assert eq.sum_h > st.sum_h
    assert eq.checks["sliding"].required == 1.1


def test_undrained_sliding_and_passive():
    g = _gravity()
    clay = FoundationSoil(drainage="undrained", su=40, gamma=18, overburden=18)
    bf = Backfill(gamma=18, phi=30, delta=20)
    r = analyze_gravity_wall(g, bf, clay)
    b_eff = 2.5 - 2 * abs(r.eccentricity)
    assert r.checks["sliding"].value == pytest.approx(40 * b_eff / r.sum_h, rel=1e-6)
    rp = analyze_gravity_wall(g, bf, clay, settings=WallSettings(use_passive=True))
    assert rp.checks["sliding"].value > r.checks["sliding"].value


def test_resultant_outside_base_fails_bearing():
    g = GravityGeometry(height=6, base_width=1.0, top_width=0.5, back_offset=0.5)
    r = analyze_gravity_wall(g, Backfill(gamma=19, phi=28), SAND, WallLoads(surcharge=20))
    assert not r.passed
    assert not r.checks["overturning"].passed


def test_non_asd_code_is_refused():
    with pytest.raises(GeoTekError, match="ASD"):
        analyze_gravity_wall(_gravity(), Backfill(gamma=18, phi=30), SAND, settings=WallSettings(design_code="ec7"))


def test_geometry_validation():
    with pytest.raises(ValidationError):
        GravityGeometry(height=4, base_width=1.0, top_width=0.8, back_offset=0.5)
    with pytest.raises(ValidationError):
        Backfill(gamma=18, phi=25, slope=30)
    with pytest.raises(ValidationError):
        FoundationSoil(drainage="undrained", gamma=18)


def test_global_stability_sensitivity():
    g = CantileverGeometry(stem_height=5.3, stem_top=0.3, stem_bottom=0.5, toe=0.8, heel=2.2,
                           base_thickness=0.7, embedment=1.5)
    bf = Backfill(gamma=18, phi=32)
    strong, chk = wall_global_stability(g, bf, [SoilBand(top=0, gamma=18, c=60)])
    weak, _ = wall_global_stability(g, bf, [SoilBand(top=0, gamma=18, c=30)])
    assert weak.fs < strong.fs
    assert strong.x_exit <= 0 and strong.x_entry >= g.width  # passes below the whole base
    assert chk.required == 1.5
    quake, chk_eq = wall_global_stability(g, bf, [SoilBand(top=0, gamma=18, c=60)],
                                          WallLoads(kh=0.15), seismic=True)
    assert quake.fs < strong.fs and chk_eq.required == 1.1
