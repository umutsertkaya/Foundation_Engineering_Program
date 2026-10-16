"""Layered wall forces: independent integrations and legacy compatibility boundaries."""

import math

import numpy as np
import pytest

from geotek.config.codes import FactorOverride
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
from geotek.engine.walls.global_stability import wall_global_stability
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


@pytest.mark.parametrize("code", ["asd", "ec7"])
def test_front_dominant_water_rejected_by_layered_adapters(code):
    soil = _soil([_layer("fill", 0, 6, phi=40, gamma=10)], front_water=0)
    overrides = {f"{case}.load.WA": FactorOverride(value=1.0, note="E4 test input")
                 for case in ("DA1-C1", "DA1-C2", "EQU")} if code == "ec7" else {}
    settings = WallSettings(design_code=code, factor_overrides=overrides)
    message = "Önden baskın yatay yük: ters yönde kayma/devrilme tahkiki bu sürümde yok"
    if code == "asd":
        with pytest.raises(GeoTekError, match=message):
            analyze_wall_layered(_geometry(), soil, WallLoads(), settings, seismic=False)
    with pytest.raises(GeoTekError, match=message):
        verify_wall_layered(_geometry(), soil, WallLoads(), settings, seismic=False, approach=None)


def test_exactly_balanced_horizontal_actions_are_rejected(monkeypatch):
    from geotek.engine.walls import layered
    from geotek.engine.walls.walls import WallForces

    forces = [Force("Weight", 0, -500, 2, 0), Force("Back", -10, 0, 4, 2, "EH"),
              Force("Water (front)", 10, 0, 0, 1, "WA")]
    monkeypatch.setattr(layered, "wall_forces_layered", lambda *args, **kwargs: WallForces(forces, 4, 1, []))
    with pytest.raises(GeoTekError, match="Önden baskın yatay yük"):
        analyze_wall_layered(_geometry(), _soil(), WallLoads(), WallSettings(), seismic=False)


def test_ponded_front_water_loads_undrained_passive_boundary_once():
    clay = SoilLayer(id="clay", top=0, bottom=30, gamma=19, gamma_sat=21, behaviour="undrained",
                     design=DesignParameters(su=25))
    soil = _soil([_layer("fill", 0, 6)], layers=[clay], front_water=4)
    settings = WallSettings(use_passive=True, passive_reduction=0.4)
    diagrams = wall_pressures_layered(_geometry(), soil, WallLoads(), settings, seismic=False)
    front = diagrams["front"]  # ground z=5; ponded head = 5-4 = 1 m
    np.testing.assert_allclose(front.sigma_v_eff, [GAMMA_W, GAMMA_W + 21], atol=1e-10)
    np.testing.assert_allclose(front.sigma_h_eff, [GAMMA_W + 50, GAMMA_W + 71], atol=1e-10)
    assert np.all(front.u == 0)
    # Only free water z=4..5 is a separate horizontal force; soil z=5..6
    # already includes water in its total-stress pressure.
    assert diagrams["front_water"].force == pytest.approx(GAMMA_W / 2)
    forces = wall_forces_layered(_geometry(), soil, WallLoads(), settings, seismic=False).forces
    passive = next(f for f in forces if f.kind == "PASSIVE")
    water = next(f for f in forces if f.name == "Water (front)")
    assert passive.fx == pytest.approx(0.4 * (GAMMA_W + 50 + 21 / 2))
    assert water.fx == pytest.approx(GAMMA_W / 2)
    assert water.y == pytest.approx(4 / 3)


@pytest.mark.parametrize("top_width", [1.0, 3.5])
def test_front_water_normal_to_actual_gravity_face(top_width):
    geometry = GravityGeometry(height=6, base_width=4, top_width=top_width, back_offset=0.5, embedment=1)
    soil = _soil([_layer("fill", 0, 6)], front_water=4)
    forces = wall_forces_layered(geometry, soil, WallLoads(), WallSettings(), seismic=False).forces
    front = next(f for f in forces if f.name == "Water (front)")
    a = (4 - 0.5 - top_width) / 6
    fx = GAMMA_W * 2**2 / 2
    assert front.fx == pytest.approx(fx)
    assert front.fy == pytest.approx(-a * fx)
    assert front.y == pytest.approx(2 / 3)
    assert front.x == pytest.approx(a * 2 / 3)
    assert front.moment == pytest.approx(-(1 + a**2) * fx * 2 / 3)


@pytest.mark.parametrize("code", ["asd", "aashto_lrfd"])
def test_undrained_base_total_overburden_and_gross_bearing_load(code):
    clay = SoilLayer(id="clay", top=0, bottom=30, gamma=19, gamma_sat=21, behaviour="undrained",
                     design=DesignParameters(su=100))
    # A heel-biased gross resultant makes increasing front head an adverse
    # contact-eccentricity case; its apparent bearing safety must not grow.
    soil = _soil([_layer("fill", 0, 6, phi=45)], layers=[clay])
    overrides = {"load.WA.strength_I": FactorOverride(value=1.0, note="E4 test input")} if code != "asd" else {}
    settings = WallSettings(design_code=code, factor_overrides=overrides)
    results = []
    for depth, expected_q in [(100.0, 19.0), (5.0, 21.0), (4.0, 21.0 + GAMMA_W)]:
        soil.gwt_front = GroundwaterCondition(depth_insitu=depth)
        fd, _ = foundation_from_structure(soil, 5, 6, 4)
        assert fd.drainage == "undrained"
        assert fd.overburden == pytest.approx(expected_q)
        result = verify_wall_layered(_geometry(), soil, WallLoads(), settings,
                                     seismic=False, approach=None)[0]
        assert result.bearing is not None
        assert result.bearing.factors["Nq"] == 1
        assert result.bearing.factors["Ngamma"] == 0
        results.append(result)
        if code == "asd":
            gross_v = -sum(f.fy for f in result.forces if f.name != "Uplift" and f.kind != "PASSIVE")
            assert result.checks["bearing"].value == pytest.approx(result.bearing.Q_ult / gross_v)
            if depth < 6:
                assert gross_v > result.sum_v  # sliding/overturning still include U
        else:
            from geotek.engine.limit_state import _factor_forces, _sums, layered_limit_state_cases
            case = layered_limit_state_cases(settings, water=depth < 6)[0]
            raw = wall_forces_layered(_geometry(), soil, WallLoads(), settings, seismic=False).forces
            unf = _factor_forces(raw, case.unfavourable)
            gross_v = -sum(f.fy for f in unf if f.name != "Uplift")
            net_v, _, mr, mo = _sums(unf)
            e = 2 - (mr - mo) / net_v
            assert result.bearing.B_eff == pytest.approx(4 - 2 * abs(e))
            assert result.checks["bearing"].value == pytest.approx(result.bearing.Q_ult / (case.r_bearing * gross_v))
    assert all(math.isfinite(r.checks["bearing"].value) and r.checks["bearing"].value > 0 for r in results)
    assert results[1].checks["bearing"].value <= results[0].checks["bearing"].value
    assert results[2].checks["bearing"].value <= results[1].checks["bearing"].value


@pytest.mark.parametrize("retained_depth,front_depth,tops,gammas", [
    (3.0, 100.0, [0.0], [20.0]),
    (7.0, 10.0, [0.0, -1.0], [19.0, 20.0]),
    (10.0, 7.0, [0.0, -1.0], [19.0, 20.0]),
])
def test_foundation_band_weights_use_bishop_water_envelope(retained_depth, front_depth, tops, gammas):
    soil = _soil([_layer("fill", 0, 6)], retained_water=retained_depth, front_water=front_depth)
    _, bands = bands_from_structure(soil, 6)
    assert [b.top for b in bands] == tops
    assert [b.gamma for b in bands] == gammas


def test_two_layer_dry_seismic_thrust_uses_each_layers_coefficient():
    from geotek.engine.earth_pressure.coefficients import mononobe_okabe_kae

    soil = _soil([_layer("upper", 0, 2, phi=32, gamma=18), _layer("lower", 2, 6, phi=25, gamma=19)])
    loads = WallLoads(surcharge=10, kh=0.1, kv=0.05, seismic_increment_height=0.5)
    forces = wall_forces_layered(_geometry(), soil, loads, WallSettings(), seismic=True).forces
    k1 = 0.95 * mononobe_okabe_kae(32, kh=0.1, kv=0.05)
    k2 = 0.95 * mononobe_okabe_kae(25, kh=0.1, kv=0.05)
    expected = k1 * (18 * 2**2 / 2 + 10 * 2) + k2 * ((36 + 10) * 4 + 19 * 4**2 / 2)
    thrusts = [f for f in forces if f.kind in ("EH", "LS") or f.name.startswith("Seismic increment")]
    assert -sum(f.fx for f in thrusts) == pytest.approx(expected, rel=1e-10)
    assert len([f for f in thrusts if f.name.startswith("Seismic increment")]) == 2
    assert all(f.y == pytest.approx(3) for f in thrusts if f.kind == "EQ")
    assert not any(f.kind == "WA" for f in forces)


def test_layered_gravity_wall_keeps_layer_directions_and_application_points():
    from geotek.engine.earth_pressure.coefficients import coulomb_ka

    geometry = GravityGeometry(height=6, base_width=4, top_width=1, back_offset=0.5, embedment=1)
    soil = _soil([_layer("upper", 0, 2, phi=30, gamma=18), _layer("lower", 2, 6, phi=25, gamma=19)])
    result = analyze_wall_layered(geometry, soil, WallLoads(), WallSettings(), seismic=False)
    forces = [f for f in result.forces if f.kind == "EH"]
    theta = math.degrees(math.atan(0.5 / 6))
    for force, phi, integral in zip(forces, [30, 25], [18 * 2**2 / 2, 36 * 4 + 19 * 4**2 / 2]):
        angle = math.radians(2 * phi / 3 + theta)
        expected = coulomb_ka(phi, delta=2 * phi / 3, theta=theta) * math.cos(angle) * integral
        assert -force.fx == pytest.approx(expected, rel=1e-10)
        assert force.fy == pytest.approx(force.fx * math.tan(angle))
        assert force.x == pytest.approx(4 - force.y * 0.5 / 6)
    assert len(forces) == 2
    assert all(math.isfinite(c.value) for c in result.checks.values())


def test_sloping_layered_backfill_water_uses_shifted_virtual_plane_head():
    geometry = _geometry()
    soil = _soil([_layer("upper", 0, 2, phi=32), _layer("lower", 2, 6, phi=25)], retained_water=3)
    loads, settings = WallLoads(), WallSettings()
    rise = geometry.heel * math.tan(math.radians(10))
    diagrams = wall_pressures_layered(geometry, soil, loads, settings, seismic=False, backfill_slope=10)
    dist = diagrams["retained"]
    assert dist.z[-1] == pytest.approx(6 + rise)
    assert any(np.isclose(dist.z, 3 + rise))
    assert dist.u[-1] == pytest.approx(3 * GAMMA_W)
    forces = wall_forces_layered(geometry, soil, loads, settings, seismic=False, backfill_slope=10).forces
    water = next(f for f in forces if f.name == "Water (retained)")
    assert water.fx == pytest.approx(-GAMMA_W * 3**2 / 2)
    assert water.y == pytest.approx(1)
    assert water.x == geometry.width
    assert water.fy == 0
    earth = [f for f in forces if f.kind == "EH"]
    assert -sum(f.fx for f in earth) == pytest.approx(dist.component("effective")[0])
    assert sum(f.fy for f in earth) == pytest.approx(sum(f.fx for f in earth) * math.tan(math.radians(10)))


def test_layered_bishop_fs_is_finite_and_weaker_retained_band_reduces_it():
    soil = _soil([_layer("upper", 0, 2, phi=35), _layer("lower", 2, 6, phi=30)])
    retained, foundation = bands_from_structure(soil, 6)
    from geotek.engine.stability import SoilBand
    weak = [retained[0], SoilBand(top=retained[1].top, gamma=retained[1].gamma, phi=8)]
    args = (_geometry(), Backfill(gamma=18, phi=35), foundation, WallLoads(surcharge=10), WallSettings())
    strong_slip, _ = wall_global_stability(*args, retained_bands=retained)
    weak_slip, _ = wall_global_stability(*args, retained_bands=weak)
    assert math.isfinite(strong_slip.fs) and strong_slip.fs > 0
    assert math.isfinite(weak_slip.fs) and 0 < weak_slip.fs < strong_slip.fs


def test_frozen_legacy_default_two_layer_lateral_pressure():
    # Frozen from the existing hand case; no E4 kwargs and no live expected-value solver.
    soil = _soil([_layer("upper", 0, 2, phi=30, gamma=18, gamma_sat=20),
                  _layer("lower", 2, 6, phi=20, gamma=19, gamma_sat=21)], retained_water=3)
    dist = lateral_pressure(soil.retained_profile(), 6)
    assert dist.force == pytest.approx(184.0397535671462, rel=1e-12)
    assert dist.z_resultant == pytest.approx(4.242320023643254, rel=1e-12)


@pytest.mark.parametrize("seismic,expected", [
    (False, None),  # FILL: frozen pre-E4 BASIC B=4.60 static Bishop FS
    (True, None),  # FILL: frozen pre-E4 BASIC B=4.60 seismic Bishop FS
])
def test_frozen_legacy_global_default_basic_B460(seismic, expected):
    from geotek.engine.stability import SoilBand
    geometry = proportion_for("cantilever", 5, 4.6, 0.6)
    kh, kv = tbdy_seismic_coefficients(0.5, TBDY_R["gravity_80sds_mm"])
    loads = WallLoads(surcharge=10, kh=kh, kv=kv, seismic_increment_height=0.5)
    slip, _ = wall_global_stability(
        geometry, Backfill(gamma=18, phi=32), [SoilBand(top=0, gamma=19, c=0, phi=30)],
        loads, WallSettings(), seismic=seismic,
    )  # retained_bands intentionally omitted: freeze the legacy default path.
    assert math.isfinite(slip.fs) and slip.fs > 0
    if expected is None:
        pytest.skip(f"FILL frozen {'seismic' if seismic else 'static'} FS from pre-E4 run; current={slip.fs:.17g}")
    assert slip.fs == pytest.approx(expected, rel=1e-12)


@pytest.fixture
def unit_partial_case(monkeypatch):
    """Unit factors isolate layered verification from code-specific factor tables."""
    from types import SimpleNamespace
    from geotek.engine import limit_state

    factors = {kind: 1.0 for kind in ("DC", "EV", "EH", "LS", "WA", "EQ")}
    case = SimpleNamespace(name="unit", stabilising=factors, unfavourable=factors,
                           tan_phi=1.0, cohesion=1.0, su=1.0, e_limit=1 / 6,
                           r_sliding=1.0, r_passive=1.0, passive_participation=1.0,
                           r_overturning=1.0, r_bearing=1.0, factors_used=[])
    monkeypatch.setattr(limit_state, "layered_design_code",
                        lambda settings: SimpleNamespace(approach="partial", combinations=[]))
    monkeypatch.setattr(limit_state, "required_layered_inputs", lambda *a, **kw: [])
    monkeypatch.setattr(limit_state, "layered_limit_state_cases", lambda *a, **kw: [case])
    monkeypatch.setattr(limit_state, "_design_structure_soil", lambda soil, case: soil)


@pytest.mark.parametrize("horizontal", [0.0, -1.0])
@pytest.mark.parametrize("partial", [False, True])
def test_reverse_or_zero_horizontal_load_rejected(monkeypatch, unit_partial_case, horizontal, partial):
    from types import SimpleNamespace
    from geotek.engine.walls import layered

    forces = [Force("Wall", 0, -500, 2, 2, "DC"),
              Force("Water (front)", -horizontal, 0, 0, 1, "WA")]
    monkeypatch.setattr(layered, "wall_forces_layered", lambda *a, **kw:
                        SimpleNamespace(forces=forces, width=4.0, embedment=1.0, warnings=[]))
    message = "Önden baskın yatay yük: ters yönde kayma/devrilme tahkiki bu sürümde yok"
    with pytest.raises(GeoTekError) as error:
        if partial:
            verify_wall_layered(_geometry(), _soil(), WallLoads(), WallSettings(),
                                seismic=False, approach="unit")
        else:
            analyze_wall_layered(_geometry(), _soil(), WallLoads(), WallSettings(), seismic=False)
    assert str(error.value) == message


def test_front_water_dominant_real_loading_rejected():
    soil = _soil([_layer("fill", 0, 6, phi=45)], front_water=0)
    for verify in (False, True):
        with pytest.raises(GeoTekError, match="Önden baskın yatay yük"):
            if verify:
                verify_wall_layered(_geometry(), soil, WallLoads(), WallSettings(),
                                    seismic=False, approach=None)
            else:
                analyze_wall_layered(_geometry(), soil, WallLoads(), WallSettings(), seismic=False)


def test_ponded_front_water_loads_undrained_boundary_once():
    clay = SoilLayer(id="clay", top=0, bottom=30, gamma=20, gamma_sat=20,
                     behaviour="undrained", design=DesignParameters(su=25))
    soil = _soil([_layer("fill", 0, 6)], layers=[clay], front_water=4)
    settings = WallSettings(use_passive=True, passive_reduction=1.0)
    diagrams = wall_pressures_layered(_geometry(), soil, WallLoads(), settings, seismic=False)
    front = diagrams["front"]
    # Ground z=5, GWT z=4: p(top)=gamma_w+2su, p(base)=gamma_w+20+2su.
    assert front.sigma_v_eff[0] == pytest.approx(GAMMA_W)
    assert front.sigma_h_eff[-1] == pytest.approx(GAMMA_W + 20 + 50)
    assert front.component("effective")[0] == pytest.approx(GAMMA_W + 10 + 50)
    assert front.component("water")[0] == 0.0
    forces = wall_forces_layered(_geometry(), soil, WallLoads(), settings, seismic=False).forces
    water = next(f for f in forces if f.name == "Water (front)")
    assert water.fx == pytest.approx(0.5 * GAMMA_W)  # Only the exposed pond, z=4..5.
    assert water.y == pytest.approx(4 / 3)
    assert next(f for f in forces if f.kind == "PASSIVE").fx == pytest.approx(GAMMA_W + 60)
    # The distribution extension is opt-in; legacy/default callers stay unchanged.
    legacy = lateral_pressure(soil.front_profile(), 1, top=5, state="passive", layerwise=True)
    assert legacy.sigma_v_eff[0] == 0.0
    assert legacy.component("effective")[0] == pytest.approx(60)
    foundation, _ = foundation_from_structure(soil, 5, 6, 4)
    assert foundation.overburden == pytest.approx(20 + GAMMA_W)


@pytest.mark.parametrize("front_batter", [0.0, 0.4])
def test_gravity_front_water_normal_force_and_centroid(front_batter):
    geom = GravityGeometry(height=6, base_width=4.6, top_width=0.6,
                           back_offset=4.0 - 6 * front_batter, embedment=1)
    soil = _soil([_layer("fill", 0, 6)], front_water=4)
    forces = wall_forces_layered(geom, soil, WallLoads(), WallSettings(), seismic=False).forces
    water = next(f for f in forces if f.name == "Water (front)")
    fx, y = 2 * GAMMA_W, 2 / 3
    assert water.fx == pytest.approx(fx)
    assert water.fy == pytest.approx(-front_batter * fx)
    assert water.x == pytest.approx(front_batter * y)
    assert water.y == pytest.approx(y)
    assert water.moment == pytest.approx(-fx * y * (1 + front_batter**2))


@pytest.mark.parametrize("partial", [False, True])
def test_undrained_bearing_uses_gross_load_and_front_total_stress(monkeypatch, unit_partial_case, partial):
    from geotek.engine import limit_state
    from geotek.engine.walls import layered

    engine = limit_state if partial else layered
    original = engine.bearing_capacity
    bearing_inputs = []

    def capture(**kwargs):
        bearing_inputs.append(kwargs)
        return original(**kwargs)

    monkeypatch.setattr(engine, "bearing_capacity", capture)
    clay = SoilLayer(id="clay", top=0, bottom=30, gamma=20, gamma_sat=20,
                     behaviour="undrained", design=DesignParameters(su=100))
    geom = _geometry().model_copy(update={"toe": 2.6, "heel": 1.0})
    settings = WallSettings()
    results = []
    for head in (5.8, 5.2):
        soil = _soil([_layer("fill", 0, 6, phi=40)], layers=[clay], front_water=head)
        foundation, _ = foundation_from_structure(soil, 5, 6, geom.width)
        assert foundation.overburden == pytest.approx(20)
        if partial:
            result = verify_wall_layered(geom, soil, WallLoads(), settings,
                                         seismic=False, approach="unit")[0]
        else:
            result = analyze_wall_layered(geom, soil, WallLoads(), settings, seismic=False)
        assert result.bearing is not None
        gross_v = -sum(f.fy for f in result.forces if f.name != "Uplift")
        assert bearing_inputs[-1]["V"] == pytest.approx(gross_v)
        assert bearing_inputs[-1]["q"] == pytest.approx(20)
        results.append(result)
    # Raising water within total-stress clay must not improve bearing safety.
    assert results[1].checks["bearing"].value <= results[0].checks["bearing"].value + 1e-10
    assert results[1].sum_v < results[0].sum_v  # Uplift still enters the other checks.
    assert results[1].eccentricity != results[0].eccentricity
