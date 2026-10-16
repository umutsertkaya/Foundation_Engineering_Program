"""Save and load project files (.gtk, UTF-8 JSON with a schema version)."""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path

from geotek.core.errors import SchemaVersionError
from geotek.core.models.project import SCHEMA_VERSION, Project

PROJECT_SUFFIX = ".gtk"

def _from_1_0(data: dict) -> dict:
    """1.0 -> 1.1: analysis level and user factor overrides added (defaults)."""
    data["meta"].setdefault("analysis_level", "basic")
    data.setdefault("design_overrides", {})
    data["meta"]["schema_version"] = "1.1"
    return data


# from_version -> function upgrading the raw dict by one step (add entries as the schema evolves)
_MIGRATIONS: dict[str, Callable[[dict], dict]] = {"1.0": _from_1_0}


def _migrate(data: dict) -> dict:
    version = data.get("meta", {}).get("schema_version", SCHEMA_VERSION)
    while version != SCHEMA_VERSION:
        step = _MIGRATIONS.get(version)
        if step is None:
            raise SchemaVersionError(
                f"Project schema {version!r} is not supported (current: {SCHEMA_VERSION})"
            )
        data = step(data)
        version = data["meta"]["schema_version"]
    return data


def save_project(project: Project, path: str | Path) -> Path:
    path = Path(path)
    if path.suffix != PROJECT_SUFFIX:
        path = path.with_suffix(PROJECT_SUFFIX)
    project.meta.schema_version = SCHEMA_VERSION
    path.write_text(project.model_dump_json(indent=2), encoding="utf-8")
    return path


def load_project(path: str | Path) -> Project:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return Project.model_validate(_migrate(data))
