"""Sieve analysis: retained masses to percent passing, D-values and grain-size fractions.

References
----------
ASTM D6913 (particle-size distribution by sieving); ASTM D2487 fractions (gravel > 4.75 mm,
sand 4.75-0.075 mm, fines < 0.075 mm). D-values are interpolated linearly in log(size).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from geotek.core.warning_codes import format_warning

GRAVEL_SAND_MM = 4.75
SAND_FINES_MM = 0.075
MASS_LOSS_WARN_PERCENT = 2.0
"""Default mass-loss warning threshold [%]; project check level, not a code limit."""


@dataclass
class SieveResult:
    openings_mm: np.ndarray
    """Sieve openings, descending."""
    percent_passing: np.ndarray
    D10: float | None
    D30: float | None
    D60: float | None
    Cu: float | None
    Cc: float | None
    gravel: float | None
    sand: float | None
    fines: float | None
    mass_loss_percent: float | None
    warnings: list[str] = field(default_factory=list)


def passing_at(openings_mm, percent_passing, size_mm: float) -> float | None:
    """Percent passing at ``size_mm`` (log-linear); None outside the measured range."""
    x = np.log10(np.asarray(openings_mm, dtype=float))
    y = np.asarray(percent_passing, dtype=float)
    order = np.argsort(x)
    x, y = x[order], y[order]
    s = math.log10(size_mm)
    if s < x[0] - 1e-9 or s > x[-1] + 1e-9:
        return None
    return float(np.interp(s, x, y))


def diameter_at(openings_mm, percent_passing, percent: float) -> float | None:
    """Grain size [mm] at which ``percent`` passes; None if the curve never brackets it."""
    x = np.log10(np.asarray(openings_mm, dtype=float))
    y = np.asarray(percent_passing, dtype=float)
    order = np.argsort(y, kind="stable")
    y, x = y[order], x[order]
    if percent < y[0] - 1e-9 or percent > y[-1] + 1e-9:
        return None
    return float(10 ** np.interp(percent, y, x))


def sieve_analysis(
    openings_mm,
    retained_g,
    *,
    total_dry_mass_g: float | None = None,
    pan_g: float | None = None,
    mass_loss_warn_percent: float = MASS_LOSS_WARN_PERCENT,
) -> SieveResult:
    """Reduce retained masses per sieve to percent passing and grain-size parameters.

    The reference mass is ``total_dry_mass_g`` if given, else retained + pan. With a total
    but no pan the remainder is taken as passing the finest sieve (no mass loss), and a
    warning states that the loss check could not be made.
    """
    size = np.asarray(openings_mm, dtype=float)
    mass = np.asarray(retained_g, dtype=float)
    if size.ndim != 1 or size.shape != mass.shape or size.size == 0:
        raise ValueError("Sieve openings and retained masses must be equal-length, non-empty lists")
    if not (np.all(np.isfinite(size)) and np.all(np.isfinite(mass))):
        raise ValueError("Sieve data must be finite")
    if np.any(size <= 0) or np.any(mass < 0):
        raise ValueError("Sieve openings must be positive and retained masses non-negative")
    if len(set(size.tolist())) != size.size:
        raise ValueError("Duplicate sieve openings")
    order = np.argsort(-size)
    size, mass = size[order], mass[order]
    warnings: list[str] = []
    retained_sum = float(mass.sum())
    pan = None if pan_g is None else float(pan_g)
    if pan is not None and pan < 0:
        raise ValueError("Pan mass must be non-negative")

    loss = None
    if total_dry_mass_g is not None:
        total = float(total_dry_mass_g)
        if total <= 0:
            raise ValueError("Total dry mass must be positive")
        if retained_sum > total * (1 + 1e-9):
            raise ValueError("Retained mass exceeds the total dry mass")
        if pan is None:
            warnings.append(format_warning("lab.warning.sieve_no_pan_assumed_no_loss"))
        else:
            loss = 100.0 * (total - retained_sum - pan) / total
            if abs(loss) > mass_loss_warn_percent:
                warnings.append(format_warning(
                    "lab.warning.sieve_mass_loss", loss_percent=round(loss, 2),
                    tolerance_percent=mass_loss_warn_percent))
    else:
        total = retained_sum + (pan or 0.0)
        if total <= 0:
            raise ValueError("Total sieve mass is zero")
        if pan is None:
            warnings.append(format_warning("lab.warning.sieve_total_unknown"))

    passing = 100.0 * (total - np.cumsum(mass)) / total
    passing = np.clip(passing, 0.0, 100.0)

    d10, d30, d60 = (diameter_at(size, passing, p) for p in (10.0, 30.0, 60.0))
    cu = d60 / d10 if d10 and d60 else None
    cc = d30**2 / (d10 * d60) if d10 and d30 and d60 else None
    p_gravel = passing_at(size, passing, GRAVEL_SAND_MM)
    p_fines = passing_at(size, passing, SAND_FINES_MM)
    gravel = None if p_gravel is None else 100.0 - p_gravel
    fines = p_fines
    sand = None if p_gravel is None or p_fines is None else p_gravel - p_fines
    return SieveResult(
        openings_mm=size, percent_passing=passing, D10=d10, D30=d30, D60=d60, Cu=cu, Cc=cc,
        gravel=gravel, sand=sand, fines=fines, mass_loss_percent=loss, warnings=warnings)
