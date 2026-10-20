"""Regression tests for engine defects found in the 2026-10-20 system check."""

import numpy as np
import pytest

from geotek.config.codes import FactorOverride, resolve_code
from geotek.core.errors import GeoTekError
from geotek.core.models import CPTSounding
from geotek.core.models.profile import SoilProfile
from geotek.core.warning_codes import parse_warning
from geotek.engine.bearing import bearing_capacity
from geotek.engine.insitu.cpt import process_cpt
from geotek.engine.liquefaction import analyze_cpt
from geotek.engine.liquefaction.analysis import _per_point


def _profile():
    return SoilProfile(id="p", gwt={"depth_insitu": 1.0},
                       layers=[{"id": "L1", "top": 0, "bottom": 20, "gamma": 18, "gamma_sat": 19}])


@pytest.mark.parametrize("method", ["bi2014", "youd2001"])
def test_cpt_point_with_zero_sleeve_friction_is_invalid_not_clay_like(method):
    s = CPTSounding(id="c", depth=[3.0, 3.1, 3.2], qc=[3000.0] * 3, fs=[15.0, 0.0, 15.0])
    p = process_cpt(s, _profile())
    assert np.isnan(p.Ic[1]) and p.zone[1] == 0
    assert ("insitu.warning.cpt_points_skipped", {"count": 1}) in [parse_warning(w) for w in p.warnings]
    r = analyze_cpt(p, _profile(), method=method, amax_g=0.3, mw=7.5)
    assert list(r.status) == ["liquefiable", "invalid", "liquefiable"]


def test_cpt_without_profile_zero_qc_does_not_void_deeper_stresses():
    s = CPTSounding(id="c", gwt_depth=2.0, depth=[0.5, 1.0, 1.5, 2.0], qc=[3000, 0, 3000, 3000],
                    fs=[30, 30, 30, 30])
    p = process_cpt(s)
    assert np.isfinite(p.sigma_v).all()
    assert p.gamma[1] == pytest.approx(p.gamma[0])
    codes = dict(parse_warning(w) for w in p.warnings)
    assert codes["insitu.warning.cpt_gamma_nearest"] == {"count": 1, "depths": "1"}
    # The q_t <= 0 point itself stays invalid: γ is borrowed only for the stress integration.
    assert np.isnan(p.Qtn[1]) and np.isnan(p.Ic[1])
    assert np.isfinite(p.Ic[[0, 2, 3]]).all()


def test_cpt_nearest_unit_weight_respects_the_lower_bound():
    s = CPTSounding(id="c", gwt_depth=5.0, depth=[1.0, 1.5], qc=[100.0, 0.0], fs=[0.1, 0.1])
    p = process_cpt(s)
    assert p.gamma.tolist() == [12.0, 12.0]
    assert np.isfinite(p.Ic[2:]).all()


def test_cpt_sounding_rejects_non_finite_values():
    with pytest.raises(ValueError, match="finite"):
        CPTSounding(id="c", depth=[1.0, float("nan")], qc=[1000, 1000], fs=[10, 10])
    with pytest.raises(ValueError, match="finite"):
        CPTSounding(id="c", depth=[1.0, 2.0], qc=[1000, 1000], fs=[10, 10], u2=[0.0, float("inf")])


def test_user_fines_content_must_be_finite():
    with pytest.raises(ValueError, match="finite"):
        _per_point([10.0, float("nan")], 2, "FC")


def test_bi2014_user_fc_gives_no_fs_where_ic_is_undefined():
    s = CPTSounding(id="c", depth=[7.9, 8.0, 8.1], qc=[3000.0, 140.0, 3000.0], fs=[15.0, 1.0, 15.0])
    p = process_cpt(s, _profile())
    r = analyze_cpt(p, _profile(), method="bi2014", amax_g=0.3, mw=7.5, fc=10.0)
    assert r.status[1] == "invalid" and np.isnan(r.fs[1])


def test_vesic_undrained_refuses_horizontal_load_beyond_adhesion():
    with pytest.raises(GeoTekError, match="Horizontal load"):
        bearing_capacity(method="vesic", B=2.0, D=0.5, phi=0, c=20, gamma=18, q=9, V=200, H=150)
    with pytest.raises(GeoTekError, match="Horizontal load"):
        bearing_capacity(method="vesic", B=2.0, D=0.5, phi=0, c=0, gamma=18, q=9, V=200, H=10)
    ok = bearing_capacity(method="vesic", B=2.0, D=0.5, phi=0, c=20, gamma=18, q=9, V=200, H=20)
    assert 0 < ok.factors["ic"] < 1 and ok.q_ult > 0


def test_partial_factor_override_with_short_path_is_a_clean_error():
    with pytest.raises(GeoTekError, match="no factor"):
        resolve_code("ec7", {"EQU": FactorOverride(value=1.2)})


def test_material_gamma_override_is_reported_as_not_applied():
    """EC7 ``material.gamma`` is accepted by the code table but unused by the engine (T12 card)."""
    from geotek.services.structures import check_structure
    from tests.api.job_helpers import wall_project

    project = wall_project(geometry=True, advanced=True, code="ec7", sds=None)
    wall = project.structure("wall")
    wall.approach = "DA1"
    baseline = check_structure(project, "wall")
    wall.settings.factor_overrides["DA1-C2.material.gamma"] = FactorOverride(value=1.2)
    result = check_structure(project, "wall")
    assert 'wall.warning.override_not_applied: path="DA1-C2.material.gamma"' in result.warnings
    assert [c.value for a in result.analyses.values() for c in a.checks.values()] == \
        [c.value for a in baseline.analyses.values() for c in a.checks.values()]


def test_rc2010_unit_weight_lower_bound_hand_calc():
    """Robertson & Cabal (2010) floor of 12 kN/m3 (project assumption approved 2026-10-20).

    Hand calc, Pa = 101.325 kPa, gamma_w = 9.81:
    qt=10000, fs=50: Rf=0.5 %, 0.27*log(0.5) + 0.36*log(98.69) + 1.236 = 1.8727 -> 18.37 (unchanged)
    qt=100, fs=0.1: Rf=0.1 %, -0.27 - 0.00206 + 1.236 = 0.96394 -> 9.456 -> floored to 12
    qt=1, fs=1e-4: Rf floored at 0.01 %, -0.54 - 0.72206 + 1.236 = -0.02606 -> negative -> 12
    """
    from geotek.engine.correlations.physical import (
        GAMMA_MIN_RC2010, rc2010_below_floor, unit_weight_robertson_cabal)
    from geotek.engine.correlations.registry import evaluate

    assert GAMMA_MIN_RC2010 == 12.0
    assert unit_weight_robertson_cabal(10000.0, 50.0) == pytest.approx(18.37, abs=0.01)
    raw = (0.27 * np.log10(0.1) + 0.36 * np.log10(100 / 101.325) + 1.236) * 9.81
    assert raw == pytest.approx(9.456, abs=0.001)
    values = unit_weight_robertson_cabal(np.array([10000.0, 100.0, 1.0]), np.array([50.0, 0.1, 1e-4]))
    assert values[1:].tolist() == [12.0, 12.0]
    assert rc2010_below_floor(np.array([10000.0, 100.0, 1.0]), np.array([50.0, 0.1, 1e-4])).tolist() == \
        [False, True, True]
    assert np.isnan(unit_weight_robertson_cabal(0.0, 10.0))  # undefined stays undefined
    candidate = evaluate("RC2010_gamma_CPT", {"qt": 100.0, "fs": 0.1})
    assert candidate.value == 12.0 and not candidate.validity_ok
    assert candidate.warnings == ["correlation.warning.gamma_floor: gamma_min=12.0"]


def test_cpt_without_profile_reports_the_unit_weight_floor():
    s = CPTSounding(id="c", gwt_depth=5.0, depth=[1.0, 2.0], qc=[100.0, 5000.0], fs=[0.1, 50.0])
    p = process_cpt(s)
    assert p.gamma[0] == 12.0
    codes = dict(parse_warning(w) for w in p.warnings)
    assert codes["insitu.warning.cpt_gamma_floor"] == {"count": 1, "gamma_min": 12.0}


def test_cpt_readings_above_predrill_depth_are_excluded():
    s = CPTSounding(id="c", gwt_depth=1.0, predrill_depth=1.5, depth=[0.5, 1.0, 1.5, 2.0],
                    qc=[0.0, 0.0, 3000.0, 3000.0], fs=[0.0, 0.0, 30.0, 30.0])
    p = process_cpt(s, _profile())
    assert p.depth.tolist() == [1.5, 2.0] and np.isfinite(p.Ic).all()
    codes = dict(parse_warning(w) for w in p.warnings)
    assert codes["insitu.warning.cpt_predrill_excluded"] == {"count": 2, "predrill": 1.5}
    assert "insitu.warning.cpt_points_skipped" not in codes
    with pytest.raises(ValueError, match="predrill"):
        process_cpt(s.model_copy(update={"predrill_depth": 3.0}), _profile())
