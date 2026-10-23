"""HS-A3: USCS-restricted correlations, new SPT correlations, K0 candidates and the SPT class."""

import datetime as dt
import math

import pytest

from geotek.engine.correlations import registry
from geotek.engine.insitu.spt import rod_length_factor
from geotek.core.models.investigations import LabRecord
from geotek.core.models.profile import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.services import parameters as svc
from geotek.core.models.parameters import ParameterSelection
from geotek.services import parameter_plan


def _value(method_id, **inputs):
    return registry.evaluate(method_id, inputs)


def test_rod_length_factor_is_0_75_from_3_to_4_m():
    # Skempton (1986) / TBDY 2018 Table 16B.1; Youd et al. (2001) would give 0.80 here.
    assert [rod_length_factor(x) for x in (2.0, 3.0, 3.5, 3.999)] == [0.75, 0.75, 0.75, 0.75]
    assert [rod_length_factor(x) for x in (4.0, 6.0, 10.0)] == [0.85, 0.95, 1.0]


def test_uscs_restricted_correlations_need_the_layer_symbol():
    assert registry.get("Sowers1979_su_high_SPT").uscs == frozenset({"CH", "MH"})
    inputs = {"N60": 10.0}
    ids = lambda symbol: {c.id for c in registry.applicable("su", inputs, uscs=symbol)}
    assert "Sowers1979_su_high_SPT" in ids(" ch ") and "Sowers1979_su_medium_SPT" not in ids("CH")
    assert not any(i.startswith("Sowers") for i in ids(None))
    assert not any(i.startswith("Sowers") for i in ids("SP"))
    # Methods without a class restriction are unaffected.
    assert "Hara1974_su_SPT" in ids(None)


@pytest.mark.parametrize("symbol, coefficient", [("CH", 12.5), ("MH", 12.5), ("CL", 7.5),
                                                  ("ML", 3.75), ("CL-ML", 3.75), ("SC", 3.75)])
def test_sowers_su_by_plasticity(symbol, coefficient):
    # N60 = 8: su = c * 8 kPa.
    candidates = {c.method_id: c for c in svc.evaluate_candidates([{"depth": 2.0, "N60": 8.0}], "su", [], uscs=symbol)}
    sowers = next(c for c in candidates.values() if c.method_id.startswith("Sowers"))
    assert sowers.value == pytest.approx(coefficient * 8)
    assert sowers.reliability == "C" and "Erol" in sowers.reference


@pytest.mark.parametrize("pi, f1", [(10.0, 6.0), (15.0, 6.0), (17.5, 5.0), (20.0, 4.0), (35.0, 4.0)])
def test_stroud_f1_follows_pi(pi, f1):
    assert _value("Stroud1974_su_SPT", N60=10.0, PI=pi).value == pytest.approx(10 * f1)


def test_stroud_without_pi_uses_f1_4_0_and_warns_but_stays_valid():
    result = _value("Stroud1974_su_SPT_noPI", N60=10.0)
    assert result.value == pytest.approx(40.0) and result.validity_ok
    assert result.warnings == ["correlation.warning.stroud_f1_pi_unknown: f1=4.0"]


def test_stroud_takes_the_layer_mean_lab_pi_as_context_only():
    points = [{"depth": 2.0, "N60": 10.0}, {"depth": 3.0, "N60": 20.0}]
    lab = [LabRecord(depth=2.5, LL=40, PL=20, PI=20), LabRecord(depth=3.5, LL=40, PL=10, PI=30)]
    pi = svc.mean_lab_pi(lab)
    assert pi == 25.0
    before = [dict(p) for p in points]
    candidates = {c.method_id: c for c in svc.evaluate_candidates(points, "su", [], layer_pi=pi)}
    # PI = 25 -> f1 = 4.0: su = 4 * 10 and 4 * 20; the noPI record is skipped, the point keeps no PI.
    assert candidates["Stroud1974_su_SPT"].value == pytest.approx(60.0)
    assert "Stroud1974_su_SPT_noPI" not in candidates
    assert points == before
    # Without any PI only the noPI record runs.
    only = {c.method_id for c in svc.evaluate_candidates(points, "su", [])}
    assert "Stroud1974_su_SPT_noPI" in only and "Stroud1974_su_SPT" not in only
    # A PI context does not make the PI-only phi' correlation run at SPT depths.
    phi = svc.evaluate_candidates(points, "phi_eff", [], layer_pi=pi)
    assert "TPM1996_phi_PI" not in {c.method_id for c in phi}


def test_shioi_fukui_friction_angles():
    # (N1)60 = 20: N'70 = 20 * 60/70 = 17.142857; phi' = sqrt(18 * 17.142857) + 15 = 32.5662.
    assert _value("SF1982_phi_roads_SPT", N1_60=20.0).value == pytest.approx(
        math.sqrt(18 * 20 * 60 / 70) + 15, abs=1e-9)
    assert _value("SF1982_phi_roads_SPT", N1_60=20.0).value == pytest.approx(32.5662, abs=1e-4)
    # (N1)60 = 14: N'70 = 14 * 60/70 = 12; phi' = 0.36 * 12 + 27 = 31.32 (overburden corrected, not N60).
    assert _value("SF1982_phi_buildings_SPT", N1_60=14.0).value == pytest.approx(31.32)
    assert "SF1982_phi_roads_SPT" in {c.id for c in registry.applicable("phi_eff", {"N1_60": 1.0})}


def test_the_unphysical_bowles_general_phi_formula_is_not_registered():
    # phi = 4.5 N70 + 20 gives more than 45 degrees for N70 > 5.6 (documented in the HS-D audit).
    assert not [c for c in registry.REGISTRY.values()
                if c.parameter == "phi_eff" and "Bowles" in c.id]


E_CASES = [
    ("ML", "FHWA2002_E_silt_SPT", 400 * 10.0), ("SM", "FHWA2002_E_silt_SPT", 400 * 10.0),
    ("SP", "FHWA2002_E_sand_SPT", 700 * 10.0), ("SW-SM", "FHWA2002_E_sand_SPT", 700 * 10.0),
    ("GW", "FHWA2002_E_gravel_SPT", 1200 * 10.0), ("GP-GM", "FHWA2002_E_gravel_SPT", 1200 * 10.0),
]


@pytest.mark.parametrize("symbol, method, expected", E_CASES)
def test_fhwa_elastic_modulus_by_uscs(symbol, method, expected):
    points = [{"depth": 2.0, "N1_60": 10.0, "N60": 8.0, "below_gwt": 0.0}]
    candidates = {c.method_id: c for c in svc.evaluate_candidates(points, "E", [], uscs=symbol)}
    assert candidates[method].value == pytest.approx(expected)
    others = {"FHWA2002_E_silt_SPT", "FHWA2002_E_sand_SPT", "FHWA2002_E_gravel_SPT"} - {method}
    assert not others & set(candidates)


def test_bowles_elastic_modulus_formulae_and_the_water_table_filter():
    # N60 = 22: N55 = 22 * 60/55 = 24.
    n55 = 24.0
    above = [{"depth": 2.0, "N60": 22.0, "below_gwt": 0.0}]
    below = [{"depth": 6.0, "N60": 22.0, "below_gwt": 1.0}]
    sand = {c.method_id: c.value for c in svc.evaluate_candidates(above, "E", [], uscs="SP")}
    assert sand["Bowles1996_E_sand_SPT"] == pytest.approx(500 * (n55 + 15))  # 19500
    assert sand["Bowles1996_E_sand_sqrt_SPT"] == pytest.approx(7000 * math.sqrt(n55))
    assert sand["Bowles1996_E_sand_lin_SPT"] == pytest.approx(6000 * n55)  # 144000
    assert sand["Bowles1996_E_sand_ln_SPT"] == pytest.approx(15000 * math.log(n55))
    assert sand["Bowles1996_E_sand_lin2_SPT"] == pytest.approx(2600 * n55)  # 62400
    assert "Bowles1996_E_sand_sat_SPT" not in sand
    wet = {c.method_id: c.value for c in svc.evaluate_candidates(below, "E", [], uscs="SP")}
    assert wet["Bowles1996_E_sand_sat_SPT"] == pytest.approx(250 * (n55 + 15))  # 9750
    assert not {"Bowles1996_E_sand_SPT", "Bowles1996_E_sand_sqrt_SPT"} & set(wet)
    assert svc.evaluate_candidates(above, "E", [], uscs="SC")[0].method_id.startswith("Bowles1996_E_clayey_sand")
    clayey = {c.method_id: c.value for c in svc.evaluate_candidates(above, "E", [], uscs="SC")}
    assert clayey["Bowles1996_E_clayey_sand_SPT"] == pytest.approx(320 * (n55 + 15))  # 12480
    silt = {c.method_id: c.value for c in svc.evaluate_candidates(above, "E", [], uscs="ML")}
    assert silt["Bowles1996_E_silt_SPT"] == pytest.approx(300 * (n55 + 6))  # 9000


def test_bowles_logarithmic_modulus_is_not_computable_for_n55_up_to_one():
    result = _value("Bowles1996_E_sand_ln_SPT", N60=0.9)  # N55 = 0.982
    assert math.isnan(result.value) and not result.validity_ok


def test_inventory_lists_uscs_as_missing_for_restricted_methods():
    from geotek.core.models.investigations import Borehole, Investigations, SPTRecord
    from geotek.core.models.project import Project, ProjectMeta
    from geotek.services import parameter_plan

    borehole = Borehole(id="BH", spt=[SPTRecord(depth=1.0, n_field=10, rod_length=5)])
    layer = SoilLayer(id="L", top=0, bottom=4, gamma=18, source_ids=["BH"], uscs="CH")
    profile = SoilProfile(id="P", gwt=GroundwaterCondition(depth_insitu=10), layers=[layer])
    project = Project(meta=ProjectMeta(name="x", date=dt.date(2026, 10, 23)),
                      investigations=Investigations(boreholes=[borehole]), soil_profiles=[profile])
    keys = {k["parameter"]: {m["id"]: m for m in k["methods"]}
            for k in parameter_plan.layer_inventory(project, profile, layer)["keys"]}
    assert keys["su"]["Sowers1979_su_high_SPT"]["ready_points"] == 1
    assert keys["su"]["Sowers1979_su_medium_SPT"]["ready_points"] == 0
    assert "uscs" in keys["su"]["Sowers1979_su_medium_SPT"]["missing_inputs"]
    assert "uscs" in keys["E"]["FHWA2002_E_sand_SPT"]["missing_inputs"]


# --- K0 ----------------------------------------------------------------------------------------


def _k0_layer(phi=30.0, ocr=None):
    """Layer whose phi' (and OCR) were really approved, as manual values."""
    selections = {}
    for key, value in (("phi_eff", phi), ("OCR", ocr)):
        if value is not None:
            selections[key] = ParameterSelection(parameter=key, mode="manual", manual_value=value)
    layer = SoilLayer(id="L", top=0, bottom=4, gamma=18, selections=selections)
    keys = list(selections)
    return svc.approve(layer, keys, [], [], dt.datetime(2026, 10, 23)) if keys else layer


def test_k0_candidates_jaky_and_mayne_kulhawy():
    # phi' = 30: sin = 0.5. Jaky K0 = 0.5; with OCR = 4 the exponent is 0.5: 0.5 * 4^0.5 = 1.0.
    plain = {c.method_id: c for c in svc.k0_candidates(_k0_layer())}
    assert set(plain) == {"JAKY_K0"} and plain["JAKY_K0"].value == pytest.approx(0.5)
    both = {c.method_id: c for c in svc.k0_candidates(_k0_layer(ocr=4.0))}
    assert both["MK1982_K0"].value == pytest.approx(1.0)
    assert both["MK1982_K0"].inputs_used == {"phi_eff": 30.0, "OCR": 4.0}
    assert both["MK1982_K0"].source == "combined" and both["MK1982_K0"].reliability == "B"
    # OCR = 101: K0 = 0.5 * sqrt(101) = 5.025, above the model bound 5: flagged invalid, not clipped.
    assert not {c.method_id: c for c in svc.k0_candidates(_k0_layer(ocr=101.0))}["MK1982_K0"].validity_ok
    assert svc.k0_candidates(_k0_layer(phi=None)) == []


def test_k0_suggestion_order_mk_before_jaky_but_registry_first():
    layer = _k0_layer(ocr=4.0)
    derived = svc.k0_candidates(layer)
    assert svc.suggest(derived, "K0", layer).method_id == "MK1982_K0"
    assert svc.suggest(derived[:1], "K0", layer).method_id == "JAKY_K0"
    registry_value = svc.evaluate_candidates([{"qt": 1500.0, "sigma_v": 100.0, "sigma_v_eff": 80.0}], "K0", [])
    assert registry_value and registry_value[0].method_id == "KM1990_K0_CPT"
    chosen = svc.suggest(registry_value + derived, "K0", layer)
    assert chosen.method_id.startswith("mean(") and "JAKY_K0" not in chosen.method_id


def test_k0_approval_records_phi_and_follows_it():
    layer = _k0_layer()
    refreshed_project = svc.refresh_profile(_k0_project(layer), "P")
    layer = refreshed_project.layers[0]
    assert {c.method_id for c in layer.selections["K0"].candidates} == {"JAKY_K0"}
    selection = layer.selections["K0"]
    selection.mode, selection.method_id = "correlation", "JAKY_K0"
    now = dt.datetime(2026, 10, 23)
    approved = svc.approve(layer, ["K0"], [], [], now)
    assert approved.design.K0 == pytest.approx(0.5)
    assert approved.selections["K0"].selected.inputs_used == {"phi_eff": 30.0}
    project = _k0_project(approved)
    assert svc.refresh_profile(project, "P").layers[0].selections["K0"].approved
    approved.design.phi_eff = 25.0
    stale = svc.refresh_profile(project, "P").layers[0].selections["K0"]
    assert not stale.approved and stale.stale_reason == "dependency_changed"
    assert stale.refreshed.value == pytest.approx(1 - math.sin(math.radians(25)))


def _k0_project(layer):
    from geotek.core.models.investigations import Investigations
    from geotek.core.models.project import Project, ProjectMeta

    profile = SoilProfile(id="P", gwt=GroundwaterCondition(depth_insitu=10), layers=[layer])
    return Project(meta=ProjectMeta(name="x", date=dt.date(2026, 10, 23)),
                   investigations=Investigations(), soil_profiles=[profile])


@pytest.mark.parametrize("context, mean, expected", [
    ("sand", 2.99, "sand.very_loose"), ("sand", 3.0, "sand.loose"), ("sand", 8.0, "sand.medium_dense"),
    ("sand", 25.0, "sand.dense"), ("sand", 42.0, "sand.very_dense"), ("sand", 70.0, "sand.very_dense"),
    ("clay", 3.99, "clay.very_soft"), ("clay", 4.0, "clay.soft"), ("clay", 8.0, "clay.firm"),
    ("clay", 15.0, "clay.stiff"), ("clay", 30.0, "clay.very_stiff"), ("clay", 60.0, "clay.hard"),
])
def test_spt_class_boundaries_belong_to_the_upper_class(context, mean, expected):
    points = [{"N": 10.0, "N1_60": mean, "N60": mean}]
    assert svc.spt_class(context, points) == expected
    assert svc.spt_class(None, points) is None and svc.spt_class(context, []) is None


def test_k0_and_delta_use_only_the_approved_phi_and_ocr():
    layer = _k0_layer(ocr=4.0)
    layer.selections["phi_eff"].approved = False
    assert svc.k0_candidates(layer) == []
    assert svc.suggest([], "delta_base", layer) is None
    layer.selections["phi_eff"].approved = True
    layer.selections["OCR"].approved = False
    assert [c.method_id for c in svc.k0_candidates(layer)] == ["JAKY_K0"]  # no Mayne & Kulhawy
    assert svc.suggest([], "delta_base", layer).inputs_used == {"phi_eff": 30.0}


def test_inventory_lists_phi_approved_and_ocr_approved_as_missing_inputs():
    layer = _k0_layer(ocr=4.0)
    layer.selections["phi_eff"].approved = False
    layer.selections["OCR"].approved = False
    methods = {}
    for key in ("K0", "delta_base"):
        methods.update({m["id"]: m for m in parameter_plan._derived_methods(layer, key)})
    assert methods["JAKY_K0"]["missing_inputs"] == ["phi_approved"]
    assert methods["TBDY2018_delta_base"]["missing_inputs"] == ["phi_approved"]
    assert methods["MK1982_K0"]["missing_inputs"] == ["phi_approved", "ocr_approved"]
    layer.selections["phi_eff"].approved = True
    ready = {m["id"]: m for m in parameter_plan._derived_methods(layer, "K0")}
    assert ready["JAKY_K0"]["ready_points"] == 1 and ready["MK1982_K0"]["missing_inputs"] == ["ocr_approved"]


@pytest.mark.parametrize("key, method, ocr", [("delta_base", "TBDY2018_delta_base", None),
                                              ("K0", "JAKY_K0", None), ("K0", "MK1982_K0", 4.0)])
def test_dependent_approval_is_withdrawn_when_phi_or_ocr_stops_being_approved(key, method, ocr):
    layer = _k0_layer(ocr=ocr)
    layer = svc.refresh_profile(_k0_project(layer), "P").layers[0]
    selection = layer.selections[key]
    selection.mode, selection.method_id = "correlation", method
    approved = svc.approve(layer, [key], [], [], dt.datetime(2026, 10, 23))
    project = _k0_project(approved)
    assert svc.refresh_profile(project, "P").layers[0].selections[key].approved
    # The phi' (or OCR) approval is withdrawn while its value stays: the dependent value goes stale.
    withdrawn = "OCR" if method == "MK1982_K0" else "phi_eff"
    approved.selections[withdrawn].approved = False
    stale = svc.refresh_profile(project, "P").layers[0].selections[key]
    assert not stale.approved and stale.stale_reason == "dependency_changed"
