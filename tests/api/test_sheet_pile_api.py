"""Sheet pile service projection, missing water factors and input validation."""

import threading

import pytest

from geotek.services import structures as service

from .job_helpers import poll_job, sheet_project, submit, wall_project


PATH = "/api/m/sheet_pile/structures/sheet/design"


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
    if anchored:
        assert result["anchor_force"] > 0 and result["toe_force"] is None
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
