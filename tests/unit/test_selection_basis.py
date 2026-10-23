"""HS-A1/A2: per-selection approval basis, stale reasons, re-approval and unit-weight handling."""

import datetime as dt
import math
from pathlib import Path

import pytest

from geotek.core.constants import G, GAMMA_W
from geotek.core.errors import LayerDesignError
from geotek.core.models.investigations import (
    Borehole, CPTSounding, Investigations, LabRecord, SPTRecord,
)
from geotek.core.models.parameters import ParameterSelection
from geotek.core.models.profile import GroundwaterCondition, SoilLayer, SoilProfile
from geotek.core.models.project import Project, ProjectMeta
from geotek.io.project_io import load_project
from geotek.services import parameter_plan
from geotek.services import parameters as svc

EXAMPLE = Path(__file__).resolve().parents[2] / "examples" / "ornek_excel_proje.gtk"
NOW = dt.datetime(2026, 10, 23, 9, tzinfo=dt.timezone.utc)


def _layer(**updates):
    return SoilLayer(**{"id": "L", "top": 0, "bottom": 4, "gamma": 20, **updates})


def _project(*, layers=None, boreholes=None, cpts=None, gwt=10.0):
    boreholes, cpts = boreholes or [], cpts or []
    sources = [b.id for b in boreholes] + [c.id for c in cpts]
    profile = SoilProfile(
        id="P", source_ids=sources, gwt=GroundwaterCondition(depth_insitu=gwt),
        layers=layers or [_layer()],
    )
    return Project(
        meta=ProjectMeta(name="HS-A", date=dt.date(2026, 10, 23)),
        investigations=Investigations(boreholes=boreholes, cpts=cpts), soil_profiles=[profile],
    )


def _approve(project, layer_id, key, pid="P", **choice):
    """Choose and approve one key the way the approve route does; returns the updated project."""
    stored = project.profile(pid)
    stored_layer = next(l for l in stored.layers if l.id == layer_id)
    refreshed = svc.refresh_profile(project, pid)
    layer = next(l for l in refreshed.layers if l.id == layer_id)
    layer.selections[key] = layer.selections[key].model_copy(update=choice)
    points = svc.layer_points(project, stored, stored_layer)
    lab = svc.layer_lab(project, stored, stored_layer)
    approved = svc.approve(layer, [key], points, lab, NOW)
    layers = [approved if l.id == layer_id else l for l in stored.layers]
    return project.model_copy(update={
        "soil_profiles": [stored.model_copy(update={"layers": layers})]})


def _selection(project, layer_id, key):
    layer = next(l for l in svc.refresh_profile(project, "P").layers if l.id == layer_id)
    return layer.selections[key]


# --- A1: approval basis per parameter --------------------------------------------------------


def test_manual_unit_weight_keeps_unrelated_approvals_and_withdraws_stress_dependent_ones():
    """Plan scenario on examples/ornek_excel_proje.gtk: only the sigma'-dependent phi' falls."""
    project = load_project(EXAMPLE)
    pid = project.soil_profiles[0].id
    upper, lower = (layer.id for layer in project.soil_profiles[0].layers)
    for layer_id, key, method in [(upper, "phi_eff", "KM1990_phi_CPT"),
                                  (upper, "gamma", "RC2010_gamma_CPT"),
                                  (lower, "gamma", "RC2010_gamma_CPT")]:
        project = _approve(project, layer_id, key, pid, mode="correlation", method_id=method)
    old_phi = project.soil_profiles[0].layers[0].design.phi_eff
    assert old_phi is not None
    # The engineer now enters gamma = 19.5 for the upper layer by hand and approves it.
    project = _approve(project, upper, "gamma", pid, mode="manual", manual_value=19.5)
    assert project.profile(pid).layers[0].gamma == 19.5

    refreshed = svc.refresh_profile(project, pid)
    gamma_upper = refreshed.layers[0].selections["gamma"]
    gamma_lower = refreshed.layers[1].selections["gamma"]
    phi_upper = refreshed.layers[0].selections["phi_eff"]
    # Manual gamma depends on the layer bounds only; RC2010 uses qt and fs, which are raw data.
    assert gamma_upper.approved and gamma_upper.stale_reason is None
    assert gamma_lower.approved and gamma_lower.stale_reason is None
    # phi' from the CPT uses sigma'_v0, which follows gamma: only the stress part changed.
    assert not phi_upper.approved and phi_upper.stale_reason == "stress_changed"
    assert phi_upper.selected.value == old_phi
    assert phi_upper.refreshed is not None and math.isfinite(phi_upper.refreshed.value)
    assert phi_upper.refreshed.value != old_phi
    data_part, stress_part = phi_upper.basis_hash.split(".")
    assert len(data_part) == len(stress_part) == 32
    assert refreshed.layers[0].design.phi_eff == old_phi


def test_manual_value_survives_data_change_but_not_new_bounds():
    borehole = Borehole(id="BH", spt=[SPTRecord(depth=1, n_field=10), SPTRecord(depth=2, n_field=12)])
    layer = _layer(source_ids=["BH"], selections={"phi_eff": ParameterSelection(
        parameter="phi_eff", mode="manual", manual_value=30)})
    project = _approve(_project(layers=[layer], boreholes=[borehole]), "L", "phi_eff")
    assert _selection(project, "L", "phi_eff").approved
    project.investigations.boreholes[0].spt[0].n_field = 30
    selection = _selection(project, "L", "phi_eff")
    assert selection.approved and selection.stale_reason is None
    project.soil_profiles[0].layers[0].bottom = 5
    selection = _selection(project, "L", "phi_eff")
    # [0,4) became [0,5): the bounds are part of every basis.
    assert not selection.approved and selection.stale_reason == "data_changed"
    assert selection.refreshed is not None and selection.refreshed.value == 30


def test_lab_measurement_ignores_unit_weight_but_follows_the_lab_value():
    borehole = Borehole(id="BH", lab=[LabRecord(depth=1, phi_eff=32)])
    project = _approve(_project(boreholes=[borehole]), "L", "phi_eff",
                       mode="correlation", method_id="lab_phi_eff")
    project.soil_profiles[0].layers[0].gamma = 21
    selection = _selection(project, "L", "phi_eff")
    assert selection.approved and selection.stale_reason is None
    project.investigations.boreholes[0].lab[0].phi_eff = 36
    selection = _selection(project, "L", "phi_eff")
    assert not selection.approved and selection.stale_reason == "data_changed"
    assert selection.refreshed.value == 36 and selection.selected.value == 32


def test_statistic_value_follows_the_raw_input_of_any_pooled_method():
    spt = [SPTRecord(depth=1, n_field=10, rod_length=5), SPTRecord(depth=2, n_field=14, rod_length=5)]
    layer = _layer(source_ids=["BH"])
    project = _project(layers=[layer], boreholes=[Borehole(id="BH", spt=spt)])
    project = _approve(project, "L", "phi_eff", mode="statistic", statistic="mean")
    selection = _selection(project, "L", "phi_eff")
    assert selection.approved and selection.selected.method_id == "statistic:mean"
    assert "KM1990_phi_SPT" in selection.selected.based_on
    # N60 is raw data of KM1990_phi_SPT, so a blow-count change is a data change.
    project.investigations.boreholes[0].spt[0].n_field = 11
    selection = _selection(project, "L", "phi_eff")
    assert not selection.approved and selection.stale_reason == "data_changed"
    assert selection.refreshed is not None


def test_delta_base_is_withdrawn_with_dependency_changed_when_phi_changes():
    layer = _layer(selections={key: ParameterSelection(parameter=key, mode="manual", manual_value=30)
                               for key in ("phi_eff", "delta_base")})
    project = _project(layers=[layer])
    project = _approve(project, "L", "phi_eff")
    project = _approve(project, "L", "delta_base")
    delta = _selection(project, "L", "delta_base")
    assert delta.approved and delta.selected.inputs_used == {"phi_eff": 30}
    # Approving a new phi' withdraws the delta approval at once, keeping its trace.
    stored = project.profile("P")
    layer = svc.refresh_profile(project, "P").layers[0]
    layer.selections["phi_eff"].manual_value = 40
    changed = svc.approve(layer, ["phi_eff"], [], [], NOW)
    assert not changed.selections["delta_base"].approved
    assert changed.selections["delta_base"].stale_reason == "dependency_changed"
    assert changed.design.delta_base == 30
    project = project.model_copy(update={"soil_profiles": [stored.model_copy(update={"layers": [changed]})]})
    delta = _selection(project, "L", "delta_base")
    assert not delta.approved and delta.stale_reason == "dependency_changed"
    # The manual value 30 re-resolves unchanged; the program's own proposal follows the new phi'.
    assert delta.refreshed is not None and delta.refreshed.value == 30
    assert delta.suggested.inputs_used == {"phi_eff": 40}


def test_legacy_single_hash_approval_migrates_when_data_is_unchanged():
    borehole = Borehole(id="BH", lab=[LabRecord(depth=1, phi_eff=32)])
    project = _approve(_project(boreholes=[borehole]), "L", "phi_eff",
                       mode="correlation", method_id="lab_phi_eff")
    stored = project.profile("P")
    layer = stored.layers[0]
    points = svc.layer_points(project, stored, layer)
    legacy = [{k: v for k, v in p.items() if k not in ("gamma_point", "below_gwt", "N1_70")}
              for p in points]
    layer.selections["phi_eff"].basis_hash = svc.basis_hash(layer, legacy)
    assert "." not in layer.selections["phi_eff"].basis_hash
    selection = _selection(project, "L", "phi_eff")
    # The data did not change since approval: approval kept, basis rewritten in the new form.
    assert selection.approved and "." in selection.basis_hash and selection.stale_reason is None
    project.investigations.boreholes[0].lab[0].phi_eff = 33
    selection = _selection(project, "L", "phi_eff")
    assert not selection.approved and selection.stale_reason == "method_upgraded"


def test_reapprove_checks_the_expected_value_and_renews_the_basis():
    borehole = Borehole(id="BH", lab=[LabRecord(depth=1, phi_eff=32)])
    project = _approve(_project(boreholes=[borehole]), "L", "phi_eff",
                       mode="correlation", method_id="lab_phi_eff")
    old_basis = project.profile("P").layers[0].selections["phi_eff"].basis_hash
    project.investigations.boreholes[0].lab[0].phi_eff = 36
    with pytest.raises(svc.ReapproveMismatch):
        svc.reapprove(project, "P", [("L", "phi_eff", 35.0)], NOW)
    profile = svc.reapprove(project, "P", [("L", "phi_eff", 36.0)], NOW)
    layer = profile.layers[0]
    selection = layer.selections["phi_eff"]
    assert selection.approved and selection.stale_reason is None and selection.refreshed is None
    assert layer.design.phi_eff == 36 and selection.basis_hash != old_basis
    # Only the listed item is approved: nothing else became approved.
    assert [k for k, s in layer.selections.items() if s.approved] == ["phi_eff"]


def test_selection_basis_rejects_an_unknown_method():
    layer = _layer()
    selected = svc.resolve(ParameterSelection(parameter="phi_eff", mode="manual", manual_value=30)).selected
    selected = selected.model_copy(update={"method_id": "no_such_method"})
    with pytest.raises(ValueError, match="Unknown parameter method"):
        svc.selection_basis(layer, "phi_eff", selected, "correlation", [], [])


# --- A2: unit weights ------------------------------------------------------------------------


def test_missing_gamma_sat_fails_only_below_the_water_table():
    layers = [_layer(id="a", top=0, bottom=2), _layer(id="b", top=2, bottom=6)]
    profile = SoilProfile(id="P", gwt=GroundwaterCondition(depth_insitu=1), layers=layers)
    assert layers[0].gamma_sat is None  # no silent gamma_sat = gamma
    # Above the table gamma governs: 20 * 0.5 = 10 kPa.
    assert profile.stresses(0.5)[0] == pytest.approx(10.0)
    with pytest.raises(LayerDesignError) as error:
        profile.stresses(3.0)
    assert error.value.message_code == "layer_gamma_sat_missing"
    dry = SoilProfile(id="P", gwt=GroundwaterCondition(depth_insitu=10), layers=layers)
    assert dry.stresses(6.0)[0] == pytest.approx(120.0)


def test_phase_relation_gamma_sat_candidate_from_gamma_w_and_gs():
    lab = [LabRecord(depth=1, gamma=19, w=25, Gs=2.70)]
    candidates = {c.method_id: c for c in svc.evaluate_candidates(
        [{"depth": 1.0, "gamma": 19.0, "w": 25.0, "Gs": 2.7, "below_gwt": 0.0}], "gamma_sat", lab)}
    candidate = candidates["PHASE_gamma_sat_lab"]
    # gamma_d = 19/1.25 = 15.2; e = 2.70 * 9.81 / 15.2 - 1 = 0.7426; gamma_sat = (2.70+e)*9.81/(1+e) = 19.38.
    gamma_d = 19 / 1.25
    e = 2.70 * GAMMA_W / gamma_d - 1
    assert candidate.value == pytest.approx((2.70 + e) * GAMMA_W / (1 + e), abs=1e-9)
    assert candidate.value == pytest.approx(19.38, abs=0.005)
    assert candidate.source == "lab" and candidate.reliability == "A"
    # A laboratory measurement outranks the correlations and is recognised as one.
    assert svc.suggest(list(candidates.values()), "gamma_sat", _layer()).method_id == "PHASE_gamma_sat_lab"


def test_lab_gamma_is_split_by_the_water_table_and_assumed_saturated_below():
    lab = [LabRecord(depth=1, gamma=18.0), LabRecord(depth=5, gamma=20.0)]
    points = [{"depth": 1.0, "gamma": 18.0, "below_gwt": 0.0},
              {"depth": 5.0, "gamma": 20.0, "below_gwt": 1.0}]
    gamma = {c.method_id: c for c in svc.evaluate_candidates(points, "gamma", lab)}
    assert gamma["lab_gamma"].value == 18.0 and gamma["lab_gamma"].stats.n == 1
    gamma_sat = {c.method_id: c for c in svc.evaluate_candidates(points, "gamma_sat", lab)}
    below = gamma_sat["lab_gamma_sat_below_gwt"]
    assert below.value == 20.0 and below.reliability == "B"
    assert "parameters.warning.gamma_below_gwt_assumed_saturated" in below.warnings
    assert svc.suggest(list(gamma_sat.values()), "gamma_sat", _layer()).method_id == "lab_gamma_sat_below_gwt"


def test_rc2010_gamma_sat_uses_only_points_below_the_water_table():
    # Rf = 1 % in both rows: gamma = 9.81 * (0.36 log10(qt/Pa) + 1.236) = 19.18836 and 15.65676.
    points = [{"qt": 10132.5, "fs": 101.325, "below_gwt": 0.0},
              {"qt": 1013.25, "fs": 10.1325, "below_gwt": 1.0}]
    sat = svc.evaluate_candidates(points, "gamma_sat", [])
    assert [c.method_id for c in sat] == ["RC2010_gamma_sat_CPT"]
    assert sat[0].value == pytest.approx(15.65676) and sat[0].stats.n == 1
    assert svc.evaluate_candidates(points, "gamma", [])[0].stats.n == 2


def test_gmax_uses_the_unit_weight_at_the_point_gamma_sat_below_the_water_table():
    bh = Borehole(id="BH", spt=[SPTRecord(depth=1.0, n_field=15, rod_length=5),
                                SPTRecord(depth=3.0, n_field=15, rod_length=5)])
    layer = _layer(bottom=6, gamma=18, gamma_sat=21, source_ids=["BH"])
    project = _project(layers=[layer], boreholes=[bh], gwt=2.0)
    points = svc.layer_points(project, project.profile("P"), layer)
    assert [p["gamma_point"] for p in points] == [18.0, 21.0]
    assert [p["below_gwt"] for p in points] == [0.0, 1.0]
    # N60 = 15 * 1 * 1 * 1 * 0.85 (rod 5 m) = 12.75; "all": Vs = 104.79 * 12.75^0.26; Gmax = gamma/g * Vs^2.
    n60 = 15 * 0.85
    vs = 104.79 * n60 ** 0.26
    gmax = {c.method_id: c for c in svc.evaluate_candidates(points, "Gmax", [])}["HU2007_Gmax_all_SPT"]
    expected = (18 / G * vs ** 2 + 21 / G * vs ** 2) / 2
    assert gmax.value == pytest.approx(expected)
    assert "gamma_layer" not in gmax.inputs_used


def test_parameters_still_work_without_gamma_sat_and_the_inventory_flags_it():
    bh = Borehole(id="BH", spt=[SPTRecord(depth=1.0, n_field=15, rod_length=5),
                                SPTRecord(depth=3.0, n_field=15, rod_length=5)])
    layer = _layer(bottom=6, gamma=18, source_ids=["BH"])
    project = _project(layers=[layer], boreholes=[bh], gwt=2.0)
    profile = project.profile("P")
    points = svc.layer_points(project, profile, layer)
    # Stress-free fields remain; the stress group is absent for the whole layer.
    assert all("N60" in p and "sigma_v_eff" not in p and "gamma_point" not in p for p in points)
    assert [p["below_gwt"] for p in points] == [0.0, 1.0]
    assert any(c.method_id == "SF1982_phi_buildings_SPT" for c in svc.evaluate_candidates(points, "phi_eff", []))
    inventory = parameter_plan.layer_inventory(project, profile, layer)
    assert inventory["stress_issue"] == "gamma_sat_missing"
    ready = parameter_plan.profile_readiness(project, profile)[0]
    assert ready["gamma_sat_missing_below_gwt"] and not ready["gamma_sat_approved"]
    assert svc.refresh_profile(project, "P").layers[0].selections["phi_eff"].candidates


def test_readiness_flags_gamma_sat_equal_to_gamma_without_approval():
    layer = _layer(gamma_sat=20)
    project = _project(layers=[layer], gwt=2.0)
    ready = parameter_plan.profile_readiness(project, project.profile("P"))[0]
    assert ready["gamma_sat_equals_gamma_unapproved"] and not ready["gamma_sat_missing_below_gwt"]


def test_bowles_range_warns_but_never_changes_the_value():
    # N'70 = 25 * 60 / 70 = 21.43 falls in "medium" and "dense": union 17-22 kN/m3.
    points = [{"depth": 1.0, "N1_70": 25 * 60 / 70}]
    lab = [LabRecord(depth=1, gamma=16.0)]
    candidate = svc.evaluate_candidates(points + [{"depth": 1.0, "gamma": 16.0, "below_gwt": 0.0}],
                                        "gamma", lab, "sand")[0]
    assert candidate.value == 16.0 and candidate.validity_ok
    assert any(w.startswith("parameters.warning.gamma_outside_bowles_range") for w in candidate.warnings)
    quiet = svc.evaluate_candidates(points + [{"depth": 1.0, "gamma": 19.0, "below_gwt": 0.0}],
                                    "gamma", [LabRecord(depth=1, gamma=19.0)], "sand")[0]
    assert not quiet.warnings


def test_merge_writes_thickness_weighted_unit_weights_and_unset_gamma_sat_stays_unset():
    from geotek.modules.soil import service

    layers = [_layer(id="a", top=0, bottom=2, gamma=18, gamma_sat=19),
              _layer(id="b", top=2, bottom=6, gamma=20, gamma_sat=None)]
    profile = SoilProfile(id="P", gwt=GroundwaterCondition(depth_insitu=1), layers=layers)
    merged, warnings = service.merge(profile, ["a", "b"])
    # gamma: (18 * 2 + 20 * 4) / 6 = 19.3333 keeps the stress at 6 m; gamma_sat: one side unset.
    assert merged.layers[0].gamma == pytest.approx(116 / 6)
    assert merged.layers[0].gamma_sat is None
    assert warnings == [
        "Unit weight gamma differs between merged layers; thickness-weighted value 19.3333 written, "
        "approval required.",
        "Unit weight gamma_sat differs between merged layers; thickness-weighted value None written, "
        "approval required."]
    same, quiet = service.merge(SoilProfile(id="P", gwt=GroundwaterCondition(depth_insitu=1), layers=[
        _layer(id="a", top=0, bottom=2), _layer(id="b", top=2, bottom=6)]), ["a", "b"])
    assert quiet == [] and same.layers[0].gamma == 20


# --- evaluation USCS from the layer's lab data ---------------------------------------------

def _lab(depth, LL, PL):
    return LabRecord(depth=depth, LL=LL, PL=PL, FC=90.0)


def _sowers_ids(project, layer):
    points = [{"depth": 2.0, "N60": 8.0}]
    lab = svc.layer_lab(project, project.profile("P"), layer)
    symbol = svc.evaluation_uscs(layer, lab)
    ids = [c.method_id for c in svc.evaluate_candidates(points, "su", lab, "clay", symbol)
           if c.method_id.startswith("Sowers")]
    return symbol, ids


def _lab_project(layer, records):
    borehole = Borehole(id="BH", lab=records)
    return _project(layers=[layer], boreholes=[borehole])


def test_cl_lab_layer_without_stored_uscs_gets_the_sowers_medium_candidate():
    layer = _layer()
    project = _lab_project(layer, [_lab(1.0, 40, 20), _lab(2.0, 42, 21)])
    symbol, ids = _sowers_ids(project, layer)
    assert symbol == "CL" and ids == ["Sowers1979_su_medium_SPT"]
    assert layer.uscs is None  # never written back


def test_stored_uscs_wins_over_the_lab_majority():
    layer = _layer(uscs="CH")
    project = _lab_project(layer, [_lab(1.0, 40, 20), _lab(2.0, 42, 21)])
    symbol, ids = _sowers_ids(project, layer)
    assert symbol == "CH" and ids == ["Sowers1979_su_high_SPT"]


def test_lab_symbol_tie_picks_the_shallowest_sample():
    layer = _layer()
    project = _lab_project(layer, [_lab(3.0, 70, 25), _lab(1.0, 40, 20)])  # CH deeper, CL shallower
    assert _sowers_ids(project, layer)[0] == "CL"
