"""examples/ornek_excel_proje.gtk: the project built from Example.xlsx by examples/make_excel_project.py."""

from pathlib import Path

from geotek.io.project_io import load_project

EXAMPLE = Path(__file__).resolve().parents[2] / "examples" / "ornek_excel_proje.gtk"


def test_example_project_holds_the_imported_workbook_data_and_a_linked_profile():
    project = load_project(EXAMPLE)
    borehole, cpt = project.investigations.boreholes[0], project.investigations.cpts[0]
    assert (borehole.id, len(borehole.spt), len(borehole.lab)) == ("Example-BH", 10, 2)
    assert (cpt.id, len(cpt.depth)) == ("Example-CPT", 200)
    profile = project.soil_profiles[0]
    assert set(profile.source_ids) == {"Example-BH", "Example-CPT"} and len(profile.layers) >= 2
