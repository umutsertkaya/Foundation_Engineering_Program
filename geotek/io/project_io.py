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


def _from_1_1(data: dict) -> dict:
    """1.1 -> 1.2: add profile origins and explicit structure/profile references."""
    cpt_ids = {item["id"] for item in data.get("investigations", {}).get("cpts", [])}
    borehole_ids = {item["id"] for item in data.get("investigations", {}).get("boreholes", [])}
    for profile in data.get("soil_profiles", []):
        source_ids = set(profile.get("source_ids", []))
        has_cpt = bool(source_ids & cpt_ids)
        has_borehole = bool(source_ids & borehole_ids)
        unknown = source_ids - cpt_ids - borehole_ids
        if unknown:
            origin = "manual"
        elif has_cpt and has_borehole:
            origin = "mixed"
        elif has_cpt:
            origin = "cpt"
        elif has_borehole:
            origin = "spt"
        else:
            origin = "manual"
        profile.setdefault("origin", origin)
    data.setdefault("structures", [])
    data.setdefault("active_profile_id", None)
    data["meta"]["schema_version"] = "1.2"
    return data


# from_version -> function upgrading the raw dict by one step (add entries as the schema evolves)
_MIGRATIONS: dict[str, Callable[[dict], dict]] = {"1.0": _from_1_0, "1.1": _from_1_1}


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
