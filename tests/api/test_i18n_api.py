"""The public catalog includes both core translations and all module fragments."""

import json
from pathlib import Path

import pytest

import geotek.i18n as i18n

from .conftest import error_code


@pytest.mark.parametrize("lang", ["tr", "en"])
def test_merged_i18n_catalog_without_project(shell, lang):
    root = Path(i18n.__file__).parent
    expected = json.loads((root / f"{lang}.json").read_text(encoding="utf-8"))
    for fragment in sorted((root.parent / "modules").glob(f"*/i18n/{lang}.json")):
        if not fragment.parent.parent.name.startswith("_"):
            expected.update(json.loads(fragment.read_text(encoding="utf-8")))
    previous_language = i18n.get_language()
    response = shell.get(f"/api/i18n/{lang}")
    assert response.status_code == 200 and response.json() == expected
    assert all(isinstance(value, str) for value in response.json().values())
    for module in ("soil", "walls", "sheet_pile", "liquefaction"):
        assert f"{module}.title" in response.json()
    assert i18n.get_language() == previous_language
    assert shell.get("/api/session").json() == {"open": False, "file": None, "dirty": False}


def test_invalid_i18n_language(shell):
    response = shell.get("/api/i18n/de")
    assert response.status_code == 422 and error_code(response) == "validation"
