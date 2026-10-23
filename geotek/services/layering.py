"""Run existing field-test processing before proposing editable soil layers."""

from __future__ import annotations

from geotek.core.models.profile import LayeringSettings
from geotek.core.models.project import Project
from geotek.engine.classification.uscs import classify_lab_record
from geotek.engine.layering import Proposal, cpt_layers, spt_log_layers, spt_uscs_n_layers
from geotek.engine.layering.common import format_warning
from geotek.services.module1 import LAB_MATCH_TOL, process_investigations


def propose_layers(
    project: Project, investigation_id: str, settings: LayeringSettings,
) -> Proposal:
    """Process using Module 1, then propose without modifying the project.

    SPT requires an existing unit-weight profile when tests are present, exactly
    as Module 1 does; no bootstrap unit weight is invented. A log without tests
    can be proposed without a profile. Missing logs fall back from spt_log to
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
    sources = {c.id: c for c in project.investigations.cpts}
    boreholes = {b.id: b for b in project.investigations.boreholes}
    if investigation_id not in sources and investigation_id not in boreholes:
        raise KeyError(investigation_id)
    is_cpt = investigation_id in sources
    if is_cpt != (settings.method == "cpt_ic"):
        raise ValueError("Layering method does not match investigation type")
    results = process_investigations(project)
    if investigation_id in results.errors:
        raise ValueError(results.errors[investigation_id])
    if is_cpt:
        # In-situ groundwater depth splits the unit-weight estimate into gamma / gamma_sat:
        # the sounding's own measurement first, else the active profile's; None = no split.
        profile = project.active_profile()
        gwt = sources[investigation_id].gwt_depth
        if gwt is None and profile is not None:
            gwt = profile.gwt.depth_insitu
        return cpt_layers(results.cpt[investigation_id], settings, gwt)
    borehole = boreholes[investigation_id]
    processed = results.spt.get(investigation_id)
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
