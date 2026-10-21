"""Report sections of the anchored wall module (``ModuleManifest.report_entries`` / ``report_writer``)."""

from __future__ import annotations

from geotek.core.errors import GeoTekError
from geotek.core.models.anchors import (
    ANCHOR_STATE_VERSION,
    AnalysisResult,
    AnchorCheck,
    AnchorDesignInputs,
    AnchorDesignResult,
    AnchoredWallState,
    Notice,
)
from geotek.core.module_state import get_state
from geotek.core.modules import ReportEntry
from geotek.i18n import t
from geotek.modules.anchored_wall.api import MODULE_ID, _analysis_stale, _soil_stale, _stale

ANALYSIS_ENTRY = f"{MODULE_ID}:analysis"
ANCHOR_ENTRY = f"{MODULE_ID}:anchor"
DASH = "—"


def _state(project) -> AnchoredWallState:
    try:
        return get_state(project, MODULE_ID, AnchoredWallState, ANCHOR_STATE_VERSION)
    except GeoTekError:
        return AnchoredWallState()


def report_entries(project) -> list[ReportEntry]:
    state = _state(project)
    lang = project.meta.language
    entries = []
    record = state.analysis
    if record is None or record.result is None:
        status = "no_result"
    else:
        status = "stale" if _analysis_stale(state) or _soil_stale(project, state) else "ready"
    entries.append(ReportEntry(ANALYSIS_ENTRY, t("anchored_wall.report.analysis", lang), status))
    anchor = state.anchor
    if anchor is None or anchor.result is None:
        status = "no_result"
    else:
        status = "stale" if _stale(state) else "ready"
    entries.append(ReportEntry(ANCHOR_ENTRY, t("anchored_wall.report.anchor", lang), status))
    return entries


def _num(value, digits: int = 2) -> str:
    return DASH if value is None else f"{value:.{digits}f}"


def _notice(w, kind: str, notice: Notice) -> str:
    params = dict(notice.params)
    if isinstance(params.get("kind"), str):  # envelope type id -> translated name
        params["kind"] = w.tr(f"anchored_wall.envelope.{params['kind']}")
    return w.coded(f"anchored_wall.{kind}.{notice.code}", params, notice.code)


def _notices(w, items: list[Notice], kind: str, prefix: str = "") -> list[str]:
    return [prefix + _notice(w, kind, n) for n in items]


def _checks(w, checks: list[AnchorCheck]) -> None:
    if not checks:
        return
    w.table([w.tr("anchored_wall.report.check"), w.tr("anchored_wall.report.demand"),
             w.tr("anchored_wall.report.limit"), w.tr("anchored_wall.report.result")],
            [[w.coded(f"anchored_wall.check.{c.id}", {}, c.id), _num(c.demand), _num(c.limit),
              w.passfail(c.ok)] for c in checks])


def _evidence(w, assumptions: list[Notice], warnings: list[Notice], sources: list[str]) -> None:
    if assumptions:
        w.heading(w.tr("report.assumptions"), 3)
        w.bullets(_notices(w, assumptions, "assumption"))
    if warnings:
        w.heading(w.tr("report.warnings"), 3)
        w.bullets(_notices(w, warnings, "warning"))
    if sources:
        w.heading(w.tr("anchored_wall.report.sources"), 3)
        w.bullets(list(sources))


def _design_rows(w, design: AnchorDesignResult) -> list[tuple[str, str]]:
    tendon = design.tendon
    return [
        (w.tr("anchored_wall.result.design_load"), _num(design.design_load, 1)),
        (w.tr("anchored_wall.result.vertical_load"), _num(design.vertical_load_per_anchor, 1)),
        (w.tr("anchored_wall.result.lock_off_load"), _num(design.lock_off_load, 1)),
        (w.tr("anchored_wall.result.test_load"), _num(design.test_load, 1)),
        (w.tr("anchored_wall.result.free_length"), _num(design.free_length)),
        (w.tr("anchored_wall.result.bond_length"), _num(design.bond_length)),
        (w.tr("anchored_wall.result.total_length"), _num(design.total_length)),
        (w.tr("anchored_wall.report.safety_factor"), _num(design.safety_factor)),
        (w.tr("anchored_wall.report.transfer_load"), _num(design.transfer_load, 1)),
        (w.tr("anchored_wall.result.tendon"),
         f"{tendon.count} × {tendon.label} ({tendon.source})"),
        (w.tr("anchored_wall.report.tendon_capacity"), _num(tendon.smts_total, 1)),
        (w.tr("anchored_wall.report.design_utilisation"), _num(tendon.design_utilisation, 2)),
    ]


def _anchor_section(w, inputs: AnchorDesignInputs, result: AnchorDesignResult) -> None:
    w.heading(w.tr("anchored_wall.report.anchor"))
    w.key_values([
        (w.tr("anchored_wall.input.excavation_height"), _num(inputs.excavation_height)),
        (w.tr("anchored_wall.input.head_depth"), _num(inputs.head_depth)),
        (w.tr("anchored_wall.input.inclination"), _num(inputs.inclination_deg, 1)),
        (w.tr("anchored_wall.input.phi"), _num(inputs.phi_deg, 1)),
    ] + _design_rows(w, result))
    _checks(w, result.checks)
    _evidence(w, result.assumptions, result.warnings, result.sources)


def _analysis_section(w, result: AnalysisResult, inputs) -> None:
    w.heading(w.tr("anchored_wall.report.analysis"))
    w.key_values([
        (w.tr("anchored_wall.report.wall_type"), w.tr(f"anchored_wall.wall_type.{inputs.wall_type}")),
        (w.tr("anchored_wall.input.excavation_height"), _num(inputs.excavation_height)),
        (w.tr("anchored_wall.report.drainage"), w.tr(f"anchored_wall.drainage.{inputs.drainage}")),
        (w.tr("anchored_wall.report.slope"), _num(inputs.backfill_slope, 1)),
        (w.tr("anchored_wall.report.surcharge"), _num(inputs.surcharge)),
        (w.tr("anchored_wall.report.passive_factor"), _num(inputs.passive_factor)),
        (w.tr("anchored_wall.report.method"), w.tr(f"anchored_wall.method.{result.method}")),
        (w.tr("anchored_wall.result.embedment_theoretical"), _num(result.embedment_theoretical)),
        (w.tr("anchored_wall.result.embedment"), _num(result.embedment)),
        (w.tr("anchored_wall.result.wall_length"), _num(result.wall_length)),
        (w.tr("anchored_wall.result.base_reaction"), _num(result.base_reaction, 1)),
        (w.tr("anchored_wall.result.m_max"), _num(result.m_max, 1)),
        (w.tr("anchored_wall.result.v_max"), _num(result.v_max, 1)),
        *([(w.tr("anchored_wall.result.m_max_member"), _num(result.m_max_member, 1)),
           (w.tr("anchored_wall.result.v_max_member"), _num(result.v_max_member, 1))]
          if result.wall_type == "soldier_pile" else []),
        (w.tr("anchored_wall.result.required_section_modulus"),
         _num(result.required_section_modulus_cm3, 1)),
    ])
    soil = inputs.soil.profile
    w.heading(w.tr("anchored_wall.report.soil"), 3)
    w.table(
        [w.tr("report.soil.top"), w.tr("report.soil.bottom"), w.tr("report.soil.gamma"),
         w.tr("report.soil.phi"), w.tr("report.soil.c"), w.tr("report.soil.su")],
        [[_num(layer.top), _num(layer.bottom), _num(layer.gamma), _num(layer.design.phi_eff, 1),
          _num(layer.design.c_eff, 1), _num(layer.design.su, 1)] for layer in soil.layers])
    if result.envelope is not None:
        env = result.envelope
        w.paragraph(w.tr("anchored_wall.report.envelope", kind=w.tr(f"anchored_wall.envelope.{env.kind}"),
                         p=_num(env.p_max, 1), thrust=_num(env.total_thrust, 1)))
    w.heading(w.tr("anchored_wall.report.levels"), 3)
    w.table(
        [w.tr("anchored_wall.report.level_depth"), w.tr("anchored_wall.report.level_inclination"),
         w.tr("anchored_wall.report.level_spacing"), w.tr("anchored_wall.report.level_load_per_m"),
         w.tr("anchored_wall.result.design_load"), w.tr("anchored_wall.result.free_length"),
         w.tr("anchored_wall.result.bond_length"), w.tr("anchored_wall.result.tendon")],
        [[_num(lv.depth), _num(lv.inclination_deg, 1), _num(lv.spacing), _num(lv.horizontal_load_per_m, 1),
          _num(lv.axial_load_per_anchor, 1),
          _num(lv.design.free_length) if lv.design else DASH,
          _num(lv.design.bond_length) if lv.design else DASH,
          f"{lv.design.tendon.count} × {lv.design.tendon.label}" if lv.design else DASH]
         for lv in result.levels])
    problems = []
    for lv in result.levels:
        label = f"{_num(lv.depth)} m: "
        if lv.design_missing:
            problems.append(label + w.tr("anchored_wall.error.missing_inputs",
                                         missing=", ".join(lv.design_missing)))
        if lv.design_error:
            problems.append(label + lv.design_error)
    if problems:
        w.heading(w.tr("anchored_wall.report.design_problems"), 3)
        w.bullets(problems)
    _checks(w, result.checks)
    assumptions, warnings = list(result.assumptions), list(result.warnings)
    for lv in result.levels:
        if lv.design is not None:
            assumptions += [n for n in lv.design.assumptions if n not in assumptions]
            warnings += [n for n in lv.design.warnings if n not in warnings]
    _evidence(w, assumptions, warnings, result.sources)


def report_writer(w, project, entry_id: str) -> None:
    state = _state(project)
    if entry_id == ANALYSIS_ENTRY and state.analysis and state.analysis.result:
        _analysis_section(w, state.analysis.result, state.analysis.inputs)
    elif entry_id == ANCHOR_ENTRY and state.anchor and state.anchor.result:
        _anchor_section(w, state.anchor.inputs, state.anchor.result)
    else:
        raise GeoTekError(f"Unknown anchored_wall report entry: {entry_id}")
