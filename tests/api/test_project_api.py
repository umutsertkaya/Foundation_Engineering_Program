"""Core shell API: current project, dirty tracking and persistence."""

from __future__ import annotations

import json
from pathlib import Path

from geotek.core.models.project import Project, ProjectMeta
from geotek.io.project_io import load_project, save_project

from .conftest import error_code


def read_meta(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))["meta"]


def test_no_project_open_errors(shell):
    for method, url, body in (
        ("GET", "/api/project", None),
        ("POST", "/api/project/save", None),
        ("PATCH", "/api/project/meta", {"name": "X"}),
        ("PUT", "/api/project/site", {"pga_g": 0.2}),
        ("PUT", "/api/project/active-profile", {"profile_id": None}),
    ):
        response = shell.request(method, url, **({"json": body} if body else {}))
        assert response.status_code == 409, (url, response.text)
        assert error_code(response) == "no_project_open"


def test_create_open_patch_save_cycle(shell, library_dir):
    created = shell.post("/api/library", json={"name": "Proje", "number": "7"}).json()
    file = library_dir / created["file"]
    summary = shell.get("/api/project").json()
    assert summary["meta"]["name"] == "Proje" and summary["meta"]["number"] == "7"
    assert summary["counts"] == {"boreholes": 0, "cpts": 0, "profiles": 0, "structures": 0}
    assert summary["structures"] == [] and summary["active_profile_id"] is None
    assert shell.get("/api/session").json()["dirty"] is False

    patched = shell.patch("/api/project/meta", json={"engineer": "Mühendis", "number": "8"})
    assert patched.status_code == 200
    assert patched.json()["engineer"] == "Mühendis" and patched.json()["name"] == "Proje"
    assert shell.get("/api/session").json() == {
        "open": True, "file": created["file"], "dirty": True}
    assert read_meta(file)["engineer"] == ""  # not saved yet

    saved = shell.post("/api/project/save")
    assert saved.status_code == 200
    assert saved.json()["open"] is True and saved.json()["dirty"] is False
    assert saved.json()["file"] == created["file"]
    assert Path(saved.json()["path"]) == file.resolve()
    assert shell.get("/api/session").json()["dirty"] is False
    assert read_meta(file)["engineer"] == "Mühendis" and read_meta(file)["number"] == "8"

    # Re-open from disk returns the saved state.
    shell.post("/api/project/close")
    shell.post(f"/api/library/{created['file']}/open")
    assert shell.get("/api/project").json()["meta"]["engineer"] == "Mühendis"


def test_patch_meta_validation_and_no_dirty_on_error(shell):
    shell.post("/api/library", json={"name": "Proje"})
    response = shell.patch("/api/project/meta", json={"language": "de"})
    assert response.status_code == 422 and error_code(response) == "validation"
    assert shell.get("/api/session").json()["dirty"] is False


def test_site_and_active_profile(shell):
    shell.post("/api/library", json={"name": "Proje"})
    site = shell.put("/api/project/site", json={"pga_g": 0.25, "mw": 7.0})
    assert site.status_code == 200 and site.json()["pga_g"] == 0.25
    assert shell.get("/api/session").json()["dirty"] is True
    assert shell.get("/api/project").json()["site"]["mw"] == 7.0
    assert shell.put("/api/project/site", json={"pga_g": 9}).status_code == 422

    response = shell.put("/api/project/active-profile", json={"profile_id": "P404"})
    assert response.status_code == 404 and error_code(response) == "not_found"
    response = shell.put("/api/project/active-profile", json={"profile_id": None})
    assert response.status_code == 200 and response.json()["active_profile_id"] is None


def test_active_profile_existing_id(shell, library_dir, two_layer_profile):
    created = shell.post("/api/library", json={"name": "Proje"}).json()
    file = library_dir / created["file"]
    project = load_project(file)
    project.soil_profiles.append(two_layer_profile)
    save_project(project, file)
    shell.post(f"/api/library/{created['file']}/open")
    response = shell.put("/api/project/active-profile", json={"profile_id": "P1"})
    assert response.status_code == 200
    assert response.json()["active_profile_id"] == "P1"
    assert response.json()["counts"]["profiles"] == 1
    shell.post("/api/project/save")
    assert json.loads(file.read_text(encoding="utf-8"))["active_profile_id"] == "P1"


def test_close_discards_and_clears_session(shell):
    shell.post("/api/library", json={"name": "Proje"})
    shell.patch("/api/project/meta", json={"engineer": "X"})
    response = shell.post("/api/project/close")
    assert response.status_code == 200
    assert response.json() == {"open": False, "file": None, "dirty": False}
    after = shell.get("/api/project")
    assert after.status_code == 409 and error_code(after) == "no_project_open"
    assert shell.post("/api/project/close").json()["open"] is False


def test_legacy_new_is_unsaved_and_save_needs_path(shell, tmp_path):
    summary = shell.post("/api/project/new", json={"name": "Taslak", "language": "en"})
    assert summary.status_code == 200 and summary.json()["meta"]["language"] == "en"
    assert shell.get("/api/session").json() == {"open": True, "file": None, "dirty": True}
    response = shell.post("/api/project/save")
    assert response.status_code == 400 and error_code(response) == "no_save_target"

    target = tmp_path / "elle" / "taslak.gtk"
    target.parent.mkdir()
    saved = shell.post("/api/project/save", json={"path": str(target)})
    assert saved.status_code == 200 and Path(saved.json()["path"]) == target.resolve()
    assert saved.json()["dirty"] is False and saved.json()["file"] is None
    assert read_meta(target)["name"] == "Taslak"
    # Later saves go to the same path.
    shell.patch("/api/project/meta", json={"engineer": "Z"})
    assert shell.post("/api/project/save").status_code == 200
    assert read_meta(target)["engineer"] == "Z"


def test_legacy_open_path_saves_back_to_path(shell, tmp_path):
    path = tmp_path / "dis.gtk"
    save_project(Project(meta=ProjectMeta(name="Dis")), path)
    summary = shell.post("/api/project/open", json={"path": str(path)})
    assert summary.status_code == 200 and summary.json()["meta"]["name"] == "Dis"
    assert shell.get("/api/session").json() == {"open": True, "file": None, "dirty": False}
    shell.patch("/api/project/meta", json={"engineer": "Q"})
    saved = shell.post("/api/project/save")
    assert saved.status_code == 200 and Path(saved.json()["path"]) == path.resolve()
    assert read_meta(path)["engineer"] == "Q"


def test_legacy_open_errors(shell, tmp_path):
    missing = shell.post("/api/project/open", json={"path": str(tmp_path / "yok.gtk")})
    assert missing.status_code == 404 and error_code(missing) == "not_found"
    bad = tmp_path / "bad.gtk"
    bad.write_text("nope", encoding="utf-8")
    response = shell.post("/api/project/open", json={"path": str(bad)})
    assert response.status_code == 422 and error_code(response) == "invalid_project_file"
    assert shell.get("/api/session").json()["open"] is False
