"""Shear key (kayma dişi): hand-calculation regression for the basic, layered and partial-factor paths.

Reference wall (all paths): cantilever, stem 5.3 m (0.3 m top / 0.5 m bottom), toe 0.8 m, heel 2.2 m,
base 0.7 m thick, front soil D = 1.5 m, backfill phi 32 / 18 kN/m3, 10 kPa surcharge, foundation
phi 30 / 18 kN/m3. Key: heel, 0.5 m wide, 0.6 m deep.
"""

import math

import pytest
from pydantic import ValidationError

from geotek.core.models.profile import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.core.models.structures import StructureSoilModel
from geotek.core.models.walls import (
    Backfill, CantileverGeometry, FoundationSoil, GravityGeometry, ShearKey, WallLoads, WallSettings,
)
from geotek.core.warning_codes import parse_warning
from geotek.engine.earth_pressure.coefficients import rankine_kp
from geotek.engine.limit_state import limit_state_cases, verify_wall, verify_wall_layered
from geotek.engine.walls.layered import analyze_wall_layered, wall_forces_layered
from geotek.engine.walls.walls import analyze_cantilever_wall, analyze_gravity_wall, wall_forces

KEY = ShearKey(position="heel", width=0.5, depth=0.6)
BACKFILL = Backfill(gamma=18, phi=32)
SAND = FoundationSoil(phi=30, gamma=18, overburden=27)
LOADS = WallLoads(surcharge=10)
TAN30 = math.tan(math.radians(30))


def _wall(key=KEY, **kwargs):
    return CantileverGeometry(stem_height=5.3, stem_top=0.3, stem_bottom=0.5, toe=0.8, heel=2.2,
                              base_thickness=0.7, embedment=1.5, key=key, **kwargs)


def _hand():
    """Independent hand numbers (kN/m, kNm/m)."""
    ka = math.tan(math.radians(45 - 16)) ** 2
    ph = 0.5 * 18 * 6**2 * ka + 10 * 6 * ka                      # virtual back, H = 6.0 m
    v0 = 3.5 * 0.7 * 24 + 0.4 * 5.3 * 24 + 2.2 * 5.3 * 18       # slab + stem + soil over heel
    v_key = 24 * 0.5 * 0.6
    pp_full = 0.5 * 3 * 18 * (2.1**2 - 1.5**2)                   # Kp = 3 for phi = 30
    arm = (81 * 0.6 * 0.3 + 0.5 * 32.4 * 0.6 * 0.4) / pp_full  # rectangle + triangle, below the base
    return ph, v0, v_key, pp_full, arm


# --- model -------------------------------------------------------------------------------


def test_key_spans_and_validation():
    assert ShearKey(position="toe", width=0.5, depth=0.6).span(3.5) == (0.0, 0.5)
    assert ShearKey(position="heel", width=0.5, depth=0.6).span(3.5) == (3.0, 3.5)
    assert ShearKey(position="middle", width=0.5, depth=0.6).span(3.5) == (1.5, 2.0)
    with pytest.raises(ValidationError):
        _wall(ShearKey(width=3.6, depth=0.5))
    with pytest.raises(ValidationError):
        ShearKey(width=0.5, depth=0)
    with pytest.raises(ValidationError):
        GravityGeometry(height=4, base_width=2.5, top_width=0.6, key=ShearKey(width=2.6, depth=0.5))


def test_default_geometry_has_no_key():
    assert _wall(None).key is None
    assert CantileverGeometry.model_validate(_wall(None).model_dump()).key is None


# --- basic path (ASD) ------------------------------------------------------------------------


def test_key_none_reproduces_old_result_and_depth_zero_converges():
    base = analyze_cantilever_wall(_wall(None), BACKFILL, SAND, LOADS)
    ph, v0, _, _, _ = _hand()
    assert base.shear_key is None and base.checks["sliding"].detail == "V tan(30) + c_a B'"
    assert base.checks["sliding"].value == pytest.approx(v0 * TAN30 / ph, rel=1e-6)
    thin = analyze_cantilever_wall(_wall(ShearKey(width=0.5, depth=1e-6)), BACKFILL, SAND, LOADS)
    assert thin.checks["sliding"].value == pytest.approx(base.checks["sliding"].value, rel=1e-5)
    assert thin.sum_v == pytest.approx(base.sum_v, rel=1e-6)
    assert thin.shear_key.passive_full == pytest.approx(0.0, abs=1e-3)


def test_hand_calculation_base_surface_governs():
    ph, v0, v_key, pp, arm = _hand()
    r = analyze_cantilever_wall(_wall(), BACKFILL, SAND, LOADS)
    k = r.shear_key
    assert k.passive_full == pytest.approx(58.32, rel=1e-9) and pp == pytest.approx(58.32)
    assert k.passive_used == pytest.approx(29.16, rel=1e-9) and k.reduction == 0.5
    assert k.arm == pytest.approx(arm, rel=1e-9)
    assert k.demand_v == pytest.approx(58.32, rel=1e-9)
    assert k.demand_m == pytest.approx(58.32 * arm, rel=1e-9)
    v = v0 + v_key
    assert r.sum_v == pytest.approx(v, rel=1e-9)
    # (a) base surface: V tan(delta_b) + reduced passive; (b) key tip: (V + soil beside key) tan(phi) + passive
    assert k.fs_base_surface == pytest.approx((v * TAN30 + 29.16) / ph, rel=1e-6)
    assert k.fs_deep_surface == pytest.approx(((v + 18 * 3.0 * 0.6) * TAN30 + 29.16) / ph, rel=1e-6)
    assert k.governing == "base" and k.fs_with_key == k.fs_base_surface
    assert r.checks["sliding"].value == pytest.approx(k.fs_with_key)
    assert k.fs_without_key == pytest.approx(v0 * TAN30 / ph, rel=1e-6)
    assert k.fs_with_key > k.fs_without_key
    assert "governing surface: base" in r.checks["sliding"].detail
    assert any(parse_warning(w)[0] == "walls.warning.shear_key_bearing" for w in r.warnings)
    passive = [f for f in r.forces if f.name == "Shear key passive"]
    assert len(passive) == 1 and passive[0].fx == pytest.approx(29.16) and passive[0].y == pytest.approx(-arm)


def test_deep_surface_governs_when_base_friction_exceeds_soil_friction():
    ph, v0, v_key, pp, _ = _hand()
    foundation = SAND.model_copy(update={"delta_base": 40.0})
    r = analyze_cantilever_wall(_wall(), BACKFILL, foundation, LOADS)
    k = r.shear_key
    v = v0 + v_key
    assert k.fs_base_surface == pytest.approx((v * math.tan(math.radians(40)) + 29.16) / ph, rel=1e-6)
    assert k.governing == "deep" and k.fs_deep_surface < k.fs_base_surface
    assert r.checks["sliding"].value == pytest.approx(k.fs_deep_surface)
    # the key-less wall uses delta_b = 40 only; the tip plane is the more conservative one
    assert k.fs_with_key < k.fs_without_key
    assert any(parse_warning(w)[0] == "walls.warning.shear_key_reduces_sliding" for w in r.warnings)


def test_undrained_foundation_uses_su_on_both_surfaces():
    foundation = FoundationSoil(drainage="undrained", su=50, gamma=18, overburden=27)
    r = analyze_cantilever_wall(_wall(), BACKFILL, foundation, LOADS)
    ph, _, _, _, _ = _hand()
    pp_full = 0.5 * 18 * (2.1**2 - 1.5**2) + 2 * 50 * 0.6
    k = r.shear_key
    assert k.passive_full == pytest.approx(pp_full, rel=1e-9)
    b_eff = 3.5 - 2 * abs(r.eccentricity)
    assert k.fs_base_surface == pytest.approx((50 * b_eff + 0.5 * pp_full) / ph, rel=1e-3)
    assert k.fs_deep_surface == pytest.approx(k.fs_base_surface, rel=1e-9)


@pytest.mark.parametrize("position,x0", [("toe", 0.0), ("middle", 1.5), ("heel", 3.0)])
def test_positions_move_weight_and_passive_not_the_passive_magnitude(position, x0):
    key = ShearKey(position=position, width=0.5, depth=0.6)
    wf = wall_forces(_wall(key), BACKFILL, LOADS, WallSettings(), seismic=False)
    weight = next(f for f in wf.forces if f.name == "Shear key")
    assert weight.fy == pytest.approx(-24 * 0.5 * 0.6) and weight.x == pytest.approx(x0 + 0.25)
    assert weight.y == pytest.approx(-0.3)
    r = analyze_cantilever_wall(_wall(key), BACKFILL, SAND, LOADS)
    passive = next(f for f in r.forces if f.name == "Shear key passive")
    assert passive.x == pytest.approx(x0) and r.shear_key.passive_full == pytest.approx(58.32)
    assert r.shear_key.position == position


def test_toe_passive_is_added_on_both_surfaces_when_used():
    ph, v0, v_key, _, _ = _hand()
    settings = WallSettings(use_passive=True)
    r = analyze_cantilever_wall(_wall(), BACKFILL, SAND, LOADS, settings)
    toe = 0.5 * 0.5 * 3 * 18 * 1.5**2
    v = v0 + v_key
    assert r.shear_key.fs_base_surface == pytest.approx((v * TAN30 + toe + 29.16) / ph, rel=1e-6)
    assert r.shear_key.fs_deep_surface == pytest.approx(
        ((v + 32.4) * TAN30 + toe + 29.16) / ph, rel=1e-6)


def test_seismic_adds_key_inertia_and_gravity_wall_supports_a_key():
    loads = WallLoads(surcharge=10, kh=0.2, kv=0.1)
    wf = wall_forces(_wall(), BACKFILL, loads, WallSettings(), seismic=True)
    assert any(f.name == "Shear key (inertia)" and f.fx == pytest.approx(-0.2 * 7.2) for f in wf.forces)
    gravity = GravityGeometry(height=4, base_width=2.5, top_width=0.6, embedment=1.0,
                              key=ShearKey(position="middle", width=0.4, depth=0.5))
    r = analyze_gravity_wall(gravity, Backfill(gamma=18, phi=30, delta=20), SAND)
    plain = analyze_gravity_wall(gravity.model_copy(update={"key": None}),
                                 Backfill(gamma=18, phi=30, delta=20), SAND)
    assert r.shear_key.passive_full == pytest.approx(0.5 * 3 * 18 * (1.5**2 - 1.0**2), rel=1e-9)
    assert r.shear_key.fs_without_key == pytest.approx(plain.checks["sliding"].value)
    assert r.checks["sliding"].value > plain.checks["sliding"].value


# --- partial-factor path ------------------------------------------------------------------------


def test_ec7_basic_matches_design_value_hand_calc():
    results = verify_wall(_wall(), BACKFILL, SAND, LOADS, WallSettings(design_code="ec7"), approach="DA2")
    cases = limit_state_cases("ec7", approach="DA2")
    plain = verify_wall(_wall(None), BACKFILL, SAND, LOADS, WallSettings(design_code="ec7"), approach="DA2")
    checked = 0
    for result, case, base in zip((r for r in results if r.case != "EQU"), cases,
                                  (r for r in plain if r.case != "EQU")):
        k = result.shear_key
        phi_d = math.degrees(math.atan(TAN30 / case.tan_phi))
        pp_d = 0.5 * rankine_kp(phi_d) * 18 * (2.1**2 - 1.5**2)       # unreduced design passive
        term = case.passive_participation * pp_d / case.r_passive
        h, v = result.sum_h, result.sum_v
        assert k.passive_full == pytest.approx(pp_d, rel=1e-9)
        assert k.fs_base_surface == pytest.approx(
            (v * math.tan(math.radians(phi_d)) / case.r_sliding + term) / h, rel=1e-9)
        v_deep = v + case.stabilising["EV"] * 18 * 3.0 * 0.6
        assert k.fs_deep_surface == pytest.approx(
            (v_deep * math.tan(math.radians(phi_d)) / case.r_sliding + term) / h, rel=1e-9)
        assert result.checks["sliding"].value == pytest.approx(k.fs_with_key)
        assert k.fs_without_key == pytest.approx(base.checks["sliding"].value)
        checked += 1
    assert checked == len(cases) >= 1


# --- layered path --------------------------------------------------------------------------------


def _soil(phi=30.0, gamma=19.0, layers=None, water=100.0):
    layer = SoilLayer(id="s", top=0, bottom=30, gamma=gamma, gamma_sat=gamma + 2,
                      design=DesignParameters(phi_eff=phi))
    return StructureSoilModel(
        profile=SoilProfile(id="p", layers=layers or [layer], gwt=GroundwaterCondition(depth_insitu=100.0)),
        retained_fill=[], gwt_retained=GroundwaterCondition(depth_insitu=water),
        gwt_front=GroundwaterCondition(depth_insitu=water))


def _layered_geometry(key=KEY):
    return CantileverGeometry(stem_height=5.4, stem_top=0.3, stem_bottom=0.4, toe=1.0, heel=2.6,
                              base_thickness=0.6, embedment=1.0, key=key)


def test_layered_key_passive_and_sliding_hand_calc():
    geometry = _layered_geometry()
    settings = WallSettings()
    r = analyze_wall_layered(geometry, _soil(), WallLoads(), settings, seismic=False)
    k = r.shear_key
    pp = 0.5 * 3 * 19 * (1.6**2 - 1.0**2)   # sigma_p = Kp gamma z on the excavated front, z from D to D + d
    assert k.passive_full == pytest.approx(pp, rel=1e-6)
    assert k.passive_used == pytest.approx(0.5 * pp, rel=1e-6)
    assert k.arm == pytest.approx(
        (3 * 19 * 1.0 * 0.6 * 0.3 + 0.5 * 3 * 19 * 0.6 * 0.6 * 0.4) / pp, rel=1e-6)
    h, v = r.sum_h, r.sum_v
    assert k.fs_base_surface == pytest.approx((v * TAN30 + 0.5 * pp) / h, rel=1e-6)
    assert geometry.width == pytest.approx(4.0)
    # soil beside the key between the base and the key tip: (B - b) * gamma * d
    assert k.fs_deep_surface == pytest.approx(((v + (4.0 - 0.5) * 19 * 0.6) * TAN30 + 0.5 * pp) / h, rel=1e-6)
    plain = analyze_wall_layered(_layered_geometry(None), _soil(), WallLoads(), settings, seismic=False)
    assert k.fs_without_key == pytest.approx(plain.checks["sliding"].value)
    assert k.fs_with_key > k.fs_without_key
    assert plain.shear_key is None


def test_layered_key_depth_zero_converges_and_stronger_layer_under_key_is_used():
    thin = analyze_wall_layered(_layered_geometry(ShearKey(width=0.5, depth=1e-6)), _soil(), WallLoads(),
                                WallSettings(), seismic=False)
    plain = analyze_wall_layered(_layered_geometry(None), _soil(), WallLoads(), WallSettings(), seismic=False)
    assert thin.checks["sliding"].value == pytest.approx(plain.checks["sliding"].value, rel=1e-5)
    # weaker sand below 6.3 m: the key tip (z = 6.6) sits in it, the base (z = 6.0) does not
    layers = [SoilLayer(id="a", top=0, bottom=6.3, gamma=19, gamma_sat=21, design=DesignParameters(phi_eff=34)),
              SoilLayer(id="b", top=6.3, bottom=30, gamma=19, gamma_sat=21, design=DesignParameters(phi_eff=22))]
    r = analyze_wall_layered(_layered_geometry(), _soil(layers=layers), WallLoads(), WallSettings(), seismic=False)
    assert r.shear_key.fs_deep_surface < r.shear_key.fs_base_surface
    assert r.shear_key.governing == "deep"


def test_layered_water_above_key_tip_warns():
    r = analyze_wall_layered(_layered_geometry(), _soil(water=5.0), WallLoads(), WallSettings(), seismic=False)
    codes = [parse_warning(w) for w in r.warnings]
    assert ("walls.warning.shear_key_water", {"depth": 5.0}) in codes


def test_layered_ec7_uses_design_values_and_participation():
    settings = WallSettings(design_code="ec7")
    results = verify_wall_layered(_layered_geometry(), _soil(), WallLoads(), settings, seismic=False,
                                  approach="DA2")
    plain = verify_wall_layered(_layered_geometry(None), _soil(), WallLoads(), settings, seismic=False,
                                approach="DA2")
    cases = limit_state_cases("ec7", approach="DA2")
    keyed = [r for r in results if r.case != "EQU"]
    assert len(keyed) == len(cases)
    for result, case, base in zip(keyed, cases, (r for r in plain if r.case != "EQU")):
        k = result.shear_key
        phi_d = math.degrees(math.atan(TAN30 / case.tan_phi))
        pp_d = 0.5 * rankine_kp(phi_d) * 19 * (1.6**2 - 1.0**2)
        assert k.passive_full == pytest.approx(pp_d, rel=1e-6)
        term = case.passive_participation * 0.5 * pp_d / case.r_passive   # layered path keeps settings reduction
        assert k.fs_base_surface == pytest.approx(
            (result.sum_v * math.tan(math.radians(phi_d)) / case.r_sliding + term) / result.sum_h, rel=1e-6)
        assert k.fs_without_key == pytest.approx(base.checks["sliding"].value)
        assert result.checks["sliding"].value == pytest.approx(k.fs_with_key)
    assert any(r.case == "EQU" for r in results) == any(r.case == "EQU" for r in plain)


def test_layered_forces_expose_key_without_changing_toe_passive_lookup():
    wf = wall_forces_layered(_layered_geometry(), _soil(), WallLoads(), WallSettings(use_passive=True),
                             seismic=False)
    assert wf.key is not None
    assert [f.name for f in wf.forces if f.kind == "PASSIVE"] == ["Passive (front)"]
    assert next(f for f in wf.forces if f.name == "Shear key").fy == pytest.approx(-24 * 0.5 * 0.6)


# --- services and API contract ---------------------------------------------------------------------


def test_basic_service_sizes_and_checks_with_a_key():
    from geotek.services.walls_basic import BasicWallInput, check_wall, size_wall

    inp = BasicWallInput(wall_type="cantilever", height=5.0, backfill_gamma=18.0, backfill_phi=32.0,
                         foundation_phi=30.0, foundation_gamma=19.0, surcharge=10.0, include_global_stability=False)
    plain = size_wall(inp)
    keyed = size_wall(inp.model_copy(update={"shear_key": ShearKey(position="heel", width=0.4, depth=0.5)}))
    assert keyed.geometry.key == ShearKey(position="heel", width=0.4, depth=0.5)
    assert keyed.geometry.width <= plain.geometry.width
    codes = {a.code for a in keyed.assumptions}
    assert {"wall.shear_key_passive", "wall.shear_key_surfaces", "wall.shear_key_demands"} <= codes
    assert not ({a.code for a in plain.assumptions} - {None}) & codes
    checked = check_wall(inp, keyed.geometry)
    assert checked.analyses["static"].shear_key.fs_with_key == pytest.approx(
        keyed.analyses["static"].shear_key.fs_with_key)


def test_structure_service_result_dto_carries_key_rows():
    from geotek.api.calculation_results import wall_result
    from geotek.core.models.project import Project, ProjectMeta
    from geotek.core.models.structures import RetainingWallStructure, WallDesignInputs
    from geotek.engine.walls.layered import soil_from_basic
    from geotek.services.structures import check_structure, size_structure
    from geotek.services.walls_basic import BasicWallInput, proportion_for

    basic = BasicWallInput(wall_type="cantilever", height=5.0, backfill_gamma=18.0, backfill_phi=32.0,
                           foundation_phi=30.0, foundation_gamma=19.0, surcharge=10.0, sds=0.5)
    key = ShearKey(position="heel", width=0.4, depth=0.5)
    geometry = proportion_for("cantilever", 5, 4.6, 0.6, key=key)
    structure = RetainingWallStructure(
        id="wall", wall_type="cantilever", height=5, embedment=0.6, geometry=geometry,
        soil=soil_from_basic(basic, 0.6), inputs=WallDesignInputs(surcharge=10, sds=0.5,
                                                                  include_global_stability=False),
        settings=WallSettings(design_code="asd"), analysis_level="basic")
    project = Project(meta=ProjectMeta(name="key"), structures=[structure])
    result = check_structure(project, "wall")
    dto = wall_result("wall", result, result.result_hash)
    assert {row.case for row in dto.shear_key} == {"static", "seismic"}
    row = next(r for r in dto.shear_key if r.case == "static")
    assert row.position == "heel" and row.governing in ("base", "deep")
    assert row.fs_with_key == pytest.approx(
        next(c.value for c in dto.checks if c.case == "static" and c.name == "sliding"))
    assert row.fs_with_key > row.fs_without_key and row.demand_v > 0 and row.demand_m > 0
    assert any(a.code == "wall.shear_key_passive" for a in dto.assumptions)
    assert any(f.name == "Shear key passive" for f in dto.forces["static"])
    assert dto.geometry.key == key
    # sizing keeps the user's key on every candidate width
    sized = size_structure(project, "wall")
    assert sized.geometry.key == key
    unkeyed = structure.model_copy(update={"geometry": geometry.model_copy(update={"key": None})})
    plain_project = Project(meta=ProjectMeta(name="x"), structures=[unkeyed])
    plain = check_structure(plain_project, "wall")
    assert wall_result("wall", plain, plain.result_hash).shear_key == []


def test_fingerprint_of_key_less_walls_is_unchanged():
    import json
    from geotek.services.structures import _fingerprint
    from geotek.core.models.project import Project, ProjectMeta
    from geotek.core.models.structures import RetainingWallStructure, WallDesignInputs
    from geotek.engine.walls.layered import soil_from_basic
    from geotek.services.walls_basic import BasicWallInput, proportion_for

    basic = BasicWallInput(wall_type="cantilever", height=5.0, backfill_gamma=18.0, backfill_phi=32.0,
                           foundation_phi=30.0, foundation_gamma=19.0)
    structure = RetainingWallStructure(
        id="w", wall_type="cantilever", height=5, embedment=0.6, geometry=proportion_for("cantilever", 5, 4.6, 0.6),
        soil=soil_from_basic(basic, 0.6), inputs=WallDesignInputs(), settings=WallSettings())
    project = Project(meta=ProjectMeta(name="f"), structures=[structure])
    before = _fingerprint(project, structure, "asd")
    keyed = structure.model_copy(update={"geometry": structure.geometry.model_copy(update={"key": KEY})})
    assert _fingerprint(project, keyed, "asd") != before
    assert "key" not in json.dumps(structure.geometry.model_dump(mode="json", exclude={"key"}))
