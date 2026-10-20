"""Regression tests for API defects found in the 2026-10-20 system check."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from geotek.api.app import create_app
from geotek.core.models.profile import GroundwaterCondition, SoilLayer, SoilProfile
from geotek.io.project_io import save_project
from tests.api.conftest import error_code
from tests.api.job_helpers import poll_job, submit, wall_project
from tests.api.test_soil_api import opened, upload  # noqa: F401  (fixture)
from tests.api.test_soil_parameters_api import CPT_CSV, params_path, sourced_profile

SOIL = "/api/m/soil"


@pytest.mark.parametrize("body", ['{"sds": Infinity, "source": "TBDY2018"}',
                                  '{"sds": 10, "source": "TBDY2018"}',
                                  '{"pga_g": NaN}'])
def test_site_rejects_values_that_could_not_be_reopened(shell, body):
    shell.post("/api/project/new", json={"name": "x", "language": "en"})
    response = shell.put("/api/project/site", content=body, headers={"content-type": "application/json"})
    assert response.status_code == 422 and error_code(response) == "validation"
    assert shell.get("/api/project").json()["site"]["sds"] is None


def test_opening_a_file_with_non_finite_numbers_keeps_the_session(shell, tmp_path):
    path = save_project(wall_project(geometry=True), tmp_path / "bad.gtk")
    data = json.loads(path.read_text())
    data["structures"][0]["inputs"]["surcharge"] = float("inf")
    path.write_text(json.dumps(data))
    response = shell.post("/api/project/open", json={"path": str(path)})
    assert response.status_code == 422 and error_code(response) == "invalid_project_file"
    assert shell.get("/api/session").json()["open"] is False


def _profile(shell, name="Main"):
    body = {"name": name, "origin": "manual", "source_ids": [], "gwt": {"depth_insitu": 3},
            "layers": [{"id": "a", "top": 0, "bottom": 4, "gamma": 18, "design": {"phi_eff": 30}},
                       {"id": "b", "top": 4, "bottom": 20, "gamma": 19, "design": {"phi_eff": 32}}]}
    response = shell.post(f"{SOIL}/profiles", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def test_editing_an_approved_value_through_put_revokes_the_approval(opened):
    assert upload(opened, content=CPT_CSV).status_code == 200
    profile = sourced_profile(opened)
    assert opened.put(params_path(profile, suffix="/phi_eff"),
                      json={"mode": "manual", "manual_value": 31}).status_code == 200
    approve = opened.post(params_path(profile, suffix="/approve"), json={"keys": ["phi_eff"]})
    assert approve.status_code == 200, approve.text
    path = f"{SOIL}/profiles/{profile['id']}"
    full = opened.get(path).json()
    assert full["layers"][0]["selections"]["phi_eff"]["approved"] is True
    unchanged = opened.put(path, json=full).json()
    assert unchanged["layers"][0]["selections"]["phi_eff"]["approved"] is True
    full["layers"][0]["design"]["phi_eff"] = 42
    updated = opened.put(path, json=full).json()
    selection = updated["layers"][0]["selections"]["phi_eff"]
    assert updated["layers"][0]["design"]["phi_eff"] == 42
    assert selection["approved"] is False and selection["basis_hash"] is None


def test_renaming_a_wall_or_its_source_profile_keeps_the_result_current(shell):
    shell.post("/api/project/new", json={"name": "x", "language": "en"})
    profile = _profile(shell)
    created = shell.post("/api/structures", json={
        "kind": "retaining_wall", "name": "W1", "wall_type": "cantilever", "height": 4, "embedment": 0.8,
    }).json()
    sid = created["id"]
    assert poll_job(shell, submit(shell, f"/api/m/walls/structures/{sid}/size"))["status"] == "done"

    def summary():
        return next(s for s in shell.get("/api/project").json()["structures"] if s["id"] == sid)

    assert summary()["stale"] is False and summary()["has_result"] is True
    wall = shell.get(f"/api/structures/{sid}").json()
    wall["name"] = "W1 renamed"
    assert shell.put(f"/api/structures/{sid}", json=wall).status_code == 200
    source = shell.get(f"{SOIL}/profiles/{profile['id']}").json()
    source["name"] = "Main renamed"
    assert shell.put(f"{SOIL}/profiles/{profile['id']}", json=source).status_code == 200
    assert summary()["stale"] is False
    response = shell.delete(f"{SOIL}/profiles/{profile['id']}")
    assert response.status_code == 409 and error_code(response) == "profile_in_use"
    assert response.json()["details"]["params"] == {"structures": "W1 renamed"}


def test_unrelated_soil_edit_during_a_wall_job_does_not_discard_the_result(library_dir):
    project = wall_project(geometry=True, with_global=True)
    project.soil_profiles.append(SoilProfile(
        id="unrelated", name="Other", gwt=GroundwaterCondition(depth_insitu=5),
        layers=[SoilLayer(id="x", top=0, bottom=10, gamma=18)]))
    with TestClient(create_app()) as client:
        client.app.state.session.open_project(project)
        job = submit(client, "/api/m/walls/structures/wall/check")
        other = client.get(f"{SOIL}/profiles/unrelated").json()
        other["name"] = "Other 2"
        assert client.put(f"{SOIL}/profiles/unrelated", json=other).status_code == 200
        state = poll_job(client, job, timeout=120)
        assert state["status"] == "done", state["error"]
        assert client.get("/api/project").json()["structures"][0]["has_result"] is True
