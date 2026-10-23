"""HS-C: surcharge seismic increment at 2H/3, at-rest (K0) analysis, quick sheet pile gamma_sat."""

import datetime as dt
import math

import pytest

from geotek.core.errors import LayerDesignError
from geotek.core.models.profile import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.core.models.project import Project, ProjectMeta
from geotek.core.models.structures import StructureSoilModel
from geotek.core.models.walls import Backfill, CantileverGeometry, WallLoads, WallSettings
from geotek.engine.earth_pressure.distribution import lateral_pressure
from geotek.engine.earth_pressure.wedge import trial_wedge
from geotek.engine.walls.base import earth_thrust_forces
from geotek.engine.walls.layered import wall_forces_layered
from geotek.services.at_rest import AtRestInput, at_rest_analysis
from geotek.services.walls_basic import BasicSheetPileInput

# Lecture Problem 1: cantilever, H = 6 m, B = 4.5 m, heel 4.1, stem 0.4, base 0.4, gamma = 18, phi = 30,
# delta = 0, q = 10 kPa, SDS = 1.0, r = 1.5 -> kh = 0.4 * 1.0 / 1.5, kv = 0.5 kh.
KH = 0.4 * 1.0 / 1.5
KV = 0.5 * KH
H, GAMMA, PHI, Q = 6.0, 18.0, 30.0, 10.0


def _mo_kae_vertical_smooth(phi_deg, kh, kv):
    """Mononobe-Okabe K_AE for a vertical smooth wall and horizontal ground (hand formula)."""
    phi, psi = math.radians(phi_deg), math.atan(kh / (1 - kv))
    root = math.sqrt(math.sin(phi) * math.sin(phi - psi) / math.cos(psi))
    return math.cos(phi - psi) ** 2 / (math.cos(psi) ** 2 * (1 + root) ** 2)


def _thrust_magnitudes(forces):
    return {f.name: (-f.fx, f.y) for f in forces}


def test_surcharge_increment_acts_at_two_thirds_h_base_path():
    """Soil increment at 0.5 H = 3.0 m, surcharge increment at 2H/3 = 4.0 m; total unchanged.

    Hand: Ka = 1/3; K_AE from the closed form; surcharge increment = q H ((1 - kv) K_AE - Ka).
    """
    loads = WallLoads(surcharge=Q, kh=KH, kv=KV, seismic_increment_height=0.5)
    backfill = Backfill(gamma=GAMMA, phi=PHI)
    forces, warnings = earth_thrust_forces(
        backfill=backfill, loads=loads, seismic=True, H=H, base_point=(0.0, 0.0), theta=0.0, delta=0.0)
    got = _thrust_magnitudes(forces)
    common = dict(H=H, gamma=GAMMA, phi=PHI, delta=0.0, theta=0.0, beta=0.0)
    p_soil = trial_wedge(**common).force
    p_static = trial_wedge(**common, q=Q).force
    p_ae0 = trial_wedge(**common, q=0.0, kh=KH, kv=KV).force
    p_ae = trial_wedge(**common, q=Q, kh=KH, kv=KV).force
    assert got["Seismic increment"][0] == pytest.approx(p_ae0 - p_soil, rel=1e-9)
    assert got["Seismic increment"][1] == pytest.approx(3.0)
    assert got["Seismic increment (surcharge)"][0] == pytest.approx((p_ae - p_static) - (p_ae0 - p_soil), rel=1e-9)
    assert got["Seismic increment (surcharge)"][1] == pytest.approx(4.0)
    total = got["Seismic increment"][0] + got["Seismic increment (surcharge)"][0]
    assert total == pytest.approx(p_ae - p_static, abs=1e-9)
    assert not warnings
    # Hand Mononobe-Okabe values (wedge grid tolerance 1e-3).
    kae = _mo_kae_vertical_smooth(PHI, KH, KV)
    ka = (1 - math.sin(math.radians(PHI))) / (1 + math.sin(math.radians(PHI)))
    assert got["Seismic increment (surcharge)"][0] == pytest.approx(Q * H * ((1 - KV) * kae - ka), rel=1e-3)
    assert got["Seismic increment"][0] == pytest.approx(
        0.5 * GAMMA * H**2 * ((1 - KV) * kae - ka), rel=1e-3)


def test_no_surcharge_increment_without_surcharge():
    loads = WallLoads(kh=KH, kv=KV, seismic_increment_height=0.5)
    forces, _ = earth_thrust_forces(backfill=Backfill(gamma=GAMMA, phi=PHI), loads=loads, seismic=True, H=H,
                                    base_point=(0.0, 0.0), theta=0.0, delta=0.0)
    assert {f.name for f in forces} == {"Earth pressure", "Seismic increment"}


def test_layered_single_layer_matches_base_path():
    """Layered integration of the same problem gives the same forces and arms (M-O closed form)."""
    geometry = CantileverGeometry(stem_height=5.6, stem_top=0.3, stem_bottom=0.4, toe=0.0, heel=4.1,
                                  base_thickness=0.4)
    layer = SoilLayer(id="fill", top=0, bottom=30, gamma=GAMMA, gamma_sat=20,
                      design=DesignParameters(phi_eff=PHI))
    soil = StructureSoilModel(profile=SoilProfile(id="p", layers=[layer], gwt=GroundwaterCondition(depth_insitu=100)),
                              gwt_retained=GroundwaterCondition(depth_insitu=100),
                              gwt_front=GroundwaterCondition(depth_insitu=100))
    loads = WallLoads(surcharge=Q, kh=KH, kv=KV, seismic_increment_height=0.5)
    layered = _thrust_magnitudes(wall_forces_layered(
        geometry, soil, loads, WallSettings(), seismic=True).forces)
    base, _ = earth_thrust_forces(backfill=Backfill(gamma=GAMMA, phi=PHI), loads=loads, seismic=True, H=H,
                                  base_point=(0.0, 0.0), theta=0.0, delta=0.0)
    base = _thrust_magnitudes(base)
    for name in ("Earth pressure", "Surcharge pressure", "Seismic increment", "Seismic increment (surcharge)"):
        assert layered[name][0] == pytest.approx(base[name][0], rel=2e-3), name
        assert layered[name][1] == pytest.approx(base[name][1], rel=1e-9), name
    assert layered["Seismic increment (surcharge)"][1] == pytest.approx(4.0)
    assert layered["Seismic increment"][1] == pytest.approx(3.0)


# --- C2: at-rest analysis -------------------------------------------------------------------------

def approve_k0(project, profile_id="p", *, approved=True, stale=False):
    """Attach an approved (or unapproved / stale) K0 selection to every layer, as the Soil module would."""
    from geotek.core.models.parameters import DerivedParameter, ParameterSelection
    from geotek.services.parameters import basis_hash, layer_points

    profile = project.profile(profile_id)
    for layer in profile.layers:
        basis = basis_hash(layer, layer_points(project, profile, layer))
        layer.selections["K0"] = ParameterSelection(
            parameter="K0", mode="manual", manual_value=layer.design.K0,
            selected=DerivedParameter(value=layer.design.K0 or 0.5, unit="-", method_id="user", source="user",
                                      user_override=True),
            approved=approved, approved_at=dt.datetime(2026, 10, 23) if approved else None,
            basis_hash="stale-basis" if stale else basis)
    return project


def _project(gwt=None, k0=0.5, gamma_sat=20.0):
    layer = SoilLayer(id="L1", top=0, bottom=10, gamma=18, gamma_sat=gamma_sat,
                      design=DesignParameters(phi_eff=30, K0=k0))
    depth = 99.0 if gwt is None else gwt
    profile = SoilProfile(id="p", layers=[layer], gwt=GroundwaterCondition(depth_insitu=depth))
    return approve_k0(Project(meta=ProjectMeta(name="at rest"), soil_profiles=[profile]))


def test_at_rest_dry_source_pattern():
    """K0 = 0.5, gamma = 18, q = 10, H = 6: sigma'h(0) = 0.5 * 10 = 5, sigma'h(6) = 0.5 * (10 + 108) = 59.

    P1 = K0 q H = 30 at 3 m; P2 = 1/2 K0 gamma H^2 = 162 at 2 m; total 192.
    """
    r = at_rest_analysis(_project(), AtRestInput(profile_id="p", height=6, surcharge=10))
    assert r.sigma_h_eff[0] == pytest.approx(5.0) and r.sigma_h_eff[-1] == pytest.approx(59.0)
    parts = {c["name"]: c for c in r.components}
    assert set(parts) == {"surcharge", "soil"}
    assert parts["surcharge"]["force"] == pytest.approx(30.0) and parts["surcharge"]["height"] == pytest.approx(3.0)
    assert parts["soil"]["force"] == pytest.approx(162.0) and parts["soil"]["height"] == pytest.approx(2.0)
    assert r.total_force == pytest.approx(192.0)
    # Moment about the base: 30 * 3 + 162 * 2 = 414 -> arm 2.15625 m.
    assert r.total_height == pytest.approx(414.0 / 192.0)
    assert r.layers == [{"layer_id": "L1", "top": 0.0, "bottom": 6.0, "K0": 0.5}]


def test_at_rest_with_water_table():
    """GWT 2 m, gamma_sat = 20, gamma_w = 9.81: u(6) = 4 * 9.81 = 39.24; Pw = 78.48 at 4/3 m.

    sigma'h(6) = 0.5 * (10 + 18 * 2 + 4 * (20 - 9.81)) = 43.38.
    """
    r = at_rest_analysis(_project(gwt=2.0), AtRestInput(profile_id="p", height=6, surcharge=10))
    assert r.u[-1] == pytest.approx(39.24)
    assert r.sigma_h_eff[-1] == pytest.approx(43.38)
    assert r.sigma_h[-1] == pytest.approx(43.38 + 39.24)
    water = next(c for c in r.components if c["name"] == "water")
    assert water["force"] == pytest.approx(78.48) and water["height"] == pytest.approx(4 / 3)
    soil = next(c for c in r.components if c["name"] == "soil")
    # P2: 1/2 * 0.5 * 18 * 2^2 + (0.5 * 18 * 2) * 4 + 1/2 * 0.5 * 10.19 * 16 = 18 + 72 + 40.76
    assert soil["force"] == pytest.approx(130.76)
    assert r.total_force == pytest.approx(30.0 + 130.76 + 78.48)


def test_at_rest_requires_approved_k0():
    with pytest.raises(LayerDesignError) as caught:
        at_rest_analysis(_project(k0=None), AtRestInput(profile_id="p", height=6))
    assert caught.value.message_code == "layer_k0_missing"
    with pytest.raises(LayerDesignError):
        lateral_pressure(_project(k0=None).soil_profiles[0], 4, state="at_rest")


@pytest.mark.parametrize("kwargs", [dict(approved=False), dict(stale=True)])
def test_at_rest_rejects_unapproved_or_stale_k0_even_if_design_has_a_value(kwargs):
    project = approve_k0(_project(), **kwargs)  # design.K0 = 0.5 is present in both cases
    assert project.soil_profiles[0].layers[0].design.K0 == 0.5
    with pytest.raises(LayerDesignError) as caught:
        at_rest_analysis(project, AtRestInput(profile_id="p", height=6))
    assert caught.value.message_code == "layer_k0_missing"


def test_at_rest_rejects_missing_selection():
    project = _project()
    project.soil_profiles[0].layers[0].selections.clear()
    with pytest.raises(LayerDesignError):
        at_rest_analysis(project, AtRestInput(profile_id="p", height=6))


def test_at_rest_undrained_layer_uses_effective_stress_plus_water():
    layer = SoilLayer(id="C", top=0, bottom=10, gamma=18, gamma_sat=20, behaviour="undrained",
                      design=DesignParameters(su=30, K0=0.6))
    profile = SoilProfile(id="p", layers=[layer], gwt=GroundwaterCondition(depth_insitu=2.0))
    d = lateral_pressure(profile, 6, state="at_rest", layerwise=True)
    assert d.sigma_h_eff[-1] == pytest.approx(0.6 * (36 + 4 * (20 - 9.81)))
    assert d.u[-1] == pytest.approx(39.24)


# --- C3: quick sheet pile gamma_sat ----------------------------------------------------------------

_SHEET = dict(retained_height=4.0, gamma=18.0, phi=30.0)


def test_quick_sheet_pile_needs_gamma_sat_when_water_in_model_depth():
    with pytest.raises(ValueError, match="gamma_sat required"):
        BasicSheetPileInput(**_SHEET, gwt_depth=3.0)
    BasicSheetPileInput(**_SHEET, gwt_depth=3.0, gamma_sat=20.0)
    BasicSheetPileInput(**_SHEET)  # water table far below the model depth (default 100 m)


def test_quick_sheet_pile_runs_with_gamma_sat_and_uses_it():
    from geotek.services.walls_basic import design_sheet_pile_basic

    wet = design_sheet_pile_basic(BasicSheetPileInput(**_SHEET, gwt_depth=3.0, gamma_sat=20.0))
    dry = design_sheet_pile_basic(BasicSheetPileInput(**_SHEET))
    assert wet.result.D > dry.result.D  # water adds pressure; no silent gamma_sat = gamma


def test_surcharge_increment_uses_the_same_submerged_branches_as_the_soil_increment():
    """Envelope mode, q = 400 kPa: the q run picks the impervious branch (surcharge raises its soil
    increment above the pervious soil + water total), while the q = 0 run alone would pick pervious.
    Both increments must use impervious: soil increment 22.3118779366562 (closed form, see
    test_submerged_tbdy_closed_form), surcharge increment >= 0, and their sum = dynamic - static."""
    from geotek.engine.walls.layered import wall_pressures_layered

    layer = SoilLayer(id="fill", top=0, bottom=30, gamma=18, gamma_sat=20, design=DesignParameters(phi_eff=30))
    soil = StructureSoilModel(profile=SoilProfile(id="p", layers=[layer], gwt=GroundwaterCondition(depth_insitu=100)),
                              gwt_retained=GroundwaterCondition(depth_insitu=0.0),
                              gwt_front=GroundwaterCondition(depth_insitu=100))
    geometry = CantileverGeometry(stem_height=5.4, stem_top=0.3, stem_bottom=0.4, toe=1.0, heel=2.6,
                                  base_thickness=0.6, embedment=1.0)
    loads = WallLoads(surcharge=400.0, kh=0.1, kv=0.05, water_kh=0.2, seismic_increment_height=0.5)
    settings = WallSettings(submerged_seismic="envelope")
    forces = {f.name: -f.fx for f in wall_forces_layered(geometry, soil, loads, settings, seismic=True).forces}
    assert "Dinamik su itkisi (TBDY Denk. 16.20)" not in forces  # impervious branch governs
    assert forces["Seismic increment"] == pytest.approx(22.3118779366562, abs=1e-9)
    assert forces["Seismic increment (surcharge)"] >= 0
    pressures = wall_pressures_layered(geometry, soil, loads, settings, seismic=True)
    total = pressures["retained"].component("effective")[0] - pressures["retained_static"].component("effective")[0]
    assert forces["Seismic increment"] + forces["Seismic increment (surcharge)"] == pytest.approx(total, abs=1e-9)
