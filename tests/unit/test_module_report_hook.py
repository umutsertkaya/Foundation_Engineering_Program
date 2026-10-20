"""Modules can contribute report sections without editing the report service."""

from __future__ import annotations

import io
from types import SimpleNamespace

import pytest
from docx import Document

from geotek.api import registry
from geotek.core.errors import GeoTekError
from geotek.core.modules import ModuleManifest, ReportEntry
from geotek.services import report


def _manifest(entry_id: str = "demo:one", **overrides) -> ModuleManifest:
    def entries(project):
        return [ReportEntry(entry_id, "Demo section", "ready")]

    def writer(w, project, entry_id):
        w.heading(f"demo written {entry_id}")

    fields = dict(id="demo", version="0.1.0", title_key="demo.title",
                  description_key="demo.description", icon="tool", order=99,
                  report_entries=entries, report_writer=writer)
    fields.update(overrides)
    return ModuleManifest(**fields)


@pytest.fixture
def with_demo(monkeypatch):
    monkeypatch.setattr(registry, "discover", lambda: [_manifest()])


def test_entries_and_writer_must_be_set_together():
    with pytest.raises(GeoTekError):
        _manifest(report_writer=None)


def test_module_section_is_listed(with_demo, monkeypatch):
    project = SimpleNamespace(
        meta=SimpleNamespace(name="P"), soil_profiles=[], structures=[],
        investigations=SimpleNamespace(cpts=[], boreholes=[]))
    monkeypatch.setattr(report, "_liquefaction_status", lambda p: "no_result")
    listed = {s.id: s for s in report.list_sections(project)}
    assert listed["demo:one"].kind == "module"
    assert listed["demo:one"].status == "ready"


def test_entry_id_needs_module_prefix(monkeypatch):
    monkeypatch.setattr(registry, "discover", lambda: [_manifest("other:one")])
    with pytest.raises(GeoTekError):
        report._module_sections(SimpleNamespace())


def test_module_section_is_rendered(with_demo):
    from geotek.core.models import Project, ProjectMeta

    project = Project(meta=ProjectMeta(name="P"))
    data = report.build_docx(project, ["demo:one"])
    text = "\n".join(p.text for p in Document(io.BytesIO(data)).paragraphs)
    assert "demo written demo:one" in text


def test_pyinstaller_helper_covers_every_module():
    import importlib.util
    from pathlib import Path

    path = Path(__file__).resolve().parents[2] / "tools" / "pyinstaller_modules.py"
    spec = importlib.util.spec_from_file_location("pyinstaller_modules", path)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    hidden = helper.hidden_imports()
    for id in registry.module_ids():
        assert f"geotek.modules.{id}" in hidden
    assert "geotek.modules._index" in hidden
