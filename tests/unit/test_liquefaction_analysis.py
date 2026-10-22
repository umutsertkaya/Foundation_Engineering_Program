"""End-to-end liquefaction analyses on small synthetic profiles."""

import numpy as np
import pytest

from geotek.core.models import Borehole, CPTSounding, SPTRecord
from geotek.engine.insitu.cpt import process_cpt
from geotek.engine.insitu.spt import process_borehole
from geotek.engine.liquefaction import analyze_cpt, analyze_spt
from geotek.engine.liquefaction.common import ABOVE_GWT, CLAY_LIKE, DENSE, LIQUEFIABLE, SAFE


@pytest.fixture
def spt_processed(two_layer_profile):
    bh = Borehole(id="SK1", spt=[
        SPTRecord(depth=1.5, n_field=6),
        SPTRecord(depth=5.0, n_field=8),
        SPTRecord(depth=7.0, n_field=12),
        SPTRecord(depth=9.0, n_field=45),
    ])
    return process_borehole(bh, two_layer_profile)


def test_youd_spt(spt_processed, two_layer_profile):
    r = analyze_spt(spt_processed, two_layer_profile, method="youd2001", amax_g=0.4, mw=7.5,
                    fc=[5, 5, 20, 5], pi=[np.nan, np.nan, 12, np.nan])
    # Seismic GWT is 4 m: 1.5 m is above it; PI 12 at 7 m is clay-like; N = 45 is dense
    assert r.status.tolist() == [ABOVE_GWT, LIQUEFIABLE, CLAY_LIKE, DENSE]
    sv, se = 91.0, 91.0 - 9.81
    assert r.csr[1] == pytest.approx(0.65 * 0.4 * sv / se * (1 - 0.00765 * 5))
    assert r.fs[1] == pytest.approx(r.crr[1] / r.csr[1])
    assert r.lpi > 0
    assert r.summary()["LPI_category"] in ("low", "high", "very_high")


def test_bi_spt(spt_processed, two_layer_profile):
    r = analyze_spt(spt_processed, two_layer_profile, method="bi2014", amax_g=0.4, mw=7.5, fc=5)
    assert r.status[1] == LIQUEFIABLE
    assert r.status[3] == SAFE  # B&I has no hard density cut-off; very high CRR instead
    assert {"FS", "N1_60cs", "CRR7.5", "MSF", "Ksigma", "status"} <= set(r.to_dataframe().columns)


def test_lower_shaking_is_safer(spt_processed, two_layer_profile):
    strong = analyze_spt(spt_processed, two_layer_profile, amax_g=0.4, mw=7.5, fc=5)
    weak = analyze_spt(spt_processed, two_layer_profile, amax_g=0.1, mw=6.0, fc=5)
    assert weak.fs[1] > strong.fs[1]
    assert weak.lpi <= strong.lpi


def test_gwt_override(spt_processed, two_layer_profile):
    r = analyze_spt(spt_processed, two_layer_profile, amax_g=0.3, mw=7.0, fc=5, gwt_seismic=6.0)
    assert r.gwt_depth == 6.0 and r.status[1] == ABOVE_GWT


def test_fc_required_and_input_checks(spt_processed, two_layer_profile):
    with pytest.raises(TypeError):
        analyze_spt(spt_processed, two_layer_profile, amax_g=0.3, mw=7.0)
    with pytest.raises(ValueError):
        analyze_spt(spt_processed, two_layer_profile, amax_g=0.3, mw=7.0, fc=5, method="xyz")
    with pytest.raises(ValueError):
        analyze_spt(spt_processed, two_layer_profile, amax_g=0.3, mw=7.0, fc=5, target_fs=0.9)


def _cpt():
    depth = np.arange(1.0, 10.01, 0.5)
    qc = np.where(depth < 6, 3000.0, 800.0)      # loose sand over soft clay
    fs = np.where(depth < 6, 20.0, 35.0)
    u2 = np.where(depth < 6, 0.0, 300.0)
    return CPTSounding(id="CPT1", gwt_depth=2.0, depth=depth.tolist(), qc=qc.tolist(),
                       fs=fs.tolist(), u2=u2.tolist())


@pytest.mark.parametrize("method", ["youd2001", "bi2014"])
def test_cpt_with_profile(method, two_layer_profile):
    p = process_cpt(_cpt(), two_layer_profile)
    r = analyze_cpt(p, two_layer_profile, method=method, amax_g=0.35, mw=7.0)
    sand = (r.depth >= 4.5) & (r.depth < 6)
    clay = r.depth >= 6.5
    assert np.all(r.status[r.depth < 4] == ABOVE_GWT)
    assert np.all(r.status[sand] == LIQUEFIABLE)
    assert np.all(r.status[clay] == CLAY_LIKE)
    assert np.all(np.isnan(r.fs[clay]))
    assert r.summary()["liquefiable_depths"][0] == pytest.approx(4.0)


def test_cpt_without_profile_needs_gwt():
    p = process_cpt(_cpt())
    with pytest.raises(ValueError):
        analyze_cpt(p, amax_g=0.3, mw=7.0)
    r = analyze_cpt(p, amax_g=0.3, mw=7.0, gwt_seismic=2.0)
    assert r.sigma_v == pytest.approx(p.sigma_v)
    assert any(w.startswith("liquefaction.warning.fc_from_ic: c_fc=") for w in r.warnings)


def test_bi_cpt_user_fc_raises_resistance(two_layer_profile):
    p = process_cpt(_cpt(), two_layer_profile)
    clean = analyze_cpt(p, two_layer_profile, amax_g=0.3, mw=7.0, fc=0)
    silty = analyze_cpt(p, two_layer_profile, amax_g=0.3, mw=7.0, fc=30)
    assert np.all(silty.resistance >= clean.resistance)


def test_exclude_mask(two_layer_profile):
    p = process_cpt(_cpt(), two_layer_profile)
    mask = np.zeros(p.depth.size, dtype=bool)
    mask[p.depth == 5.0] = True
    r = analyze_cpt(p, two_layer_profile, amax_g=0.35, mw=7.0, exclude=mask)
    assert r.status[p.depth == 5.0][0] == "excluded_by_user"


@pytest.mark.parametrize("mw,variant,expected", [
    (8.0, "andrus_stokoe", True), (7.5, "andrus_stokoe", False),
    (8.0, "idriss", False), (7.0, "andrus_stokoe", False),
])
def test_msf_andrus_stokoe_high_magnitude_warning(spt_processed, two_layer_profile, mw, variant, expected):
    from geotek.engine.liquefaction.analysis import MSF_AS_HIGH_MW_WARNING

    r = analyze_spt(spt_processed, two_layer_profile, method="youd2001", amax_g=0.4, mw=mw,
                    fc=[5, 5, 20, 5], msf_variant=variant)
    assert (MSF_AS_HIGH_MW_WARNING in r.warnings) is expected
    if expected:
        # Andrus-Stokoe is lower (more conservative) than Idriss above M 7.5
        idriss = analyze_spt(spt_processed, two_layer_profile, method="youd2001", amax_g=0.4, mw=mw,
                             fc=[5, 5, 20, 5], msf_variant="idriss")
        assert np.all(r.msf <= idriss.msf)


def _fake_result(status, fs):
    from geotek.engine.liquefaction.common import LiquefactionResult
    n = len(status)
    z = np.arange(1, n + 1, dtype=float)
    blank = np.full(n, np.nan)
    return LiquefactionResult(
        method="bi2014", test_type="SPT", source_id="X", amax_g=0.3, mw=7.0, gwt_depth=0.0, target_fs=1.1,
        depth=z, sigma_v=blank, sigma_v_eff=blank, rd=blank, csr=blank, resistance=blank, fc=blank,
        crr75=blank, msf=blank, ksigma=blank, crr=blank, fs=np.array(fs, dtype=float),
        status=np.array(status, dtype=object))


def test_summary_lpi_none_when_every_point_invalid_and_flag_when_partial():
    allbad = _fake_result(["invalid"] * 3, [np.nan] * 3).summary()
    assert allbad["LPI"] is None and allbad["LPI_category"] is None
    partial = _fake_result(["liquefiable", "invalid", "safe"], [0.5, np.nan, 2.0]).summary()
    assert partial["LPI"] > 0 and partial["LPI_incomplete"] is True
    assert _fake_result(["liquefiable", "safe"], [0.5, 2.0]).summary()["LPI_incomplete"] is False


@pytest.mark.parametrize("method", ["youd2001", "bi2014"])
def test_cpt_points_without_converged_normalisation_are_invalid(method, two_layer_profile):
    import dataclasses
    p = process_cpt(_cpt(), two_layer_profile)
    base = analyze_cpt(p, two_layer_profile, method=method, amax_g=0.35, mw=7.0)
    idx = int(np.flatnonzero(base.status == LIQUEFIABLE)[0])
    flags = p.converged.copy()
    flags[idx] = False
    r = analyze_cpt(dataclasses.replace(p, converged=flags), two_layer_profile, method=method, amax_g=0.35, mw=7.0)
    assert r.status[idx] == "invalid" and np.isnan(r.fs[idx])
    assert r.summary()["LPI_incomplete"] is True


def test_liquefaction_dto_exposes_lpi_category_and_incomplete_flag():
    from types import SimpleNamespace

    from geotek.api.calculation_results import liquefaction_result
    item = _fake_result(["liquefiable", "invalid", "safe"], [0.5, np.nan, 2.0])
    out = liquefaction_result(SimpleNamespace(liquefaction={"S": item}, errors={}))
    s = out.per_sounding["S"]
    # GWT 0, depths 1,2,3 -> cell 0-1.5 (surface extension, 0..2.5): first cell [0, 1.5], FS 0.5:
    # F = 0.5, integral of (10 - 0.5 z) over 0..1.5 = 15 - 0.25*2.25 = 14.4375 -> LPI = 7.21875
    assert s.LPI == pytest.approx(7.21875)
    assert s.LPI_category == "high" and s.LPI_incomplete is True
