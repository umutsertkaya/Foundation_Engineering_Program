import datetime as dt
import json
from pathlib import Path

import pytest
from pydantic import BaseModel, Field, ValidationError

from geotek.core.errors import GeoTekError
from geotek.core.models.project import ModuleSection, Project, ProjectMeta
from geotek.core.module_state import get_state, set_state
from geotek.io.project_io import _from_1_2, load_project, save_project


DATA_DIR = Path(__file__).resolve().parents[1] / "data"


class TinyState(BaseModel):
    count: int = 0
    items: list[int] = Field(default_factory=list)
    date: dt.date | None = None


@pytest.mark.parametrize("version", ["1.0", "1.1", "1.2"])
def test_legacy_project_loads_and_round_trips_as_1_3(version, tmp_path):
    project = load_project(DATA_DIR / f"project_{version.replace('.', '_')}.gtk")

    assert project.meta.schema_version == "1.3"
    assert project.modules == {}

    path = save_project(project, tmp_path / f"roundtrip_{version}")
    saved = json.loads(path.read_text(encoding="utf-8"))
    assert saved["meta"]["schema_version"] == "1.3"
    assert saved["modules"] == {}
    assert load_project(path) == project


def test_unknown_module_section_round_trips_unchanged(tmp_path):
    section = {"v": 3, "data": {"x": [1, 2]}, "extra": "kept"}
    project = Project(
        meta=ProjectMeta(name="Future module"), modules={"future_mod": section}
    )
    path = save_project(project, tmp_path / "future.gtk")
    original_bytes = path.read_bytes()
    loaded = load_project(path)

    preserved = loaded.modules["future_mod"].model_dump(mode="json")
    assert json.dumps(preserved).encode("utf-8") == json.dumps(section).encode("utf-8")
    assert json.loads(original_bytes)["modules"]["future_mod"] == section
    save_project(loaded, path)
    assert path.read_bytes() == original_bytes


def test_from_1_2_preserves_existing_module_sections():
    modules = {"future_mod": {"v": 3, "data": {"x": [1, 2]}, "extra": "kept"}}
    data = {"meta": {"schema_version": "1.2"}, "modules": modules}

    migrated = _from_1_2(data)

    assert migrated["meta"]["schema_version"] == "1.3"
    assert migrated["modules"] is modules


def test_module_section_defaults_and_version_validation():
    first = ModuleSection()
    second = ModuleSection()
    assert first.v == 1
    assert first.data == {}
    first.data["x"] = 1
    assert second.data == {}
    with pytest.raises(ValidationError):
        ModuleSection(v=0)


def test_get_state_missing_section_returns_default_without_mutation():
    project = Project(meta=ProjectMeta(name="Defaults"))
    before = project.model_dump(mode="json")

    assert get_state(project, "tiny", TinyState, version=3) == TinyState()
    assert project.model_dump(mode="json") == before


@pytest.mark.parametrize("version", [1, 3])
def test_set_state_get_state_round_trip(version):
    project = Project(meta=ProjectMeta(name="State"))
    state = TinyState(count=7, items=[1, 2], date=dt.date(2026, 10, 17))
    if version == 1:
        set_state(project, "tiny", state)
    else:
        set_state(project, "tiny", state, version=version)

    assert project.modules["tiny"].v == version
    assert project.modules["tiny"].data == {
        "count": 7, "items": [1, 2], "date": "2026-10-17"
    }
    before = project.model_dump(mode="json")
    restored = get_state(project, "tiny", TinyState, version=version)
    assert restored == state
    restored.items.append(99)
    assert project.model_dump(mode="json") == before


def test_get_state_applies_migrations_in_order_without_mutation():
    project = Project(
        meta=ProjectMeta(name="Migrations"),
        modules={"tiny": {"v": 1, "data": {"count": 1, "items": [1]}}},
    )
    before = project.model_dump(mode="json")
    calls = []

    def from_1(data):
        calls.append(1)
        data["count"] += 1
        data["items"].append(2)
        return data

    def from_2(data):
        calls.append(2)
        data["count"] *= 3
        data["items"].append(3)
        return data

    result = get_state(project, "tiny", TinyState, 3, {1: from_1, 2: from_2})

    assert result == TinyState(count=6, items=[1, 2, 3])
    assert calls == [1, 2]
    assert project.model_dump(mode="json") == before


@pytest.mark.parametrize("partial", [False, True])
def test_get_state_missing_migration_raises_without_mutation(partial):
    project = Project(
        meta=ProjectMeta(name="Missing migration"),
        modules={"tiny": {"v": 1, "data": {"items": [1]}}},
    )
    before = project.model_dump(mode="json")

    def from_1(data):
        data["items"].append(2)
        return data

    migrations = {1: from_1} if partial else None
    missing_step = "2 -> 3" if partial else "1 -> 2"
    with pytest.raises(GeoTekError, match=f"Missing migration.*{missing_step}"):
        get_state(project, "tiny", TinyState, 3, migrations)

    assert project.model_dump(mode="json") == before


def test_get_state_newer_version_raises_without_mutation():
    project = Project(
        meta=ProjectMeta(name="Newer state"),
        modules={"tiny": {"v": 3, "data": {"count": "unknown format"}}},
    )
    before = project.model_dump(mode="json")

    with pytest.raises(GeoTekError, match="newer module data"):
        get_state(project, "tiny", TinyState, version=2)

    assert project.model_dump(mode="json") == before
