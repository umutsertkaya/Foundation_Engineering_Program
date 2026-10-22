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
from geotek.engine.earth_pressure.coefficients import (
    mononobe_okabe_kae, seismic_angle, tbdy_kae_steep, tbdy_seismic_coefficients, TBDY_R,
)
from geotek.engine.earth_pressure.distribution import lateral_pressure
from geotek.engine.earth_pressure.wedge import trial_wedge
from geotek.engine.limit_state import _factor_forces, limit_state_cases, verify_wall_global_stability, verify_wall_layered
from geotek.engine.walls.base import Force, evaluate_checks
from geotek.engine.walls.global_stability import wall_global_stability
from geotek.engine.walls.layered import (
    analyze_wall_layered, bands_from_structure, foundation_from_structure,
    soil_from_basic, wall_forces_layered, wall_pressures_layered,
)
from geotek.engine.walls.walls import analyze_cantilever_wall, analyze_gravity_wall, wall_forces
from geotek.services.walls_basic import BasicWallInput, _foundation, proportion_for


@pytest.mark.parametrize("partial", [False, True])
def test_hand_uplift_overturning_choices(partial, unit_partial_case):
    """Reuse the verification hand case within the authorised E4 unit-test scope."""
    soil = _soil([_layer("upper", 0, 2, phi=30, gamma=18, gamma_sat=20),
                  _layer("lower", 2, 6, phi=20, gamma=19, gamma_sat=21)], retained_water=3)
    code = "ec7" if partial else "asd"
    results = []
    for choice in ("overturning", "resisting"):
        settings = WallSettings(design_code=code, uplift_moment=choice)
        result = (verify_wall_layered(_geometry(), soil, WallLoads(), settings,
                                      seismic=False, approach=None)[0] if partial else
                  analyze_wall_layered(_geometry(), soil, WallLoads(), settings, seismic=False))
        results.append(result)
    assert WallSettings().uplift_moment == "overturning"
    assert results[0].checks["overturning"].value == pytest.approx(
        910.62 / (323.4829896986029 + 156.96), abs=1e-10)
    assert results[1].checks["overturning"].value == pytest.approx(
        (910.62 - 156.96) / 323.4829896986029, abs=1e-10)
    assert results[0].sum_v == results[1].sum_v
    assert results[0].eccentricity == results[1].eccentricity
    assert results[0].q_max == results[1].q_max
    assert results[0].checks["bearing"].value == results[1].checks["bearing"].value


@pytest.mark.parametrize("name,kind,fy,y", [
    ("Uplift", "WA", 10, 0), ("Vertical seismic", "EQ", 10, 0),
    ("Water (front)", "WA", 10, 1), ("Uplift", "DC", 10, 0),
    ("Uplift", "WA", -10, 0), ("Uplift", "WA", 10, 1),
])
def test_uplift_choice_only_reclassifies_upward_base_uplift(name, kind, fy, y):
    from geotek.core.models.walls import FoundationSoil

    forces = [Force("Weight", 0, -200, 2, 0), Force("Earth", -10, 0, 4, 2),
              Force(name, 0, fy, 1, y, kind)]
    foundation = FoundationSoil(phi=30, gamma=19)
    checks = [evaluate_checks(case="static", width=4, forces=forces, passive=None,
                              foundation=foundation, embedment=1, warnings=[],
                              settings=WallSettings(uplift_moment=choice))
              for choice in ("overturning", "resisting")]
    if name == "Uplift" and kind == "WA" and fy > 0 and y == 0:
        assert checks[0].checks["overturning"].value == pytest.approx(400 / 30)
        assert checks[1].checks["overturning"].value == pytest.approx(390 / 20)
    else:
        assert checks[0].checks["overturning"].value == checks[1].checks["overturning"].value
    assert checks[0].eccentricity == checks[1].eccentricity


@pytest.mark.parametrize("choice", ["overturning", "resisting"])
def test_equ_uses_factored_uplift_moment_choice(choice):
    settings = WallSettings(design_code="ec7", uplift_moment=choice, factor_overrides={
        f"{combo}.load.WA": FactorOverride(value=1.1, note="E4 test")
        for combo in ("DA1-C1", "DA1-C2", "EQU")})
    equ = next(a for a in verify_wall_layered(_geometry(), _soil(retained_water=3),
                                             WallLoads(), settings, seismic=False, approach=None)
               if a.case == "EQU")
    uplift = next(f for f in equ.forces if f.name == "Uplift")
    mu = uplift.x * uplift.fy
    mr = -sum(f.x * f.fy for f in equ.forces if f.name != "Uplift")
    mo = -sum(f.y * f.fx for f in equ.forces)
    assert uplift.fy == pytest.approx(1.1 * 58.86)
    expected = mr / (mo + mu) if choice == "overturning" else (mr - mu) / mo
    assert equ.checks["overturning"].value == pytest.approx(expected)


def test_bearing_groundwater_transition_is_continuous_and_monotone():
    B, H, eps = 4.0, 6.0, 1e-7
    depths = [-eps, 0, eps, B / 4, B / 2, 3 * B / 4, B - eps, B, B + eps]
    gammas = [foundation_from_structure(_soil(front_water=H + dw), 5, H, B)[0].gamma
              for dw in depths]
    submerged = 20 - GAMMA_W
    expected = [submerged + min(max(dw / B, 0), 1) * (19 - submerged) for dw in depths]
    assert gammas == pytest.approx(expected, abs=1e-12)
    assert all(a <= b for a, b in zip(gammas, gammas[1:]))
    assert gammas[0] == gammas[1] == pytest.approx(submerged)
    assert gammas[2] == pytest.approx(gammas[1], abs=1e-6)
    assert gammas[-3] == pytest.approx(gammas[-2], abs=1e-6)
    assert gammas[-2] == gammas[-1] == 19


@pytest.mark.parametrize("dw,expected", [(-1, 20 - GAMMA_W), (0, 20 - GAMMA_W), (2, 19), (4, 19)])
def test_bearing_groundwater_transition_can_be_disabled(dw, expected):
    foundation, _ = foundation_from_structure(_soil(front_water=6 + dw), 5, 6, 4,
                                               gwt_bearing_correction=False)
    assert foundation.gamma == pytest.approx(expected)


def test_da1_c2_global_surcharge_factoring_reduces_fs():
    soil, geometry = _soil(), _geometry()
    retained, foundation = bands_from_structure(soil, geometry.height)
    settings, loads = WallSettings(design_code="ec7"), WallLoads(surcharge=30)
    backfill = Backfill(gamma=19, phi=30)
    case = next(c for c in limit_state_cases("ec7") if c.name == "DA1-C2")
    # Both use the same design strengths; only surface action factors differ.
    unfactored, _ = wall_global_stability(
        geometry, backfill, foundation, loads, settings, retained_bands=retained,
        tan_phi_factor=case.tan_phi, cohesion_factor=case.cohesion, required=case.r_global)
    factored = dict(verify_wall_global_stability(
        geometry, backfill, foundation, loads, settings, retained_bands=retained))["DA1-C2"]
    assert math.isfinite(unfactored.fs) and math.isfinite(factored.value)
    assert factored.value * case.r_global < unfactored.fs
    factors = {f.path: f.value for f in factored.factors_used}
    assert factors["DA1-C2.load.Q_unfav"] == case.unfavourable["LS"] > 1
    assert factors["DA1-C2.load.G_unfav"] == case.unfavourable["DC"] == 1


def test_global_load_factors_preserve_characteristic_soil_and_factored_centroid(monkeypatch):
    from geotek.engine.stability import SlipResult, SurfaceLoad
    from geotek.engine.walls import global_stability as engine

    captured, weights_used = [], []
    footprint = engine._footprint_load

    def capture_weights(weights, width):
        weights_used.append(weights)
        return footprint(weights, width)

    def capture(model, **kwargs):
        captured.append(model)
        return SlipResult(fs=2, xc=1, yc=8, radius=10, x_entry=10, x_exit=-2)

    monkeypatch.setattr(engine, "search_critical_circle", capture)
    monkeypatch.setattr(engine, "_footprint_load", capture_weights)
    geometry, soil = _geometry(), _soil()
    retained, foundation = bands_from_structure(soil, geometry.height)
    for factors, qfactor in [(None, 1), ({"DC": 1.2, "EV": 1.5}, 1.3)]:
        wall_global_stability(geometry, Backfill(gamma=19, phi=30), foundation,
                              WallLoads(surcharge=10), retained_bands=retained,
                              footprint_factors=factors, surcharge_factor=qfactor)
    assert captured[0].layers == captured[1].layers
    # The hand geometry's concrete W=102.96, M=170.712; carried dry soil W=266.76, M=720.252.
    assert sum(w for w, x in weights_used[1]) == pytest.approx(1.2 * 102.96 + 1.5 * 266.76)
    assert sum(w * x for w, x in weights_used[1]) == pytest.approx(1.2 * 170.712 + 1.5 * 720.252)
    assert captured[1].loads[-1] == SurfaceLoad(geometry.width, geometry.width + 4 * geometry.height, 13, 13)


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


def _submerged_case(mode, *, water_depth=0.0, water_kh=0.2, fill=None):
    soil = _soil(fill or [_layer("fill", 0, 6)], retained_water=water_depth)
    loads = WallLoads(kh=0.1, kv=0.05, water_kh=water_kh, seismic_increment_height=0.5)
    settings = WallSettings(submerged_seismic=mode)
    return wall_forces_layered(_geometry(), soil, loads, settings, seismic=True)


@pytest.mark.parametrize("mode,kae,increment,water", [
    ("impervious", 0.478923138363240, 22.3118779366562, 0.0),
    ("pervious", 0.461484663757904, 19.2732411751510, 41.202),
])
def test_submerged_tbdy_closed_form(mode, kae, increment, water):
    """H=6, phi=30, gamma=18, gamma_sat=20, gamma_w=9.81, kh=.1, kv=.05.

    gamma*=10.19, static=61.14 kN/m. Impervious: psi=11.6731239102854 deg,
    KAE=.478923138363240, Pt_soil=83.4518779366562, increment=22.3118779366562.
    Pervious: psi=10.5333299100496, KAE=.461484663757904, Pt_soil=80.413241175151,
    increment=19.273241175151; water_kh=.2 -> deltaPsu=41.202 at y=2.4 m.
    Total seismic demands: 22.3118779366562 / 60.475241175151 kN/m.
    """
    result = _submerged_case(mode)
    static = -sum(f.fx for f in result.forces if f.kind == "EH")
    soil_increment = -sum(f.fx for f in result.forces if f.name.startswith("Seismic increment"))
    assert static == pytest.approx(61.14, abs=1e-10)
    assert soil_increment == pytest.approx(kae * 0.95 * 0.5 * 10.19 * 6**2 - static, abs=1e-10)
    assert soil_increment == pytest.approx(increment, abs=1e-10)
    water_forces = [f for f in result.forces if f.name == "Dinamik su itkisi (TBDY Denk. 16.20)"]
    assert len(water_forces) == int(mode == "pervious")
    assert -sum(f.fx for f in water_forces) == pytest.approx(water)
    assert -sum(f.fx for f in result.forces if f.name.startswith("Seismic increment")
                or f in water_forces) == pytest.approx(increment + water, abs=1e-10)


@pytest.mark.parametrize("water_kh,governing", [(0.001, "impervious"), (0.2, "pervious")])
def test_submerged_envelope_compares_soil_plus_water(water_kh, governing):
    branches = {mode: _submerged_case(mode, water_kh=water_kh) for mode in ("impervious", "pervious")}
    envelope = _submerged_case("envelope", water_kh=water_kh)
    def demand(r):
        return -sum(f.fx for f in r.forces if f.kind in ("EH", "EQ"))

    assert demand(envelope) == max(map(demand, branches.values()))
    assert envelope.forces == branches[governing].forces
    assert any(f"seçim: envelope, yöneten: {governing}." in w for w in envelope.warnings)


@pytest.mark.parametrize("k,governing", [(4.999e-4, "impervious"), (5e-4, "pervious"),
                                       (1e-3, "pervious"), (None, "pervious")])
def test_submerged_permeability_classification_and_unknown_fallback(k, governing):
    layer = _layer("fill", 0, 6).model_copy(update={"permeability": k})
    result = _submerged_case("by_permeability", fill=[layer])
    reference = _submerged_case("envelope" if k is None else governing, fill=[layer])
    assert result.forces == reference.forces
    assert any(f"Katman fill: su altı deprem sınıfı {governing}." == w for w in result.warnings)
    assert any("k girilmedi" in w and "envelope" in w for w in result.warnings) == (k is None)


def test_submerged_permeability_is_per_layer_and_water_added_once():
    layers = [_layer("low", 0, 2).model_copy(update={"permeability": 1e-5}),
              _layer("high", 2, 4).model_copy(update={"permeability": 5e-4}),
              _layer("unknown", 4, 6)]
    result = _submerged_case("by_permeability", fill=layers)
    for key, branch in [("low", "impervious"), ("high", "pervious"), ("unknown", "impervious")]:
        assert f"Katman {key}: su altı deprem sınıfı {branch}." in result.warnings
    water = [f for f in result.forces if f.name == "Dinamik su itkisi (TBDY Denk. 16.20)"]
    assert len(water) == 1 and -water[0].fx == pytest.approx(41.202)
    assert any("Karışık geçirgenlik" in w and "doğrulanmamış mühendislik yaklaşımı" in w
               for w in result.warnings)
    soil = _soil(layers, retained_water=0)
    dist = wall_pressures_layered(_geometry(), soil, WallLoads(kh=.1, kv=.05, water_kh=.2),
                                  WallSettings(submerged_seismic="by_permeability"), seismic=True)["retained"]
    for key, numerator, midpoint in [("low", 20, 1), ("high", 18, 3), ("unknown", 20, 5)]:
        lo, hi = midpoint - 1, midpoint + 1
        expected = .95 * mononobe_okabe_kae(30, kh=numerator / 10.19 * .1, kv=.05)
        assert dist.K[(dist.z >= lo) & (dist.z <= hi)][1:-1] == pytest.approx(expected)


@pytest.mark.parametrize("mode", ["impervious", "pervious", "envelope", "by_permeability"])
@pytest.mark.parametrize("water_depth", [6., 100.])
def test_dry_seismic_path_is_bit_identical(mode, water_depth):
    soil, geometry = _soil([_layer("fill", 0, 6)], retained_water=water_depth), _geometry()
    loads = WallLoads(surcharge=10, kh=.1, kv=.05)
    old = lateral_pressure(soil.retained_profile(), 6, method="coulomb", beta=0., theta=0.,
                           layerwise=True, gwt_case="design", delta=0., surcharge=10, kh=.1, kv=.05)
    current = wall_pressures_layered(geometry, soil, loads, WallSettings(submerged_seismic=mode),
                                     seismic=True)["retained"]
    for name in ("z", "K", "sigma_v_eff", "sigma_h_eff", "u", "sigma_h"):
        assert getattr(current, name).tobytes() == getattr(old, name).tobytes()
    assert current.force == old.force and current.z_resultant == old.z_resultant
    baseline = wall_forces_layered(geometry, soil, loads, WallSettings(), seismic=True)
    result = wall_forces_layered(geometry, soil, loads, WallSettings(submerged_seismic=mode), seismic=True)
    assert result.forces == baseline.forces and result.warnings == baseline.warnings


@pytest.mark.parametrize("water_depth", [0., 2.])
def test_dynamic_water_location_and_partial_submergence_warning(water_depth):
    result = _submerged_case("pervious", water_depth=water_depth)
    water = next(f for f in result.forces if f.name == "Dinamik su itkisi (TBDY Denk. 16.20)")
    d_su = 6 - water_depth
    assert (6 - water.y) - water_depth == pytest.approx(.6 * d_su)
    assert water.fx == pytest.approx(-(7 / 12) * .2 * GAMMA_W * d_su**2)
    assert water.fy == 0 and water.kind == "EQ" and water.x == _geometry().width
    warning = ("Kısmen su altındaki dolgu yönetmelik formüllerinin kapsamı dışındadır; "
               "katman bazında mühendislik yargısı uygulandı — sonucu kontrol edin.")
    assert (warning in result.warnings) == (water_depth > 0)
    assert ("Kazı Destek Yapıları Tasarım ve Uygulama Esasları (16.07.2026 değişikliği) "
            "ek şartları kontrol edilmelidir; bu belge yazılımda incelenmedi.") in result.warnings


def test_partial_submergence_keeps_dry_mo_above_water_and_splits_one_layer():
    soil = _soil([_layer("fill", 0, 6)], retained_water=2.)
    dist = wall_pressures_layered(_geometry(), soil, WallLoads(kh=.1, kv=.05, water_kh=.2),
                                  WallSettings(submerged_seismic="impervious"), seismic=True)["retained"]
    dry_k = .95 * mononobe_okabe_kae(30, kh=.1, kv=.05)
    wet_k = .95 * mononobe_okabe_kae(30, kh=20 / 10.19 * .1, kv=.05)
    assert list(dist.z) == [0., 2., 2., 6.]
    assert dist.K == pytest.approx([dry_k, dry_k, wet_k, wet_k])


@pytest.mark.parametrize("phi,delta,theta,kh,kv,expected", [
    (30., 0., 0., .2, 0., .933205),
    (32., 0., 10., .2, .1, 1.112545),
    (35., 0., -5., .25, -.1, .825149),
    (32., 20., 10., .2, .1, 1.394478),
    (30., 20., 0., .2, 0., 1.071063),
])
def test_tbdy_kae_steep_en_e3_reference(phi, delta, theta, kh, kv, expected):
    # Independent EN E.3 notation: psi_EN is measured from horizontal.
    psi_en = math.radians(90 - theta)
    theta_en = math.atan(kh / (1 - kv))
    en_e3 = math.sin(psi_en + math.radians(phi) - theta_en)**2 / (
        math.cos(theta_en) * math.sin(psi_en)**2 * math.sin(psi_en - theta_en - math.radians(delta)))
    assert en_e3 == pytest.approx(expected, abs=1e-5)
    assert tbdy_kae_steep(phi, delta, theta, kh, kv) == pytest.approx(expected, abs=1e-5)
    assert tbdy_kae_steep(phi, delta, theta, kh, kv) == pytest.approx(en_e3, abs=1e-12)


@pytest.mark.parametrize("theta", [0., 10., -5.])
@pytest.mark.parametrize("offset", [0., 1e-10])
def test_tbdy_kae_steep_continuous_at_mo_boundary(theta, offset):
    phi, delta, kh, kv = 30., 20., .2, 0.
    beta = phi - seismic_angle(kh, kv) - offset
    assert mononobe_okabe_kae(phi, delta, theta, beta, kh, kv) == pytest.approx(
        tbdy_kae_steep(phi, delta, theta, kh, kv), abs=1e-5)


@pytest.mark.parametrize("delta", [0., 20.])
def test_tbdy_kae_steep_rejects_nonpositive_denominator(delta):
    with pytest.raises(GeoTekError, match=r"cos\(delta \+ theta \+ psi\) > 0"):
        tbdy_kae_steep(30., delta=delta, theta=45., kh=.8, kv=.4)


@pytest.mark.parametrize("beta", [20., 25., 29.])
def test_steep_distribution_opt_in_is_beta_independent_and_keeps_delta(beta):
    profile = _soil([_layer("fill", 0, 6)]).retained_profile()
    with pytest.raises(GeoTekError, match="M-O has no solution"):
        lateral_pressure(profile, 6, method="coulomb", beta=beta, delta=20., kh=.2)
    dist = lateral_pressure(profile, 6, method="coulomb", beta=beta, delta=20., kh=.2,
                             steep_seismic=True)
    assert dist.K == pytest.approx(tbdy_kae_steep(30, delta=20., kh=.2) * math.cos(math.radians(20.)))
    warnings = [w for w in dist.warnings if "16.24b" in w]
    assert warnings == ["Katman fill: TBDY Denk. 16.24b (β > φ' − ψ) uygulandı."]


def test_steep_opt_in_preserves_mo_inside_domain():
    profile = _soil([_layer("fill", 0, 6)]).retained_profile()
    kwargs = dict(method="coulomb", beta=10., delta=20., theta=5., kh=.2, kv=.1)
    default = lateral_pressure(profile, 6, **kwargs)
    opted_in = lateral_pressure(profile, 6, steep_seismic=True, **kwargs)
    assert opted_in.K.tobytes() == default.K.tobytes()
    assert opted_in.force == default.force and opted_in.warnings == default.warnings


@pytest.mark.parametrize("wall_type", ["cantilever", "gravity"])
def test_steep_eq_vertical_component_keeps_wall_friction(wall_type):
    geometry = (_geometry() if wall_type == "cantilever" else
                GravityGeometry(height=6, base_width=4.6, top_width=0.6, back_offset=0.6, embedment=1))
    soil = _soil([_layer("fill", 0, 6)])
    loads, settings, slope = WallLoads(surcharge=10, kh=.2, kv=.05), WallSettings(), 20.
    diagrams = wall_pressures_layered(geometry, soil, loads, settings, seismic=True, backfill_slope=slope)
    result = wall_forces_layered(geometry, soil, loads, settings, seismic=True, backfill_slope=slope)
    dynamic, static = diagrams["retained"], diagrams["retained_static"]
    pa, pae = static.component("effective")[0], dynamic.component("effective")[0]
    theta = math.atan2(geometry.back_offset, geometry.height) if wall_type == "gravity" else 0.
    delta = math.radians(20.)  # 2*phi/3 for gravity, slope for the cantilever.
    eq = next(f for f in result.forces if f.name.startswith("Seismic increment"))
    assert eq.fx == pytest.approx(-(pae - pa))
    assert eq.fy == pytest.approx(eq.fx * math.tan(delta + theta))
    soil_forces = [f for f in result.forces if f.kind in ("EH", "LS") or f is eq]
    assert sum(f.fy for f in soil_forces) == pytest.approx(-pae * math.tan(delta + theta), abs=1e-10)


def test_steep_eq_inclination_keeps_delta_in_partially_submerged_layer():
    geometry = GravityGeometry(height=6, base_width=4.6, top_width=0.6, back_offset=0.6, embedment=1)
    soil = _soil([_layer("fill", 0, 6)], retained_water=2.)
    loads = WallLoads(surcharge=10, kh=.1, kv=.05)
    settings = WallSettings(submerged_seismic="impervious")
    diagrams = wall_pressures_layered(geometry, soil, loads, settings, seismic=True, backfill_slope=20.)
    dynamic, static = diagrams["retained"], diagrams["retained_static"]
    assert list(dynamic.z) == [0., 2., 2., 6.]
    theta = math.atan2(geometry.back_offset, geometry.height)
    tangent = math.tan(math.radians(20.) + theta)
    result = wall_forces_layered(geometry, soil, loads, settings, seismic=True, backfill_slope=20.)
    eq = next(f for f in result.forces if f.name.startswith("Seismic increment"))
    assert eq.fy == pytest.approx(
        (static.component("effective")[0] - dynamic.component("effective")[0]) * tangent)


@pytest.mark.parametrize("water_depth,kh,kv", [(100., .2, 0.), (0., .1, .05), (2., .1, .05)])
def test_layered_steep_seismic_returns_result_and_tbdy_1624b_warning(water_depth, kh, kv):
    soil = _soil([_layer("fill", 0, 6)], retained_water=water_depth)
    loads = WallLoads(kh=kh, kv=kv, water_kh=.2)
    result = wall_forces_layered(_geometry(), soil, loads, WallSettings(),
                                 seismic=True, backfill_slope=20.)
    assert result.forces
    warnings = [w for w in result.warnings if "16.24b" in w]
    assert len(warnings) == 1
    assert warnings == ["Katman fill: TBDY Denk. 16.24b (β > φ' − ψ) uygulandı."]


@pytest.mark.parametrize("water_depth", [0., 2.])
def test_seismic_with_zero_coefficients_and_submerged_fill_stays_static(water_depth):
    soil, loads, settings = _soil(retained_water=water_depth), WallLoads(), WallSettings()
    static = wall_forces_layered(_geometry(), soil, loads, settings, seismic=False)
    seismic = wall_forces_layered(_geometry(), soil, loads, settings, seismic=True)
    assert seismic.forces == static.forces and seismic.warnings == static.warnings


def test_pervious_requires_explicit_unreduced_water_kh_but_impervious_does_not():
    with pytest.raises(GeoTekError, match=r"water_kh=0.4"):
        _submerged_case("pervious", water_kh=None)
    assert _submerged_case("impervious", water_kh=None).forces


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
@pytest.mark.parametrize("method", ["vesic", "meyerhof"])
def test_undrained_base_total_overburden_and_gross_bearing_load(code, method):
    clay = SoilLayer(id="clay", top=0, bottom=30, gamma=19, gamma_sat=21, behaviour="undrained",
                     design=DesignParameters(su=100))
    # A heel-biased gross resultant makes increasing front head an adverse
    # contact-eccentricity case; its apparent bearing safety must not grow.
    soil = _soil([_layer("fill", 0, 6, phi=45)], layers=[clay])
    overrides = {"load.WA.strength_I": FactorOverride(value=1.0, note="E4 test input")} if code != "asd" else {}
    settings = WallSettings(design_code=code, factor_overrides=overrides, bearing_method=method)
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
            hb = result.sum_h
            assert result.checks["bearing"].value == pytest.approx(result.bearing.Q_ult / gross_v)
            if depth < 6:
                assert gross_v > result.sum_v  # sliding/overturning still include U
        else:
            from geotek.engine.limit_state import _factor_forces, _sums, layered_limit_state_cases
            case = layered_limit_state_cases(settings, water=depth < 6)[0]
            raw = wall_forces_layered(_geometry(), soil, WallLoads(), settings, seismic=False).forces
            unf = _factor_forces(raw, case.unfavourable)
            gross_v = -sum(f.fy for f in unf if f.name != "Uplift")
            net_v, hb, mr, mo = _sums(unf)
            e = 2 - (mr - mo) / net_v
            assert result.bearing.B_eff == pytest.approx(4 - 2 * abs(e))
            assert result.checks["bearing"].value == pytest.approx(result.bearing.Q_ult / (case.r_bearing * gross_v))
        if method == "vesic":
            expected_qult = 5.14 * 100 * 1.1 * (1 - 2 * hb / (result.bearing.B_eff * 100 * 5.14)) + expected_q
        else:
            inclination = (1 - math.degrees(math.atan2(hb, gross_v)) / 90)**2
            expected_qult = (5.14 * 100 * 1.05 + expected_q) * inclination
        assert result.bearing.q_ult == pytest.approx(expected_qult, rel=1e-10)
    assert all(math.isfinite(r.checks["bearing"].value) and r.checks["bearing"].value > 0 for r in results)
    # Water rising from deep to the front ground must not improve undrained bearing. Ponded water
    # above the front ground is a genuine total-stress surcharge and reduces the net horizontal load,
    # so no monotonic trend is required for that case (Meyerhof's inclination factor improves).
    assert results[1].checks["bearing"].value <= results[0].checks["bearing"].value


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


@pytest.mark.parametrize("higher_side", ["retained", "front"])
@pytest.mark.parametrize("water_depth,tops,gammas", [
    (3.0, [0.0, -3.0], [21.0, 23.0]),
    (6.0, [0.0, -3.0], [21.0, 23.0]),
    (8.0, [0.0, -2.0, -3.0], [19.0, 21.0, 23.0]),
    (9.0, [0.0, -3.0], [19.0, 23.0]),
    (100.0, [0.0, -3.0], [19.0, 20.0]),
])
def test_multilayer_foundation_weights_match_bishop_model_water_level(
        monkeypatch, higher_side, water_depth, tops, gammas):
    from geotek.engine.stability import SlipResult
    from geotek.engine.walls import global_stability as global_engine

    soil = _soil(
        fill=[_layer("fill", 0, 6, gamma=17, gamma_sat=20)],
        layers=[_layer("upper-natural", 0, 9, gamma=19, gamma_sat=21),
                _layer("lower-natural", 9, 30, gamma=20, gamma_sat=23)],
        retained_water=water_depth if higher_side == "retained" else 100,
        front_water=water_depth if higher_side == "front" else 100,
    )
    before = soil.model_dump_json()
    retained, foundation = bands_from_structure(soil, 6)
    assert [b.top for b in foundation] == tops
    assert [b.gamma for b in foundation] == gammas
    models = []

    def capture(model, **kwargs):
        models.append(model)
        return SlipResult(fs=2, xc=1, yc=8, radius=10, x_entry=10, x_exit=-2)

    monkeypatch.setattr(global_engine, "search_critical_circle", capture)
    water_level = 6 - min(soil.gwt_retained.depth_for("design"), soil.gwt_front.depth_for("design"))
    global_engine.wall_global_stability(
        _geometry(), Backfill(gamma=17, phi=30), foundation,
        water_level=water_level, retained_bands=retained,
    )
    model = models[0]
    assert model.water_level == 6 - water_depth
    for depth, gamma, gamma_sat in [(7, 19, 21), (8.5, 19, 21), (10, 20, 23)]:
        assert model.band_at(6 - depth).gamma == (gamma_sat if depth > water_depth else gamma)
    # The retained mass keeps its own head when only the front side is wet.
    assert retained[0].gamma == 17
    assert retained[-1].gamma == (20 if higher_side == "retained" and water_depth < 6 else 17)
    assert soil.model_dump_json() == before


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
    (False, 1.7624732507127798),  # pre-E4 1.77138; vertex probing (ENG-B-004) lands on a different search optimum; that critical circle gives 1.76247 in the old code too
    (True, 1.2941297669813243),  # pre-E4 1.29858; now with surface vertices probed (ENG-B-004) and true centroid arm (ENG-B-002)
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


@pytest.mark.parametrize("theta,expected_ph", [(-10.0, 2402.178), (10.0, 1301.449)])
def test_coulomb_passive_horizontal_projection_uses_delta_minus_theta(theta, expected_ph):
    """ENG-B-003: P_h = 1/2 gamma H^2 Kp cos(delta - theta) (passive), hand-derived Kp."""
    d, p, t = math.radians(10), math.radians(35), math.radians(theta)
    root = math.sqrt(math.sin(p + d) * math.sin(p) / (math.cos(d - t) * math.cos(-t)))
    kp = math.cos(p + t) ** 2 / (math.cos(t) ** 2 * math.cos(d - t) * (1 - root) ** 2)
    hand = 0.5 * 18 * 6**2 * kp * math.cos(d - t)
    assert hand == pytest.approx(expected_ph, abs=0.01)
    soil = _soil(layers=[_layer("n", 0, 10, phi=35, gamma=18)])
    dist = lateral_pressure(soil.retained_profile(), 6, state="passive", method="coulomb",
                            delta=10, theta=theta)
    assert dist.force == pytest.approx(hand, rel=1e-6)


def test_coulomb_active_horizontal_projection_unchanged_for_leaning_face():
    d, p, t = math.radians(10), math.radians(35), math.radians(10)
    root = math.sqrt(math.sin(p + d) * math.sin(p) / (math.cos(d + t) * math.cos(t)))
    ka = math.cos(p - t) ** 2 / (math.cos(t) ** 2 * math.cos(d + t) * (1 + root) ** 2)
    soil = _soil(layers=[_layer("n", 0, 10, phi=35, gamma=18)])
    dist = lateral_pressure(soil.retained_profile(), 6, state="active", method="coulomb", delta=10, theta=10)
    assert dist.force == pytest.approx(0.5 * 18 * 36 * ka * math.cos(d + t), rel=1e-6)


def test_trial_wedge_active_unbounded_slope_raises_and_bad_state_raises():
    """ENG-B-001: beta = 25 deg >= phi - psi (30 - 11.31) has no finite critical wedge."""
    with pytest.raises(GeoTekError, match="finite critical wedge"):
        trial_wedge(H=6, gamma=18, phi=30, beta=25, kh=0.2)
    # beta = 0, kh = 0.2: closed-form Mononobe-Okabe K_AE = 0.4733 (hand evaluation, delta = 0)
    res = trial_wedge(H=6, gamma=18, phi=30, kh=0.2)
    psi = math.atan(0.2)
    p = math.radians(30)
    kae = math.cos(p - psi) ** 2 / (math.cos(psi) ** 2 * (1 + math.sqrt(math.sin(p) * math.sin(p - psi) / math.cos(psi))) ** 2)
    assert res.K == pytest.approx(kae, rel=1e-4)
    with pytest.raises(GeoTekError):
        trial_wedge(H=6, gamma=18, phi=30, state="at_rest")


@pytest.mark.parametrize("bad", [
    dict(height=float("inf")), dict(base_width=float("nan")), dict(top_width=float("inf")),
    dict(embedment=3.0), dict(embedment=4.0), dict(embedment=float("inf")),
])
def test_gravity_geometry_rejects_non_finite_and_embedment_not_below_height(bad):
    """ENG-C-006: embedment >= height (3.0 m wall) and non-finite values are invalid."""
    base = dict(height=3.0, base_width=2.0, top_width=0.6)
    base.update(bad)
    with pytest.raises(ValueError):
        GravityGeometry(**base)
    GravityGeometry(height=3.0, base_width=2.0, top_width=0.6, embedment=1.0)


def test_trial_wedge_accepts_the_exact_unbounded_boundary_beta_equals_phi_minus_psi():
    """beta = phi = 30 deg, kh = 0: the limit is finite, K = cos^2(phi) = 0.75 (Rankine-type)."""
    res = trial_wedge(H=6, gamma=18, phi=30, beta=30)
    assert res.K == pytest.approx(math.cos(math.radians(30)) ** 2, rel=2e-2)


def test_wall_analysis_reports_failed_bearing_check_when_horizontal_load_exceeds_capacity(monkeypatch):
    from geotek.engine.walls import base

    def boom(**kwargs):
        from geotek.core.errors import BearingFailureError
        raise BearingFailureError("Horizontal load exceeds the bearing capacity")

    res, failure = base.try_bearing_capacity(boom, B=2)
    assert res is None and "Horizontal load exceeds" in failure
