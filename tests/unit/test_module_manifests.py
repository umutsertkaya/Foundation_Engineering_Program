"""Manifest and i18n consistency across backend and web modules."""

from __future__ import annotations

import json
import re
from pathlib import Path


from geotek.api import registry

ROOT = Path(__file__).resolve().parents[2]
CORE_I18N = ROOT / "geotek" / "i18n"
MODULES = ROOT / "geotek" / "modules"
WEB_MODULES = ROOT / "web" / "src" / "modules"
LANGS = ("tr", "en")


def _load(path: Path) -> dict[str, str]:
    return json.loads(path.read_text(encoding="utf-8"))


def _module_dirs() -> list[Path]:
    return sorted(p for p in MODULES.iterdir()
                  if p.is_dir() and (p / "__init__.py").exists() and not p.name.startswith("_"))


def _catalogs() -> dict[str, dict[str, str]]:
    result = {f"core/{lang}": _load(CORE_I18N / f"{lang}.json") for lang in LANGS}
    for folder in _module_dirs():
        for lang in LANGS:
            result[f"{folder.name}/{lang}"] = _load(folder / "i18n" / f"{lang}.json")
    return result


def _web_manifest_ids() -> dict[str, str | None]:
    ids: dict[str, str | None] = {}
    for manifest in sorted(WEB_MODULES.glob("*/manifest.ts")):
        match = re.search(r"""\bid:\s*["']([^"']+)["']""", manifest.read_text(encoding="utf-8"))
        ids[manifest.parent.name] = match.group(1) if match else None
    return ids


def test_every_package_has_manifest_with_matching_id():
    folders = [p.name for p in _module_dirs()]
    assert folders
    assert tuple(folders) == registry.module_ids()
    registry.clear_cache()
    manifests = {m.id for m in registry.discover()}
    assert manifests == set(folders)
    for folder in folders:
        assert registry.get_module(folder).id == folder


def test_core_catalog_key_sets_match():
    assert set(_load(CORE_I18N / "tr.json")) == set(_load(CORE_I18N / "en.json"))


def test_module_catalog_key_sets_match_between_languages():
    for folder in _module_dirs():
        tr, en = (_load(folder / "i18n" / f"{lang}.json") for lang in LANGS)
        assert set(tr) == set(en), (
            f"{folder.name}: only in tr {sorted(set(tr) - set(en))}, only in en {sorted(set(en) - set(tr))}"
        )


def test_module_keys_are_namespaced_by_module_id():
    for folder in _module_dirs():
        for lang in LANGS:
            bad = [k for k in _load(folder / "i18n" / f"{lang}.json") if not k.startswith(f"{folder.name}.")]
            assert not bad, f"{folder.name}/{lang}: keys outside '{folder.name}.': {bad}"


def test_module_keys_do_not_collide_with_core_or_each_other():
    core = set(_load(CORE_I18N / "en.json")) | set(_load(CORE_I18N / "tr.json"))
    seen: dict[str, str] = {}
    for folder in _module_dirs():
        keys = set(_load(folder / "i18n" / "en.json")) | set(_load(folder / "i18n" / "tr.json"))
        assert not keys & core, f"{folder.name} collides with core: {sorted(keys & core)}"
        for key in keys:
            assert key not in seen, f"{key} defined by {seen[key]} and {folder.name}"
            seen[key] = folder.name


def test_manifest_title_and_description_keys_exist():
    for manifest in registry.discover():
        for lang in LANGS:
            keys = _load(MODULES / manifest.id / "i18n" / f"{lang}.json")
            assert manifest.title_key in keys, f"{manifest.id}/{lang}: {manifest.title_key}"
            assert manifest.description_key in keys, f"{manifest.id}/{lang}: {manifest.description_key}"


def test_no_catalog_value_uses_double_brace_interpolation():
    bad = [f"{name}:{key}" for name, catalog in _catalogs().items()
           for key, value in catalog.items() if "{{" in str(value)]
    assert not bad, f"use single-brace {{field}} interpolation: {bad}"


def test_backend_and_web_module_ids_match():
    web = _web_manifest_ids()
    assert web
    assert set(web) == {p.name for p in _module_dirs()}


def test_web_manifest_id_equals_folder_name():
    for folder, manifest_id in _web_manifest_ids().items():
        assert manifest_id == folder, f"web/src/modules/{folder}/manifest.ts has id {manifest_id!r}"
