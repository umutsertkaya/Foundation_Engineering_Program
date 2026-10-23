"""Consolidated-undrained triaxial (CU) reduction with pore pressure measurement.

Failure points are read from each test curve, then a Mohr-Coulomb line is fitted to the
points in s-t space (s = (s1 + s3)/2, t = (s1 - s3)/2; the MIT convention):
``t = a + s tan(alpha)``, ``sin(phi) = tan(alpha)``, ``c = a / cos(phi)``. The same fit in
effective stresses gives (c', phi'); in total stresses it gives (c_cu, phi_cu), which are
informative only and are not design parameters.

Reference: ASTM D4767 (CU triaxial with pore pressure); Lambe & Whitman (1969), s-t diagram.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Literal

import numpy as np

from geotek.core.warning_codes import format_warning

Criterion = Literal["max_stress_ratio", "max_q", "strain_limit"]
B_MIN = 0.95
"""Minimum Skempton B accepted as saturated (ASTM D4767)."""
STRAIN_LIMIT_DEFAULT = 15.0
"""Axial strain [%] at which a test without a peak is stopped (ASTM D4767)."""


@dataclass
class CUTest:
    test_id: str
    consolidation_eff: float
    """Effective consolidation stress [kPa]."""
    cell_total: float
    """Total cell pressure during shear [kPa]."""
    strain_percent: list[float]
    q: list[float]
    """Deviator stress [kPa]."""
    u: list[float]
    """Pore pressure including back pressure [kPa]."""
    B: float | None = None


@dataclass
class FailurePoint:
    test_id: str
    index: int
    strain_percent: float
    q_f: float
    sigma3_eff: float
    sigma1_eff: float
    sigma3_total: float
    sigma1_total: float
    su: float
    """q_f / 2 at this test's consolidation stress."""
    at_end_of_record: bool = False


@dataclass
class MCFit:
    phi_deg: float
    c: float
    r2: float | None
    through_origin: bool = False


@dataclass
class CUResult:
    criterion: str
    points: list[FailurePoint]
    effective: MCFit | None
    total: MCFit | None
    warnings: list[str] = field(default_factory=list)


def failure_point(test: CUTest, criterion: Criterion = "max_stress_ratio",
                  strain_limit: float = STRAIN_LIMIT_DEFAULT) -> FailurePoint:
    eps = np.asarray(test.strain_percent, dtype=float)
    q = np.asarray(test.q, dtype=float)
    u = np.asarray(test.u, dtype=float)
    if not (eps.shape == q.shape == u.shape) or eps.size < 2:
        raise ValueError(f"{test.test_id}: strain, q and u must be equal-length with >= 2 points")
    if not (np.all(np.isfinite(eps)) and np.all(np.isfinite(q)) and np.all(np.isfinite(u))):
        raise ValueError(f"{test.test_id}: test curve must be finite")
    s3 = test.cell_total - u
    s1 = s3 + q
    if criterion == "max_stress_ratio":
        valid = s3 > 1e-6
        if not valid.any():
            raise ValueError(f"{test.test_id}: effective confining stress never positive")
        ratio = np.where(valid, s1 / np.where(valid, s3, 1.0), -np.inf)
        i = int(np.argmax(ratio))
    elif criterion == "max_q":
        i = int(np.argmax(q))
    elif criterion == "strain_limit":
        if strain_limit <= 0:
            raise ValueError("strain_limit must be positive")
        within = np.where(eps <= strain_limit + 1e-9)[0]
        if within.size == 0:
            raise ValueError(f"{test.test_id}: no data within {strain_limit} % strain")
        i = int(within[-1])
    else:
        raise ValueError(f"Unknown failure criterion {criterion!r}")
    return FailurePoint(
        test_id=test.test_id, index=i, strain_percent=float(eps[i]), q_f=float(q[i]),
        sigma3_eff=float(s3[i]), sigma1_eff=float(s1[i]),
        sigma3_total=float(test.cell_total), sigma1_total=float(test.cell_total + q[i]),
        su=float(q[i] / 2.0), at_end_of_record=bool(i == eps.size - 1))


def _fit_st(s: np.ndarray, t: np.ndarray) -> tuple[MCFit, list[str]]:
    """Least-squares t = a + s tan(alpha); refit through the origin if a < 0."""
    warnings: list[str] = []
    slope, a = np.polyfit(s, t, 1)
    through_origin = False
    if a < 0:
        slope = float(np.sum(s * t) / np.sum(s * s))
        a = 0.0
        through_origin = True
        warnings.append(format_warning("lab.warning.cu_negative_cohesion"))
    if not 0 < slope < 1:
        raise ValueError("Fitted s-t slope is outside (0, 1): test data are not usable")
    fitted = a + slope * s
    ss_tot = float(np.sum((t - t.mean()) ** 2))
    r2 = None
    if s.size >= 3 and ss_tot > 0:
        r2 = 1.0 - float(np.sum((t - fitted) ** 2)) / ss_tot
    phi = math.asin(slope)
    return MCFit(phi_deg=math.degrees(phi), c=float(a / math.cos(phi)), r2=r2,
                 through_origin=through_origin), warnings


def reduce_cu(tests: list[CUTest], *, criterion: Criterion = "max_stress_ratio",
              strain_limit: float = STRAIN_LIMIT_DEFAULT,
              specimen: Literal["reconstituted", "undisturbed"] | None = None) -> CUResult:
    """Failure points and Mohr-Coulomb fits for the CU tests of one sample (>= 2 tests)."""
    if len(tests) < 2:
        raise ValueError("At least two CU tests on one sample are required for a strength envelope")
    warnings: list[str] = []
    if len(tests) < 3:
        warnings.append(format_warning("lab.warning.cu_few_tests", count=len(tests)))
    points = [failure_point(t, criterion, strain_limit) for t in tests]
    for test, point in zip(tests, points):
        if test.B is not None and test.B < B_MIN:
            warnings.append(format_warning(
                "lab.warning.cu_b_low", test_id=test.test_id, b=test.B, minimum=B_MIN))
        if point.at_end_of_record and criterion != "strain_limit":
            warnings.append(format_warning("lab.warning.cu_no_peak", test_id=point.test_id))
    if specimen == "reconstituted":
        warnings.append(format_warning("lab.warning.cu_reconstituted"))
    eff = _fit_st(np.array([(p.sigma1_eff + p.sigma3_eff) / 2 for p in points]),
                  np.array([(p.sigma1_eff - p.sigma3_eff) / 2 for p in points]))
    tot = _fit_st(np.array([(p.sigma1_total + p.sigma3_total) / 2 for p in points]),
                  np.array([(p.sigma1_total - p.sigma3_total) / 2 for p in points]))
    warnings += eff[1]
    return CUResult(criterion=criterion, points=points, effective=eff[0], total=tot[0],
                    warnings=warnings)
