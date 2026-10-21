"""anchored_wall module: manifest, state in Project.modules, anchor design routes."""

import math

import pytest

from geotek.api import registry
from geotek.core.models.anchors import AnchoredWallState
from geotek.core.models.project import ModuleSection, Project, ProjectMeta
from geotek.core.module_state import get_state

BASE = "/api/m/anchored_wall"
BODY = {
    "excavation_height": 10.0, "head_depth": 6.25, "inclination_deg": 15.0, "phi_deg": 33.0,
    "horizontal_load_per_m": 172.0, "spacing": 2.5, "ultimate_transfer_load": 100.0,
    "safety_factor": 2.0, "lock_off_ratio": 1.0, "tendon": {"type": "strand"},
}


@pytest.fixture
def open_project(shell):
    project = Project(meta=ProjectMeta(name="Anchors"))
    shell.app.state.session.open_project(project)
    return project


def test_manifest_registered_without_new_structure_or_job_kind():
    manifest = registry.get_module("anchored_wall")
    assert manifest.state_model is AnchoredWallState
    assert manifest.state_version == 1
    assert manifest.structure_kinds == ()
    assert manifest.order not in {m.order for m in registry.discover() if m.id != "anchored_wall"}


def test_design_is_pure_without_a_project(shell):
    response = shell.post(f"{BASE}/anchor/design", json=BODY)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["design_load"] == pytest.approx(172 * 2.5 / math.cos(math.radians(15)))
    assert data["bond_length"] == pytest.approx(8.9, abs=0.01)
    assert data["tendon"]["count"] == 3
    assert all(c["ok"] for c in data["checks"])
    assert shell.post(f"{BASE}/anchor/design?save=true", json=BODY).status_code == 409


def test_missing_engineering_inputs_give_a_clear_422(shell):
    body = {k: v for k, v in BODY.items()
            if k not in {"safety_factor", "ultimate_transfer_load", "lock_off_ratio"}}
    response = shell.post(f"{BASE}/anchor/design", json=body)
    assert response.status_code == 422
    error = response.json()
    assert error["code"] == "missing_inputs"
    assert error["details"]["missing"] == [
        "safety_factor", "ultimate_transfer_load|ultimate_bond_stress", "lock_off_ratio"]


def test_invalid_input_and_engine_refusal(shell):
    assert shell.post(f"{BASE}/anchor/design", json={**BODY, "head_depth": 10}).status_code == 422
    extra = shell.post(f"{BASE}/anchor/design", json={**BODY, "unknown": 1})
    assert extra.status_code == 422 and extra.json()["code"] == "validation"
    refused = shell.post(f"{BASE}/anchor/design",
                         json={**BODY, "tendon": {"type": "strand", "count": 1}})
    assert refused.status_code == 422 and "at least" in refused.json()["message"]


def test_state_defaults_save_and_stale(shell, open_project):
    assert shell.get(f"{BASE}/state").json() == {
        "state": {"anchor": None, "analysis": None}, "anchor_result_stale": False,
        "analysis_result_stale": False, "analysis_soil_stale": False}
    assert "anchored_wall" not in open_project.modules
    saved = shell.post(f"{BASE}/anchor/design?save=true", json=BODY)
    assert saved.status_code == 200
    section = open_project.modules["anchored_wall"]
    assert section.v == 1 and section.data["anchor"]["result"]["design_load"] > 0
    state = shell.get(f"{BASE}/state").json()
    assert state["anchor_result_stale"] is False
    assert state["state"]["anchor"]["inputs"]["safety_factor"] == 2.0
    assert shell.app.state.session.dirty
    # editing the inputs without recomputing marks the result stale
    stored = get_state(open_project, "anchored_wall", AnchoredWallState)
    stored.anchor.inputs.safety_factor = 2.5
    open_project.modules["anchored_wall"] = ModuleSection(v=1, data=stored.model_dump(mode="json"))
    assert shell.get(f"{BASE}/state").json()["anchor_result_stale"] is True


def test_put_state_round_trip_and_stale_refusal(shell, open_project):
    shell.post(f"{BASE}/anchor/design?save=true", json=BODY)
    state = shell.get(f"{BASE}/state").json()["state"]
    assert shell.put(f"{BASE}/state", json=state).status_code == 200
    state["anchor"]["inputs"]["phi_deg"] = 30.0
    refused = shell.put(f"{BASE}/state", json=state)
    assert refused.status_code == 422
    state["anchor"]["result"] = None
    state["anchor"]["result_hash"] = None
    ok = shell.put(f"{BASE}/state", json=state)
    assert ok.status_code == 200 and ok.json()["state"]["anchor"]["result"] is None


def test_state_requires_a_project_and_keeps_other_modules(shell):
    assert shell.get(f"{BASE}/state").status_code == 409
    project = Project(meta=ProjectMeta(name="Other"))
    project.modules["example"] = ModuleSection(v=3, data={"keep": True})
    shell.app.state.session.open_project(project)
    shell.post(f"{BASE}/anchor/design?save=true", json=BODY)
    assert project.modules["example"].data == {"keep": True}


def test_newer_state_version_is_an_error(shell):
    project = Project(meta=ProjectMeta(name="Newer"))
    project.modules["anchored_wall"] = ModuleSection(v=2, data={})
    shell.app.state.session.open_project(project)
    assert shell.get(f"{BASE}/state").status_code >= 400


def test_reference_tables_are_source_labelled(shell):
    data = shell.get(f"{BASE}/anchor/reference").json()
    assert all("GEC-4" in t["source"] for t in data["tendons"] + data["transfer_loads"])
    assert {t["id"] for t in data["tendons"]} >= {"strand_15mm_gr270", "bar_150_32"}
    assert data["defaults"]["min_free_length_strand"] == 4.5
    assert {g["ground"] for g in data["safety_factor_guidance"]} == {
        "soil", "rock", "intermediate_geomaterial"}


ANALYSIS = {
    "excavation_height": 10.0, "passive_factor": 1.5,
    "soil": {"profile": {"id": "SP", "gwt": {"depth_insitu": 100.0}, "layers": [
        {"id": "S", "top": 0, "bottom": 40, "gamma": 18.0, "gamma_sat": 20.0,
         "design": {"phi_eff": 30.0}}]}},
    "levels": [{"depth": 1.5, "spacing": 2.5}, {"depth": 4.5, "spacing": 2.5},
               {"depth": 7.5, "spacing": 2.5}],
}


def test_analysis_runs_without_a_project_and_refuses_save(shell):
    response = shell.post(f"{BASE}/analysis/run", json=ANALYSIS)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["method"] == "apparent_hinge"
    assert data["levels"][0]["horizontal_load_per_m"] == pytest.approx(120.625, abs=0.01)
    assert shell.post(f"{BASE}/analysis/run?save=true", json=ANALYSIS).status_code == 409


def test_analysis_stop_is_a_coded_422(shell):
    body = {**ANALYSIS, "backfill_slope": 5.0}
    response = shell.post(f"{BASE}/analysis/run", json=body)
    assert response.status_code == 422
    error = response.json()
    assert error["code"] == "calculation_stopped"
    assert error["details"]["stop_code"] == "envelope_sloping_ground"


def test_analysis_save_state_and_stale(shell, open_project):
    assert shell.post(f"{BASE}/analysis/run?save=true", json=ANALYSIS).status_code == 200
    state = shell.get(f"{BASE}/state").json()
    assert state["analysis_result_stale"] is False and state["analysis_soil_stale"] is False
    assert state["state"]["analysis"]["result"]["base_reaction"] == pytest.approx(27.083, abs=0.01)
    # a stored result that no longer matches its inputs is rejected
    state["state"]["analysis"]["inputs"]["excavation_height"] = 11.0
    assert shell.put(f"{BASE}/state", json=state["state"]).status_code == 422


def test_soil_copy_from_project_profile(shell, open_project):
    from geotek.core.models import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile

    profile = SoilProfile(id="P1", name="Sand", gwt=GroundwaterCondition(depth_insitu=50.0), layers=[
        SoilLayer(id="S", top=0, bottom=20, gamma=18.0, design=DesignParameters(phi_eff=30.0))])
    open_project.soil_profiles.append(profile)
    data = shell.get(f"{BASE}/soil/P1").json()
    assert data["source_profile_id"] == "P1"
    assert data["source_hash"] == profile.content_hash()
    assert data["profile"]["layers"][0]["design"]["phi_eff"] == 30.0
    assert shell.get(f"{BASE}/soil/nope").status_code == 404
