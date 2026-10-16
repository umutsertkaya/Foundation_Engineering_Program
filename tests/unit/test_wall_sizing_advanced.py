"""Advanced-level sizing must reproduce the basic-level result when given the same inputs."""

import math

import pytest

from geotek.core.errors import GeoTekError
from geotek.core.models.walls import Backfill, FoundationSoil, WallLoads, WallSettings
from geotek.engine.earth_pressure.coefficients import TBDY_R, tbdy_seismic_coefficients
from geotek.engine.stability import SoilBand
from geotek.services.walls_advanced import check_wall_advanced, size_wall_advanced
from geotek.services.walls_basic import BasicWallInput, check_wall, size_wall

BASIC = BasicWallInput(wall_type="cantilever", height=5.0, backfill_gamma=18.0, backfill_phi=32.0,
                       foundation_phi=30.0, foundation_gamma=19.0, surcharge=10.0, sds=0.5)


@pytest.fixture(scope="module")
def basic():
    return size_wall(BASIC)


def _advanced_inputs():
    D = 0.6
    kh, kv = tbdy_seismic_coefficients(0.5, TBDY_R["gravity_80sds_mm"])
    foundation = FoundationSoil(phi=30.0, gamma=19.0, overburden=19.0 * D,
                                delta_base=math.degrees(math.atan(min(math.tan(math.radians(30.0)), 0.6))))
    loads = WallLoads(surcharge=10.0, kh=kh, kv=kv, seismic_increment_height=0.5)
    return D, Backfill(gamma=18.0, phi=32.0), foundation, loads


def test_advanced_sizing_matches_basic(basic):
    D, backfill, foundation, loads = _advanced_inputs()
    r = size_wall_advanced("cantilever", 5.0, backfill, foundation, loads,
                           WallSettings(design_code="asd", bearing_method="vesic"), embedment=D,
                           include_seismic=True, foundation_bands=[SoilBand(top=0.0, gamma=19.0, c=0.0, phi=30.0)])
    assert r.passed
    assert r.geometry.width == pytest.approx(basic.geometry.width) == pytest.approx(4.60)
    assert r.governing == basic.governing == "seismic:bearing"
    assert {c for c, _ in r.result.global_stability} == {"static", "seismic"}


def test_check_wall_on_sized_and_narrower_geometry(basic):
    ok = check_wall(BASIC, basic.geometry)
    assert ok.passed and set(ok.slip_results) == {"static", "seismic"}
    narrow = basic.geometry.model_copy(update={"heel": basic.geometry.heel - 0.05})
    bad = check_wall(BASIC, narrow)
    assert not bad.passed and "seismic:bearing" in bad.governing


def test_check_wall_advanced_merges_cases():
    D, backfill, foundation, loads = _advanced_inputs()
    geom = size_wall(BASIC).geometry
    r = check_wall_advanced(geom, backfill, foundation, loads, WallSettings(design_code="asd"), include_seismic=True)
    assert [a.case for a in r.analyses] == ["static", "seismic"]


def test_advanced_sizing_refuses_missing_factors():
    D, backfill, foundation, loads = _advanced_inputs()
    with pytest.raises(GeoTekError, match="eksik"):
        size_wall_advanced("cantilever", 5.0, backfill, foundation, loads, WallSettings(design_code="tbdy2018"),
                           embedment=D, include_seismic=True, approach="TBDY")
