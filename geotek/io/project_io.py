"""Save and load project files (.gtk, UTF-8 JSON with a schema version)."""

from __future__ import annotations

import json
import os
import tempfile
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
        if has_cpt and has_borehole:
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


def _from_1_2(data: dict) -> dict:
    """1.2 -> 1.3: add module-private state sections."""
    data.setdefault("modules", {})
    data["meta"]["schema_version"] = "1.3"
    return data


# from_version -> function upgrading the raw dict by one step (add entries as the schema evolves)
_MIGRATIONS: dict[str, Callable[[dict], dict]] = {
    "1.0": _from_1_0,
    "1.1": _from_1_1,
    "1.2": _from_1_2,
}


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


def write_atomic(path: str | Path, data: bytes) -> None:
    """Write ``data`` to a temp file next to ``path`` and ``os.replace`` it into place.

    A failure at any point leaves an existing ``path`` untouched and removes the temp file.
    """
    path = Path(path)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", dir=path.parent, prefix=f".{path.name}.", suffix=".tmp", delete=False
        ) as stream:
            temporary = Path(stream.name)
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def save_project(project: Project, path: str | Path) -> Path:
    path = Path(path)
    if path.suffix != PROJECT_SUFFIX:
        path = path.with_suffix(PROJECT_SUFFIX)
    project.meta.schema_version = SCHEMA_VERSION
    write_atomic(path, project.model_dump_json(indent=2).encode("utf-8"))
    return path


def _reject_constant(name: str):
    raise ValueError(f"Project file contains the non-finite number {name}")


def load_project(path: str | Path) -> Project:
    # save_project never writes NaN/Infinity; such a file was edited by hand and would break
    # fingerprints and JSON responses later, so refuse it on load.
    data = json.loads(Path(path).read_text(encoding="utf-8"), parse_constant=_reject_constant)
    return Project.model_validate(_migrate(data))
