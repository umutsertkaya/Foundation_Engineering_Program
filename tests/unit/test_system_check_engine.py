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
