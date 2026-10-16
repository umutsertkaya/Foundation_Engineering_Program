"""Fixtures for core shell API tests: isolated settings file and library directory."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from geotek.api.app import create_app
from geotek.library import AppSettings, save_settings


@pytest.fixture
def library_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Library root inside tmp_path; settings live in tmp_path too (GEOTEK_SETTINGS)."""
    monkeypatch.setenv("GEOTEK_SETTINGS", str(tmp_path / "settings.json"))
    root = tmp_path / "library"
    save_settings(AppSettings(library_dir=root, language="tr"))
    return root


@pytest.fixture
def shell(library_dir: Path):
    """TestClient over a fresh application and session."""
    with TestClient(create_app()) as client:
        yield client


def error_code(response) -> str:
    return response.json()["code"]
