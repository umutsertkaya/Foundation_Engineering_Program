"""Core shell API: modules, settings, library and session over a temporary library."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from geotek.api.app import create_app
from geotek.library import load_settings

from .conftest import error_code


def create(client, name="Çağlayan Şev", **extra):
    response = client.post("/api/library", json={"name": name, **extra})
    assert response.status_code == 200, response.text
    return response.json()


def test_modules_in_menu_order(shell):
    response = shell.get("/api/modules")
    assert response.status_code == 200
    modules = response.json()
    assert [m["id"] for m in modules] == ["soil", "liquefaction", "walls", "sheet_pile", "report"]
    assert [m["order"] for m in modules] == sorted(m["order"] for m in modules)
    assert set(modules[0]) == {"id", "version", "title_key", "description_key", "icon", "order"}


def test_empty_library_and_session(shell):
    assert shell.get("/api/library").json() == []
    assert shell.get("/api/session").json() == {"open": False, "file": None, "dirty": False}


def test_create_opens_project_and_lists_entry(shell, library_dir):
    entry = create(shell, number="GTK-1", engineer="Ayşe")
    assert entry["file"] == "caglayan-sev.gtk"
    assert (entry["name"], entry["number"], entry["engineer"]) == ("Çağlayan Şev", "GTK-1", "Ayşe")
    assert entry["error"] is None and entry["size"] > 0
    assert entry["schema_version"]
    assert (library_dir / "caglayan-sev.gtk").is_file()
    assert shell.get("/api/session").json() == {
        "open": True, "file": "caglayan-sev.gtk", "dirty": False}
    assert [e["file"] for e in shell.get("/api/library").json()] == ["caglayan-sev.gtk"]
    recent = load_settings().recent
    assert recent == [str((library_dir / "caglayan-sev.gtk").resolve())]


def test_create_uses_request_language_and_unique_names(shell):
    first = create(shell, "Alfa")
    second = create(shell, "Alfa", language="en", design_code="tbdy")
    assert (first["file"], second["file"]) == ("alfa.gtk", "alfa-2.gtk")
    assert shell.get("/api/project").json()["meta"]["language"] == "en"


def test_create_rejects_blank_name(shell):
    response = shell.post("/api/library", json={"name": "   "})
    assert response.status_code == 422 and error_code(response) == "validation"


def test_open_switches_project_and_pushes_recent(shell, library_dir):
    create(shell, "Alfa")
    create(shell, "Beta")
    assert shell.get("/api/project").json()["meta"]["name"] == "Beta"
    response = shell.post("/api/library/alfa.gtk/open")
    assert response.status_code == 200
    assert response.json() == {"open": True, "file": "alfa.gtk", "dirty": False}
    assert shell.get("/api/project").json()["meta"]["name"] == "Alfa"
    assert load_settings().recent[0] == str((library_dir / "alfa.gtk").resolve())


def test_duplicate_rename_export_import(shell, library_dir, tmp_path):
    create(shell, "Alfa")
    shell.post("/api/project/close")
    copy = shell.post("/api/library/alfa.gtk/duplicate")
    assert copy.status_code == 200
    assert copy.json()["name"] == "Alfa (kopya)"
    assert copy.json()["file"] == "alfa-kopya.gtk"

    renamed = shell.post("/api/library/alfa-kopya.gtk/rename", json={"name": "Gamma"})
    assert renamed.status_code == 200
    assert renamed.json()["file"] == "gamma.gtk" and renamed.json()["name"] == "Gamma"
    assert not (library_dir / "alfa-kopya.gtk").exists()
    assert {e["file"] for e in shell.get("/api/library").json()} == {"alfa.gtk", "gamma.gtk"}

    dest = tmp_path / "out" / "disari.gtk"
    exported = shell.post("/api/library/gamma.gtk/export", json={"dest": str(dest)})
    assert exported.status_code == 200
    assert Path(exported.json()["path"]) == dest and dest.is_file()
    assert json.loads(dest.read_text(encoding="utf-8"))["meta"]["name"] == "Gamma"

    imported = shell.post("/api/library/import", json={"path": str(dest)})
    assert imported.status_code == 200
    assert imported.json()["file"] == "disari.gtk" and imported.json()["name"] == "Gamma"
    assert (library_dir / "disari.gtk").is_file()


def test_rename_open_project_follows_file(shell, library_dir):
    create(shell, "Alfa")
    renamed = shell.post("/api/library/alfa.gtk/rename", json={"name": "Delta"})
    assert renamed.json()["file"] == "delta.gtk"
    assert shell.get("/api/session").json()["file"] == "delta.gtk"
    assert shell.get("/api/project").json()["meta"]["name"] == "Delta"
    assert shell.post("/api/project/save").status_code == 200
    assert not (library_dir / "alfa.gtk").exists()


def test_delete_moves_to_trash(shell, library_dir):
    create(shell, "Alfa")
    shell.post("/api/project/close")
    response = shell.delete("/api/library/alfa.gtk")
    assert response.status_code == 200
    trash = Path(response.json()["trash_path"])
    assert trash.is_file() and trash.parent == library_dir.resolve() / ".trash"
    assert shell.get("/api/library").json() == []


def test_delete_open_project_is_refused(shell, library_dir):
    create(shell, "Alfa")
    response = shell.delete("/api/library/alfa.gtk")
    assert response.status_code == 409 and error_code(response) == "project_open"
    assert (library_dir / "alfa.gtk").is_file()
    shell.post("/api/project/close")
    assert shell.delete("/api/library/alfa.gtk").status_code == 200


def test_missing_file_is_404(shell, tmp_path):
    for method, url, body in (
        ("POST", "/api/library/yok.gtk/open", None),
        ("POST", "/api/library/yok.gtk/duplicate", None),
        ("POST", "/api/library/yok.gtk/rename", {"name": "X"}),
        ("POST", "/api/library/yok.gtk/export", {"dest": str(tmp_path / "x.gtk")}),
        ("DELETE", "/api/library/yok.gtk", None),
        ("POST", "/api/library/import", {"path": str(tmp_path / "yok.gtk")}),
    ):
        response = shell.request(method, url, **({"json": body} if body else {}))
        assert response.status_code == 404, (url, response.text)
        assert error_code(response) == "not_found"


def test_invalid_file_names_are_400(shell):
    for file in ("x.txt", "a%5Cb.gtk", "..%5Cx.gtk", "c%3Ax.gtk", "x.gtk.exe"):
        for method, suffix in (("POST", "/open"), ("POST", "/duplicate"), ("DELETE", "")):
            response = shell.request(method, f"/api/library/{file}{suffix}")
            assert response.status_code == 400, (file, suffix, response.text)
            assert error_code(response) == "invalid_file_name"
    response = shell.post("/api/library/..%5Cx.gtk/rename", json={"name": "X"})
    assert response.status_code == 400 and error_code(response) == "invalid_file_name"
    response = shell.post("/api/library/..%5Cx.gtk/export", json={"dest": "x.gtk"})
    assert response.status_code == 400
    # An encoded slash never reaches the handler as a file name.
    assert shell.post("/api/library/..%2Fx.gtk/open").status_code in {400, 404}


def test_corrupt_file_listed_with_error_and_open_is_422(shell, library_dir):
    create(shell, "Alfa")
    shell.post("/api/project/close")
    (library_dir / "bozuk.gtk").write_text("{ not json", encoding="utf-8")
    entries = {e["file"]: e for e in shell.get("/api/library").json()}
    assert entries["bozuk.gtk"]["error"]
    assert entries["alfa.gtk"]["error"] is None
    response = shell.post("/api/library/bozuk.gtk/open")
    assert response.status_code == 422 and error_code(response) == "invalid_project_file"
    assert shell.get("/api/session").json()["open"] is False
    response = shell.post("/api/library/bozuk.gtk/duplicate")
    assert response.status_code == 422 and error_code(response) == "invalid_project_file"


def test_import_rejects_unreadable_file(shell, tmp_path):
    bad = tmp_path / "bad.gtk"
    bad.write_text("{}", encoding="utf-8")
    response = shell.post("/api/library/import", json={"path": str(bad)})
    assert response.status_code == 422 and error_code(response) == "invalid_project_file"
    assert shell.get("/api/library").json() == []


def test_settings_round_trip_and_library_switch(shell, library_dir, tmp_path):
    initial = shell.get("/api/settings").json()
    assert initial == {"library_dir": str(library_dir), "language": "tr", "recent": []}
    create(shell, "Alfa")
    recent = shell.get("/api/settings").json()["recent"]
    assert len(recent) == 1

    other = tmp_path / "baska"
    updated = shell.put("/api/settings", json={
        "library_dir": str(other), "language": "en", "recent": ["C:/ignored.gtk"]})
    assert updated.status_code == 200
    assert updated.json() == {"library_dir": str(other), "language": "en", "recent": recent}
    assert load_settings().language == "en" and load_settings().library_dir == other
    assert shell.get("/api/settings").json() == updated.json()
    assert shell.get("/api/library").json() == []

    # The project opened from the old library keeps saving to its old location.
    assert shell.get("/api/session").json() == {"open": True, "file": None, "dirty": False}
    shell.patch("/api/project/meta", json={"engineer": "Yeni"})
    assert shell.post("/api/project/save").status_code == 200
    old = json.loads((library_dir / "alfa.gtk").read_text(encoding="utf-8"))
    assert old["meta"]["engineer"] == "Yeni"

    create(shell, "Beta")
    assert (other / "beta.gtk").is_file()
    assert [e["file"] for e in shell.get("/api/library").json()] == ["beta.gtk"]


def test_settings_validation(shell):
    response = shell.put("/api/settings", json={"library_dir": "", "language": "tr"})
    assert response.status_code == 422 and error_code(response) == "validation"
    response = shell.put("/api/settings", json={"library_dir": "x", "language": "de"})
    assert response.status_code == 422


def test_session_is_per_application(library_dir):
    with TestClient(create_app()) as first, TestClient(create_app()) as second:
        create(first, "Alfa")
        assert first.get("/api/session").json()["open"] is True
        assert second.get("/api/session").json()["open"] is False
