"""Bilingual (TR/EN) text catalogs for UI and reports.

Usage::

    from geotek.i18n import t, set_language
    set_language("en")
    t("module1.title")
"""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path

SUPPORTED = ("tr", "en")
FALLBACK = "en"
_current = "tr"


@cache
def _catalog(lang: str) -> dict[str, str]:
    path = Path(__file__).parent / f"{lang}.json"
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def set_language(lang: str) -> None:
    global _current
    if lang not in SUPPORTED:
        raise ValueError(f"Unsupported language {lang!r}; choose from {SUPPORTED}")
    _current = lang


def get_language() -> str:
    return _current


def t(key: str, lang: str | None = None, **kwargs) -> str:
    """Translate ``key``; falls back to English, then to the key itself."""
    lang = lang or _current
    text = _catalog(lang).get(key) or _catalog(FALLBACK).get(key) or key
    return text.format(**kwargs) if kwargs else text
