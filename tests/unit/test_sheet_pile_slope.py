"""G1: sloping ground and surcharge basis for sheet piles; wall path checked against the wedge.

Hand values (phi = 30 deg, beta = 10 deg, gamma = 18 kN/m3, H = 5 m, dry sand):
  Rankine-beta  Ka = cos b (cos b - sqrt(cos^2 b - cos^2 phi)) / (cos b + sqrt(...)) = 0.34952
  resultant     Pa = 1/2 * 18 * 25 * 0.34952 = 78.64 kN/m (parallel to the slope)
  horizontal    Pa cos b = 77.45 kN/m
  surcharge     q per horizontal length: P_q = Ka q H; per inclined area: Ka q H / cos b
                (Das, Principles of Foundation Engineering Ch. 7, vertical face a = 0).
"""

import math

import pytest

from geotek.api.jobs import error_from_exception
from geotek.core.errors import GeoTekError, SlopeError
from geotek.core.models import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.core.models.project import Project, ProjectMeta
from geotek.core.models.structures import SheetPileStructure, StructureSoilModel
from geotek.engine.earth_pressure.coefficients import (
    coulomb_ka, mononobe_okabe_kae, rankine_ka, rankine_kp, surcharge_per_horizontal,
)
from geotek.engine.earth_pressure.distribution import lateral_pressure
from geotek.engine.earth_pressure.wedge import trial_wedge
from geotek.engine.sheet_pile import anchored_sheet_pile, cantilever_sheet_pile, net_pressure
from geotek.services.structures import calculation_fingerprint, design_sheet_pile_structure
from geotek.services.walls_basic import BasicSheetPileInput, design_sheet_pile_basic

G, PHI, BETA, H = 18.0, 30.0, 10.0, 5.0
KA_B = rankine_ka(PHI, BETA)
COS_B = math.cos(math.radians(BETA))


def _profile(phi=PHI, c=0.0, su=None, bottom=40.0, gwt=100.0):
    layer = SoilLayer(id="S", top=0, bottom=bottom, gamma=G, gamma_sat=20.0,
                      design=DesignParameters(phi_eff=phi, c_eff=c, su=su))
    return SoilProfile(id="SP", gwt=GroundwaterCondition(depth_insitu=gwt), layers=[layer])


def test_rankine_slope_coefficient_hand_value():
    assert KA_B == pytest.approx(0.349520, abs=1e-6)
    assert 0.5 * G * H**2 * KA_B == pytest.approx(78.642, abs=1e-3)
    # Rankine-beta equals Coulomb with delta = beta on a vertical face
    assert coulomb_ka(PHI, BETA, 0.0, BETA) == pytest.approx(KA_B, rel=1e-12)


def test_lateral_pressure_slope_matches_hand_value_and_wedge():
    dist = lateral_pressure(_profile(), H, beta=BETA)
    assert dist.force == pytest.approx(0.5 * G * H**2 * KA_B * COS_B, rel=1e-6)  # 77.447
    wedge = trial_wedge(H=H, gamma=G, phi=PHI, delta=BETA, beta=BETA)
    assert dist.force == pytest.approx(wedge.force * COS_B, rel=0.01)


@pytest.mark.parametrize("q", [10.0, 25.0])
def test_surcharge_thrust_horizontal_basis_matches_wedge_and_closed_form(q):
    base = trial_wedge(H=H, gamma=G, phi=PHI, delta=BETA, beta=BETA).force
    with_q = trial_wedge(H=H, gamma=G, phi=PHI, delta=BETA, beta=BETA, q=q).force
    assert with_q - base == pytest.approx(KA_B * q * H, rel=0.01)
    dist = lateral_pressure(_profile(), H, beta=BETA, surcharge=q)
    soil = lateral_pressure(_profile(), H, beta=BETA)
    assert dist.force - soil.force == pytest.approx(KA_B * q * H * COS_B, rel=1e-6)


def test_surcharge_inclined_basis_is_q_over_cos_beta():
    q = 20.0
    q_h = surcharge_per_horizontal(q, BETA, "inclined")
    assert q_h == pytest.approx(q / COS_B) and q_h == pytest.approx(20.3085, abs=1e-3)
    assert surcharge_per_horizontal(q, BETA, "horizontal") == q
    assert surcharge_per_horizontal(q, 0.0, "inclined") == q
    # Das closed form for a vertical face (a = 0): Ka q H cos a / cos(a - b) = Ka q H / cos b
    das = KA_B * q * H / COS_B
    wedge = (trial_wedge(H=H, gamma=G, phi=PHI, delta=BETA, beta=BETA, q=q_h).force
             - trial_wedge(H=H, gamma=G, phi=PHI, delta=BETA, beta=BETA).force)
    assert wedge == pytest.approx(das, rel=0.01)
    # The alternative form Ka q cos b / cos(b - a) = Ka q (a = 0) disagrees with the wedge by 1/cos b.
    assert wedge != pytest.approx(KA_B * q, rel=0.01)


def test_cantilever_with_slope_closed_form():
    # Moments about the toe: Ka cos(b) (H+D)^3 = Kp D^3 (front ground horizontal)
    kah, kp = KA_B * COS_B, rankine_kp(PHI)
    r = cantilever_sheet_pile(_profile(), H, backfill_slope=BETA)
    ratio = (kah / kp) ** (1 / 3)
    d0 = H * ratio / (1 - ratio)
    assert r.D0 == pytest.approx(d0, rel=1e-3)
    assert r.D == pytest.approx(1.2 * d0, rel=1e-3)
    z0 = H * math.sqrt(kp) / (math.sqrt(kp) - math.sqrt(kah))
    assert r.M_max == pytest.approx(G * (kah * z0**3 - kp * (z0 - H) ** 3) / 6, rel=2e-3)


def test_zero_slope_and_zero_surcharge_reproduce_old_results_exactly():
    for solver, extra in ((cantilever_sheet_pile, {}), (anchored_sheet_pile, {"anchor_depth": 1.0})):
        old = solver(_profile(), H, surcharge=15.0, passive_factor=1.5, **extra)
        new = solver(_profile(), H, surcharge=15.0, passive_factor=1.5, backfill_slope=0.0, **extra)
        assert (new.D0, new.M_max, new.anchor_force, new.toe_force) == (
            old.D0, old.M_max, old.anchor_force, old.toe_force)


def test_net_pressure_surcharge_profile():
    q_h = surcharge_per_horizontal(20.0, BETA, "inclined")
    np_ = net_pressure(_profile(), H, surcharge=q_h, backfill_slope=BETA)
    i = int((abs(np_.z - 3.0)).argmin())
    assert np_.active[i] == pytest.approx(KA_B * COS_B * (G * np_.z[i] + q_h), rel=1e-9)


def test_slope_raises_demand():
    flat = cantilever_sheet_pile(_profile(), H)
    sloped = cantilever_sheet_pile(_profile(), H, backfill_slope=BETA)
    assert sloped.D > flat.D and sloped.M_max > flat.M_max


def test_slope_beyond_phi_is_a_coded_error():
    with pytest.raises(SlopeError) as exc:
        cantilever_sheet_pile(_profile(), H, backfill_slope=32.0)
    assert exc.value.message_code == "slope_exceeds_phi"
    assert error_from_exception(exc.value).details == {
        "message_code": "slope_exceeds_phi", "params": {"slope": 32.0, "phi": 30.0}}


def test_slope_with_undrained_layer_is_stopped():
    prof = _profile(phi=None, su=50.0)
    with pytest.raises(SlopeError) as exc:
        net_pressure(prof, H, drainage="undrained", backfill_slope=BETA)
    assert exc.value.message_code == "slope_undrained_unsupported"
    with pytest.raises(ValueError, match="undrained"):
        BasicSheetPileInput(retained_height=H, gamma=18, drainage="undrained", su=50, backfill_slope=5)


def test_cohesion_dropped_on_active_slope_side_with_warning():
    # c' is dropped behind the wall only; the horizontal front side keeps its cohesion.
    with_c = net_pressure(_profile(c=10.0), H, backfill_slope=BETA)
    without = net_pressure(_profile(c=0.0), H, backfill_slope=BETA)
    assert (with_c.active == without.active).all()
    assert with_c.passive[-1] > without.passive[-1]
    assert any("c' ignored for sloping backfill" in w for w in with_c.warnings)
    assert not without.warnings
    solved = cantilever_sheet_pile(_profile(c=10.0), H, backfill_slope=BETA)
    assert any("c' ignored for sloping backfill" in w for w in solved.warnings)


def test_mononobe_okabe_no_solution_is_a_coded_error():
    # sds 1.0, r = 1: kh = 0.4, kv = 0.2 -> psi = 26.57 deg; beta = 25 > phi - psi = 3.43
    inp = BasicSheetPileInput(retained_height=H, gamma=18, phi=30, backfill_slope=25, sds=1.0)
    with pytest.raises(SlopeError) as exc:
        design_sheet_pile_basic(inp)
    assert exc.value.message_code == "mo_no_solution"
    assert exc.value.message_params["slope"] == 25.0
    with pytest.raises(SlopeError):
        mononobe_okabe_kae(30, 25, 0, 25, 0.4, 0.2)


def test_basic_sheet_pile_with_slope_and_seismic_runs():
    flat = design_sheet_pile_basic(BasicSheetPileInput(retained_height=H, gamma=18, phi=35, sds=0.5))
    sloped = design_sheet_pile_basic(BasicSheetPileInput(
        retained_height=H, gamma=18, phi=35, sds=0.5, backfill_slope=8, surcharge=10,
        surcharge_basis="inclined"))
    assert sloped.result.D > flat.result.D
    assert any(a.code == "sheet_pile.backfill_slope" for a in sloped.assumptions)
    assert any(a.code == "sheet_pile.surcharge_inclined" for a in sloped.assumptions)


def _sheet_project(**fields):
    layer = SoilLayer(id="sand", top=0, bottom=35, gamma=18, gamma_sat=20,
                      design=DesignParameters(phi_eff=30))
    soil = StructureSoilModel(profile=SoilProfile(id="sheet", layers=[layer],
                                                  gwt=GroundwaterCondition(depth_insitu=100)))
    return Project(meta=ProjectMeta(name="sheet"),
                   structures=[SheetPileStructure(id="sheet", retained_height=H, soil=soil, **fields)])


def test_structure_path_matches_engine_with_slope_and_inclined_surcharge():
    project = _sheet_project(backfill_slope=BETA, surcharge=20.0, surcharge_basis="inclined")
    got = design_sheet_pile_structure(project, "sheet")
    q_h = 20.0 / COS_B
    ref = cantilever_sheet_pile(project.structure("sheet").soil.profile, H, passive_factor=1.5,
                                backfill_slope=BETA, surcharge=q_h)
    assert got.result.D0 == pytest.approx(ref.D0, rel=1e-6)
    assert got.result.M_max == pytest.approx(ref.M_max, rel=1e-6)
    assert any(a.code == "sheet_pile.backfill_slope" for a in got.assumptions)


def test_structure_path_horizontal_basis_differs_from_inclined():
    horizontal = design_sheet_pile_structure(_sheet_project(backfill_slope=BETA, surcharge=20.0), "sheet")
    inclined = design_sheet_pile_structure(
        _sheet_project(backfill_slope=BETA, surcharge=20.0, surcharge_basis="inclined"), "sheet")
    assert inclined.result.M_max > horizontal.result.M_max


def test_structure_seismic_slope_increment_is_purely_dynamic():
    # Coulomb(delta = beta) at kh = kv = 0 is the Rankine slope coefficient, so the seismic
    # increment is zero without shaking and positive with it.
    assert mononobe_okabe_kae(PHI, BETA, 0.0, BETA, 0.0, 0.0) == pytest.approx(KA_B, rel=1e-12)
    static = design_sheet_pile_structure(_sheet_project(backfill_slope=5.0), "sheet")
    shaken = design_sheet_pile_structure(_sheet_project(backfill_slope=5.0, sds=0.4), "sheet")
    assert shaken.result.M_max > static.result.M_max


def test_structure_mo_no_solution_stops():
    with pytest.raises(GeoTekError) as exc:
        design_sheet_pile_structure(_sheet_project(backfill_slope=25.0, sds=1.0), "sheet")
    assert getattr(exc.value, "message_code", None) == "mo_no_solution"


def test_fingerprint_unchanged_at_defaults_and_changes_with_inputs():
    flat = _sheet_project()
    base = calculation_fingerprint(flat, flat.structure("sheet"))
    sloped = _sheet_project(backfill_slope=5.0)
    basis = _sheet_project(surcharge=5.0, surcharge_basis="inclined")
    assert len({base, calculation_fingerprint(sloped, sloped.structure("sheet")),
                calculation_fingerprint(basis, basis.structure("sheet"))}) == 3


# ---- retaining wall path: existing beta/q wiring, surcharge basis -------------------------------

def _wall_project(basis="horizontal", slope=BETA, surcharge=20.0):
    from geotek.core.models.structures import RetainingWallStructure, WallDesignInputs
    from geotek.engine.walls.layered import soil_from_basic
    from geotek.services.walls_basic import BasicWallInput, proportion_for

    basic = BasicWallInput(wall_type="cantilever", height=5.0, backfill_gamma=18.0, backfill_phi=32.0,
                           backfill_slope=slope, foundation_phi=30.0, foundation_gamma=19.0)
    wall = RetainingWallStructure(
        id="wall", wall_type="cantilever", height=5, embedment=0.6, backfill_slope=slope,
        geometry=proportion_for("cantilever", 5, 4.6, 0.6), soil=soil_from_basic(basic, 0.6),
        inputs=WallDesignInputs(surcharge=surcharge, surcharge_basis=basis, include_global_stability=False))
    return Project(meta=ProjectMeta(name="wall"), structures=[wall])


def test_wall_inclined_basis_equals_horizontal_with_converted_q():
    from geotek.services.structures import check_structure

    inclined = check_structure(_wall_project("inclined"), "wall")
    converted = check_structure(_wall_project("horizontal", surcharge=20.0 / COS_B), "wall")
    for key, analysis in inclined.analyses.items():
        for name, check in analysis.checks.items():
            assert check.value == pytest.approx(converted.analyses[key].checks[name].value, rel=1e-9)
    plain = check_structure(_wall_project("horizontal"), "wall")
    assert all(a.checks["sliding"].value < b.checks["sliding"].value
               for a, b in zip(inclined.analyses.values(), plain.analyses.values()))
    assert any(a.code == "wall.surcharge_inclined" for a in inclined.assumptions)


def test_wall_basic_inclined_equals_horizontal_converted():
    from geotek.services.walls_basic import BasicWallInput, size_wall

    kw = dict(wall_type="cantilever", height=5.0, backfill_gamma=18.0, backfill_phi=32.0,
              backfill_slope=BETA, foundation_phi=30.0, foundation_gamma=19.0)
    a = size_wall(BasicWallInput(**kw, surcharge=20.0, surcharge_basis="inclined"))
    b = size_wall(BasicWallInput(**kw, surcharge=20.0 / COS_B))
    assert a.geometry.model_dump() == b.geometry.model_dump()


def test_wall_wedge_thrust_matches_rankine_slope_hand_value():
    from geotek.core.models.walls import Backfill, WallLoads

    wedge = trial_wedge(H=H, gamma=G, phi=PHI, delta=BETA, beta=BETA, q=0.0)
    assert wedge.force == pytest.approx(78.642, abs=1e-2)
    assert Backfill(gamma=G, phi=PHI, slope=BETA).slope == BETA and WallLoads().surcharge == 0.0
