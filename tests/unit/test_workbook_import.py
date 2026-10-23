"""Smart workbook import: detection, open questions and record building."""

from __future__ import annotations

from pathlib import Path

import pytest
from openpyxl import Workbook

from geotek.core.errors import ImportDataError
from geotek.core.warning_codes import parse_warning
from geotek.io.workbook import analyze_workbook, build_import

EXAMPLE = Path(__file__).resolve().parents[2] / "examples" / "Example.xlsx"


def codes(items):
    return {(i.code if hasattr(i, "code") else parse_warning(i)[0]) for i in items}


def xlsx_bytes(sheets: dict[str, list[list]], tmp_path: Path) -> bytes:
    wb = Workbook()
    wb.remove(wb.active)
    for name, rows in sheets.items():
        ws = wb.create_sheet(name)
        for row in rows:
            ws.append(row)
    path = tmp_path / "book.xlsx"
    wb.save(path)
    return path.read_bytes()


@pytest.fixture(scope="module")
def example_plan():
    return analyze_workbook(EXAMPLE.read_bytes(), "Example.xlsx")


def test_example_sheet_roles_and_open_question(example_plan):
    roles = {s.name: s.role for s in example_plan.sheets}
    assert roles == {"CPT": "cpt", "SPT": "spt", "Samples": "samples", "Sieve": "sieve",
                     "Limits": "limits", "CU_Setup": "cu_setup", "CU_Curves": "cu_curves"}
    spt = next(s for s in example_plan.sheets if s.name == "SPT")
    assert {"blow1", "blow2", "blow3", "drive_start", "drive_end", "rod_length", "energy_ratio",
            "borehole_diameter", "sampler"} <= set(spt.columns)
    assert next(s for s in example_plan.sheets if s.name == "CPT").columns["fs"].unit == "MPa"
    # The sampler text is never guessed: the engineer must answer; the suggestion is only offered.
    assert [i.code for i in example_plan.blockers()] == ["import.issue.sampler_unmapped"]
    text = "Standard split spoon; no liner"
    assert example_plan.options.sampler_map == {text: None}
    assert example_plan.options.sampler_suggestions == {text: "no_liner"}
    with pytest.raises(ImportDataError):
        build_import(EXAMPLE.read_bytes(), "Example.xlsx", example_plan)


def test_example_import_builds_all_records():
    data = EXAMPLE.read_bytes()
    plan = analyze_workbook(data, "Example.xlsx")
    plan.options.sampler_map = {"Standard split spoon; no liner": "no_liner"}
    plan.issues = [i for i in plan.issues if i.severity != "blocker"]
    result = build_import(data, "Example.xlsx", plan)
    (borehole,) = result.boreholes
    (cpt,) = result.cpts
    first = borehole.spt[0]
    # drive 1.00-1.45 m: counted drive 1.15-1.45 m, representative depth 1.30 m; N = 11 + 11.
    assert first.depth == pytest.approx(1.30)
    assert (first.n_field, first.blows, first.rod_length, first.energy_ratio) == (22, [8, 11, 11], 2.0, 55.0)
    assert first.sampler == "no_liner" and first.borehole_diameter_mm == 100.0
    assert len(borehole.spt) == 10 and len(cpt.depth) == 200
    assert cpt.qc[0] == pytest.approx(4397.0) and cpt.fs[0] == pytest.approx(57.4)
    sand, clay = sorted(borehole.lab, key=lambda r: r.depth)
    assert (sand.sample_id, sand.specimen, sand.Gs) == ("G3-S", "reconstituted", 2.67)
    assert (sand.gravel, sand.FC) == pytest.approx((2.0, 22.0))
    assert sand.LL == pytest.approx(30.0, abs=0.1) and sand.PI == pytest.approx(10.0, abs=0.1)
    assert sand.phi_eff == pytest.approx(32.0, abs=0.2) and sand.c_eff == pytest.approx(2.5, abs=0.3)
    assert clay.FC == pytest.approx(81.0) and clay.phi_eff == pytest.approx(25.1, abs=0.2)
    assert {"import.warning.spt_depth_from_drive", "lab.warning.cu_reconstituted"} <= codes(result.warnings)


def test_depth_and_n_only_csv(tmp_path):
    csv = b"Depth (m),N\n1.5,10\n3.0,18\n4.5,50/12\n"
    plan = analyze_workbook(csv, "bh.csv")
    assert not plan.blockers() and plan.sheets[0].role == "spt"
    (borehole,) = build_import(csv, "bh.csv", plan).boreholes
    assert [(r.depth, r.n_field, r.refusal) for r in borehole.spt] == [
        (1.5, 10, False), (3.0, 18, False), (4.5, 50, True)]
    assert borehole.energy_ratio is None and borehole.spt[0].energy_ratio is None  # assumed later, with a warning


def test_turkish_semicolon_csv_with_decimal_comma():
    csv = "Derinlik (m);Darbe Sayısı\n1,5;10\n3,0;18\n".encode()
    plan = analyze_workbook(csv, "sondaj.csv")
    (borehole,) = build_import(csv, "sondaj.csv", plan).boreholes
    assert [r.depth for r in borehole.spt] == [1.5, 3.0]


def test_cpt_fs_unit_inferred_from_friction_ratio():
    kpa = b"Depth,qc (MPa),fs\n1,5,60\n2,6,70\n3,7,80\n"
    mpa = b"Depth,qc (MPa),fs\n1,5,0.06\n2,6,0.07\n3,7,0.08\n"
    assert analyze_workbook(kpa, "a.csv").sheets[0].columns["fs"].unit == "kPa"
    plan = analyze_workbook(mpa, "b.csv")
    assert plan.sheets[0].columns["fs"].unit == "MPa" and plan.sheets[0].columns["fs"].unit_source == "inferred"
    (cpt,) = build_import(mpa, "b.csv", plan).cpts
    assert cpt.fs == pytest.approx([60.0, 70.0, 80.0]) and cpt.qc == pytest.approx([5000.0, 6000.0, 7000.0])
    ambiguous = b"Depth,qc (MPa),fs\n1,5,2\n2,6,3\n3,7,4\n"
    assert "import.issue.unit_ambiguous" in {i.code for i in analyze_workbook(ambiguous, "c.csv").blockers()}


def test_cpt_without_fs_is_an_open_question():
    plan = analyze_workbook(b"Depth (m),qc (MPa)\n1,5\n2,6\n", "c.csv")
    assert not plan.blockers() and "import.issue.cpt_fs_missing" in {i.code for i in plan.issues}


def test_energy_ratio_scale_is_asked_when_ambiguous(tmp_path):
    data = xlsx_bytes({"SPT": [["Depth (m)", "N", "ER"], [1.5, 10, 0.55], [3.0, 12, 0.55]]}, tmp_path)
    plan = analyze_workbook(data, "x.xlsx")
    assert "import.issue.energy_ratio_scale" in {i.code for i in plan.blockers()}
    plan.options.energy_ratio_scale = "fraction"
    plan.issues = [i for i in plan.issues if i.severity != "blocker"]
    (borehole,) = build_import(data, "x.xlsx", plan).boreholes
    assert borehole.spt[0].energy_ratio == pytest.approx(55.0)


def test_point_id_column_splits_boreholes_and_unknown_samples_warn(tmp_path):
    data = xlsx_bytes({
        "SPT": [["Borehole", "Depth (m)", "N"], ["BH-1", 1.5, 10], ["BH-1", 3, 12], ["BH-2", 1.5, 8]],
        "Samples": [["Sample ID", "Depth (m)", "Natural water (%)"], ["S1", 2.0, 20]],
        "Limits": [["Sample ID", "Test", "Water content (%)"], ["S9", "PL", 20]],
    }, tmp_path)
    plan = analyze_workbook(data, "multi.xlsx")
    result = build_import(data, "multi.xlsx", plan)
    assert sorted(b.id for b in result.boreholes) == ["BH-1", "BH-2", "multi-BH"]
    assert "import.warning.sample_unknown" in codes(result.warnings)


def test_unrecognised_sheet_is_ignored_with_info(tmp_path):
    data = xlsx_bytes({"Notes": [["hello", "world"], ["a", "b"]],
                       "SPT": [["Depth", "N"], [1.5, 10]]}, tmp_path)
    plan = analyze_workbook(data, "n.xlsx")
    assert next(s for s in plan.sheets if s.name == "Notes").role is None
    assert "import.issue.sheet_unrecognised" in {i.code for i in plan.issues}
    assert len(build_import(data, "n.xlsx", plan).boreholes[0].spt) == 1


def test_bad_files_are_rejected():
    with pytest.raises(ImportDataError):
        analyze_workbook(b"not a workbook", "x.xlsx")
    with pytest.raises(ImportDataError):
        analyze_workbook(b"a,b", "x.pdf")
    plan = analyze_workbook(b"Depth,N\n", "e.csv")
    with pytest.raises(ImportDataError):
        build_import(b"Depth,N\n", "e.csv", plan)


def test_every_import_code_is_translated():
    import json
    import re

    root = Path(__file__).resolve().parents[2] / "geotek"
    used = set()
    for path in (root / "io" / "workbook").glob("*.py"):
        used |= set(re.findall(r'"(import\.(?:issue|warning)\.[a-z0-9_]+)"', path.read_text(encoding="utf-8")))
    assert used
    for lang in ("en", "tr"):
        catalog = json.loads((root / "i18n" / f"{lang}.json").read_text(encoding="utf-8"))
        assert not used - set(catalog), f"{lang}: {sorted(used - set(catalog))}"


# --- hardening: questions are re-derived on the server, no silent unit/scale guesses ----------

def blocker_codes(plan):
    return {i.code for i in plan.blockers()}


def test_client_cannot_skip_open_questions_by_dropping_issues():
    data = EXAMPLE.read_bytes()
    plan = analyze_workbook(data, "Example.xlsx")
    plan.issues = []
    with pytest.raises(ImportDataError):
        build_import(data, "Example.xlsx", plan)  # sampler still unanswered
    plan.options.sampler_map = {"Standard split spoon; no liner": "standard"}
    assert len(build_import(data, "Example.xlsx", plan).boreholes[0].spt) == 10


def test_energy_ratio_fraction_is_never_read_as_percent(tmp_path):
    data = xlsx_bytes({"SPT": [["Depth (m)", "N", "ER (%)"], [1.5, 10, 0.6], [3.0, 12, 60]]}, tmp_path)
    plan = analyze_workbook(data, "x.xlsx")
    assert "import.issue.energy_ratio_scale" in blocker_codes(plan)  # mixed 0.6 and 60
    plan.issues = []
    with pytest.raises(ImportDataError):
        build_import(data, "x.xlsx", plan)


def test_qc_unit_is_inferred_or_asked_never_assumed_blindly():
    kpa = b"Depth (m),qc,fs (kPa)\n1,5000,50\n2,6000,60\n"
    plan = analyze_workbook(kpa, "k.csv")
    qc = plan.sheets[0].columns["qc"]
    assert (qc.unit, qc.unit_source) == ("kPa", "inferred") and not plan.blockers()
    assert build_import(kpa, "k.csv", plan).cpts[0].qc == pytest.approx([5000.0, 6000.0])
    unclear = b"Depth (m),qc,fs (kPa)\n1,300,5\n2,320,6\n"
    assert "import.issue.unit_ambiguous" in blocker_codes(analyze_workbook(unclear, "u.csv"))
    wrong = b"Depth (m),qc (MPa),fs (kPa)\n1,5000,50\n2,6000,60\n"
    assert "import.issue.unit_implausible" in blocker_codes(analyze_workbook(wrong, "w.csv"))


def test_fs_unit_follows_the_qc_unit_not_a_hidden_default():
    csv = b"Depth (m),qc (bar),fs\n1,50,60\n2,60,70\n3,70,80\n"  # qc 5000 kPa, fs 60 kPa -> 1.2 %
    plan = analyze_workbook(csv, "b.csv")
    assert plan.sheets[0].columns["fs"].unit == "kPa" and not plan.blockers()
    (cpt,) = build_import(csv, "b.csv", plan).cpts
    assert cpt.qc[0] == pytest.approx(5000.0) and cpt.fs[0] == pytest.approx(60.0)
    # An explicit but implausible unit (fs in MPa against qc 5000 kPa) is asked again by the server.
    plan.sheets[0].columns["fs"].unit, plan.sheets[0].columns["fs"].unit_source = "MPa", "header"
    with pytest.raises(ImportDataError):
        build_import(csv, "b.csv", plan)


def test_unknown_unit_is_a_question_not_a_default():
    csv = b"Depth (furlong),N\n1,10\n2,12\n"
    plan = analyze_workbook(csv, "f.csv")
    assert "import.issue.unit_unknown" in blocker_codes(plan)
    with pytest.raises(ImportDataError):
        build_import(csv, "f.csv", plan)


def test_unit_row_under_header_is_read(tmp_path):
    data = xlsx_bytes({"CPT": [["Depth", "qc", "fs"], ["ft", "bar", "bar"], [3.28, 50, 0.5], [6.56, 60, 0.6]]},
                      tmp_path)
    plan = analyze_workbook(data, "u.xlsx")
    cols = plan.sheets[0].columns
    assert (cols["depth"].unit, cols["qc"].unit, cols["fs"].unit) == ("ft", "bar", "bar")
    (cpt,) = build_import(data, "u.xlsx", plan).cpts
    assert cpt.depth == pytest.approx([1.0, 2.0], abs=0.01) and len(cpt.depth) == 2


def test_ambiguous_thousands_separator_is_a_question():
    csv = 'Depth (m);qc (kPa);fs (kPa)\n1;"5,000";50\n2;6000;60\n'.encode()
    assert "import.issue.number_format_ambiguous" in blocker_codes(analyze_workbook(csv, "t.csv"))


def test_two_sheets_with_the_same_role_are_a_question(tmp_path):
    data = xlsx_bytes({"CPT1": [["Depth (m)", "qc (MPa)", "fs (kPa)"], [1, 5, 50], [2, 6, 60]],
                       "CPT2": [["Depth (m)", "qc (MPa)", "fs (kPa)"], [1, 7, 70], [2, 8, 80]]}, tmp_path)
    plan = analyze_workbook(data, "d.xlsx")
    assert "import.issue.role_duplicate" in blocker_codes(plan)
    plan.sheets[1].role = None
    plan.issues = []
    assert len(build_import(data, "d.xlsx", plan).cpts) == 1


def test_empty_point_id_continues_the_id_above(tmp_path):
    data = xlsx_bytes({"SPT": [["Borehole", "Depth (m)", "N"], ["BH-1", 1.5, 10], [None, 3, 12],
                               ["BH-2", 1.5, 8]]}, tmp_path)
    plan = analyze_workbook(data, "m.xlsx")
    boreholes = {b.id: len(b.spt) for b in build_import(data, "m.xlsx", plan).boreholes}
    assert boreholes == {"BH-1": 2, "BH-2": 1}


def test_single_letter_diameter_column_is_not_depth():
    csv = b"D (mm),N\n100,10\n100,12\n"
    plan = analyze_workbook(csv, "d.csv")
    assert not plan.sheets[0].role or "depth" not in plan.sheets[0].columns


def test_short_drive_depth_never_exceeds_drive_end(tmp_path):
    data = xlsx_bytes({"SPT": [["Drive start (m)", "Drive end (m)", "Blows 0-150 mm", "Blows 150-300 mm",
                                "Blows 300-450 mm"], [10.0, 10.05, 50, 0, 0], [12.0, 12.45, 5, 6, 7]]},
                      tmp_path)
    plan = analyze_workbook(data, "s.xlsx")
    result = build_import(data, "s.xlsx", plan)
    first, second = result.boreholes[0].spt
    assert first.depth <= 10.05 and first.refusal
    assert second.depth == pytest.approx(12.3) and second.n_field == 13
    assert "import.warning.spt_short_drive" in codes(result.warnings)


def test_sieve_designations_are_resolved_and_unknown_ones_asked(tmp_path):
    book = {
        "Samples": [["Sample ID", "Depth (m)", "Sieve dry mass (g)"], ["S1", 2.0, 100]],
        "Sieve": [["Sample ID", "Sieve opening", "Dry mass retained (g)"],
                  ["S1", "No. 4", 10], ["S1", "#200", 50]],
    }
    data = xlsx_bytes(book, tmp_path)
    plan = analyze_workbook(data, "sv.xlsx")
    assert not plan.blockers()
    lab = build_import(data, "sv.xlsx", plan).boreholes[0].lab[0]
    assert (lab.gravel, lab.FC) == pytest.approx((10.0, 40.0))
    book["Sieve"][1][1] = "coarse"
    assert "import.issue.sieve_opening_unresolved" in blocker_codes(
        analyze_workbook(xlsx_bytes(book, tmp_path), "sv.xlsx"))


def test_lab_scale_checks(tmp_path):
    book = {"Samples": [["Sample ID", "Depth (m)", "Bulk unit wt", "Natural water (%)"],
                        ["S1", 2.0, 1.9, 0.25]]}
    plan = analyze_workbook(xlsx_bytes(book, tmp_path), "l.xlsx")
    found = blocker_codes(plan)
    assert {"import.issue.unit_implausible", "import.issue.water_content_scale"} <= found


def test_refresh_plan_rederives_questions_after_edits():
    from geotek.io.workbook import refresh_plan

    data = EXAMPLE.read_bytes()
    plan = analyze_workbook(data, "Example.xlsx")
    assert [i.code for i in plan.blockers()] == ["import.issue.sampler_unmapped"]
    plan.options.sampler_map = {"Standard split spoon; no liner": "no_liner"}
    assert refresh_plan(data, "Example.xlsx", plan).blockers() == []
    # Pointing the depth of the CPT sheet at another column re-derives its unit and keeps asking.
    cpt = next(s for s in plan.sheets if s.name == "CPT")
    cpt.columns["qc"].header = "fs (MPa)"
    cpt.columns["qc"].unit_source = "default"
    cpt.columns["qc"].unit = None
    refreshed = refresh_plan(data, "Example.xlsx", plan)
    assert cpt.columns["qc"].unit == "MPa"
    del cpt.columns["qc"]
    assert "import.issue.required_missing" in {i.code for i in refresh_plan(data, "Example.xlsx", plan).blockers()}
    assert refreshed is plan
