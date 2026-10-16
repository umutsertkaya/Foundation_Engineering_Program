import json

import pytest

from geotek.core.errors import SchemaVersionError
from geotek.core.models import Project, ProjectMeta
from geotek.io.project_io import load_project, save_project


FIXTURE = "tests/data/project_1_1.gtk"


def test_project_1_1_migrates_to_1_2(tmp_path):
    project = load_project(FIXTURE)
    assert project.meta.schema_version == "1.2"
    assert project.profile("P1").origin == "mixed"
    assert project.structures == []
    assert project.active_profile_id is None

    path = save_project(project, tmp_path / "roundtrip")
    assert load_project(path) == project


def test_unsupported_schema_version_still_raises(tmp_path):
    data = json.loads(Project(meta=ProjectMeta(name="x")).model_dump_json())
    data["meta"]["schema_version"] = "9.9"
    path = tmp_path / "unsupported.gtk"
    path.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(SchemaVersionError):
        load_project(path)
