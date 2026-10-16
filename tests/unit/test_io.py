import json

import pandas as pd
import pytest

from geotek.core.errors import ImportDataError, SchemaVersionError
from geotek.core.models import Investigations, Project, ProjectMeta
from geotek.io.project_io import load_project, save_project
from geotek.io.tabular import import_cpt, import_spt


def test_project_roundtrip(tmp_path, two_layer_profile):
    project = Project(meta=ProjectMeta(name="Deneme Projesi", engineer="Ş. Öztürk"),
                      soil_profiles=[two_layer_profile])
    path = save_project(project, tmp_path / "proje")
    assert path.suffix == ".gtk"
    loaded = load_project(path)
    assert loaded == project
    assert loaded.profile("P1").stresses(5.0)[0] == pytest.approx(95.0)


def test_unknown_schema_version_is_rejected(tmp_path):
    path = tmp_path / "old.gtk"
    data = json.loads(Project(meta=ProjectMeta(name="x")).model_dump_json())
    data["meta"]["schema_version"] = "0.1"
    path.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(SchemaVersionError):
        load_project(path)


def test_import_cpt_turkish_csv_with_header_units(tmp_path):
    path = tmp_path / "cpt.csv"
    path.write_text(
        "Derinlik (m);qc (MPa);fs (kPa);u2 (kPa)\n"
        "0,10;1,50;12,0;0,0\n"
        "0,20;2,00;15,5;\n"
        "0,30;;16,0;3,0\n",
        encoding="utf-8",
    )
    cpt = import_cpt(path, "CPT-1")
    assert cpt.depth == pytest.approx([0.1, 0.2])  # row without qc dropped
    assert cpt.qc == pytest.approx([1500.0, 2000.0])  # MPa -> kPa
    assert cpt.fs == pytest.approx([12.0, 15.5])
    assert cpt.u2 == pytest.approx([0.0, 0.0])


def test_import_cpt_excel_explicit_units(tmp_path):
    path = tmp_path / "cpt.xlsx"
    pd.DataFrame({"Depth": [1.0, 2.0], "qc": [5.0, 6.0], "fs": [0.05, 0.06]}).to_excel(
        path, index=False
    )
    cpt = import_cpt(path, "C2", fs_unit="MPa", area_ratio=0.75)
    assert cpt.qc == pytest.approx([5000.0, 6000.0])
    assert cpt.fs == pytest.approx([50.0, 60.0])
    assert cpt.u2 is None and cpt.area_ratio == 0.75


def test_import_spt_with_refusal(tmp_path):
    path = tmp_path / "spt.csv"
    path.write_text("depth,N\n1.5,7\n3.0,50/12\n4.5,23\n", encoding="utf-8")
    bh = import_spt(path, "SK-1", energy_ratio=55)
    assert [(r.depth, r.n_field, r.refusal) for r in bh.spt] == [
        (1.5, 7, False), (3.0, 50, True), (4.5, 23, False)
    ]
    assert bh.energy_ratio == 55
    Investigations(boreholes=[bh])


def test_missing_column_message(tmp_path):
    path = tmp_path / "bad.csv"
    path.write_text("depth,qc\n1,2\n", encoding="utf-8")
    with pytest.raises(ImportDataError, match="fs"):
        import_cpt(path, "C")
