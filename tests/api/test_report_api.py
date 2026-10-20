"""Report module: section listing, stale refusal and docx content."""

import io

import pytest
from docx import Document

from geotek.core.models.investigations import Borehole, CPTSounding, Investigations, SPTRecord
from geotek.core.models.project import ProjectMeta
from geotek.core.models.structures import RetainingWallStructure

from .job_helpers import poll_job, sheet_project, submit, wall_project

BASE = "/api/m/report"
LIQ = {"method": "bi2014", "amax_g": 0.4, "mw": 7.5, "target_fs": 1.1,
       "default_fc": 5, "c_fc": 0, "ic_cutoff": 2.6}
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def _text(response) -> str:
    doc = Document(io.BytesIO(response.content))
    cells = [c.text for t in doc.tables for row in t.rows for c in row.cells]
    return "\n".join([p.text for p in doc.paragraphs] + cells)


@pytest.fixture
def open_project(shell, two_layer_profile):
    """Wall + sheet pile + liquefaction results, all current."""
    project = wall_project(geometry=True)
    pile = sheet_project().structures[0]
    pile.id = "sheet"
    project.structures.append(pile)
    project.soil_profiles.append(two_layer_profile)
    project.active_profile_id = two_layer_profile.id
    project.investigations = Investigations(
        boreholes=[Borehole(id="BH1", spt=[SPTRecord(depth=1.5, n_field=6),
                                           SPTRecord(depth=5, n_field=8)])],
        cpts=[CPTSounding(id="CPT1", depth=[1, 2, 4, 5, 7, 9], qc=[3000, 3000, 3000, 3000, 800, 800],
                          fs=[20, 20, 20, 20, 35, 35])])
    project.meta = ProjectMeta(name="Rapor Projesi", language="en")
    shell.app.state.session.open_project(project)
    for path in ("/api/m/walls/structures/wall/check", "/api/m/sheet_pile/structures/sheet/design"):
        assert poll_job(shell, submit(shell, path))["status"] == "done"
    assert poll_job(shell, submit(shell, "/api/m/liquefaction/run", json=LIQ))["status"] == "done"
    return project


def test_requires_open_project(shell):
    assert shell.get(f"{BASE}/sections").status_code == 409
    assert shell.post(f"{BASE}/docx", json={}).status_code == 409


def test_sections_report_status(shell, open_project):
    sections = {s["id"]: s for s in shell.get(f"{BASE}/sections").json()}
    assert sections["project"]["status"] == "ready"
    assert sections["soil:P1"]["kind"] == "soil_profile"
    assert sections["structure:wall"]["status"] == "ready"
    assert sections["structure:sheet"]["status"] == "ready"
    assert sections["liquefaction"]["status"] == "ready"


def test_default_report_contains_results(shell, open_project):
    response = shell.post(f"{BASE}/docx", json={})
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == DOCX
    assert 'filename="Rapor_Projesi_report.docx"' in response.headers["content-disposition"]
    text = _text(response)
    assert "Rapor Projesi" in text and "Checks" in text and "Utilisation" in text
    assert "Max moment" in text and "Liquefaction analysis" in text and "BH1" in text
    wall_checks = open_project.structure("wall").result["checks"]
    assert wall_checks[0]["name"] in text


def test_language_override_and_selection(shell, open_project):
    response = shell.post(f"{BASE}/docx", json={"sections": ["project"], "language": "tr"})
    assert response.status_code == 200
    text = _text(response)
    assert "Proje bilgileri" in text and "Kontroller" not in text


def test_selection_errors(shell, open_project):
    assert shell.post(f"{BASE}/docx", json={"sections": ["structure:nope"]}).status_code == 404
    assert shell.post(f"{BASE}/docx", json={"sections": []}).status_code == 422


def test_stale_wall_is_refused_and_skipped_by_default(shell, open_project):
    wall = open_project.structure("wall")
    assert isinstance(wall, RetainingWallStructure)
    wall.inputs.surcharge += 5
    status = {s["id"]: s["status"] for s in shell.get(f"{BASE}/sections").json()}
    assert status["structure:wall"] == "stale"
    refused = shell.post(f"{BASE}/docx", json={"sections": ["structure:wall"]})
    assert refused.status_code == 409 and refused.json()["code"] == "stale_result"
    assert refused.json()["details"]["sections"] == ["structure:wall"]
    default = _text(shell.post(f"{BASE}/docx", json={}))
    assert "Checks" not in default and "Max moment" in default


def test_missing_result_is_refused(shell, open_project):
    open_project.structure("sheet").result = None
    open_project.structure("sheet").result_hash = None
    refused = shell.post(f"{BASE}/docx", json={"sections": ["structure:sheet"]})
    assert refused.status_code == 409 and refused.json()["code"] == "no_result"


def test_liquefaction_goes_stale_when_investigations_change(shell, open_project):
    open_project.investigations.boreholes[0].spt[0].n_field = 30
    status = {s["id"]: s["status"] for s in shell.get(f"{BASE}/sections").json()}
    assert status["liquefaction"] == "stale"
    refused = shell.post(f"{BASE}/docx", json={"sections": ["liquefaction"]})
    assert refused.status_code == 409 and refused.json()["code"] == "stale_result"
