"""Design-code endpoints use the supplied code data and project factor overrides."""

from dataclasses import replace

import pytest
import yaml

from geotek.api import registry
from geotek.config.codes import get_design_code, list_design_codes
from geotek.io.project_io import load_project
from geotek.library import load_settings, save_settings
from geotek.services.walls_advanced import list_factors, required_inputs

from .conftest import error_code


def test_list_codes_without_project_and_localized_names(shell):
    codes = list_design_codes()
    response = shell.get("/api/codes")
    assert response.status_code == 200
    assert response.json() == [
        {"id": code.id, "name": code.label.tr, "approach": code.approach,
         "approaches": list(code.approaches)} for code in codes.values()
    ]
    settings = load_settings()
    settings.language = "en"
    save_settings(settings)
    assert [row["name"] for row in shell.get("/api/codes").json()] == [
        code.label.en for code in codes.values()]
    shell.post("/api/library", json={"name": "Codes", "language": "tr"})
    assert [row["name"] for row in shell.get("/api/codes").json()] == [
        code.label.tr for code in codes.values()]
    assert not shell.app.state.session.dirty


@pytest.mark.parametrize("code_id", list(list_design_codes()))
def test_factor_rows_match_data_and_provenance(shell, code_id):
    response = shell.get(f"/api/codes/{code_id}/factors")
    assert response.status_code == 200
    assert response.json() == [row.model_dump() for row in list_factors(code_id)]
    code = get_design_code(code_id)
    for row in response.json():
        assert row["value"] == code.get(row["path"])
        assert row["source"] == code.source_of(row["path"]).source
        assert row["status"] == code.source_of(row["path"]).status


@pytest.mark.parametrize("code_id", list(list_design_codes()))
@pytest.mark.parametrize("seismic", [False, True])
def test_required_factors_match_service_for_all_approaches(shell, code_id, seismic):
    code = get_design_code(code_id)
    for approach in [None, *code.approaches]:
        params = {"seismic": str(seismic).lower()}
        if approach is not None:
            params["approach"] = approach
        response = shell.get(f"/api/codes/{code_id}/required", params=params)
        assert response.status_code == 200, response.text
        assert response.json() == [item.model_dump() for item in required_inputs(
            code_id, approach=approach, seismic=seismic)]


@pytest.mark.parametrize("method,path,body", [
    ("GET", "/api/codes/unknown/factors", None),
    ("GET", "/api/codes/unknown/required", None),
    ("PUT", "/api/project/design-overrides/unknown", {}),
])
def test_unknown_code(shell, method, path, body):
    shell.post("/api/library", json={"name": "Codes"})
    response = shell.request(method, path, **({"json": body} if body is not None else {}))
    assert response.status_code == 404 and error_code(response) == "not_found"
    assert not shell.app.state.session.dirty


def test_overrides_require_project(shell):
    response = shell.put("/api/project/design-overrides/asd", json={})
    assert response.status_code == 409 and error_code(response) == "no_project_open"


@pytest.mark.parametrize("query", ["approach=unknown", "seismic=invalid"])
def test_required_invalid_query(shell, query):
    response = shell.get("/api/codes/tbdy2018/required?" + query)
    assert response.status_code == 422 and error_code(response) == "validation"


def test_overrides_replace_persist_and_clear(shell, library_dir):
    entry = shell.post("/api/library", json={"name": "Codes"}).json()
    path = "/api/project/design-overrides/tbdy2018"
    missing_before = shell.get("/api/codes/tbdy2018/required").json()
    selected = missing_before[0]["path"]
    overrides = {selected: {"value": 1.7, "note": "Project specification"}}
    response = shell.put(path, json=overrides)
    assert response.status_code == 200 and response.json() == overrides
    assert shell.app.state.session.dirty
    rows = {row["path"]: row for row in shell.get("/api/codes/tbdy2018/factors").json()}
    assert rows[selected]["value"] == 1.7 and rows[selected]["status"] == "user"
    assert "Project specification" in rows[selected]["source"]
    assert shell.get("/api/codes/tbdy2018/required").json() == [
        item for item in missing_before if item["path"] != selected]
    assert get_design_code("tbdy2018").get(selected) is None
    shell.post("/api/project/save")
    saved = load_project(library_dir / entry["file"])
    assert saved.design_overrides["tbdy2018"][selected].value == 1.7
    shell.post("/api/project/close")
    shell.post(f"/api/library/{entry['file']}/open")
    assert {row["path"]: row for row in shell.get("/api/codes/tbdy2018/factors").json()}[
        selected]["status"] == "user"
    # Replacing one code's overrides preserves the other codes.
    asd = {"safety.sliding.static": {"value": 1.6, "note": "Specification"}}
    assert shell.put("/api/project/design-overrides/asd", json=asd).json() == asd
    assert shell.put(path, json={}).json() == {}
    assert shell.get("/api/codes/tbdy2018/required").json() == missing_before
    assert shell.app.state.session.project.design_overrides["asd"]
    shell.post("/api/project/close")
    assert shell.get("/api/codes/tbdy2018/required").json() == missing_before


@pytest.mark.parametrize("code_id,payload", [
    ("asd", {"safety.sliding.static": {"value": 0.9}}),
    ("asd", {"eccentricity.soil.static": {"value": 0.6}}),
    ("asd", {"unknown": {"value": 1.5}}),
    ("asd", {"safety.sliding.unknown": {"value": 1.5}}),
    ("asd", {"safety.sliding.static": {"value": "invalid"}}),
    ("asd", {"safety.sliding.static": {}}),
    ("tbdy2018", {"unknown": {"value": 1.5}}),
    ("tbdy2018", {"TBDY-static.material.tan_phi": {"value": 0.8}}),
    ("tbdy2018", {"TBDY-static.load.G_unfav": {"value": -1}}),
    ("aashto_lrfd", {"resistance.strength.bearing": {"value": 1.2}}),
])
def test_invalid_override_is_atomic(shell, code_id, payload):
    shell.post("/api/library", json={"name": "Codes"})
    session = shell.app.state.session
    before = session.project.model_dump()
    response = shell.put(f"/api/project/design-overrides/{code_id}", json=payload)
    assert response.status_code == 422, response.text
    assert error_code(response) == "validation"
    assert session.project.model_dump() == before and not session.dirty


def test_nonfinite_override_rejected(shell):
    shell.post("/api/library", json={"name": "Codes"})
    response = shell.put("/api/project/design-overrides/asd",
                         content='{"safety.sliding.static":{"value":1e999}}',
                         headers={"Content-Type": "application/json"})
    assert response.status_code == 422 and error_code(response) == "validation"
    assert not shell.app.state.session.dirty


def test_module_design_codes_use_same_services(shell, tmp_path, monkeypatch):
    code = get_design_code("tbdy2018").model_dump()
    code["id"] = "module_test"
    code["label"] = {"tr": "Module test TR", "en": "Module test EN"}
    directory = tmp_path / "codes"
    directory.mkdir()
    (directory / "module_test.yaml").write_text(yaml.safe_dump(code), encoding="utf-8")
    manifests = registry.discover()
    monkeypatch.setattr(registry, "discover", lambda: [
        replace(manifests[0], design_code_dirs=(directory,)), *manifests[1:]])
    listed = {item["id"]: item for item in shell.get("/api/codes").json()}
    assert listed["module_test"]["name"] == "Module test TR"
    rows = shell.get("/api/codes/module_test/factors")
    assert rows.status_code == 200 and rows.json()
    missing = shell.get("/api/codes/module_test/required")
    assert missing.status_code == 200 and missing.json()
    shell.post("/api/library", json={"name": "Module code"})
    overrides = {missing.json()[0]["path"]: {"value": 1.8, "note": "Test specification"}}
    response = shell.put("/api/project/design-overrides/module_test", json=overrides)
    assert response.status_code == 200, response.text
    assert len(shell.get("/api/codes/module_test/required").json()) == len(missing.json()) - 1
    row = next(row for row in shell.get("/api/codes/module_test/factors").json()
               if row["path"] in overrides)
    assert row["status"] == "user" and row["value"] == 1.8
