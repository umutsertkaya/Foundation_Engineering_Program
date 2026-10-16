"""Module 1 workflow: process field tests and run liquefaction for a project.

The GUI calls only these functions, so the whole workflow is testable without Qt.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

import numpy as np

from geotek.core.models.investigations import Borehole
from geotek.core.models.profile import SoilProfile
from geotek.core.models.project import Project
from geotek.engine.insitu.cpt import CPTProcessed, process_cpt
from geotek.engine.insitu.spt import SPTProcessed, process_borehole
from geotek.engine.liquefaction import LiquefactionResult, analyze_cpt, analyze_spt

LAB_MATCH_TOL = 0.5
"""Lab sample within this distance [m] of an SPT depth is used for its FC / PI."""


@dataclass
class LiquefactionSettings:
    method: Literal["youd2001", "bi2014"] = "bi2014"
    amax_g: float = 0.3
    mw: float = 7.5
    target_fs: float = 1.1
    gwt_seismic: float | None = None
    """Overrides the profile's seismic GWT when given."""
    default_fc: float | None = None
    """FC [%] for SPT records without a matching lab sample. None = such records are an error."""
    c_fc: float = 0.0
    ic_cutoff: float = 2.6


@dataclass
class Module1Results:
    spt: dict[str, SPTProcessed] = field(default_factory=dict)
    cpt: dict[str, CPTProcessed] = field(default_factory=dict)
    liquefaction: dict[str, LiquefactionResult] = field(default_factory=dict)
    errors: dict[str, str] = field(default_factory=dict)
    """Per-investigation errors; one failing sounding does not stop the others."""
    profile_hash: str | None = None


def active_profile(project: Project) -> SoilProfile | None:
    return project.soil_profiles[0] if project.soil_profiles else None


def spt_fc_pi(borehole: Borehole, default_fc: float | None):
    """FC and PI per SPT record from the nearest lab sample within ``LAB_MATCH_TOL``.

    Returns (fc, pi, notes). Records without lab FC use ``default_fc``; if that is None a
    ValueError names the depths, because FC has no safe default.
    """
    fc, pi, missing = [], [], []
    for rec in borehole.spt:
        near = [lab for lab in borehole.lab if abs(lab.depth - rec.depth) <= LAB_MATCH_TOL]
        lab = min(near, key=lambda lab: abs(lab.depth - rec.depth)) if near else None
        if lab is not None and lab.FC is not None:
            fc.append(lab.FC)
        else:
            fc.append(np.nan)
            missing.append(rec.depth)
        pi.append(lab.PI if lab is not None and lab.PI is not None else np.nan)
    notes = []
    fc = np.array(fc)
    if missing:
        if default_fc is None:
            raise ValueError(
                f"Borehole {borehole.id}: no lab FC at depth(s) {missing} m; enter a default FC"
            )
        fc[np.isnan(fc)] = default_fc
        notes.append(f"Default FC = {default_fc:g}% used at depth(s) {missing} m")
    return fc, np.array(pi), notes


def process_investigations(project: Project) -> Module1Results:
    """Correct SPT records and normalise CPT soundings."""
    results = Module1Results()
    profile = active_profile(project)
    results.profile_hash = profile.content_hash() if profile else None
    for bh in project.investigations.boreholes:
        if not bh.spt:
            continue
        if profile is None:
            results.errors[bh.id] = "SPT processing needs a soil profile (unit weights)"
            continue
        try:
            results.spt[bh.id] = process_borehole(bh, profile)
        except Exception as exc:  # reported per sounding in the UI
            results.errors[bh.id] = str(exc)
    for cpt in project.investigations.cpts:
        try:
            if profile is not None and cpt.depth[-1] <= profile.bottom:
                results.cpt[cpt.id] = process_cpt(cpt, profile)
            else:
                gwt = cpt.gwt_depth if cpt.gwt_depth is not None else (
                    profile.gwt.depth_insitu if profile else None
                )
                results.cpt[cpt.id] = process_cpt(cpt, gwt_depth=gwt)
        except Exception as exc:
            results.errors[cpt.id] = str(exc)
    return results


def run_liquefaction(
    project: Project, settings: LiquefactionSettings, results: Module1Results | None = None
) -> Module1Results:
    """Process (if needed) and run the selected triggering method for every sounding."""
    results = results or process_investigations(project)
    results.liquefaction.clear()
    profile = active_profile(project)
    boreholes = {b.id: b for b in project.investigations.boreholes}
    common = dict(method=settings.method, amax_g=settings.amax_g, mw=settings.mw,
                  target_fs=settings.target_fs)

    for bh_id, processed in results.spt.items():
        try:
            fc, pi, notes = spt_fc_pi(boreholes[bh_id], settings.default_fc)
            r = analyze_spt(processed, profile, fc=fc, pi=pi, gwt_seismic=settings.gwt_seismic, **common)
            r.warnings = notes + r.warnings
            results.liquefaction[bh_id] = r
        except Exception as exc:
            results.errors[bh_id] = str(exc)

    for cpt_id, processed in results.cpt.items():
        try:
            use_profile = profile if processed.gamma is None else None
            gwt = settings.gwt_seismic
            if use_profile is None and gwt is None:
                gwt = profile.gwt.depth_seismic if profile else None
            results.liquefaction[cpt_id] = analyze_cpt(
                processed, use_profile, gwt_seismic=gwt, c_fc=settings.c_fc,
                ic_cutoff=settings.ic_cutoff, **common,
            )
        except Exception as exc:
            results.errors[cpt_id] = str(exc)
    return results
