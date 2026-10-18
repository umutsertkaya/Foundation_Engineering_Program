"""Filesystem catalog fragments merge without importing module packages."""

import json
from pathlib import Path

import pytest

import geotek.i18n as i18n


MODULE_IDS = ("soil", "liquefaction", "walls", "sheet_pile")


@pytest.fixture(autouse=True)
def clear_catalog_cache():
    i18n.clear_cache()
    yield
    i18n.clear_cache()


def _read(path: Path) -> dict[str, str]:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_fragment(root: Path, module_id: str, lang: str, entries: dict[str, str]) -> None:
    directory = root / module_id / "i18n"
    directory.mkdir(parents=True, exist_ok=True)
    (directory / f"{lang}.json").write_text(
        json.dumps(entries, ensure_ascii=False), encoding="utf-8"
    )


@pytest.mark.parametrize("lang", i18n.SUPPORTED)
def test_merged_catalog_contains_module_fragments(lang: str) -> None:
    catalog = i18n._catalog(lang)
    for module_id in MODULE_IDS:
        fragment = _read(i18n._MODULES_DIR / module_id / "i18n" / f"{lang}.json")
        assert f"{module_id}.title" in catalog
        assert f"{module_id}.description" in catalog
        assert fragment.items() <= catalog.items()


@pytest.mark.parametrize("module_id", MODULE_IDS)
def test_fragment_language_parity(module_id: str) -> None:
    directory = i18n._MODULES_DIR / module_id / "i18n"
    assert _read(directory / "tr.json").keys() == _read(directory / "en.json").keys()


def test_merged_language_parity() -> None:
    assert i18n._catalog("tr").keys() == i18n._catalog("en").keys()


@pytest.mark.parametrize("lang", i18n.SUPPORTED)
def test_fragments_have_prefix_and_do_not_collide_with_core(lang: str) -> None:
    core = _read(Path(i18n.__file__).parent / f"{lang}.json")
    for path in i18n._MODULES_DIR.glob(f"*/i18n/{lang}.json"):
        module_id = path.parent.parent.name
        if module_id.startswith("_"):
            continue
        fragment = _read(path)
        assert all(key.startswith(f"{module_id}.") for key in fragment)
        assert core.keys().isdisjoint(fragment)


@pytest.mark.parametrize("lang", i18n.SUPPORTED)
@pytest.mark.parametrize("key", ["other.title", "example", "examplex.title"])
def test_wrong_prefix_raises(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, lang: str, key: str
) -> None:
    monkeypatch.setattr(i18n, "_MODULES_DIR", tmp_path)
    _write_fragment(tmp_path, "example", lang, {key: "Invalid"})
    with pytest.raises(ValueError, match="must start with"):
        i18n._catalog(lang)


@pytest.mark.parametrize("lang", i18n.SUPPORTED)
def test_core_collision_raises(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, lang: str):
    monkeypatch.setattr(i18n, "_MODULES_DIR", tmp_path)
    core = _read(Path(i18n.__file__).parent / f"{lang}.json")
    key = next(key for key in core if key.startswith("soil."))
    _write_fragment(tmp_path, "soil", lang, {key: "Override"})
    with pytest.raises(ValueError, match="collides with core"):
        i18n._catalog(lang)


@pytest.mark.parametrize("lang", i18n.SUPPORTED)
def test_discovery_is_filesystem_only_and_skips_private_modules(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, lang: str
) -> None:
    monkeypatch.setattr(i18n, "_MODULES_DIR", tmp_path)
    _write_fragment(tmp_path, "example", lang, {"example.title": "Example"})
    (tmp_path / "example" / "__init__.py").write_text(
        "raise AssertionError('Module must not be imported')\n", encoding="utf-8"
    )
    _write_fragment(tmp_path, "_private", lang, {"wrong.prefix": "Ignored"})
    catalog = i18n._catalog(lang)
    assert catalog["example.title"] == "Example"
    assert "wrong.prefix" not in catalog


def test_catalog_cache_can_be_cleared(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(i18n, "_MODULES_DIR", tmp_path)
    _write_fragment(tmp_path, "example", "tr", {"example.title": "Before"})
    catalog = i18n._catalog("tr")
    _write_fragment(tmp_path, "example", "tr", {"example.title": "After"})
    assert i18n._catalog("tr") is catalog
    assert i18n.t("example.title", "tr") == "Before"
    i18n.clear_cache()
    assert i18n.t("example.title", "tr") == "After"


def test_turkish_wall_title() -> None:
    assert i18n.t("walls.title", "tr") == "İstinat duvarı"
