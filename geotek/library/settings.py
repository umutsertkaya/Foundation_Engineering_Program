"""Persistent application preferences."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, field_validator


def settings_path() -> Path:
    override = os.environ.get("GEOTEK_SETTINGS")
    if override:
        return Path(override).expanduser()
    appdata = os.environ.get("APPDATA")
    if appdata:
        return Path(appdata) / "GeoTek" / "settings.json"
    return Path.home() / ".geotek" / "settings.json"


def default_library_dir() -> Path:
    return Path.home() / "Documents" / "GeoTek Projeleri"


class AppSettings(BaseModel):
    library_dir: Path = Field(default_factory=default_library_dir)
    language: Literal["tr", "en"] = "tr"
    recent: list[str] = Field(default_factory=list)

    @field_validator("recent")
    @classmethod
    def _normalize_recent(cls, paths: list[str]) -> list[str]:
        recent: list[str] = []
        seen: set[str] = set()
        for value in paths:
            path = str(Path(value).expanduser().resolve())
            key = os.path.normcase(path)
            if key not in seen:
                recent.append(path)
                seen.add(key)
            if len(recent) == 10:
                break
        return recent


def load_settings() -> AppSettings:
    try:
        return AppSettings.model_validate_json(settings_path().read_text(encoding="utf-8"))
    except (OSError, ValueError, RuntimeError):
        return AppSettings()


def save_settings(s: AppSettings) -> None:
    path = settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent, prefix=".settings-", delete=False
        ) as stream:
            temporary = Path(stream.name)
            stream.write(s.model_dump_json(indent=2))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def add_recent(s: AppSettings, path: str | Path) -> AppSettings:
    data = s.model_dump()
    data["recent"] = [str(path), *s.recent]
    return AppSettings.model_validate(data)
