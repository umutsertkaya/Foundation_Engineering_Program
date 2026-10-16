"""Layered wall forces: independent integrations and legacy compatibility boundaries."""

import math

import numpy as np
import pytest

from geotek.core.constants import GAMMA_W
from geotek.core.errors import GeoTekError, MissingFactorsError
from geotek.core.models.profile import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.core.models.structures import StructureSoilModel
from geotek.core.models.walls import Backfill, CantileverGeometry, GravityGeometry, WallLoads, WallSettings
from geotek.engine.earth_pressure.coefficients import rankine_ka, tbdy_seismic_coefficients, TBDY_R
from geotek.engine.earth_pressure.distribution import lateral_pressure
from geotek.engine.earth_pressure.wedge import trial_wedge
from geotek.engine.limit_state import _factor_forces, verify_wall_layered
from geotek.engine.walls.base import Force
from geotek.engine.walls.layered import (
    analyze_wall_layered, bands_from_structure, foundation_from_structure,
    soil_from_basic, wall_forces_layered, wall_pressures_layered,
)
from geotek.engine.walls.walls import analyze_cantilever_wall, analyze_gravity_wall, wall_forces
from geotek.services.walls_basic import BasicWallInput, _foundation, proportion_for


def _layer(id, top, bottom, phi=30.0, gamma=18.0, gamma_sat=20.0, **kwargs):
    return SoilLayer(id=id, top=top, bottom=bottom, gamma=gamma, gamma_sat=gamma_sat,
                     design=DesignParameters(phi_eff=phi, **kwargs))


def _soil(fill=None, layers=None, retained_water=100.0, front_water=100.0):
    return StructureSoilModel(
        profile=SoilProfile(id="natural", layers=layers or [_layer("natural", 0, 30, phi=30, gamma=19)],
                            gwt=GroundwaterCondition(depth_insitu=100.0)),
        retained_fill=fill or [], gwt_retained=GroundwaterCondition(depth_insitu=retained_water),
        gwt_front=GroundwaterCondition(depth_insitu=front_water),
    )


def _geometry():
    return CantileverGeometry(stem_height=5.4, stem_top=0.3, stem_bottom=0.4,
                               toe=1.0, heel=2.6, base_thickness=0.6, embedment=1.0)


@pytest.mark.parametrize("wall_type", ["cantilever", "gravity"])
@pytest.mark.parametrize("slope", [0.0, 12.0])
@pytest.mark.parametrize("seismic", [False, True])
def test_homogeneous_thrust_matches_trial_wedge(wall_type, slope, seismic):
    inp = BasicWallInput(wall_type=wall_type, height=5, backfill_gamma=18, backfill_phi=32,
                         foundation_gamma=19, foundation_phi=30, backfill_slope=slope)
    geometry = proportion_for(wall_type, 5.0, 4.6, 0.6)
    if wall_type == "gravity":
        geometry = geometry.model_copy(update={"back_offset": 0.5})
    soil = soil_from_basic(inp, 0.6)
    kh, kv = tbdy_seismic_coefficients(0.5, TBDY_R["gravity_80sds_mm"])
    loads = WallLoads(surcharge=10, kh=kh, kv=kv, seismic_increment_height=0.5)
    wf = wall_forces_layered(geometry, soil, loads, WallSettings(), seismic=seismic, backfill_slope=slope)
    hv = geometry.height + (geometry.heel * math.tan(math.radians(slope)) if wall_type == "cantilever" else 0)
    theta = math.degrees(math.atan2(geometry.back_offset, geometry.height)) if wall_type == "gravity" else 0
    delta = 2 * 32 / 3 if wall_type == "gravity" else slope
    expected = trial_wedge(H=hv, gamma=18, phi=32, delta=delta, theta=theta, beta=slope, q=10,
                            kh=kh if seismic else 0.0, kv=kv if seismic else 0.0).force
    pressure = [f for f in wf.forces if f.kind in ("EH", "LS") or f.name.startswith("Seismic increment")]
    assert -sum(f.fx for f in pressure) == pytest.approx(expected * math.cos(math.radians(delta + theta)), rel=1e-4)
    assert -sum(f.fy for f in pressure) == pytest.approx(expected * math.sin(math.radians(delta + theta)), abs=1e-8, rel=1e-4)
    legacy = wall_forces(geometry, Backfill(gamma=18, phi=32, slope=slope), loads, WallSettings(), seismic=seismic)
    for component in ("fx", "fy"):
        assert sum(getattr(f, component) for f in wf.forces) == pytest.approx(
            sum(getattr(f, component) for f in legacy.forces), rel=1e-4, abs=1e-8)
    assert sum(f.moment for f in wf.forces) == pytest.approx(sum(f.moment for f in legacy.forces), rel=1e-4)


@pytest.mark.parametrize("wall_type", ["cantilever", "gravity"])
@pytest.mark.parametrize("seismic", [False, True])
def test_homogeneous_all_external_checks_match_legacy(wall_type, seismic):
    inp = BasicWallInput(wall_type=wall_type, height=5, backfill_gamma=18, backfill_phi=32,
                         foundation_gamma=19, foundation_phi=30, surcharge=10, sds=0.5)
    geometry = proportion_for(wall_type, 5, 4.6, 0.6)
    kh, kv = tbdy_seismic_coefficients(0.5, TBDY_R["gravity_80sds_mm"])
    loads = WallLoads(surcharge=10, kh=kh, kv=kv, seismic_increment_height=0.5)
    settings = WallSettings()
    old_fn = analyze_cantilever_wall if wall_type == "cantilever" else analyze_gravity_wall
    old = old_fn(geometry, Backfill(gamma=18, phi=32), _foundation(inp, 0.6), loads, settings, seismic=seismic)
    new = analyze_wall_layered(geometry, soil_from_basic(inp, 0.6), loads, settings, seismic=seismic)
    for key, check in old.checks.items():
        assert new.checks[key].value == pytest.approx(check.value, rel=1e-4, abs=1e-8)
        assert new.checks[key].required == check.required
        assert new.checks[key].passed == check.passed
    for attr in ("sum_v", "sum_h", "m_resisting", "m_overturning", "eccentricity", "q_max", "q_min"):
        assert getattr(new, attr) == pytest.approx(getattr(old, attr), rel=1e-4, abs=1e-8)


def test_two_layers_closed_form_and_surcharge_split():
    soil = _soil([_layer("upper", 0, 2, phi=30, gamma=18), _layer("lower", 2, 6, phi=20, gamma=19)])
    loads = WallLoads(surcharge=10)
    wf = wall_forces_layered(_geometry(), soil, loads, WallSettings(), seismic=False)
    k1, k2 = math.tan(math.radians(30)) ** 2, math.tan(math.radians(35)) ** 2
    soil_force = 0.5 * k1 * 18 * 2**2 + k2 * (36 * 4 + 0.5 * 19 * 4**2)
    surcharge_force = 10 * (k1 * 2 + k2 * 4)
    assert -sum(f.fx for f in wf.forces if f.kind == "EH") == pytest.approx(soil_force, rel=1e-10)
    assert -sum(f.fx for f in wf.forces if f.kind == "LS") == pytest.approx(surcharge_force, rel=1e-10)
    assert not any(f.kind == "WA" for f in wf.forces)


@pytest.mark.parametrize("gwt_case,water_depth", [("design", 3.0), ("seismic", 2.0), ("insitu", 4.0)])
def test_water_force_lever_and_uplift(gwt_case, water_depth):
    soil = _soil([_layer("fill", 0, 6, phi=30)], retained_water=3)
    soil.gwt_retained = GroundwaterCondition(depth_insitu=4, depth_design=3, depth_seismic=2)
    geom = _geometry()
    wf = wall_forces_layered(geom, soil, WallLoads(), WallSettings(), seismic=False, gwt_case=gwt_case)
    water = next(f for f in wf.forces if f.name == "Water (retained)")
    uplift = next(f for f in wf.forces if f.name == "Uplift")
    head = 6 - water_depth
    assert water.kind == uplift.kind == "WA"
    assert -water.fx == pytest.approx(0.5 * GAMMA_W * head**2, rel=1e-12)
    assert water.y == pytest.approx(head / 3, rel=1e-12)
    assert uplift.fy == pytest.approx(0.5 * GAMMA_W * head * geom.width, rel=1e-12)
    assert uplift.x == pytest.approx(2 * geom.width / 3)


def test_front_head_and_trapezoidal_uplift_even_when_passive_disabled():
    geom = _geometry()
    soil = _soil([_layer("fill", 0, 6)], retained_water=2, front_water=5)
    forces = wall_forces_layered(geom, soil, WallLoads(), WallSettings(), seismic=False).forces
    uplift = next(f for f in forces if f.name == "Uplift")
    front = next(f for f in forces if f.name == "Water (front)")
    uf, ur = GAMMA_W, 4 * GAMMA_W
    assert uplift.fy == pytest.approx((uf + ur) * geom.width / 2)
    assert uplift.x == pytest.approx(geom.width * (uf + 2 * ur) / (3 * (uf + ur)))
    assert front.fx == pytest.approx(GAMMA_W / 2)
    assert front.y == pytest.approx(1 / 3)
    assert not any(f.kind == "PASSIVE" for f in forces)


def test_front_free_water_above_ground_is_kept_with_and_without_passive():
    geom = _geometry()
    soil = _soil([_layer("fill", 0, 6)], retained_water=3, front_water=4)
    for enabled in (False, True):
        settings = WallSettings(use_passive=enabled)
        forces = wall_forces_layered(geom, soil, WallLoads(), settings, seismic=False).forces
        water = next(f for f in forces if f.name == "Water (front)")
        assert water.fx == pytest.approx(0.5 * GAMMA_W * 2**2)
        assert water.y == pytest.approx(2 / 3)
        diagrams = wall_pressures_layered(geom, soil, WallLoads(), settings, seismic=False)
        assert diagrams["front_water"].force == pytest.approx(water.fx)
        assert diagrams["front"].component("water")[0] == pytest.approx(1.5 * GAMMA_W)


def test_heel_weights_use_layer_total_weights_at_water_table():
    geom = _geometry()
    soil = _soil([_layer("upper", 0, 2, gamma=18, gamma_sat=20),
                  _layer("lower", 2, 6, gamma=19, gamma_sat=21)], retained_water=3)
    ev = [f for f in wall_forces_layered(geom, soil, WallLoads(), WallSettings(), seismic=False).forces
          if f.kind == "EV"]
    assert -sum(f.fy for f in ev) == pytest.approx(2.6 * (2 * 18 + 19 + 2.4 * 21), rel=1e-12)
    assert -sum(f.fy * f.y for f in ev) == pytest.approx(2.6 * (2 * 18 * 5 + 19 * 3.5 + 2.4 * 21 * 1.8))


def test_front_overburden_removes_excavation_and_uses_front_water():
    soil = _soil([_layer("fill", 0, 6, gamma=15)], retained_water=1, front_water=5.5)
    foundation, _ = foundation_from_structure(soil, 5.0, 6.0, 4.0)
    assert foundation.overburden == pytest.approx(19 * 0.5 + (20 - GAMMA_W) * 0.5)
    assert foundation.gamma == pytest.approx(20 - GAMMA_W)
    dry = soil.model_copy(update={"gwt_front": GroundwaterCondition(depth_insitu=100)})
    assert foundation_from_structure(dry, 5.4, 6, 4)[0].overburden == pytest.approx(11.4)


def test_base_layer_and_weaker_layer_warning_within_B():
    natural = [_layer("overburden", 0, 6, phi=40, gamma=17),
               _layer("base", 6, 7, phi=30, gamma=19), _layer("weak", 7, 30, phi=20, gamma=19)]
    soil = _soil(layers=natural)
    foundation, warnings = foundation_from_structure(soil, 5, 6, 4)
    assert foundation.phi == 30 and foundation.gamma == 19
    assert foundation.overburden == pytest.approx(17)
    assert any("weak" in w and "iki tabakalı" in w for w in warnings)
    assert not foundation_from_structure(soil, 5, 6, 0.5)[1]


def test_passive_uses_front_layers_and_is_only_added_to_sliding():
    geom = _geometry()
    natural = [_layer("above", 0, 5.4, phi=25, gamma=17), _layer("below", 5.4, 30, phi=30, gamma=19)]
    soil = _soil(fill=[_layer("fill", 0, 6, phi=35, gamma=18)], layers=natural)
    on = WallSettings(use_passive=True, passive_reduction=0.4)
    off = WallSettings()
    expected = lateral_pressure(soil.front_profile(), 1, top=5, state="passive", layerwise=True)
    wf = wall_forces_layered(geom, soil, WallLoads(), on, seismic=False)
    passive = next(f for f in wf.forces if f.kind == "PASSIVE")
    assert passive.fx == pytest.approx(expected.component("effective")[0] * 0.4)
    assert passive.y == pytest.approx(1 - expected.component("effective")[1])
    a = analyze_wall_layered(geom, soil, WallLoads(), off, seismic=False)
    b = analyze_wall_layered(geom, soil, WallLoads(), on, seismic=False)
    assert b.checks["sliding"].value > a.checks["sliding"].value
    assert b.checks["overturning"].value == a.checks["overturning"].value
    assert b.eccentricity == a.eccentricity


def test_virtual_plane_maps_layer_boundaries_and_extends_top_layer():
    geom = _geometry()
    soil = _soil([_layer("upper", 0, 2, phi=30), _layer("lower", 2, 6, phi=25)])
    slope = 10.0
    rise = geom.heel * math.tan(math.radians(slope))
    dist = wall_pressures_layered(geom, soil, WallLoads(), WallSettings(), seismic=False,
                                  backfill_slope=slope)["retained"]
    assert dist.z[-1] == pytest.approx(6 + rise)
    at = np.flatnonzero(np.isclose(dist.z, 2 + rise))
    assert len(at) == 2 and dist.K[at[0]] != dist.K[at[1]]
    assert dist.sigma_v_eff[at[0]] == pytest.approx((2 + rise) * 18)


def test_bands_keep_fill_out_of_foundation_and_use_structure_elevations():
    soil = _soil([_layer("upper", 0, 2, phi=35), _layer("lower", 2, 6, phi=25)], retained_water=3)
    retained, foundation = bands_from_structure(soil, 6)
    assert [b.top for b in retained] == [6, 4, 3]
    assert [b.phi for b in retained] == [35, 25, 25]
    assert foundation[0].top == 0 and foundation[0].phi == 30
    assert [b.gamma for b in retained] == [18, 18, 20]


def test_global_model_uses_retained_bands_and_preserves_legacy_none(monkeypatch):
    from geotek.engine.stability import SlipResult, SoilBand
    from geotek.engine.walls import global_stability as global_engine

    models = []

    def capture(model, **kwargs):
        models.append(model)
        return SlipResult(fs=2.0, xc=1, yc=8, radius=10, x_entry=10, x_exit=-2)

    monkeypatch.setattr(global_engine, "search_critical_circle", capture)
    geom = _geometry()
    backfill = Backfill(gamma=18, phi=32)
    foundation = [SoilBand(top=0, gamma=19, c=0, phi=30)]
    global_engine.wall_global_stability(geom, backfill, foundation)
    global_engine.wall_global_stability(geom, backfill, foundation, retained_bands=None)
    assert models[0].surface == models[1].surface
    assert models[0].layers == models[1].layers
    assert models[0].loads == models[1].loads
    bands = [SoilBand(top=6, gamma=17, phi=35), SoilBand(top=4, gamma=20, c=4, phi=20)]
    global_engine.wall_global_stability(geom, backfill, foundation, retained_bands=bands)
    assert models[-1].band_at(5).phi == 35
    assert models[-1].band_at(3).phi == 20
    assert models[-1].band_at(-1).phi == 30
    assert models[-1].loads != models[0].loads


def test_mixed_undrained_retained_layer_uses_total_stress_without_double_water():
    upper = _layer("upper", 0, 2, phi=30, gamma=18)
    lower = SoilLayer(id="clay", top=2, bottom=6, gamma=19, gamma_sat=21, behaviour="undrained",
                      design=DesignParameters(su=20))
    soil = _soil([upper, lower], retained_water=3)
    wf = wall_forces_layered(_geometry(), soil, WallLoads(), WallSettings(), seismic=False)
    # Lower total pressure rises from max(36-40,0)=0 to 36+19+3*21-40=78.
    # Tension cutoff z=2+4/19; below z=3 the pressure slope is gamma_sat=21.
    expected_lower = 0.5 * 15 * (1 - 4 / 19) + (15 + 78) * 3 / 2
    assert -sum(f.fx for f in wf.forces if f.kind == "EH") == pytest.approx(12 + expected_lower, rel=1e-10)
    assert not any(f.name == "Water (retained)" for f in wf.forces)
    with pytest.raises(GeoTekError, match="seismic undrained"):
        wall_forces_layered(_geometry(), soil, WallLoads(kh=0.1), WallSettings(), seismic=True)


@pytest.mark.parametrize("kind", ["UNKNOWN", "WA", "PASSIVE"])
def test_unknown_or_unmapped_load_kind_raises(kind):
    with pytest.raises(GeoTekError, match="load factor"):
        _factor_forces([Force("test", -1, 0, 0, 1, kind)], {"DC": 1.0})


def test_layered_partial_design_requires_explicit_WA():
    soil = _soil([_layer("fill", 0, 6)], retained_water=3)
    with pytest.raises(MissingFactorsError) as error:
        verify_wall_layered(_geometry(), soil, WallLoads(), WallSettings(design_code="ec7"),
                             seismic=False, approach="DA1")
    assert {m.path for m in error.value.missing} == {
        "DA1-C1.load.WA", "DA1-C2.load.WA", "EQU.load.WA"}


def test_absent_design_parameters_are_not_invented():
    bad = _layer("bad", 0, 6)
    bad.design.phi_eff = None
    with pytest.raises(GeoTekError, match="phi"):
        wall_forces_layered(_geometry(), _soil([bad]), WallLoads(), WallSettings(), seismic=False)
