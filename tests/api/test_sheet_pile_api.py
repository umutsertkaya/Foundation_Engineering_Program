"""Sheet pile service projection, missing water factors and input validation."""

import threading
import math

import pytest

from geotek.services import structures as service

from .job_helpers import poll_job, sheet_project, submit, wall_project


PATH = "/api/m/sheet_pile/structures/sheet/design"


@pytest.mark.parametrize("text,code,params", [
    ("Design embedment extends below the soil profile", "embedment_below_profile", {}),
    ("Tension zone to 1.25 m set to zero (tension crack)", "tension_crack", {"depth": 1.25}),
    ("Layer L1: c' ignored by the coulomb solution", "cohesion_ignored", {"layer": "L1", "method": "coulomb"}),
    ("Katman L1: TBDY Denk. 16.24b (β > φ' − ψ) uygulandı.", "steep_seismic", {"layer": "L1"}),
    ("Layer L1: Coulomb passive with delta > phi/2 is unconservative", "passive_coulomb", {"layer": "L1"}),
    ("Anchor load: 258.8 kN per anchor (spacing 2.5 m, inclination 15 deg)", "anchor_load",
     {"load": 258.8, "spacing": 2.5, "inclination": 15.0}),
])
def test_sheet_pile_all_warning_sources(text, code, params):
    from geotek.api.calculation_results import _sheet_warning

    assert _sheet_warning(text).model_dump() == {"code": f"sheet_pile.{code}", "params": params}


@pytest.mark.parametrize("advanced", [False, True])
def test_sheet_pile_warning_contract_preserves_legacy(advanced, monkeypatch):
    from geotek.api.calculation_results import sheet_pile_result

    project = sheet_project(advanced=advanced, code="ec7" if advanced else "asd")
    original = service.lateral_pressure
    diagnostic = "Tension zone to 1.25 m set to zero (tension crack)"

    def pressure(*args, **kwargs):
        result = original(*args, **kwargs)
        result.warnings.extend([diagnostic, "Unknown future diagnostic"])
        return result

    monkeypatch.setattr(service, "lateral_pressure", pressure)
    result = sheet_pile_result("sheet", service.design_sheet_pile_structure(project, "sheet"))
    assert result.warnings == [diagnostic, "Unknown future diagnostic"]
    assert [w.model_dump() for w in result.warning_items] == [
        {"code": "sheet_pile.tension_crack", "params": {"depth": 1.25}},
        {"code": "generic", "params": {"text": "Unknown future diagnostic"}},
    ]


def test_sheet_pile_real_pressure_warning_is_translatable():
    from geotek.api.calculation_results import sheet_pile_result

    project = sheet_project()
    project.structure("sheet").soil.profile.layers[0].design.c_eff = 2
    reference = service.design_sheet_pile_structure(project, "sheet")
    result = sheet_pile_result("sheet", reference)
    assert result.warnings == reference.warnings
    assert any(w.code == "sheet_pile.tension_crack" and w.params["depth"] >= 0
               for w in result.warning_items)
    assert all(w.code != "generic" for w in result.warning_items)


@pytest.mark.parametrize("advanced,anchored", [(False, True), (True, True), (False, False)])
def test_sheet_pile_per_anchor_contract(shell, advanced, anchored):
    project = sheet_project(advanced=advanced, code="ec7" if advanced else "asd", anchored=anchored)
    pile = project.structure("sheet")
    pile.anchor_spacing, pile.anchor_inclination = 2.5, 15
    pile.depth_increase, pile.front_water_depth = 0.3, 100.0
    shell.app.state.session.open_project(project)
    state = poll_job(shell, submit(shell, PATH))
    assert state["status"] == "done", state
    result = state["result"]
    assert all(a["code"] and isinstance(a["params"], dict) for a in result["assumptions"])
    if anchored:
        # Exactly the reporting formula in engine.sheet_pile.anchored_sheet_pile.
        assert result["anchor_force_per_anchor"] == pytest.approx(
            result["anchor_force"] * 2.5 / math.cos(math.radians(15)))
        assert result["anchor_spacing_used"] == 2.5
        assert result["anchor_inclination_used"] == 15
        geometry = next(a for a in result["assumptions"] if a["code"] == "sheet_pile.anchor_geometry")
        assert geometry["params"] == {"spacing": 2.5, "inclination": 15}
    else:
        assert result["anchor_force_per_anchor"] is None
        assert result["anchor_spacing_used"] is None
        assert result["anchor_inclination_used"] is None


def test_sheet_pile_additions_leave_wall_contract_compatible():
    from geotek.api import schemas as dto
    from geotek.services.walls_basic import Assumption

    assumption = Assumption(text="Existing wall assumption", source="Existing source")
    transported = dto.AssumptionDTO.model_validate(assumption)
    assert transported.code is None and transported.params == {}
    assert transported.text == assumption.text and transported.source == assumption.source
    assert not {"warning_items", "anchor_force_per_anchor", "anchor_spacing_used",
                "anchor_inclination_used"} & dto.WallResultDTO.model_fields.keys()
    other = Assumption(text="Other", source="Source")
    assumption.params["test"] = 1
    assert other.params == {}


def test_sheet_pile_optional_inputs_create_update_read_and_stale(shell):
    shell.app.state.session.open_project(sheet_project())
    values = {"depth_increase": 0.3, "anchor_spacing": 2.0,
              "anchor_inclination": 15.0, "front_water_depth": 8.0}
    created = shell.post("/api/structures", json={
        "kind": "sheet_pile", "name": "Optional inputs", "retained_height": 4,
        "support": "anchored", "anchor_depth": 1,
        "soil": sheet_project().structure("sheet").soil.model_dump(mode="json"), **values,
    })
    assert created.status_code == 200, created.text
    pile = created.json()
    for key, value in values.items():
        assert pile[key] == value
    id = pile["id"]
    state = poll_job(shell, submit(shell, f"/api/m/sheet_pile/structures/{id}/design"))
    assert state["status"] == "done", state
    stored = shell.get(f"/api/structures/{id}").json()
    stored["anchor_spacing"] = 3.0
    updated = shell.put(f"/api/structures/{id}", json=stored)
    assert updated.status_code == 200, updated.text
    assert shell.get(f"/api/structures/{id}").json()["anchor_spacing"] == 3.0
    summary = next(item for item in shell.get("/api/structures").json() if item["id"] == id)
    assert summary["stale"] is True


def test_sheet_pile_requires_open_project_and_matching_resource(shell):
    response = shell.post(PATH)
    assert response.status_code == 409 and response.json()["code"] == "no_project_open"
    project = wall_project()
    project.structures[0].id = "sheet"
    shell.app.state.session.open_project(project)
    assert shell.post(PATH).status_code == 404
    assert shell.post("/api/m/sheet_pile/structures/unknown/design").status_code == 404


@pytest.mark.parametrize("advanced,anchored", [(False, False), (False, True), (True, False)])
def test_sheet_pile_design_matches_service_envelope(shell, advanced, anchored):
    project = sheet_project(advanced=advanced, code="ec7" if advanced else "asd", anchored=anchored)
    reference = service.design_sheet_pile_structure(project, "sheet")
    shell.app.state.session.open_project(project)
    state = poll_job(shell, submit(shell, PATH))
    assert state["status"] == "done", state
    result = state["result"]
    if advanced:
        raw = reference.cases[reference.governing_moment]
        assert result["D"] == pytest.approx(reference.D_required)
        assert result["M_max"] == pytest.approx(reference.M_design)
        assert result["D0"] == pytest.approx(reference.cases[reference.governing_embedment].D0)
        assert reference.governing_moment in result["assumptions"][0]["text"]
    else:
        raw = reference.result
        assert result["D"] == pytest.approx(raw.D)
        assert result["M_max"] == pytest.approx(raw.M_max)
    assert result["total_length"] == pytest.approx(result["H"] + result["D"])
    assert result["z"] == pytest.approx(raw.z.tolist())
    assert result["shear"] == pytest.approx(raw.shear.tolist())
    assert result["moment"] == pytest.approx(raw.moment.tolist())
    assert result["net"] == pytest.approx(raw.net.tolist())
    assert len(result["z"]) == len(result["shear"]) == len(result["moment"]) == len(result["net"])
    assert result["support"] == ("anchored" if anchored else "cantilever")
    assert all(a["code"] for a in result["assumptions"])
    if anchored:
        assert result["anchor_force"] > 0 and result["toe_force"] is None
        assert result["anchor_force_per_anchor"] == pytest.approx(result["anchor_force"])
        assert result["anchor_spacing_used"] == 1.0
        assert result["anchor_inclination_used"] == 0.0
    pile = project.structure("sheet")
    assert pile.result == result
    assert pile.result_hash == service.calculation_fingerprint(project, pile)
    assert shell.get("/api/structures/sheet").json()["result"] == result
    assert shell.get("/api/structures").json()[0]["stale"] is False
    assert shell.app.state.session.dirty
    # Stored output never contributes to input freshness.
    before = pile.result_hash
    pile.result["warnings"].append("Test-only display change")
    assert service.calculation_fingerprint(project, pile) == before


def test_sheet_pile_missing_factors_prevent_submission(shell):
    project = sheet_project(advanced=True, code="ec7", wet=True)
    shell.app.state.session.open_project(project)
    response = shell.post(PATH)
    assert response.status_code == 422
    error = response.json()
    assert error["code"] == "missing_factors"
    assert any(item["path"].endswith(".WA") for item in error["missing_factors"])
    assert all(item["source"] for item in error["missing_factors"])
    assert project.structure("sheet").result is None and not shell.app.state.session.dirty


def test_sheet_pile_engine_failure_is_a_failed_job(shell):
    project = sheet_project()
    # Domain-valid profile ending just below the dredge line cannot reach equilibrium.
    project.structure("sheet").soil.profile.layers[0].bottom = 4.1
    shell.app.state.session.open_project(project)
    failed = poll_job(shell, submit(shell, PATH))
    assert failed["status"] == "failed" and failed["error"]["code"] == "engine_error"
    assert failed["result"] is None and project.structure("sheet").result is None
    assert not shell.app.state.session.dirty


def test_sheet_pile_rejects_invalid_structure_input(shell):
    shell.app.state.session.open_project(sheet_project())
    response = shell.post("/api/structures", json={
        "kind": "sheet_pile", "name": "Invalid", "retained_height": 4,
        "support": "anchored", "anchor_depth": 5,
        "soil": sheet_project().structure("sheet").soil.model_dump(mode="json"),
    })
    assert response.status_code == 422 and response.json()["code"] == "validation"


def test_sheet_pile_changed_inputs_discard_result(shell, monkeypatch):
    project = sheet_project()
    reference = service.design_sheet_pile_structure(project, "sheet")
    session = shell.app.state.session
    session.open_project(project)
    entered, release = threading.Event(), threading.Event()

    def blocked(snapshot, id, progress):
        entered.set()
        assert release.wait(10)
        assert snapshot.structure(id).surcharge == 0
        return reference

    monkeypatch.setattr(service, "design_sheet_pile_structure", blocked)
    try:
        id = submit(shell, PATH)
        assert entered.wait(10)
        with session.lock:
            project.structure("sheet").surcharge = 1
        release.set()
        state = poll_job(shell, id)
        assert state["status"] == "failed" and state["error"]["code"] == "stale_structure"
        assert project.structure("sheet").result is None and not session.dirty
    finally:
        release.set()
