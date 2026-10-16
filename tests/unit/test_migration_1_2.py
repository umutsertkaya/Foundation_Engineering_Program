import json
from pathlib import Path

import pytest

from geotek.core.errors import SchemaVersionError
from geotek.core.models import Project, ProjectMeta
from geotek.io.project_io import _from_1_1, load_project, save_project


FIXTURE = "tests/data/project_1_1.gtk"


@pytest.mark.parametrize(
    ("source_ids", "expected"),
    [
        ([], "manual"),
        (["CPT-1"], "cpt"),
        (["SK-1"], "spt"),
        (["CPT-1", "missing"], "cpt"),
        (["missing"], "manual"),
    ],
)
def test_from_1_1_derives_origin_from_known_sources(source_ids, expected):
    data = {
        "meta": {"schema_version": "1.1"},
        "investigations": {
            "cpts": [{"id": "CPT-1"}],
            "boreholes": [{"id": "SK-1"}],
        },
        "soil_profiles": [{"id": "P1", "source_ids": source_ids}],
    }

    _from_1_1(data)

    assert data["soil_profiles"][0]["origin"] == expected


def test_project_1_1_migrates_to_1_2(tmp_path):
    project = load_project(FIXTURE)
    assert project.meta.schema_version == "1.2"
    assert project.profile("P1").origin == "mixed"
    assert project.structures == []
    assert project.active_profile_id is None

    legacy = json.loads(Path(FIXTURE).read_text(encoding="utf-8-sig"))
    assert project.site.model_dump() == legacy["site"]
    assert project.investigations.boreholes[0].id == legacy["investigations"]["boreholes"][0]["id"]
    assert project.investigations.cpts[0].id == legacy["investigations"]["cpts"][0]["id"]
    assert project.profile("P1").source_ids == legacy["soil_profiles"][0]["source_ids"]
    assert project.design_overrides == legacy["design_overrides"]

    path = save_project(project, tmp_path / "roundtrip")
    assert load_project(path) == project


def test_project_1_0_migrates_through_1_1_to_1_2():
    project = load_project("tests/data/project_1_0.gtk")

    assert project.meta.schema_version == "1.2"
    assert project.meta.analysis_level == "basic"
    assert project.design_overrides == {}
    assert project.structures == []
    assert project.active_profile_id is None
    assert project.module2_inputs == {"wall": {"height": 5.0}}


def test_unsupported_schema_version_still_raises(tmp_path):
    data = json.loads(Project(meta=ProjectMeta(name="x")).model_dump_json())
    data["meta"]["schema_version"] = "9.9"
    path = tmp_path / "unsupported.gtk"
    path.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(SchemaVersionError):
        load_project(path)
