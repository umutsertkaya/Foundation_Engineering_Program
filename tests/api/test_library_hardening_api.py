"""Core shell API hardening: export safety, case identity, failure atomicity, dirty flag."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from geotek.api import library_routes
from geotek.library import load_settings

from .conftest import error_code
from .test_library_api import create


def test_export_conflict_and_overwrite(shell, tmp_path):
    create(shell, "Alfa")
    dest = tmp_path / "out.gtk"
    dest.write_text("precious", encoding="utf-8")
    response = shell.post("/api/library/alfa.gtk/export", json={"dest": str(dest)})
    assert response.status_code == 409 and error_code(response) == "file_exists"
    assert dest.read_text(encoding="utf-8") == "precious"
    response = shell.post(
        "/api/library/alfa.gtk/export", json={"dest": str(dest), "overwrite": True})
    assert response.status_code == 200
    assert '"Alfa"' in dest.read_text(encoding="utf-8")


def test_export_directory_suffix_and_invalid_path(shell, tmp_path):
    create(shell, "Alfa")
    (tmp_path / "dir").mkdir()
    response = shell.post("/api/library/alfa.gtk/export", json={"dest": str(tmp_path / "dir")})
    assert response.status_code == 200
    assert Path(response.json()["path"]) == tmp_path / "dir" / "alfa.gtk"
    response = shell.post("/api/library/alfa.gtk/export", json={"dest": str(tmp_path / "plain")})
    assert Path(response.json()["path"]) == tmp_path / "plain.gtk"
    response = shell.post("/api/library/alfa.gtk/export", json={"dest": str(tmp_path / "x.txt")})
    assert response.status_code == 400 and error_code(response) == "invalid_path"
    assert not (tmp_path / "x.gtk").exists()


def test_reserved_names_are_400(shell):
    for file in ("CON.gtk", "nul.gtk", "x%20.gtk", "x..gtk"):
        response = shell.post(f"/api/library/{file}/open")
        assert response.status_code == 400 and error_code(response) == "invalid_file_name", file


@pytest.mark.skipif(os.name != "nt", reason="case-insensitive file system")
def test_open_project_identity_is_case_insensitive(shell, library_dir):
    create(shell, "Alfa")
    response = shell.delete("/api/library/ALFA.GTK")
    assert response.status_code == 409 and error_code(response) == "project_open"
    assert (library_dir / "alfa.gtk").is_file()
    renamed = shell.post("/api/library/ALFA.gtk/rename", json={"name": "Delta"})
    assert renamed.status_code == 200 and renamed.json()["file"] == "delta.gtk"
    assert shell.get("/api/session").json()["file"] == "delta.gtk"
    response = shell.post("/api/library/DELTA.GTK/open")
    assert response.json()["file"] == "delta.gtk"


def test_open_identity_uses_normalized_names(shell, monkeypatch):
    create(shell, "Alfa")
    session = shell.app.state.session
    monkeypatch.setattr(library_routes, "normalize", str.lower)
    assert library_routes._is_open(session, "ALFA.GTK")
    assert not library_routes._is_open(session, "beta.gtk")


def test_failed_open_keeps_current_session(shell, library_dir):
    create(shell, "Alfa")
    (library_dir / "bozuk.gtk").write_text("{ not json", encoding="utf-8")
    response = shell.post("/api/library/bozuk.gtk/open")
    assert response.status_code == 422
    assert shell.get("/api/session").json()["file"] == "alfa.gtk"
    assert shell.get("/api/project").json()["meta"]["name"] == "Alfa"


def test_failed_create_keeps_current_session(shell, monkeypatch):
    create(shell, "Alfa")

    def fail(self, meta):
        raise OSError("disk full")

    monkeypatch.setattr(type(shell.app.state.session.library), "create", fail)
    response = shell.post("/api/library", json={"name": "Beta"})
    assert response.status_code == 400 and error_code(response) == "invalid_path"
    assert shell.get("/api/session").json()["file"] == "alfa.gtk"


def test_recent_persistence_failure_does_not_fail_request(shell, monkeypatch):
    def fail(settings):
        raise OSError("read-only settings")

    monkeypatch.setattr(library_routes, "save_settings", fail)
    response = shell.post("/api/library", json={"name": "Alfa"})
    assert response.status_code == 200
    assert shell.post("/api/library/alfa.gtk/open").status_code == 200
    assert shell.get("/api/session").json()["file"] == "alfa.gtk"
    assert load_settings().recent == []


def test_settings_invalid_library_dir_keeps_old_settings(shell, library_dir, tmp_path):
    blocker = tmp_path / "blocker"
    blocker.write_text("a file", encoding="utf-8")
    before = shell.get("/api/settings").json()
    response = shell.put(
        "/api/settings", json={"library_dir": str(blocker / "sub"), "language": "en"})
    assert response.status_code == 400 and error_code(response) == "invalid_path"
    assert shell.get("/api/settings").json() == before
    assert load_settings().language == "tr"
    assert shell.app.state.session.library.root == library_dir.resolve()


def test_settings_creates_new_library_before_persisting(shell, tmp_path):
    other = tmp_path / "fresh" / "lib"
    response = shell.put("/api/settings", json={"library_dir": str(other), "language": "tr"})
    assert response.status_code == 200
    assert other.is_dir()


def test_meta_dirty_only_when_changed(shell):
    create(shell, "Alfa")
    assert shell.get("/api/session").json()["dirty"] is False
    assert shell.patch("/api/project/meta", json={"name": "Alfa"}).status_code == 200
    assert shell.patch("/api/project/meta", json={}).status_code == 200
    assert shell.get("/api/session").json()["dirty"] is False
    assert shell.patch("/api/project/meta", json={"engineer": "Yeni"}).status_code == 200
    assert shell.get("/api/session").json()["dirty"] is True


def test_put_site_identical_keeps_dirty_false(shell):
    create(shell, "Alfa")
    site = shell.app.state.session.require_project().site.model_dump(mode="json")
    assert shell.put("/api/project/site", json=site).status_code == 200
    assert shell.get("/api/session").json()["dirty"] is False
    assert shell.put("/api/project/site", json={**site, "mw": 7.0}).status_code == 200
    assert shell.get("/api/session").json()["dirty"] is True
