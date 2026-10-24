"""Run existing field-test processing before proposing editable soil layers."""

from __future__ import annotations

import numpy as np

from geotek.core.models.investigations import Borehole
from geotek.core.models.profile import LayeringSettings
from geotek.core.models.project import Project
from geotek.engine.classification.uscs import classify_lab_record
from geotek.engine.correlations.physical import unit_weight_robertson_cabal
from geotek.engine.insitu.spt import equipment_corrections
from geotek.engine.layering import (
    Proposal, combined_layers, cpt_layers, spt_log_layers, spt_uscs_n_layers, suggest_unit_weights,
)
from geotek.engine.layering.combined import CPTPoints, Site
from geotek.engine.layering.common import format_warning
from geotek.engine.layering.spt import N60Series
from geotek.engine.layering.unit_weight import apply_suggestions
from geotek.services.module1 import LAB_MATCH_TOL, process_investigations

Supplied = dict[int, tuple[float, float | None]]


def _gwt_insitu(project: Project, own: float | None) -> float | None:
    """The investigation's own groundwater depth, else the active profile's in-situ one."""
    profile = project.active_profile()
    return own if own is not None or profile is None else profile.gwt.depth_insitu


def _n60_series(project: Project, borehole: Borehole, results) -> object | None:
    """SPT N60 of a borehole; without an active profile the stress-free equipment corrections.

    With a profile the Module 1 result is used unchanged (its error is raised as before).
    """
    if not borehole.spt:
        return None
    if project.active_profile() is not None:
        if borehole.id in results.errors:
            raise ValueError(results.errors[borehole.id])
        return results.spt[borehole.id]
    depth, _, refusal, *_, n60, warnings = equipment_corrections(borehole)
    return N60Series(borehole.id, depth, n60, refusal, warnings)


def _borehole_proposal(borehole: Borehole, processed, settings: LayeringSettings) -> Proposal:
    """Layers of one borehole (log or lab USCS + N60) without unit-weight suggestions."""
    if settings.method == "spt_log" and borehole.log:
        return spt_log_layers(borehole, processed, settings)
    if processed is None:
        raise ValueError("SPT layering needs at least one SPT test or a borehole log")
    groups, warnings = [], []
    for depth in processed.depth:
        near = [lab for lab in borehole.lab if abs(lab.depth - depth) <= LAB_MATCH_TOL]
        lab = min(near, key=lambda lab: (abs(lab.depth - depth), lab.depth)) if near else None
        classification = classify_lab_record(lab) if lab is not None else None
        groups.append(classification.symbol if classification else None)
        if classification is not None and (not classification.complete or classification.notes):
            warnings.append(format_warning("layering.warning.uscs_qualified"))
    effective = settings.model_copy(update={"method": "spt_uscs_n"})
    result = spt_uscs_n_layers(processed, groups, effective)
    if settings.method == "spt_log":
        warnings.append(format_warning("layering.warning.log_missing"))
    result.warnings = list(dict.fromkeys(result.warnings + warnings))
    return result


def _n60_points(processed) -> list[tuple[float, float]]:
    """(depth, N60) of finite non-refusal tests."""
    if processed is None:
        return []
    return [(float(d), float(n)) for d, n, r in zip(processed.depth, processed.n60, processed.refusal)
            if np.isfinite(n) and not r]


def _lab_samples(borehole: Borehole):
    return [(lab.depth, lab.gamma, lab.w, lab.Gs) for lab in borehole.lab]


def _apply_supplied(proposal: Proposal, supplied: Supplied) -> None:
    for index, (gamma, gamma_sat) in supplied.items():
        if not 0 <= index < len(proposal.layers):
            raise ValueError(f"Supplied unit weight refers to unknown layer index {index}")
        layer = proposal.layers[index]
        layer.gamma_suggested, layer.gamma_source = gamma, "user"
        layer.gamma_sat_suggested = gamma_sat
        layer.gamma_sat_source = None if gamma_sat is None else "user"
        layer.gamma_range = None


def _check_supplied(count: int, supplied: Supplied) -> None:
    unknown = sorted(i for i in supplied if not 0 <= i < count)
    if unknown:
        raise ValueError(f"Supplied unit weight refers to unknown layer indices: {unknown}")


def propose_layers(
    project: Project, investigation_id: str, settings: LayeringSettings,
    supplied: Supplied | None = None,
) -> Proposal:
    """Process using Module 1, then propose without modifying the project.

    SPT layering needs only N60 (stress-independent equipment corrections), so a borehole
    proposal works without an active profile; with one, Module 1's result is used unchanged.
    A log without tests can be proposed too. Unit weights are suggested per layer by
    ``suggest_unit_weights`` (lab, phase relations, CPT RC2010, SPT Bowles 1996) with the
    source recorded; ``supplied`` ({layer index: (gamma, gamma_sat)}) replaces the suggestion.
    CPT unit weights keep their RC2010 estimate. Missing logs fall back from spt_log to
    spt_uscs_n, returning the effective settings and a warning for reproducibility.
    Lab groups use the nearest sample within Module 1's existing LAB_MATCH_TOL
    (an algorithmic matching distance); equal distances prefer the shallower
    sample, then input order. ASTM D2487 classification is delegated unchanged to
    classify_lab_record; incomplete or qualified classifications are flagged.
    Existing processing messages are represented by a code, not copied as UI text.

    Processing references (delegated, not reimplemented): Youd et al. (2001),
    Table 2, N60 = N * (ER/60) * CB * CS * CR; Liao & Whitman (1986),
    CN = sqrt(Pa/sigma_v_eff), with the existing NCEER cap of 1.7. CPT uses
    Robertson (2009), iterative Qtn/Ic, and Robertson & Cabal (2010) unit weight
    (see cpt_layers for the classification thresholds and gamma equation).
    """
    supplied = supplied or {}
    sources = {c.id: c for c in project.investigations.cpts}
    boreholes = {b.id: b for b in project.investigations.boreholes}
    if investigation_id not in sources and investigation_id not in boreholes:
        raise KeyError(investigation_id)
    is_cpt = investigation_id in sources
    if is_cpt != (settings.method == "cpt_ic"):
        raise ValueError("Layering method does not match investigation type")
    results = process_investigations(project)
    if is_cpt:
        if investigation_id in results.errors:
            raise ValueError(results.errors[investigation_id])
        # In-situ groundwater depth splits the unit-weight estimate into gamma / gamma_sat:
        # the sounding's own measurement first, else the active profile's; None = no split.
        gwt = _gwt_insitu(project, sources[investigation_id].gwt_depth)
        result = cpt_layers(results.cpt[investigation_id], settings, gwt)
        for layer in result.layers:
            layer.gamma_source = None if layer.gamma_suggested is None else "cpt_rc2010"
            layer.gamma_sat_source = None if layer.gamma_sat_suggested is None else "cpt_rc2010"
        _check_supplied(len(result.layers), supplied)
        _apply_supplied(result, supplied)
        return result
    borehole = boreholes[investigation_id]
    processed = _n60_series(project, borehole, results)
    result = _borehole_proposal(borehole, processed, settings)
    _check_supplied(len(result.layers), supplied)
    suggestions, warnings = suggest_unit_weights(
        result.layers, gwt=_gwt_insitu(project, borehole.gwt_depth), lab=_lab_samples(borehole),
        cpt_points=[], spt_points=_n60_points(processed), supplied=supplied)
    apply_suggestions(result.layers, suggestions)
    if all(layer.gamma_suggested is not None for layer in result.layers):
        # Every layer has a (suggested or supplied) unit weight: the generic notice no longer applies.
        result.warnings = [w for w in result.warnings
                           if w != format_warning("layering.warning.gamma_unavailable")]
    result.warnings = list(dict.fromkeys(result.warnings + warnings))
    return result


def propose_combined_layers(
    project: Project, cpt_id: str, borehole_ids: list[str], settings: LayeringSettings,
    supplied: Supplied | None = None,
) -> Proposal:
    """Propose common layers from one CPT sounding and several boreholes.

    The CPT and each borehole are layered with their own rules (``cpt_ic``; ``spt_log`` when a
    log exists, else ``spt_uscs_n``) and merged by ``combined_layers`` (elevation alignment,
    boundary merging, USCS/Ic conflict flags, unit weights from all sources). The groundwater
    depth is the sounding's own, else the active profile's. Nothing is approved.
    """
    if settings.method != "combined":
        raise ValueError("Layering method does not match investigation type")
    cpts = {c.id: c for c in project.investigations.cpts}
    boreholes = {b.id: b for b in project.investigations.boreholes}
    if cpt_id not in cpts:
        raise KeyError(cpt_id)
    for identifier in borehole_ids:
        if identifier not in boreholes:
            raise KeyError(identifier)
    if not borehole_ids or len(set(borehole_ids)) != len(borehole_ids):
        raise ValueError("Combined layering needs distinct borehole ids")
    results = process_investigations(project)
    if cpt_id in results.errors:
        raise ValueError(results.errors[cpt_id])
    sounding, processed = cpts[cpt_id], results.cpt[cpt_id]
    gwt = _gwt_insitu(project, sounding.gwt_depth)
    cpt_proposal = cpt_layers(processed, settings.model_copy(update={"method": "cpt_ic"}), gwt)
    proposals, series, labs, sites = {}, {}, {}, {}
    for identifier in borehole_ids:
        borehole = boreholes[identifier]
        series[identifier] = _n60_series(project, borehole, results)
        method = "spt_log" if borehole.log else "spt_uscs_n"
        proposals[identifier] = _borehole_proposal(
            borehole, series[identifier], settings.model_copy(update={"method": method}))
        labs[identifier] = borehole.lab
        sites[identifier] = Site(identifier, borehole.x, borehole.y, borehole.elevation)
    qt, fs = np.asarray(processed.qt, dtype=float), np.asarray(processed.fs, dtype=float)
    good = np.isfinite(qt) & (qt > 0) & np.isfinite(fs) & (fs >= 0)
    gamma = np.full(len(qt), np.nan)
    gamma[good] = unit_weight_robertson_cabal(qt[good], fs[good])
    points = CPTPoints(np.asarray(processed.depth, dtype=float),
                       np.asarray(processed.Ic, dtype=float), gamma)
    result = combined_layers(
        cpt_proposal, proposals, points, labs,
        cpt_site=Site(cpt_id, sounding.x, sounding.y, sounding.elevation), sites=sites,
        spt_points={i: _n60_points(series[i]) for i in borehole_ids}, settings=settings,
        gwt=gwt, supplied=supplied or {})
    _check_supplied(len(result.layers), supplied or {})
    return result
