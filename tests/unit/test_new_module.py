"""Exercise module scaffolding exclusively in temporary repositories."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from geotek.core.modules import ModuleManifest
from tools.new_module import default_order, main, scaffold


def test_generated_files_and_catalogs(tmp_path: Path) -> None:
    paths = scaffold("demo_tool", tmp_path, title_tr="Deneme", title_en="Demo")
    expected = {
        "geotek/modules/demo_tool/__init__.py", "geotek/modules/demo_tool/api.py",
        "geotek/modules/demo_tool/i18n/tr.json", "geotek/modules/demo_tool/i18n/en.json",
        "web/src/modules/demo_tool/manifest.ts", "web/src/modules/demo_tool/Root.tsx",
        "web/src/modules/demo_tool/pages/HomePage.tsx", "web/src/modules/demo_tool/api.ts",
        "web/src/modules/demo_tool/mock.ts",
        "web/src/modules/demo_tool/__tests__/demo_tool.test.tsx",
    }
    assert {path.relative_to(tmp_path).as_posix() for path in paths} == expected
    for path in paths:
        assert path.is_file()
        assert b"\r" not in path.read_bytes()
        path.read_bytes().decode("utf-8")
    catalogs = [json.loads((tmp_path / f"geotek/modules/demo_tool/i18n/{lang}.json")
                           .read_text(encoding="utf-8")) for lang in ("tr", "en")]
    assert set(catalogs[0]) == set(catalogs[1])
    assert {"demo_tool.title", "demo_tool.description", "demo_tool.nav.home",
            "demo_tool.home.heading"} <= set(catalogs[0])
    for catalog in catalogs:
        assert all(key.startswith("demo_tool.") for key in catalog)
        assert "{{" not in json.dumps(catalog)
    assert catalogs[0]["demo_tool.title"] == "Deneme"
    assert catalogs[1]["demo_tool.title"] == "Demo"
    manifest = tmp_path / "web/src/modules/demo_tool/manifest.ts"
    assert 'id: "demo_tool"' in manifest.read_text(encoding="utf-8")
    assert not (tmp_path / "geotek/modules/_index.py").exists()


def test_generated_manifest_import_and_router(tmp_path: Path) -> None:
    scaffold("demo_tool", tmp_path)
    package = tmp_path / "geotek/modules/demo_tool/__init__.py"
    name = "_scaffold_test_demo_tool"
    previous = dict(sys.modules)
    spec = importlib.util.spec_from_file_location(name, package)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    try:
        sys.modules[name] = module
        spec.loader.exec_module(module)
        manifest = module.MANIFEST
        assert isinstance(manifest, ModuleManifest)
        assert manifest.id == package.parent.name
        assert manifest.order == 10
        assert manifest.router is not None
        app = FastAPI()
        app.include_router(manifest.router(), prefix=f"/api/m/{manifest.id}")
        with TestClient(app) as client:
            assert client.post("/api/m/demo_tool/run").status_code == 501
        assert app.openapi()["paths"]["/api/m/demo_tool/run"]["post"]["operationId"] == (
            "demo_tool_run"
        )
    finally:
        for key in tuple(sys.modules):
            if key == name or key.startswith(name + "."):
                if key in previous:
                    sys.modules[key] = previous[key]
                else:
                    del sys.modules[key]
    assert name not in sys.modules
    assert name + ".api" not in sys.modules


@pytest.mark.parametrize("module_id", ["", "Bad", "1bad", "bad-id", "../bad", "bad\n",
                                       "_private", "bad/name", "çalışma"])
def test_invalid_id_rejected(tmp_path: Path, module_id: str) -> None:
    with pytest.raises(ValueError, match="Invalid module id"):
        scaffold(module_id, tmp_path)
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize("module_id", ["core", "api", "shared", "app", "project", "class",
                                       "units", "errors", "module_state"])
def test_reserved_id_rejected(tmp_path: Path, module_id: str) -> None:
    with pytest.raises(ValueError, match="Reserved module id"):
        scaffold(module_id, tmp_path)
    assert list(tmp_path.iterdir()) == []


def test_core_filename_collision_rejected(tmp_path: Path) -> None:
    core = tmp_path / "geotek/core"
    core.mkdir(parents=True)
    (core / "custom_core.py").write_text("", encoding="utf-8")
    with pytest.raises(ValueError, match="Reserved module id"):
        scaffold("custom_core", tmp_path)


@pytest.mark.parametrize("parent", ["geotek/modules", "web/src/modules"])
def test_existing_path_rejected_without_partial_output(tmp_path: Path, parent: str) -> None:
    existing = tmp_path / parent / "demo_tool"
    existing.mkdir(parents=True)
    marker = existing / "keep.txt"
    marker.write_bytes(b"keep")
    before = set(tmp_path.rglob("*"))
    with pytest.raises(FileExistsError, match="already exists"):
        scaffold("demo_tool", tmp_path)
    assert set(tmp_path.rglob("*")) == before
    assert marker.read_bytes() == b"keep"


def test_default_order_and_explicit_options(tmp_path: Path) -> None:
    assert default_order(tmp_path) == 10
    scaffold("alpha", tmp_path, order=70)
    scaffold("beta", tmp_path, order=20)
    assert default_order(tmp_path) == 80
    scaffold("gamma", tmp_path, icon="chart-bar")
    manifest = (tmp_path / "web/src/modules/gamma/manifest.ts").read_text(encoding="utf-8")
    assert "order: 80" in manifest
    assert "icon: IconChartBar" in manifest
    assert default_order(tmp_path) == 90


def test_order_reading_does_not_execute_modules(tmp_path: Path) -> None:
    package = tmp_path / "geotek/modules/existing"
    package.mkdir(parents=True)
    (package / "__init__.py").write_text(
        "raise RuntimeError('Do not import')\nMANIFEST = ModuleManifest(order=-20)\n",
        encoding="utf-8",
    )
    assert default_order(tmp_path) == -10


def test_nonliteral_order_rejected_before_writing(tmp_path: Path) -> None:
    package = tmp_path / "geotek/modules/existing"
    package.mkdir(parents=True)
    (package / "__init__.py").write_text("MANIFEST = ModuleManifest(order=ORDER)\n")
    with pytest.raises(ValueError, match="literal integer"):
        scaffold("demo_tool", tmp_path)
    assert not (tmp_path / "geotek/modules/demo_tool").exists()


@pytest.mark.parametrize("options", [{"icon": "Bad;name"}, {"order": True},
                                     {"title_en": "{{field}}"}, {"title_tr": ""}])
def test_invalid_options_do_not_write(tmp_path: Path, options: dict) -> None:
    with pytest.raises(ValueError):
        scaffold("demo_tool", tmp_path, **options)
    assert list(tmp_path.iterdir()) == []


def test_cli_custom_root_checklist(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["demo_tool", "--root", str(tmp_path), "--title-en", "Demo",
                 "--order", "50", "--icon", "columns"]) == 0
    output = capsys.readouterr().out
    for text in ("Created 10 files", "tools/gen_module_index.py", "tools/export_openapi.py",
                 "npm --prefix web run gen:api", "web/src/test/module_paths.test.ts"):
        assert text in output


def test_repo_root_refreshes_index(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    import tools.new_module as tool

    commands: list[list[str]] = []

    def record(command: list[str], *, check: bool) -> None:
        assert check
        commands.append(command)

    monkeypatch.setattr(tool, "ROOT", tmp_path)
    monkeypatch.setattr(tool.subprocess, "run", record)
    scaffold("demo_tool", tmp_path)
    assert commands == [[sys.executable, str(tmp_path / "tools/gen_module_index.py")]]
