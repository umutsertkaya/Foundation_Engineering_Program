"""Word (docx) report from the stored results of an open project.

Only results already stored in the project are reported; nothing is recalculated here. A result
whose inputs changed since it was calculated is stale and is refused rather than printed.
Labels come from the ``report.*`` i18n keys in the requested language.
"""

from __future__ import annotations

import io
import math
import re
from dataclasses import dataclass
from typing import Any, Literal

from geotek.core.errors import GeoTekError
from geotek.core.models.profile import SoilProfile
from geotek.core.models.project import Project
from geotek.core.warning_codes import parse_warning
from geotek.i18n import t
from geotek.services import module1
from geotek.services.structures import calculation_fingerprint

SectionStatus = Literal["ready", "stale", "no_result"]
SectionKind = Literal[
    "project", "soil_profile", "classification", "retaining_wall", "sheet_pile", "liquefaction",
    "module"]

PROJECT_SECTION = "project"
LIQUEFACTION_SECTION = "liquefaction"
CLASSIFICATION_SECTION = "classification"
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
    if structure.soil.is_stale(source):
        return "stale"
    try:
        current = calculation_fingerprint(project, structure)
    except (ValueError, KeyError, TypeError):
        # Inputs that cannot be fingerprinted (e.g. NaN) cannot match the stored result.
        return "stale"
    return "ready" if structure.result_hash == current else "stale"


def _liquefaction_status(project: Project) -> SectionStatus:
    return module1.liquefaction_result_state(project)


def _module_manifests():
    # Lazy: the registry lives in the API layer and imports module packages.
    from geotek.api.registry import discover

    return [m for m in discover() if m.report_entries is not None]


def _module_sections(project: Project) -> list[SectionInfo]:
    """Sections contributed by modules through ``ModuleManifest.report_entries``."""
    out: list[SectionInfo] = []
    for manifest in _module_manifests():
        for entry in manifest.report_entries(project):
            if not entry.id.startswith(f"{manifest.id}:"):
                raise GeoTekError(
                    f"Module {manifest.id!r}: report entry id {entry.id!r} needs its module prefix")
            out.append(SectionInfo(entry.id, "module", entry.name or entry.id, entry.status))
    return out


def list_sections(project: Project) -> list[SectionInfo]:
    """All reportable sections of the project with the state of their results."""
    sections = [SectionInfo(PROJECT_SECTION, "project", project.meta.name, "ready")]
    sections += [SectionInfo(f"soil:{p.id}", "soil_profile", p.name or p.id, "ready")
                 for p in project.soil_profiles]
    sections += [SectionInfo(f"structure:{s.id}", s.kind, s.name or s.id,
                             _structure_status(project, s)) for s in project.structures]
    inv = project.investigations
    has_data = bool(inv.cpts) or any(b.lab for b in inv.boreholes)
    sections.append(SectionInfo(CLASSIFICATION_SECTION, "classification", "",
                                "ready" if has_data else "no_result"))
    sections.append(SectionInfo(LIQUEFACTION_SECTION, "liquefaction", "",
                                _liquefaction_status(project)))
    return sections + _module_sections(project)


def _fmt(value: Any, digits: int = 2) -> str:
    if value is None:
        return DASH
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, (int, float)):
        return DASH if not math.isfinite(value) else f"{value:.{digits}f}"
    return str(value)


_XML_INVALID = re.compile("[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]")


def _xml_safe(text: str) -> str:
    """docx (XML) cannot hold control characters; drop them instead of failing the report."""
    return _XML_INVALID.sub("", str(text))


class _Writer:
    def __init__(self, language: str) -> None:
        from docx import Document

        self.lang = language
        self.doc = Document()

    def tr(self, key: str, **kwargs) -> str:
        return t(key, self.lang, **kwargs)

    def coded(self, key: str, params: dict, fallback: Any = None) -> str:
        """Translate ``key`` with ``params``; an unknown key falls back to ``fallback`` or the key."""
        try:
            text = self.tr(key, **params)
        except (KeyError, IndexError, ValueError):
            text = key
        return text if text != key else str(fallback if fallback is not None else key)

    def message(self, message: str) -> str:
        """Localise a ``code[: key=value ...]`` warning string; free text passes through unchanged."""
        try:
            code, params = parse_warning(message)
        except ValueError:
            return message
        return self.coded(code, params, message)

    def enum(self, prefix: str, value: Any) -> str:
        """Translated label of a stored identifier (``<prefix>.<value>``); unknown ids stay raw."""
        if value is None or value == "":
            return DASH
        return self.coded(f"{prefix}.{value}", {}, value)

    def code_label(self, code_id: str) -> str:
        from geotek.config.codes import list_design_codes

        code = list_design_codes().get(code_id)
        return code.label.get(self.lang) if code is not None else code_id

    def assumption(self, item: dict) -> str:
        code = item.get("code")
        text = item["text"]
        if code and not code.startswith("wall."):
            text = self.coded(f"sheet_pile.assumption.{code}", item.get("params") or {}, text)
        elif code:
            text = self.coded(f"report.assumption.{code}", item.get("params") or {}, text)
        return f"{text} ({item['source']})"

    def heading(self, text: str, level: int = 1) -> None:
        self.doc.add_heading(_xml_safe(text), level=level)

    def paragraph(self, text: str, *, bold: bool = False) -> None:
        run = self.doc.add_paragraph().add_run(_xml_safe(text))
        run.bold = bold

    def bullets(self, items: list[str]) -> None:
        for item in items:
            self.doc.add_paragraph(_xml_safe(item), style="List Bullet")

    def table(self, header: list[str], rows: list[list[str]]) -> None:
        table = self.doc.add_table(rows=1, cols=len(header))
        table.style = "Table Grid"
        for cell, text in zip(table.rows[0].cells, header):
            cell.text = ""
            cell.paragraphs[0].add_run(_xml_safe(text)).bold = True
        for row in rows:
            for cell, text in zip(table.add_row().cells, row):
                cell.text = _xml_safe(text)
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
        (w.tr("report.project.code"), w.code_label(meta.design_code)),
        (w.tr("report.project.level"), w.enum("ui.level", meta.analysis_level)),
        (w.tr("report.project.pga"), _fmt(site.pga_g, 3)),
        (w.tr("report.project.mw"), _fmt(site.mw, 1)),
        (w.tr("report.project.sds"), _fmt(site.sds, 3)),
        (w.tr("report.project.sd1"), _fmt(site.sd1, 3)),
        (w.tr("report.project.site_class"), site.site_class or DASH),
    ])


def _soil_section(w: _Writer, profile: SoilProfile) -> None:
    w.heading(w.tr("report.section.soil", name=profile.name or w.tr("report.profile.unnamed")))
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


def _run_bottom(depth, start: int, stop: int) -> float:
    """Bottom of the samples ``start..stop-1``: each sample stands for the interval to the next one
    (the last sample for one spacing), so single-sample runs do not print as ``x–x``."""
    if stop < len(depth):
        return float(depth[stop])
    if stop >= 2:
        return float(depth[stop - 1] + (depth[stop - 1] - depth[stop - 2]))
    return float(depth[stop - 1])


def _classification_section(w: _Writer, project: Project) -> None:
    """SBTn zones per CPT and USCS per lab record, derived from the current investigations."""
    from geotek.engine.classification import robertson, uscs
    from geotek.engine.classification.uscs_names import USCS_NAMES

    w.heading(w.tr("report.section.classification"))
    lang = "tr" if w.lang == "tr" else "en"
    if project.investigations.cpts:
        processed = module1.process_investigations(project)
        w.heading(w.tr("report.cls.sbtn"), 2)
        for cpt in project.investigations.cpts:
            if cpt.id in processed.errors:
                w.bullets([f"{cpt.id}: {processed.errors[cpt.id]}"])
                continue
            data = processed.cpt[cpt.id]
            rows, start = [], 0
            zones = [int(z) if z is not None and 1 <= z <= 9 else 0 for z in data.zone]
            for i in range(1, len(zones) + 1):
                if i == len(zones) or zones[i] != zones[start]:
                    zone = zones[start]
                    rows.append([
                        _fmt(data.depth[start]), _fmt(_run_bottom(data.depth, start, i)),
                        str(zone) if zone else DASH,
                        robertson.ZONE_NAMES[zone][lang] if zone else DASH,
                        _fmt(float(sum(data.Ic[start:i]) / (i - start)), 2),
                    ])
                    start = i
            w.paragraph(cpt.id, bold=True)
            w.table([w.tr("report.soil.top"), w.tr("report.soil.bottom"), w.tr("report.cls.zone"),
                     w.tr("report.cls.zone_name"), w.tr("report.cls.ic_mean")], rows)
    labs = [(b.id, record) for b in project.investigations.boreholes for record in b.lab]
    if labs:
        w.heading(w.tr("report.cls.uscs"), 2)
        rows = []
        classified = {}
        for bid, record in labs:
            result = classified[id(record)] = uscs.classify_lab_record(record)
            name = USCS_NAMES.get(result.symbol)
            label = (name.group_name_tr if lang == "tr" else name.group_name_en) if name else DASH
            rows.append([bid, _fmt(record.depth), result.symbol or DASH, label, _fmt(record.FC, 1),
                         _fmt(record.LL, 1), _fmt(record.PI, 1),
                         w.tr("report.cls.complete" if result.complete else "report.cls.incomplete")])
        w.table([w.tr("report.cls.borehole"), w.tr("report.cls.depth"), w.tr("report.soil.uscs"),
                 w.tr("report.cls.zone_name"), "FC [%]", "LL", "PI", w.tr("report.cls.status")], rows)
        notes = [f"{bid} {_fmt(r.depth)} m: {n}" for bid, r in labs
                 for n in classified[id(r)].notes]
        if notes:
            w.heading(w.tr("report.warnings"), 3)
            w.bullets(notes)


def _evidence(w: _Writer, result: dict) -> None:
    assumptions = result.get("assumptions") or []
    if assumptions:
        w.heading(w.tr("report.assumptions"), 3)
        w.bullets([w.assumption(item) for item in assumptions])
    factors = result.get("factors_used") or []
    if factors:
        w.heading(w.tr("report.factors"), 3)
        w.table([w.tr("report.factor.path"), w.tr("report.col.value"),
                 w.tr("report.factor.source"), w.tr("report.factor.status")],
                [[f["path"], _fmt(f["value"], 3), f["source"], w.enum("fstatus", f["status"])]
                 for f in factors])
    items = result.get("warning_items") or []
    warnings = ([w.coded(f"sheet_pile.warning.{i['code']}", i.get("params") or {}, i.get("params", {}).get("text"))
                 for i in items] if items else [w.message(m) for m in result.get("warnings") or []])
    if warnings:
        w.heading(w.tr("report.warnings"), 3)
        w.bullets(warnings)


def _case_label(w: _Writer, case: str) -> str:
    """``static`` or ``seismic:combination`` as a readable label; unknown parts pass through."""
    state, _, combo = case.partition(":")
    label = w.coded(f"case.{state}", {}, state)
    return f"{label} ({combo})" if combo else label


def _check_label(w: _Writer, name: str) -> str:
    return w.coded(f"check.{name}", {}, name)


def _governing_ids(w: _Writer, text: str) -> str:
    """Localise ``case:name`` ids (separated by ``;`` or ``,``) used by the governing line."""
    out = []
    for part in text.replace(",", ";").split(";"):
        case, sep, name = part.strip().rpartition(":")
        out.append(f"{_case_label(w, case)} · {_check_label(w, name)}" if sep else part.strip())
    return "; ".join(out)


def _governing_line(w: _Writer, result: dict) -> str:
    """Failing checks when there are any; otherwise the check with the highest utilisation."""
    if result.get("governing"):
        return f"{w.tr('report.wall.governing')}: {_governing_ids(w, str(result['governing']))}"
    rated = [c for c in result.get("checks") or [] if c.get("utilisation") is not None
             and math.isfinite(c["utilisation"])]
    if not rated:
        return f"{w.tr('report.wall.governing')}: {DASH}"
    top = max(rated, key=lambda c: c["utilisation"])
    return (f"{w.tr('report.wall.governing_utilisation')}: "
            f"{_case_label(w, top['case'])} · {_check_label(w, top['name'])} "
            f"({_fmt(top['utilisation'], 2)})")


def _structure_basis(w: _Writer, structure, design_code: str, sds, r=None) -> list[tuple[str, str]]:
    """Rows stating what the structure itself was calculated with (not the project defaults)."""
    rows = [
        (w.tr("report.struct.design_code"), w.code_label(design_code)),
        (w.tr("report.struct.analysis_level"), w.enum("ui.level", structure.analysis_level)),
        (w.tr("report.struct.sds"), _fmt(sds, 3)),
    ]
    if r is not None:
        rows.append((w.tr("report.struct.r"), _fmt(r, 2)))
    return rows


def _structure_gwt_rows(w: _Writer, structure) -> list[tuple[str, str]]:
    """Retained / front water depths (design and seismic) the calculation used; fall back to the profile's."""
    soil = structure.soil
    rows: list[tuple[str, str]] = []
    for side, gwt in (("retained", soil.gwt_retained or soil.profile.gwt),
                      ("front", soil.gwt_front or soil.profile.gwt)):
        rows.append((w.tr(f"report.struct.gwt_{side}_design"), _fmt(gwt.depth_design)))
        rows.append((w.tr(f"report.struct.gwt_{side}_seismic"), _fmt(gwt.depth_seismic)))
    front_override = getattr(structure, "front_water_depth", None)
    if front_override is not None:
        rows.append((w.tr("report.struct.front_water_depth"), _fmt(front_override)))
    return rows


def _wall_section(w: _Writer, structure, result: dict) -> None:
    w.heading(w.tr("report.section.wall", name=structure.name or structure.id))
    inputs = structure.inputs
    w.key_values([
        (w.tr("report.wall.type"), w.enum("walls.type", structure.wall_type)),
        (w.tr("report.wall.height"), _fmt(structure.height)),
        (w.tr("report.wall.slope"), _fmt(structure.backfill_slope, 1)),
        (w.tr("report.wall.surcharge"), _fmt(inputs.surcharge)),
        (w.tr("report.wall.surcharge_basis"), w.enum("report.surcharge_basis", inputs.surcharge_basis)),
        (w.tr("report.wall.gwt_case"), w.enum("web.soil.gwt", f"{inputs.gwt_case}_short")),
        (w.tr("report.wall.approach"), structure.approach or DASH),
        *_structure_basis(w, structure, structure.settings.design_code, inputs.sds, inputs.r),
        *_structure_gwt_rows(w, structure),
        (w.tr("report.wall.kh"), _fmt(result.get("kh"), 3)),
        (w.tr("report.wall.kv"), _fmt(result.get("kv"), 3)),
    ])
    geometry = result.get("geometry") or {}
    w.heading(w.tr("report.wall.geometry"), 3)
    w.table([w.tr("report.col.item"), w.tr("report.col.value")],
            [[w.coded(f"ui.geo.{k}", {}, k), _fmt(v, 3)]
             for k, v in geometry.items() if k not in {"kind", "key"}])
    key = geometry.get("key")
    if key:
        w.heading(w.tr("walls.key.result_title"), 3)
        w.key_values([
            (w.tr("walls.key.position"), w.enum("walls.key.position", key["position"])),
            (w.tr("walls.key.width"), _fmt(key["width"], 2)),
            (w.tr("walls.key.depth"), _fmt(key["depth"], 2)),
        ])
        rows = result.get("shear_key") or []
        if rows:
            w.table([w.tr("walls.key.col_case"), w.tr("walls.key.col_fs_base"), w.tr("walls.key.col_fs_deep"),
                     w.tr("walls.key.col_fs_without"), w.tr("walls.key.col_fs_with"),
                     w.tr("walls.key.col_passive"), w.tr("walls.key.col_demand_v"),
                     w.tr("walls.key.col_demand_m")],
                    [[_case_label(w, r["case"]), _fmt(r["fs_base_surface"], 2), _fmt(r["fs_deep_surface"], 2),
                      _fmt(r["fs_without_key"], 2), _fmt(r["fs_with_key"], 2),
                      _fmt(r["passive_used"], 1), _fmt(r["demand_v"], 1), _fmt(r["demand_m"], 1)]
                     for r in rows])
            w.paragraph(w.tr("walls.key.note"))
    w.paragraph(f"{w.tr('report.wall.verdict')}: {(w.passfail(bool(result.get('passed'))) if result.get('passed') is not None else DASH)}",
                bold=True)
    w.paragraph(_governing_line(w, result))
    w.heading(w.tr("report.wall.checks"), 3)
    w.table(
        [w.tr("report.check.case"), w.tr("report.check.name"), w.tr("report.check.value"),
         w.tr("report.check.required"), w.tr("report.check.utilisation"),
         w.tr("report.check.result")],
        [[_case_label(w, c["case"]), _check_label(w, c["name"]), f"{_fmt(c['value'], 3)}", f"{c['comparison']} {_fmt(c['required'], 3)}",
          _fmt(c.get("utilisation"), 2), (w.passfail(bool(c["passed"])) if c.get("passed") is not None else DASH)]
         for c in result.get("checks") or []],
    )
    _evidence(w, result)


def _anchor_rows(w: _Writer, structure, result: dict) -> list[tuple[str, str]]:
    """Per-anchor load, spacing and inclination actually used (anchored support only)."""
    if structure.support != "anchored":
        return []
    return [
        (w.tr("report.pile.anchor_force_per_anchor"), _fmt(result.get("anchor_force_per_anchor"), 1)),
        (w.tr("report.pile.anchor_spacing"), _fmt(result.get("anchor_spacing_used", structure.anchor_spacing))),
        (w.tr("report.pile.anchor_inclination"),
         _fmt(result.get("anchor_inclination_used", structure.anchor_inclination), 1)),
    ]


def _sheet_pile_section(w: _Writer, structure, result: dict) -> None:
    w.heading(w.tr("report.section.sheet_pile", name=structure.name or structure.id))
    w.key_values([
        (w.tr("report.pile.support"), w.enum("sheet_pile.support", structure.support)),
        (w.tr("report.pile.slope"), _fmt(structure.backfill_slope, 1)),
        (w.tr("report.pile.surcharge"), _fmt(structure.surcharge)),
        (w.tr("report.pile.surcharge_basis"), w.enum("report.surcharge_basis", structure.surcharge_basis)),
        (w.tr("report.wall.approach"), structure.approach or DASH),
        *_structure_basis(w, structure, structure.design_code, structure.sds),
        *_structure_gwt_rows(w, structure),
        (w.tr("report.pile.H"), _fmt(result.get("H"))),
        (w.tr("report.pile.D0"), _fmt(result.get("D0"))),
        (w.tr("report.pile.D"), _fmt(result.get("D"))),
        (w.tr("report.pile.total_length"), _fmt(result.get("total_length"))),
        (w.tr("report.pile.anchor_depth"), _fmt(result.get("anchor_depth"))),
        (w.tr("report.pile.anchor_force"), _fmt(result.get("anchor_force"), 1)),
        *_anchor_rows(w, structure, result),
        (w.tr("report.pile.toe_force"), _fmt(abs(result["toe_force"]) if isinstance(result.get("toe_force"), (int, float)) else None, 1)),
        (w.tr("report.pile.M_max"), _fmt(result.get("M_max"), 1)),
        (w.tr("report.pile.z_M_max"), _fmt(result.get("z_M_max"))),
        (w.tr("report.pile.section_modulus"), _fmt(result.get("section_modulus_cm3"), 1)),
    ])
    _evidence(w, result)



def _profile_label(w: _Writer, project: Project, profile_id: str | None) -> str:
    """Profile name for display; a vanished or unnamed profile never shows its raw id."""
    if not profile_id:
        return DASH
    profile = next((p for p in project.soil_profiles if p.id == profile_id), None)
    if profile is None:
        return w.tr("report.profile.deleted")
    return profile.name or w.tr("report.profile.unnamed")


def _liquefaction_section(w: _Writer, project: Project, data: dict) -> None:
    w.heading(w.tr("report.section.liquefaction"))
    settings = data.get("settings") or {}
    w.key_values([
        (w.tr("report.liq.profile"), _profile_label(w, project, data.get("profile_id"))),
        (w.tr("report.liq.method"), w.enum("liquefaction.method", settings.get("method"))),
        (w.tr("report.liq.amax"), _fmt(settings.get("amax_g"), 3)),
        (w.tr("report.liq.mw"), _fmt(settings.get("mw"), 1)),
        (w.tr("report.liq.target_fs"), _fmt(settings.get("target_fs"), 2)),
        (w.tr("report.liq.gwt"), _fmt(settings.get("gwt_seismic"))),
        (w.tr("report.liq.fc"), _fmt(settings.get("default_fc"), 1)),
    ])
    rows = []
    for sounding_id, series in (data["result"].get("per_sounding") or {}).items():
        fs = [(v, d) for v, d in zip(series["FS"], series["depth"]) if v is not None and math.isfinite(v)]
        low = min(fs) if fs else None
        status = series["status"]
        rows.append([
            sounding_id, _fmt(low[0]) if low else DASH, _fmt(low[1]) if low else DASH,
            str(sum(s == "liquefiable" for s in status)), str(sum(s == "marginal" for s in status)),
            _fmt(series.get("LPI")) + (" *" if series.get("LPI_incomplete") else ""),
            w.tr(f"report.liq.lpi_category.{series['LPI_category']}") if series.get("LPI_category") else DASH,
        ])
    w.table([w.tr("report.liq.sounding"), w.tr("report.liq.min_fs"), w.tr("report.liq.min_fs_depth"),
             w.tr("report.liq.n_liquefiable"), w.tr("report.liq.n_marginal"),
             w.tr("report.liq.lpi"), w.tr("report.liq.lpi_category")], rows)
    notes = [f"{sid}: {w.tr('report.liq.lpi_incomplete')}" for sid, series in (data["result"].get("per_sounding") or {}).items()
             if series.get("LPI_incomplete")]
    notes += [f"{sid}: {w.message(msg)}" for sid, series in (data["result"].get("per_sounding") or {}).items()
             for msg in series.get("warnings") or []]
    if notes:
        w.heading(w.tr("report.warnings"), 3)
        w.bullets(notes)
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
        elif info.kind == "classification":
            _classification_section(w, project)
        elif info.kind == "liquefaction":
            _liquefaction_section(w, project, project.modules[LIQUEFACTION_SECTION].data)
        elif info.kind == "module":
            owner = next(m for m in _module_manifests() if info.id.startswith(f"{m.id}:"))
            owner.report_writer(w, project, info.id)
        else:
            structure = project.structure(info.id.removeprefix("structure:"))
            if info.kind == "retaining_wall":
                _wall_section(w, structure, structure.result)
            else:
                _sheet_pile_section(w, structure, structure.result)
    buffer = io.BytesIO()
    w.doc.save(buffer)
    return buffer.getvalue()
