"""Phase relations from measured unit weight, water content and specific gravity."""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from geotek.core.constants import GAMMA_W
from geotek.core.warning_codes import format_warning

SATURATION_TOL = 0.02
"""Computed S above 1 + this is flagged as inconsistent input."""


@dataclass
class PhaseResult:
    gamma_d: float | None = None
    e: float | None = None
    S: float | None = None
    """Degree of saturation, fraction (0-1)."""
    gamma_sat: float | None = None
    warnings: list[str] = field(default_factory=list)


def phase_relations(
    *, gamma: float | None = None, w_percent: float | None = None, Gs: float | None = None,
    S: float | None = None, gamma_w: float = GAMMA_W,
) -> PhaseResult:
    """Compute what the inputs determine; nothing is assumed.

    gamma, w, Gs: gamma_d = gamma/(1+w); e = Gs gamma_w/gamma_d - 1; S = w Gs / e.
    Without gamma, an explicit S (fraction) gives e = w Gs / S. Missing inputs leave fields None.
    """
    out = PhaseResult()
    w = None if w_percent is None else w_percent / 100.0
    for value in (gamma, w_percent, Gs, S):
        if value is not None and not math.isfinite(value):
            raise ValueError("Phase-relation inputs must be finite")
    if gamma is not None and gamma <= 0 or Gs is not None and Gs <= 0 or w is not None and w < 0:
        raise ValueError("Unit weight and Gs must be positive, water content non-negative")
    if S is not None and not 0 < S <= 1:
        raise ValueError("S must be in (0, 1]")
    if gamma is not None and w is not None:
        out.gamma_d = gamma / (1.0 + w)
        if Gs is not None:
            out.e = Gs * gamma_w / out.gamma_d - 1.0
    elif w is not None and Gs is not None and S is not None:
        out.e = w * Gs / S
        out.gamma_d = Gs * gamma_w / (1.0 + out.e)
    if out.e is not None and out.e <= 0:
        out.warnings.append(format_warning("lab.warning.void_ratio_invalid", e=round(out.e, 3)))
        out.e = None
    if out.e is not None and w is not None and Gs is not None:
        out.S = w * Gs / out.e
        if out.S > 1.0 + SATURATION_TOL:
            out.warnings.append(format_warning(
                "lab.warning.saturation_over_100", saturation_percent=round(100 * out.S, 1)))
    if out.e is not None and Gs is not None:
        out.gamma_sat = (Gs + out.e) * gamma_w / (1.0 + out.e)
    return out
