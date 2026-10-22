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
    with pytest.warns(UserWarning, match="u2"):
        cpt = import_cpt(path, "CPT-1")
    assert cpt.depth == pytest.approx([0.1, 0.2])  # row without qc dropped
    assert cpt.qc == pytest.approx([1500.0, 2000.0])  # MPa -> kPa
    assert cpt.fs == pytest.approx([12.0, 15.5])
    assert cpt.u2 == [0.0, None]  # the empty u2 cell stays missing (it used to be stored as 0)


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


def test_unrecognised_header_unit_is_an_error_but_explicit_unit_overrides(tmp_path):
    path = tmp_path / "cpt.csv"
    path.write_text("depth (m),qc (bogus),fs (kPa)\n1,5,50\n2,6,60\n", encoding="utf-8")
    with pytest.raises(ImportDataError, match="bogus"):
        import_cpt(path, "C1")
    cpt = import_cpt(path, "C1", qc_unit="MPa")
    assert cpt.qc == pytest.approx([5000.0, 6000.0])


def test_missing_u2_cells_stay_missing_with_warning(tmp_path):
    from geotek.engine.insitu.cpt import process_cpt
    path = tmp_path / "cpt.csv"
    path.write_text("depth,qc,fs,u2\n1,5,50,10\n2,6,60,\n3,7,70,30\n", encoding="utf-8")
    with pytest.warns(UserWarning, match="1 u2 cell"):
        cpt = import_cpt(path, "C1", qc_unit="MPa")
    assert cpt.u2 == [10.0, None, 30.0]
    assert Investigations(cpts=[cpt]).model_dump_json()  # null round-trips through the model
    processed = process_cpt(cpt, gwt_depth=0.5)
    # q_t = q_c + u2 (1 - a), a = 0.8: measured point 10 -> 5000 + 2 = 5002; missing point -> q_c unchanged
    assert processed.qt.tolist() == pytest.approx([5002.0, 6000.0, 7006.0])
    assert processed.Bq is not None and processed.Bq[1] != processed.Bq[1]  # NaN
    assert any(w.startswith("insitu.warning.cpt_u2_missing") for w in processed.warnings)


def test_lab_record_rejects_fines_plus_gravel_above_100():
    from geotek.core.models.investigations import LabRecord
    with pytest.raises(ValueError, match="cannot exceed 100"):
        LabRecord(depth=1.0, FC=60.0, gravel=50.0)
    assert LabRecord(depth=1.0, FC=60.0, gravel=40.0).FC == 60.0


def test_spt_diameter_out_of_table_warns_and_bad_rod_length_errors(two_layer_profile):
    from geotek.core.models.investigations import Borehole, SPTRecord
    from geotek.engine.insitu.spt import process_borehole, rod_length_factor
    bh = Borehole(id="B", borehole_diameter_mm=250.0, spt=[SPTRecord(depth=5.0, n_field=10)])
    assert any(w.startswith("insitu.warning.spt_borehole_diameter_out_of_range")
               for w in process_borehole(bh, two_layer_profile).warnings)
    ok = Borehole(id="B", borehole_diameter_mm=100.0, spt=[SPTRecord(depth=5.0, n_field=10)])
    assert not any("diameter" in w for w in process_borehole(ok, two_layer_profile).warnings)
    with pytest.raises(ValueError):
        rod_length_factor(float("nan"))
    with pytest.raises(ValueError):
        rod_length_factor(-1.0)
