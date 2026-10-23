"""CPT soundings without sleeve friction: qc-only processing, and clean refusals elsewhere."""

from __future__ import annotations

import datetime as dt

import numpy as np
import pytest

from geotek.core.models import CPTSounding, Investigations, Project, ProjectMeta
from geotek.core.warning_codes import parse_warning
from geotek.engine.insitu.cpt import process_cpt
from geotek.services import parameters


def qc_only() -> CPTSounding:
    return CPTSounding(id="Q1", depth=[1.0, 2.0, 3.0, 4.0], qc=[5000.0, 6000.0, 7000.0, 8000.0])


def test_model_accepts_missing_fs_and_roundtrips():
    cpt = qc_only()
    assert cpt.fs is None and set(cpt.arrays()) == {"depth", "qc"}
    assert CPTSounding.model_validate_json(cpt.model_dump_json()).fs is None
    with pytest.raises(ValueError):
        CPTSounding(id="bad", depth=[1.0, 2.0], qc=[1.0, 2.0], fs=[1.0])


def test_processing_needs_a_profile_and_leaves_ic_undefined(two_layer_profile):
    with pytest.raises(ValueError, match="sleeve friction"):
        process_cpt(qc_only())
    out = process_cpt(qc_only(), two_layer_profile)
    assert np.isnan(out.Ic).all() and np.isnan(out.Rf).all() and np.isnan(out.fs).all()
    assert out.sigma_v_eff.shape == (4,) and np.isfinite(out.sigma_v_eff).all()
    assert "insitu.warning.cpt_no_fs" in {parse_warning(w)[0] for w in out.warnings}


def test_qc_based_correlations_still_apply_to_a_layer(two_layer_profile):
    from geotek.core.models import SoilLayer

    project = Project(meta=ProjectMeta(name="Q", date=dt.date(2026, 10, 23)),
                      investigations=Investigations(cpts=[qc_only()]))
    layer = SoilLayer(id="L", top=0.5, bottom=5.0, gamma=18, source_ids=["Q1"])
    points = parameters.layer_points(project, two_layer_profile, layer)
    assert points and all("qc" in p and "Ic" not in p for p in points)
    candidates = parameters.evaluate_candidates(points, "phi_eff", [])
    assert any(c.method_id == "RC1983_phi_CPT" for c in candidates)
