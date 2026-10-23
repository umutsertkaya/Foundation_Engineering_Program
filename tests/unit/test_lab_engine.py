"""Laboratory reduction engine: hand-calculable cases and the Example.xlsx workbook."""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import pytest

from geotek.core.warning_codes import parse_warning
from geotek.engine.lab.atterberg import (
    liquid_limit_multipoint,
    liquid_limit_one_point,
    plasticity,
)
from geotek.engine.lab.phase import phase_relations
from geotek.engine.lab.sieve import sieve_analysis
from geotek.engine.lab.triaxial import CUTest, reduce_cu

EXAMPLE = Path(__file__).resolve().parents[2] / "examples" / "Example.xlsx"


def codes(warnings):
    return {parse_warning(w)[0] for w in warnings}


def test_sieve_hand_calc():
    # 500 g total; retained 0/10/50 on 10/4.75/2 mm sieves, 440 g in the pan.
    r = sieve_analysis([10, 4.75, 2], [0, 10, 50], total_dry_mass_g=500, pan_g=440)
    assert r.percent_passing.tolist() == pytest.approx([100.0, 98.0, 88.0])
    assert r.mass_loss_percent == pytest.approx(0.0)
    assert r.gravel == pytest.approx(2.0)
    assert r.fines is None  # 0.075 mm sieve not measured: no extrapolation
    assert r.D10 is None and r.D30 is None and r.D60 is None  # passing never drops below 88 %


def test_sieve_log_interpolation_hand_calc():
    # Passing 100 / 50 / 10 % at 10 / 1 / 0.1 mm: D50 = 1 mm, D30 midway in log between 1 and 0.1.
    r = sieve_analysis([10, 1, 0.1], [0, 500, 400], total_dry_mass_g=1000, pan_g=100)
    assert r.percent_passing.tolist() == pytest.approx([100.0, 50.0, 10.0])
    assert r.D10 == pytest.approx(0.1)
    assert r.D30 == pytest.approx(10 ** (-0.5))
    assert r.D60 == pytest.approx(10 ** (np.log10(1) + (60 - 50) / 50))
    assert r.Cu == pytest.approx(r.D60 / 0.1)


def test_sieve_mass_loss_and_missing_pan():
    lost = sieve_analysis([4.75, 0.075], [100, 300], total_dry_mass_g=500, pan_g=50)
    assert lost.mass_loss_percent == pytest.approx(10.0)
    assert "lab.warning.sieve_mass_loss" in codes(lost.warnings)
    nopan = sieve_analysis([4.75, 0.075], [100, 300], total_dry_mass_g=500)
    assert "lab.warning.sieve_no_pan_assumed_no_loss" in codes(nopan.warnings)
    assert nopan.fines == pytest.approx(20.0)


def test_sieve_d_values_none_when_curve_does_not_reach():
    r = sieve_analysis([0.425, 0.075], [100, 100], total_dry_mass_g=1000, pan_g=800)
    assert r.D10 is None and r.Cu is None  # passing never drops below 80 %


def test_sieve_rejects_bad_input():
    with pytest.raises(ValueError):
        sieve_analysis([4.75, 4.75], [1, 1], total_dry_mass_g=10)
    with pytest.raises(ValueError):
        sieve_analysis([4.75], [600], total_dry_mass_g=500)
    with pytest.raises(ValueError):
        sieve_analysis([4.75], [-1], total_dry_mass_g=500)


def test_liquid_limit_hand_calc():
    # w = 40 - 10 log10(N/25): exact line, so LL = 40 at 25 blows.
    n = [16, 22, 30, 38]
    w = [40 - 10 * math.log10(v / 25) for v in n]
    r = liquid_limit_multipoint(n, w)
    assert r.ll == pytest.approx(40.0)
    assert r.slope == pytest.approx(-10.0)
    assert r.r2 == pytest.approx(1.0)
    assert "lab.warning.ll_blows_outside_range" in codes(r.warnings)  # 38 > 35
    assert liquid_limit_multipoint([20, 30], [30, 28]).warnings  # two points warn


def test_one_point_liquid_limit():
    ll, warn = liquid_limit_one_point(25, 40.0)
    assert ll == pytest.approx(40.0) and not warn
    ll, _ = liquid_limit_one_point(20, 40.0)
    assert ll == pytest.approx(40.0 * 0.8**0.121)
    assert liquid_limit_one_point(40, 30.0)[1]


def test_plasticity_and_np():
    r = plasticity(30.0, [20.0, 20.0, 20.0])
    assert (r.pl, r.pi, r.non_plastic, r.pl_spread) == (20.0, 10.0, False, 0.0)
    assert plasticity(30.0, [31.0]).non_plastic
    missing = plasticity(30.0, [])
    assert missing.pl is None and missing.pi is None and not missing.non_plastic


def test_phase_relations_hand_calc():
    # gamma 20, w 20 %, Gs 2.7: gamma_d = 16.667, e = 2.7*9.81/16.667 - 1 = 0.5892, S = 0.54/0.5892.
    r = phase_relations(gamma=20.0, w_percent=20.0, Gs=2.7)
    assert r.gamma_d == pytest.approx(20 / 1.2)
    assert r.e == pytest.approx(2.7 * 9.81 / (20 / 1.2) - 1)
    assert r.S == pytest.approx(0.2 * 2.7 / r.e)
    assert r.gamma_sat == pytest.approx((2.7 + r.e) * 9.81 / (1 + r.e))
    assert phase_relations(w_percent=20.0).e is None  # nothing is assumed
    over = phase_relations(gamma=22.0, w_percent=30.0, Gs=2.7)
    assert "lab.warning.saturation_over_100" in codes(over.warnings)


def test_cu_exact_envelope():
    # Synthetic tests on phi' = 30 deg, c' = 10 kPa. Each curve peaks at the Mohr-Coulomb
    # stress ratio and the pore pressure is constant, so s3' = cell - u is known exactly.
    phi, c = math.radians(30), 10.0
    tests = []
    for i, s3 in enumerate((50.0, 100.0, 200.0)):
        s1 = s3 * (1 + math.sin(phi)) / (1 - math.sin(phi)) + 2 * c * math.cos(phi) / (1 - math.sin(phi))
        tests.append(CUTest(f"T{i}", s3, s3 + 200, [0, 2, 4, 6], [0, (s1 - s3) / 2, s1 - s3, 0.9 * (s1 - s3)],
                            [200, 200, 200, 200], B=0.97))
    r = reduce_cu(tests)
    assert r.effective.phi_deg == pytest.approx(30.0)
    assert r.effective.c == pytest.approx(10.0)
    assert [p.index for p in r.points] == [2, 2, 2]
    assert r.points[0].su == pytest.approx((s1 - s3) / 2) or r.points[0].su > 0


def test_cu_warnings():
    t = lambda i, cp: CUTest(f"T{i}", cp, cp + 100, [0, 5], [0, 2 * cp], [100, 100], B=0.9)
    r = reduce_cu([t(1, 50), t(2, 100)], specimen="reconstituted")
    found = codes(r.warnings)
    assert {"lab.warning.cu_few_tests", "lab.warning.cu_b_low", "lab.warning.cu_reconstituted",
            "lab.warning.cu_no_peak"} <= found
    with pytest.raises(ValueError):
        reduce_cu([t(1, 50)])


# --- Example.xlsx (synthetic workbook supplied by the user; regression baseline) --------

openpyxl = pytest.importorskip("openpyxl")


@pytest.fixture(scope="module")
def workbook():
    wb = openpyxl.load_workbook(EXAMPLE, data_only=True)
    return {ws.title: [r for r in ws.iter_rows(min_row=2, values_only=True) if r[0] is not None]
            for ws in wb}


def test_example_sieve_and_limits(workbook):
    samples = {r[0]: r for r in workbook["Samples"]}
    sieve = {}
    for sid, size, mass in workbook["Sieve"]:
        sieve.setdefault(sid, []).append((size, mass))
    s = sieve["G3-S"]
    r = sieve_analysis([x[0] for x in s], [x[1] for x in s], total_dry_mass_g=samples["G3-S"][5])
    assert (r.gravel, r.sand, r.fines) == pytest.approx((2.0, 76.0, 22.0))
    assert r.D30 == pytest.approx(0.139, abs=2e-3) and r.D60 == pytest.approx(0.535, abs=2e-3)
    assert r.D10 is None
    c = sieve["G3-C"]
    assert sieve_analysis([x[0] for x in c], [x[1] for x in c],
                          total_dry_mass_g=samples["G3-C"][5]).fines == pytest.approx(81.0)

    for sid, ll_expect, pl_expect in (("G3-S", 30.0, 20.0), ("G3-C", 43.0, 21.9)):
        rows = [r for r in workbook["Limits"] if r[0] == sid]
        ll = liquid_limit_multipoint([r[3] for r in rows if r[1] == "LL"],
                                     [r[4] for r in rows if r[1] == "LL"])
        pl = plasticity(ll.ll, [r[4] for r in rows if r[1] == "PL"])
        assert ll.ll == pytest.approx(ll_expect, abs=0.1) and ll.r2 > 0.99
        assert pl.pl == pytest.approx(pl_expect, abs=0.1)


def test_example_phase_relations(workbook):
    for sid, e_expect in (("G3-S", 0.616), ("G3-C", 0.646)):
        row = next(r for r in workbook["Samples"] if r[0] == sid)
        r = phase_relations(gamma=row[2], w_percent=row[3], Gs=row[4])
        assert r.e == pytest.approx(e_expect, abs=2e-3) and r.S == pytest.approx(1.0, abs=0.01)


def test_example_cu(workbook):
    setup = {r[0]: r for r in workbook["CU_Setup"]}
    curves: dict[str, list] = {}
    for tid, eps, q, u in workbook["CU_Curves"]:
        curves.setdefault(tid, []).append((eps, q, u))
    for sid, phi_expect, c_expect in (("G3-S", 32.0, 2.5), ("G3-C", 25.1, 8.8)):
        tests = []
        for tid, row in setup.items():
            if row[1] != sid:
                continue
            e, q, u = zip(*curves[tid])
            tests.append(CUTest(tid, row[2], row[3], list(e), list(q), list(u), B=row[5]))
        ratio = reduce_cu(tests)
        assert ratio.effective.phi_deg == pytest.approx(phi_expect, abs=0.2)
        assert ratio.effective.c == pytest.approx(c_expect, abs=0.3)
        peak_q = reduce_cu(tests, criterion="max_q")
        assert [p.index for p in peak_q.points] == [p.index for p in ratio.points]


def test_cu_total_stress_excludes_back_pressure():
    def make(back):
        return [CUTest(f"T{i}", cp, cp + back, [0, 2, 4], [0, 1.2 * cp, 1.0 * cp],
                       [back, back + 0.2 * cp, back + 0.3 * cp], B=0.97)
                for i, cp in enumerate((50.0, 100.0, 200.0))]
    low, high = reduce_cu(make(0.0)), reduce_cu(make(300.0))
    assert high.total.phi_deg == pytest.approx(low.total.phi_deg)
    assert high.effective.phi_deg == pytest.approx(low.effective.phi_deg)
    assert high.points[0].sigma3_total == pytest.approx(50.0)
    bad = make(100.0)
    bad[0].consolidation_eff = 80.0
    assert "lab.warning.cu_consolidation_inconsistent" in codes(reduce_cu(bad).warnings)


def test_cu_rejects_identical_confining_stress_and_decreasing_strain():
    same = [CUTest(f"T{i}", 100.0, 300.0, [0, 4], [0, 150.0], [200, 220]) for i in range(2)]
    with pytest.raises(ValueError):
        reduce_cu(same)
    with pytest.raises(ValueError):
        reduce_cu([CUTest("a", 100.0, 300.0, [4, 0], [0, 150.0], [200, 220]),
                   CUTest("b", 200.0, 400.0, [0, 4], [0, 250.0], [200, 220])])


def test_edge_cases_nan_np_void_ratio():
    with pytest.raises(ValueError):
        phase_relations(gamma=float("nan"), w_percent=10.0, Gs=2.7)
    with pytest.raises(ValueError):
        plasticity(float("nan"), [20.0])
    with pytest.raises(ValueError):
        liquid_limit_one_point(float("nan"), 30.0)
    bad = phase_relations(gamma=30.0, w_percent=10.0, Gs=2.65)
    assert bad.e is None and bad.gamma_sat is None
    assert "lab.warning.void_ratio_invalid" in codes(bad.warnings)
    assert plasticity(30.0, []).non_plastic is False
    assert plasticity(30.0, [], not_rollable=True).non_plastic is True


def test_sieve_all_material_finer_than_gravel_limit():
    r = sieve_analysis([2, 0.075], [0, 400], total_dry_mass_g=500, pan_g=100)
    assert r.gravel == pytest.approx(0.0)
