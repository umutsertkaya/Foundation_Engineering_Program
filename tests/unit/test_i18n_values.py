"""Fragment values must be strings."""

import json
from pathlib import Path

import pytest

import geotek.i18n as i18n


@pytest.fixture(autouse=True)
def clear_catalog_cache():
    i18n.clear_cache()
    yield
    i18n.clear_cache()


@pytest.mark.parametrize("lang", i18n.SUPPORTED)
@pytest.mark.parametrize("value", [5, None, ["x"], {"a": "b"}, True])
def test_non_string_values_raise(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, lang: str, value: object
) -> None:
    monkeypatch.setattr(i18n, "_MODULES_DIR", tmp_path)
    directory = tmp_path / "example" / "i18n"
    directory.mkdir(parents=True)
    (directory / f"{lang}.json").write_text(
        json.dumps({"example.title": value}), encoding="utf-8")
    with pytest.raises(ValueError, match="must be a string"):
        i18n._catalog(lang)
