"""Wall metadata, preflight, sizing regression and snapshot-safe writeback."""

import threading

import pytest

from geotek.config.codes import FactorOverride
from geotek.core.models.project import Project
from geotek.services import structures as service

from .job_helpers import poll_job, sheet_project, submit, wall_project


PREFIX = "/api/m/walls/structures/wall"


@pytest.fixture(scope="module")
def checked_wall():
    return service.check_structure(wall_project(geometry=True), "wall")


def test_wall_types_are_available_without_project(shell):
    response = shell.get("/api/m/walls/wall-types")
    assert response.status_code == 200
    assert response.json() == [
        {"id": "cantilever", "title_key": "walls.type.cantilever"},
        {"id": "gravity", "title_key": "walls.type.gravity"},
    ]


@pytest.mark.parametrize("operation", ["required-factors", "size", "check"])
def test_wall_routes_require_project_and_matching_structure(shell, operation):
    assert shell.post(f"{PREFIX}/{operation}").status_code == 409
    assert shell.post(f"{PREFIX}/{operation}").json()["code"] == "no_project_open"
    shell.app.state.session.open_project(wall_project())
    unknown = shell.post(f"/api/m/walls/structures/unknown/{operation}")
    assert unknown.status_code == 404 and unknown.json()["code"] == "not_found"
    project = sheet_project()
    project.structures[0].id = "wall"
    shell.app.state.session.open_project(project)
    wrong_kind = shell.post(f"{PREFIX}/{operation}")
    assert wrong_kind.status_code == 404 and wrong_kind.json()["code"] == "not_found"


def test_check_requires_geometry(shell):
    project = wall_project()
    shell.app.state.session.open_project(project)
    response = shell.post(f"{PREFIX}/check")
    assert response.status_code == 422 and response.json()["code"] == "validation"
    assert project.structure("wall").result_hash is None
    assert not shell.app.state.session.dirty


def test_missing_factors_are_synchronous_and_preserve_provenance(shell):
    project = wall_project(geometry=True, advanced=True, code="tbdy2018")
    shell.app.state.session.open_project(project)
    before = project.model_dump_json()
    missing = shell.post(f"{PREFIX}/required-factors")
    assert missing.status_code == 200
    rows = missing.json()
    assert "TBDY-seismic.material.tan_phi" in {row["path"] for row in rows}
    assert all(row["source"] and row["status"] == "not_in_source" for row in rows)
    for operation in ("size", "check"):
        response = shell.post(f"{PREFIX}/{operation}")
        assert response.status_code == 422
        error = response.json()
        assert error["code"] == "missing_factors" and error["missing_factors"] == rows
    assert project.model_dump_json() == before and not shell.app.state.session.dirty


def test_engine_validation_errors_in_preflight_use_envelope(shell):
    project = wall_project(advanced=True, code="unknown")
    shell.app.state.session.open_project(project)
    response = shell.post(f"{PREFIX}/required-factors")
    assert response.status_code == 400 and response.json()["code"] == "engine_error"


def test_five_metre_wall_regression_size_then_check_and_persist(shell, tmp_path):
    project = wall_project(with_global=True)
    shell.app.state.session.open_project(project)
    assert shell.post(f"{PREFIX}/required-factors").json() == []
    job = submit(shell, f"{PREFIX}/size")
    state = poll_job(shell, job, timeout=180)
    assert state["status"] == "done", state
    result = state["result"]
    wall = project.structure("wall")
    assert wall.geometry.width == pytest.approx(4.60)
    assert result["passed"] and result["governing"] == "seismic:bearing"
    assert result["geometry"] == wall.geometry.model_dump(mode="json")
    assert {row["case"] for row in result["checks"]} == {"static", "seismic"}
    assert any(row["name"] == "global_stability" for row in result["checks"])
    assert len(result["slip_circles"]) == 2 and len(result["pressures"]) == 4
    assert result["factors_used"] and result["forces"] and result["assumptions"]
    for row in result["checks"]:
        if row["value"] not in (None, 0) and row["required"]:
            expected = (row["required"] / row["value"] if row["comparison"] == ">="
                        else row["value"] / row["required"])
            assert row["utilisation"] == pytest.approx(expected)
    assert wall.result == result and wall.result_hash == result["result_hash"]
    assert wall.result_hash == service.calculation_fingerprint(project, wall)
    assert shell.get("/api/structures").json()[0]["stale"] is False
    assert shell.app.state.session.dirty
    check = poll_job(shell, submit(shell, f"{PREFIX}/check"), timeout=60)
    assert check["status"] == "done" and check["result"]["passed"]
    assert check["result"]["iterations"] == 0
    from geotek.io.project_io import load_project
    path = tmp_path / "calculated.gtk"
    assert shell.post("/api/project/save", json={"path": str(path)}).status_code == 200
    restored = load_project(path)
    assert restored.structure("wall").result == check["result"]
    assert restored.structure("wall").result_hash == service.calculation_fingerprint(
        restored, restored.structure("wall"))
    edited = shell.get("/api/structures/wall").json()
    edited["inputs"]["surcharge"] += 1
    assert shell.put("/api/structures/wall", json=edited).status_code == 200
    assert shell.get("/api/structures").json()[0]["stale"] is True


@pytest.mark.parametrize("change", ["project", "close", "load", "soil", "source", "override", "delete"])
def test_jobs_discard_when_project_or_calculation_inputs_change(shell, monkeypatch, checked_wall, change):
    project = wall_project(geometry=True)
    if change == "source":
        source = project.structure("wall").soil.profile.model_copy(deep=True, update={"id": "source"})
        project.soil_profiles.append(source)
        project.structure("wall").soil.source_profile_id = source.id
        project.structure("wall").soil.source_hash = source.content_hash()
    session = shell.app.state.session
    session.open_project(project)
    entered, release = threading.Event(), threading.Event()
    snapshots = []

    def blocked(snapshot, id, progress):
        assert snapshot is not project
        snapshots.append(snapshot)
        progress(0.2, "job.step.earth_pressure")
        entered.set()
        assert release.wait(10)
        assert snapshot.structure(id).inputs.surcharge == 10
        return checked_wall

    monkeypatch.setattr(service, "check_structure", blocked)
    try:
        id = submit(shell, f"{PREFIX}/check")
        assert entered.wait(10)
        if change == "project":
            # Even an identical new project, with the same structure id, is distinct.
            replacement = Project.model_validate(project.model_dump())
            session.open_project(replacement)
        elif change == "close":
            assert shell.post("/api/project/close").status_code == 200
        elif change == "delete":
            assert shell.delete("/api/structures/wall").status_code == 200
        else:
            with session.lock:
                if change == "load":
                    project.structure("wall").inputs.surcharge = 11
                elif change == "soil":
                    project.structure("wall").soil.profile.layers[0].gamma += 1
                elif change == "source":
                    project.soil_profiles[0].layers[0].gamma += 1
                else:
                    project.design_overrides["asd"] = {
                        "safety.sliding.static": FactorOverride(value=1.6, note="API test input")}
        session.dirty = False
        release.set()
        state = poll_job(shell, id)
        assert state["status"] == "failed" and state["result"] is None
        assert state["error"]["code"] == "stale_structure"
        assert state["error"]["details"]["discarded"] is True
        assert not session.dirty
        assert all(item.result is None and item.result_hash is None for item in project.structures)
        if session.project is not None:
            assert all(item.result is None for item in session.project.structures)
        assert len(snapshots) == 1
    finally:
        release.set()


def test_wall_cancellation_does_not_store_result(shell, monkeypatch, checked_wall):
    project = wall_project(geometry=True)
    session = shell.app.state.session
    session.open_project(project)
    entered, release = threading.Event(), threading.Event()

    def blocked(snapshot, id, progress):
        progress(0.2, "job.step.earth_pressure")
        entered.set()
        assert release.wait(10)
        progress(0.8, "job.step.stability_checks")
        return checked_wall

    monkeypatch.setattr(service, "check_structure", blocked)
    try:
        id = submit(shell, f"{PREFIX}/check")
        assert entered.wait(10)
        assert shell.delete(f"/api/jobs/{id}").status_code == 200
        release.set()
        assert poll_job(shell, id)["status"] == "cancelled"
        assert project.structure("wall").result is None
        assert project.structure("wall").result_hash is None and not session.dirty
    finally:
        release.set()
