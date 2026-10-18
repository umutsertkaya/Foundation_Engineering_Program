"""Module contract, isolated discovery and generated-index checks."""

from __future__ import annotations

import importlib
import sys
from collections.abc import Iterator
from dataclasses import FrozenInstanceError, replace
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import geotek.modules
from geotek.api import registry
from geotek.core.errors import GeoTekError
from geotek.core.modules import ModuleManifest
from geotek.modules import _index
from tools.gen_module_index import generate_module_index, render_index


def _manifest(**overrides: object) -> ModuleManifest:
    values = dict(
        id="example", version="1.0", title_key="example.title",
        description_key="example.description", icon="tool", order=10,
    )
    values.update(overrides)
    return ModuleManifest(**values)


def _write_module(
    root: Path, id: str, *, order: int, manifest_id: str | None = None, router: bool = False,
) -> None:
    package = root / id
    package.mkdir(exist_ok=True)
    manifest_id = id if manifest_id is None else manifest_id
    source = [
        "from __future__ import annotations",
        "from pathlib import Path",
        "from geotek.core.modules import ModuleManifest",
    ]
    if router:
        source.extend([
            "def make_router():",
            "    from fastapi import APIRouter",
            "    router = APIRouter()",
            "    @router.get('/ping')",
            "    def ping():",
            f"        return {{'module': {id!r}}}",
            "    return router",
        ])
    source.extend([
        "MANIFEST = ModuleManifest(",
        f"    id={manifest_id!r}, version='1.0',",
        f"    title_key={manifest_id + '.title'!r},",
        f"    description_key={manifest_id + '.description'!r},",
        f"    icon='tool', order={order},",
        f"    router={'make_router' if router else 'None'},",
        f"    design_code_dirs=(Path({'codes/' + id!r}),),",
        ")",
    ])
    (package / "__init__.py").write_text("\n".join(source) + "\n", encoding="utf-8")


@pytest.fixture(autouse=True)
def clear_registry_cache() -> Iterator[None]:
    registry.clear_cache()
    yield
    registry.clear_cache()


@pytest.fixture
def fake_modules(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    root = tmp_path / "modules"
    root.mkdir()
    _write_module(root, "c1_alpha", order=20)
    _write_module(root, "c1_beta", order=10, router=True)
    (root / "_private").mkdir()
    (root / "_private" / "__init__.py").write_text("", encoding="utf-8")
    (root / "loose.py").write_text("", encoding="utf-8")
    monkeypatch.setattr(geotek.modules, "__path__", [str(root)])
    importlib.invalidate_caches()
    try:
        yield root
    finally:
        registry.clear_cache()
        for name in tuple(sys.modules):
            if name.startswith("geotek.modules.c1_"):
                del sys.modules[name]
        for id in ("c1_alpha", "c1_beta"):
            if hasattr(geotek.modules, id):
                delattr(geotek.modules, id)
        importlib.invalidate_caches()


@pytest.mark.parametrize("overrides, message", [
    ({"id": "Bad-id"}, "Invalid module id"),
    ({"id": "1bad"}, "Invalid module id"),
    ({"id": "bad\n"}, "Invalid module id"),
    ({"version": ""}, "version"),
    ({"order": 1.5}, "order"),
    ({"order": True}, "order"),
    ({"title_key": "other.title"}, "title_key"),
    ({"description_key": "other.description"}, "description_key"),
    ({"state_version": 0}, "state_version"),
    ({"state_version": 1.5}, "state_version"),
    ({"state_migrations": {0: dict}}, "migration key"),
    ({"state_migrations": {1: dict}}, "migration key"),
    ({"state_version": 2, "state_migrations": {2: dict}}, "migration key"),
    ({"state_version": 2, "state_migrations": {"1": dict}}, "migration key"),
])
def test_manifest_validation(overrides: dict, message: str) -> None:
    with pytest.raises(GeoTekError, match=message):
        _manifest(**overrides)


def test_manifest_defaults_and_valid_migration() -> None:
    manifest = _manifest(state_version=2, state_migrations={1: dict})
    assert manifest.state_migrations[1]({"value": 3}) == {"value": 3}
    assert manifest.router is None
    assert manifest.state_model is None
    assert manifest.consumes == manifest.structure_kinds == manifest.design_code_dirs == ()
    assert _manifest().state_migrations is not _manifest().state_migrations
    with pytest.raises(FrozenInstanceError):
        manifest.order = 0


def test_discovery_sorting_lookup_and_directories(fake_modules: Path) -> None:
    assert registry.module_ids() == ("c1_alpha", "c1_beta")
    manifests = registry.discover()
    assert [manifest.id for manifest in manifests] == ["c1_beta", "c1_alpha"]
    assert registry.get_module("c1_beta") is manifests[0]
    assert registry.design_code_dirs() == (Path("codes/c1_beta"), Path("codes/c1_alpha"))
    with pytest.raises(GeoTekError, match="Unknown module"):
        registry.get_module("absent")


def test_discovery_sorts_equal_orders_by_id(fake_modules: Path) -> None:
    package = importlib.import_module("geotek.modules.c1_alpha")
    package.MANIFEST = replace(package.MANIFEST, order=10)
    assert [manifest.id for manifest in registry.discover()] == ["c1_alpha", "c1_beta"]


def test_discovery_cache_can_be_cleared(fake_modules: Path) -> None:
    manifests = registry.discover()
    package = importlib.import_module("geotek.modules.c1_alpha")
    package.MANIFEST = replace(package.MANIFEST, order=0)
    assert registry.discover() is manifests
    registry.clear_cache()
    assert registry.discover()[0] is package.MANIFEST


def test_discovery_rejects_id_mismatch(fake_modules: Path) -> None:
    _write_module(fake_modules, "c1_alpha", order=20, manifest_id="other")
    with pytest.raises(GeoTekError, match="does not match package"):
        registry.discover()


@pytest.mark.parametrize("source", ["", "MANIFEST = object()\n"])
def test_discovery_rejects_invalid_manifest(fake_modules: Path, source: str) -> None:
    (fake_modules / "c1_alpha" / "__init__.py").write_text(source, encoding="utf-8")
    with pytest.raises(GeoTekError, match="MANIFEST must be a ModuleManifest"):
        registry.discover()


def test_discovery_rejects_duplicate_ids(
    fake_modules: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(registry, "iter_modules", lambda path: iter(()))
    monkeypatch.setattr(_index, "MODULE_IDS", ("c1_alpha", "c1_alpha"))
    with pytest.raises(GeoTekError, match="Duplicate module id"):
        registry.discover()


def test_discovery_falls_back_to_index(
    fake_modules: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(registry, "iter_modules", lambda path: iter(()))
    monkeypatch.setattr(_index, "MODULE_IDS", ("c1_beta", "c1_alpha"))
    assert registry.module_ids() == ("c1_alpha", "c1_beta")
    assert [manifest.id for manifest in registry.discover()] == ["c1_beta", "c1_alpha"]


def test_empty_discovery(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(registry, "iter_modules", lambda path: iter(()))
    monkeypatch.setattr(_index, "MODULE_IDS", ())
    assert registry.module_ids() == ()
    assert registry.discover() == []
    assert registry.design_code_dirs() == ()


@pytest.mark.parametrize("prefix", ["/api", "/custom"])
def test_mount_modules(fake_modules: Path, prefix: str) -> None:
    app = FastAPI()
    if prefix == "/api":
        registry.mount_modules(app)
    else:
        registry.mount_modules(app, prefix=prefix)
    with TestClient(app) as client:
        response = client.get(f"{prefix}/m/c1_beta/ping")
        assert response.status_code == 200
        assert response.json() == {"module": "c1_beta"}
        assert client.get(f"{prefix}/m/c1_alpha/ping").status_code == 404
    assert app.openapi()["paths"][f"{prefix}/m/c1_beta/ping"]["get"]["tags"] == ["c1_beta"]


def test_real_module_index_is_up_to_date() -> None:
    assert generate_module_index(check=True), "Run tools/gen_module_index.py"


def test_index_generation_and_check_mode(tmp_path: Path) -> None:
    _write_module(tmp_path, "beta", order=0)
    _write_module(tmp_path, "alpha", order=0)
    (tmp_path / "_private").mkdir()
    (tmp_path / "_private" / "__init__.py").write_text("", encoding="utf-8")
    (tmp_path / "namespace").mkdir()
    (tmp_path / "loose.py").write_text("", encoding="utf-8")
    output = tmp_path / "_index.py"
    assert not generate_module_index(tmp_path, check=True)
    assert not output.exists()
    assert generate_module_index(tmp_path)
    content = output.read_bytes()
    assert content.decode("utf-8") == render_index(tmp_path)
    assert b"    'alpha',\n    'beta',\n" in content
    assert b"_private" not in content
    assert b"namespace" not in content
    assert b"loose" not in content
    assert generate_module_index(tmp_path, check=True)
    _write_module(tmp_path, "gamma", order=0)
    assert not generate_module_index(tmp_path, check=True)
    assert output.read_bytes() == content
