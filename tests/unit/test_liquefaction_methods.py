"""Equation-level checks against hand calculations."""

import numpy as np
import pytest

from geotek.engine.liquefaction import boulanger_idriss2014 as bi
from geotek.engine.liquefaction import youd2001 as youd
from geotek.engine.liquefaction.common import (
    ABOVE_GWT,
    BEYOND_DEPTH,
    CLAY_LIKE,
    DENSE,
    EXCLUDED,
    INVALID,
    LIQUEFIABLE,
    MARGINAL,
    SAFE,
    assign_status,
    cyclic_stress_ratio,
    liquefaction_potential_index,
    lpi_category,
)

# --- Youd et al. 2001 --------------------------------------------------------------------


def test_youd_rd():
    rd = youd.stress_reduction([5.0, 15.0, 25.0, 31.0])
    assert rd[:3] == pytest.approx([0.96175, 0.7735, 0.544])
    assert np.isnan(rd[3])


def test_youd_msf():
    assert float(youd.magnitude_scaling(7.5)) == pytest.approx(1.0, abs=1e-3)
    assert float(youd.magnitude_scaling(6.5)) == pytest.approx(10**2.24 / 6.5**2.56)
    assert float(youd.magnitude_scaling(6.5, variant="andrus_stokoe")) == pytest.approx((6.5 / 7.5) ** -3.3)


def test_youd_ksigma():
    ks = youd.overburden_factor([50.0, 200.0], f=0.7)
    assert ks[0] == 1.0
    assert ks[1] == pytest.approx((200 / 101.325) ** -0.3)
    with pytest.raises(ValueError):
        youd.overburden_factor([100.0], f=0.9)


def test_youd_fines_correction():
    ncs = youd.fines_correction_spt([10, 10, 10], [3, 15, 40])
    alpha = np.exp(1.76 - 190 / 15**2)
    beta = 0.99 + 15**1.5 / 1000
    assert ncs == pytest.approx([10.0, alpha + beta * 10, 5 + 12.0])


def test_youd_crr_spt():
    assert float(youd.crr75_spt(10)) == pytest.approx(0.11312, rel=1e-3)
    assert np.isnan(youd.crr75_spt(30))
    ncs, crr, dense = youd.spt_resistance([40], [35], [0], [100])
    assert dense[0] and np.isnan(crr[0])


def test_youd_crr_cpt_and_kc():
    assert youd.crr75_cpt([40, 100]) == pytest.approx([0.08332, 0.173])
    assert np.isnan(youd.crr75_cpt(160))
    assert youd.kc_factor([1.5, 2.0]) == pytest.approx([1.0, 1.3], abs=1e-3)
    # Youd et al. (2001), Eq. (19b), at Ic = 2: Kc = 1.3 regardless of F.
    assert youd.kc_factor([2.0], F=[0.3]) == pytest.approx([1.3], rel=1e-12)


def test_youd_cpt_resistance_clean_sand():
    # Clean sand: n = 0.5, qc1N = (Pa/sigma')^0.5 qc/Pa
    r = youd.cpt_resistance(np.array([10000.0]), np.array([20.0]), np.array([100.0]), np.array([80.0]))
    assert r["ic"][0] < 1.64 and r["kc"][0] == 1.0
    assert r["resistance"][0] == pytest.approx(np.sqrt(101.325 / 80) * 10000 / 101.325)
    assert not r["clay_like"][0]


# --- Boulanger & Idriss 2014 -------------------------------------------------------------


def test_bi_rd():
    rd = bi.stress_reduction([0.0, 5.0, 10.0, 20.0, 35.0], 7.5)
    assert rd[0] == pytest.approx(1.0, abs=0.01)
    assert np.all(np.diff(rd[:4]) < 0)
    assert np.isnan(rd[4])


def test_bi_msf():
    assert float(bi.magnitude_scaling(7.5, 15, "SPT")) == pytest.approx(1.0, abs=2e-3)
    assert float(bi.msf_max(40, "SPT")) == 2.2  # capped
    assert float(bi.magnitude_scaling(6.0, 15, "SPT")) > 1.0


def test_bi_ksigma():
    assert float(bi.overburden_factor(101.325, 15, "SPT")) == pytest.approx(1.0)
    cs = 1 / (18.9 - 2.55 * np.sqrt(15))
    assert float(bi.overburden_factor(200.0, 15, "SPT")) == pytest.approx(1 - cs * np.log(200 / 101.325))
    assert float(bi.overburden_factor(20.0, 15, "SPT")) == pytest.approx(1.1)
    assert float(bi.c_sigma(60, "SPT")) == pytest.approx(0.3)


def test_bi_crr():
    assert float(bi.crr75_spt(15)) == pytest.approx(0.1561, rel=1e-3)
    assert float(bi.crr75_cpt(100)) == pytest.approx(0.13729, rel=1e-3)


def test_bi_fines_terms():
    assert float(bi.delta_n_fines(0)) == pytest.approx(0.0, abs=1e-6)
    assert float(bi.delta_n_fines(35)) == pytest.approx(5.507, rel=1e-3)
    assert float(bi.delta_qc1n_fines(100, 0)) < float(bi.delta_qc1n_fines(100, 35))


def test_bi_spt_iteration_is_a_fixed_point():
    n60, se, fc = np.array([12.0, 25.0]), np.array([60.0, 180.0]), np.array([10.0, 30.0])
    ncs, crr, dense, conv = bi.spt_resistance(n60, None, fc, se)
    assert conv.all() and not dense.any()
    m = 0.784 - 0.0768 * np.sqrt(ncs)
    cn = np.minimum((101.325 / se) ** m, 1.7)
    assert ncs == pytest.approx(cn * n60 + bi.delta_n_fines(fc), abs=1e-3)


def test_bi_cpt_iteration_is_a_fixed_point():
    qt, se, fc = np.array([8000.0]), np.array([90.0]), np.array([15.0])
    r = bi.cpt_resistance(qt, se, fc, np.array([1.9]))
    q = r["resistance"]
    m = 1.338 - 0.249 * np.clip(q, 21, 254) ** 0.264
    qc1n = np.minimum((101.325 / se) ** m, 1.7) * qt / 101.325
    assert r["converged"].all()
    assert q == pytest.approx(qc1n + bi.delta_qc1n_fines(qc1n, fc), abs=1e-3)


# --- Common ------------------------------------------------------------------------------


def test_csr():
    assert float(cyclic_stress_ratio(0.4, 91.0, 81.19, 0.96175)) == pytest.approx(0.65 * 0.4 * 91 / 81.19 * 0.96175)


def test_status_precedence():
    z = np.array([1.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 40.0])
    fs = np.array([0.5, 0.8, 1.05, 2.0, np.nan, 0.5, 0.5, np.nan, 0.5])
    clay = np.array([0, 0, 0, 0, 0, 1, 0, 0, 0], dtype=bool)
    exclude = np.array([0, 0, 0, 0, 0, 0, 1, 0, 0], dtype=bool)
    dense = np.array([0, 0, 0, 0, 0, 0, 0, 1, 0], dtype=bool)
    status, fs_out = assign_status(
        depth=z, gwt_depth=2.0, sigma_v_eff=np.full(9, 50.0), fs=fs, target_fs=1.1,
        max_depth=30.0, clay_like=clay, dense=dense, exclude=exclude,
    )
    assert status.tolist() == [
        ABOVE_GWT, LIQUEFIABLE, MARGINAL, SAFE, INVALID, CLAY_LIKE, EXCLUDED, DENSE, BEYOND_DEPTH
    ]
    assert np.isnan(fs_out[[0, 4, 5, 6, 7, 8]]).all()
    assert fs_out[1] == 0.8


def test_lpi():
    # intervals 1-3, 3-5, 5-7 m; only the first has FS < 1: (1 - 0.5) * integral(10 - 0.5z) = 0.5 * 18
    assert liquefaction_potential_index([2.0, 4.0, 6.0], [0.5, np.nan, 2.0]) == pytest.approx(9.0)
    assert liquefaction_potential_index([25.0, 26.0], [0.1, 0.1]) == 0.0  # below 20 m
    assert [lpi_category(v) for v in (0, 3, 10, 20)] == ["very_low", "low", "high", "very_high"]
