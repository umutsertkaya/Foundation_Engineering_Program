"""Word (docx) report from the stored results of an open project.

Only results already stored in the project are reported; nothing is recalculated here. A result
whose inputs changed since it was calculated is stale and is refused rather than printed.
Labels come from the ``report.*`` i18n keys in the requested language.
"""

from __future__ import annotations

import io
import math
from dataclasses import dataclass
from typing import Any, Literal

from geotek.core.errors import GeoTekError
from geotek.core.models.profile import SoilProfile
from geotek.core.models.project import Project
from geotek.i18n import t
from geotek.services import module1
from geotek.services.structures import calculation_fingerprint

SectionStatus = Literal["ready", "stale", "no_result"]
SectionKind = Literal["project", "soil_profile", "retaining_wall", "sheet_pile", "liquefaction"]

PROJECT_SECTION = "project"
LIQUEFACTION_SECTION = "liquefaction"
DASH = "-"


class ReportError(GeoTekError):
    """Selection error carrying a machine code and the offending section ids."""

    def __init__(self, code: str, section_ids: list[str]) -> None:
        super().__init__(f"{code}: {', '.join(section_ids)}")
        self.code = code
        self.section_ids = section_ids


@dataclass(frozen=True)
class SectionInfo:
    id: str
    kind: SectionKind
    name: str
    status: SectionStatus


def _structure_status(project: Project, structure) -> SectionStatus:
    if structure.result is None or structure.result_hash is None:
        return "no_result"
    source = next((p for p in project.soil_profiles
                   if p.id == structure.soil.source_profile_id), None)
    if (structure.soil.is_stale(source)
            or structure.result_hash != calculation_fingerprint(project, structure)):
        return "stale"
    return "ready"


def _liquefaction_status(project: Project) -> SectionStatus:
    section = project.modules.get(LIQUEFACTION_SECTION)
    data = section.data if section is not None else {}
    if not data.get("result") or data.get("profile_id") is None:
        return "no_result"
    # The run either followed the active profile or an explicit one; the stored hash matches
    # exactly one of the two cases.
    for use_active in (True, False):
        try:
            current = module1.liquefaction_input_hash(project, data["profile_id"], use_active)
        except (KeyError, ValueError):
            continue
        if current == data.get("input_hash"):
            return "ready"
    return "stale"


def list_sections(project: Project) -> list[SectionInfo]:
    """All reportable sections of the project with the state of their results."""
    sections = [SectionInfo(PROJECT_SECTION, "project", project.meta.name, "ready")]
    sections += [SectionInfo(f"soil:{p.id}", "soil_profile", p.name or p.id, "ready")
                 for p in project.soil_profiles]
    sections += [SectionInfo(f"structure:{s.id}", s.kind, s.name or s.id,
                             _structure_status(project, s)) for s in project.structures]
    sections.append(SectionInfo(LIQUEFACTION_SECTION, "liquefaction", "",
                                _liquefaction_status(project)))
    return sections


def _fmt(value: Any, digits: int = 2) -> str:
    if value is None:
        return DASH
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, (int, float)):
        return DASH if not math.isfinite(value) else f"{value:.{digits}f}"
    return str(value)


class _Writer:
    def __init__(self, language: str) -> None:
        from docx import Document

        self.lang = language
        self.doc = Document()

    def tr(self, key: str, **kwargs) -> str:
        return t(key, self.lang, **kwargs)

    def heading(self, text: str, level: int = 1) -> None:
        self.doc.add_heading(text, level=level)

    def paragraph(self, text: str, *, bold: bool = False) -> None:
        run = self.doc.add_paragraph().add_run(text)
        run.bold = bold

    def bullets(self, items: list[str]) -> None:
        for item in items:
            self.doc.add_paragraph(item, style="List Bullet")

    def table(self, header: list[str], rows: list[list[str]]) -> None:
        table = self.doc.add_table(rows=1, cols=len(header))
        table.style = "Table Grid"
        for cell, text in zip(table.rows[0].cells, header):
            cell.text = ""
            cell.paragraphs[0].add_run(text).bold = True
        for row in rows:
            for cell, text in zip(table.add_row().cells, row):
                cell.text = text
        self.doc.add_paragraph()

    def key_values(self, pairs: list[tuple[str, str]]) -> None:
        self.table([self.tr("report.col.item"), self.tr("report.col.value")],
                   [[k, v] for k, v in pairs])

    def passfail(self, passed: bool) -> str:
        return self.tr("report.pass" if passed else "report.fail")


def _project_section(w: _Writer, project: Project) -> None:
    meta, site = project.meta, project.site
    w.heading(w.tr("report.section.project"))
    w.key_values([
        (w.tr("report.project.name"), meta.name),
        (w.tr("report.project.number"), meta.number or DASH),
        (w.tr("report.project.engineer"), meta.engineer or DASH),
        (w.tr("report.project.date"), meta.date.isoformat()),
        (w.tr("report.project.code"), meta.design_code),
        (w.tr("report.project.level"), meta.analysis_level),
        (w.tr("report.project.pga"), _fmt(site.pga_g, 3)),
        (w.tr("report.project.mw"), _fmt(site.mw, 1)),
        (w.tr("report.project.sds"), _fmt(site.sds, 3)),
        (w.tr("report.project.sd1"), _fmt(site.sd1, 3)),
        (w.tr("report.project.site_class"), site.site_class or DASH),
    ])


def _soil_section(w: _Writer, profile: SoilProfile) -> None:
    w.heading(w.tr("report.section.soil", name=profile.name or profile.id))
    gwt = profile.gwt
    w.key_values([
        (w.tr("report.soil.gwt_insitu"), _fmt(gwt.depth_insitu)),
        (w.tr("report.soil.gwt_design"), _fmt(gwt.depth_design)),
        (w.tr("report.soil.gwt_seismic"), _fmt(gwt.depth_seismic)),
    ])
    w.table(
        [w.tr("report.soil.top"), w.tr("report.soil.bottom"), w.tr("report.soil.description"),
         w.tr("report.soil.uscs"), w.tr("report.soil.gamma"), w.tr("report.soil.gamma_sat"),
         w.tr("report.soil.phi"), w.tr("report.soil.c"), w.tr("report.soil.su")],
        [[_fmt(layer.top), _fmt(layer.bottom), layer.description or DASH, layer.uscs or DASH,
          _fmt(layer.gamma), _fmt(layer.gamma_sat), _fmt(layer.design.phi_eff, 1),
          _fmt(layer.design.c_eff, 1), _fmt(layer.design.su, 1)] for layer in profile.layers],
    )


def _evidence(w: _Writer, result: dict) -> None:
    assumptions = result.get("assumptions") or []
    if assumptions:
        w.heading(w.tr("report.assumptions"), 3)
        w.bullets([f"{item['text']} ({item['source']})" for item in assumptions])
    factors = result.get("factors_used") or []
    if factors:
        w.heading(w.tr("report.factors"), 3)
        w.table([w.tr("report.factor.path"), w.tr("report.col.value"),
                 w.tr("report.factor.source"), w.tr("report.factor.status")],
                [[f["path"], _fmt(f["value"], 3), f["source"], f["status"]] for f in factors])
    warnings = result.get("warnings") or []
    if warnings:
        w.heading(w.tr("report.warnings"), 3)
        w.bullets(list(warnings))


def _wall_section(w: _Writer, structure, result: dict) -> None:
    w.heading(w.tr("report.section.wall", name=structure.name or structure.id))
    inputs = structure.inputs
    w.key_values([
        (w.tr("report.wall.type"), structure.wall_type),
        (w.tr("report.wall.height"), _fmt(structure.height)),
        (w.tr("report.wall.slope"), _fmt(structure.backfill_slope, 1)),
        (w.tr("report.wall.surcharge"), _fmt(inputs.surcharge)),
        (w.tr("report.wall.gwt_case"), inputs.gwt_case),
        (w.tr("report.wall.approach"), structure.approach or DASH),
        (w.tr("report.wall.kh"), _fmt(result.get("kh"), 3)),
        (w.tr("report.wall.kv"), _fmt(result.get("kv"), 3)),
    ])
    geometry = result.get("geometry") or {}
    w.heading(w.tr("report.wall.geometry"), 3)
    w.table([w.tr("report.col.item"), w.tr("report.col.value")],
            [[k, _fmt(v, 3)] for k, v in geometry.items() if k != "kind"])
    w.paragraph(f"{w.tr('report.wall.verdict')}: {w.passfail(bool(result.get('passed')))}",
                bold=True)
    w.paragraph(f"{w.tr('report.wall.governing')}: {result.get('governing') or DASH}")
    w.heading(w.tr("report.wall.checks"), 3)
    w.table(
        [w.tr("report.check.case"), w.tr("report.check.name"), w.tr("report.check.value"),
         w.tr("report.check.required"), w.tr("report.check.utilisation"),
         w.tr("report.check.result")],
        [[c["case"], c["name"], f"{_fmt(c['value'], 3)}", f"{c['comparison']} {_fmt(c['required'], 3)}",
          _fmt(c.get("utilisation"), 2), w.passfail(bool(c["passed"]))]
         for c in result.get("checks") or []],
    )
    _evidence(w, result)


def _sheet_pile_section(w: _Writer, structure, result: dict) -> None:
    w.heading(w.tr("report.section.sheet_pile", name=structure.name or structure.id))
    w.key_values([
        (w.tr("report.pile.support"), structure.support),
        (w.tr("report.pile.surcharge"), _fmt(structure.surcharge)),
        (w.tr("report.wall.approach"), structure.approach or DASH),
        (w.tr("report.pile.H"), _fmt(result.get("H"))),
        (w.tr("report.pile.D0"), _fmt(result.get("D0"))),
        (w.tr("report.pile.D"), _fmt(result.get("D"))),
        (w.tr("report.pile.total_length"), _fmt(result.get("total_length"))),
        (w.tr("report.pile.anchor_depth"), _fmt(result.get("anchor_depth"))),
        (w.tr("report.pile.anchor_force"), _fmt(result.get("anchor_force"), 1)),
        (w.tr("report.pile.toe_force"), _fmt(result.get("toe_force"), 1)),
        (w.tr("report.pile.M_max"), _fmt(result.get("M_max"), 1)),
        (w.tr("report.pile.z_M_max"), _fmt(result.get("z_M_max"))),
        (w.tr("report.pile.section_modulus"), _fmt(result.get("section_modulus_cm3"), 1)),
    ])
    _evidence(w, result)



def _liquefaction_section(w: _Writer, data: dict) -> None:
    w.heading(w.tr("report.section.liquefaction"))
    settings = data.get("settings") or {}
    w.key_values([
        (w.tr("report.liq.profile"), str(data.get("profile_id"))),
        (w.tr("report.liq.method"), str(settings.get("method", DASH))),
        (w.tr("report.liq.amax"), _fmt(settings.get("amax_g"), 3)),
        (w.tr("report.liq.mw"), _fmt(settings.get("mw"), 1)),
        (w.tr("report.liq.target_fs"), _fmt(settings.get("target_fs"), 2)),
        (w.tr("report.liq.gwt"), _fmt(settings.get("gwt_seismic"))),
        (w.tr("report.liq.fc"), _fmt(settings.get("default_fc"), 1)),
    ])
    rows = []
    for sounding_id, series in (data["result"].get("per_sounding") or {}).items():
        fs = [(v, d) for v, d in zip(series["FS"], series["depth"]) if v is not None]
        low = min(fs) if fs else None
        status = series["status"]
        rows.append([
            sounding_id, _fmt(low[0]) if low else DASH, _fmt(low[1]) if low else DASH,
            str(sum(s == "liquefiable" for s in status)), str(sum(s == "marginal" for s in status)),
        ])
    w.table([w.tr("report.liq.sounding"), w.tr("report.liq.min_fs"), w.tr("report.liq.min_fs_depth"),
             w.tr("report.liq.n_liquefiable"), w.tr("report.liq.n_marginal")], rows)
    errors = data["result"].get("errors") or {}
    if errors:
        w.heading(w.tr("report.liq.errors"), 3)
        w.bullets([f"{key}: {message}" for key, message in errors.items()])


def default_selection(project: Project) -> list[str]:
    """Project, every profile and every section whose result is current."""
    return [s.id for s in list_sections(project)
            if s.kind in ("project", "soil_profile") or s.status == "ready"]


def build_docx(project: Project, section_ids: list[str] | None = None,
               language: str | None = None) -> bytes:
    """Render the selected sections (default: :func:`default_selection`) to docx bytes.

    Raises :class:`ReportError` ``unknown_section`` / ``no_result`` / ``stale_result``.
    Document order follows the project, not the order of ``section_ids``.
    """
    sections = {s.id: s for s in list_sections(project)}
    selected = default_selection(project) if section_ids is None else list(dict.fromkeys(section_ids))
    unknown = [i for i in selected if i not in sections]
    if unknown:
        raise ReportError("unknown_section", unknown)
    missing = [i for i in selected if sections[i].status == "no_result"]
    if missing:
        raise ReportError("no_result", missing)
    stale = [i for i in selected if sections[i].status == "stale"]
    if stale:
        raise ReportError("stale_result", stale)
    if not selected:
        raise ReportError("empty_selection", [])

    w = _Writer(language or project.meta.language)
    w.doc.add_heading(w.tr("report.title"), 0)
    w.paragraph(project.meta.name, bold=True)
    for info in sections.values():
        if info.id not in selected:
            continue
        if info.id == PROJECT_SECTION:
            _project_section(w, project)
        elif info.kind == "soil_profile":
            _soil_section(w, project.profile(info.id.removeprefix("soil:")))
        elif info.kind == "liquefaction":
            _liquefaction_section(w, project.modules[LIQUEFACTION_SECTION].data)
        else:
            structure = project.structure(info.id.removeprefix("structure:"))
            if info.kind == "retaining_wall":
                _wall_section(w, structure, structure.result)
            else:
                _sheet_pile_section(w, structure, structure.result)
    buffer = io.BytesIO()
    w.doc.save(buffer)
    return buffer.getvalue()
