"""SPT layering from supplied log intervals or depth-aligned laboratory USCS groups.

USCS symbols follow the existing ASTM D2487 classifier; no new classification
thresholds are introduced. USCS does not determine drainage: the required behaviour
field is a provisional coarse (G/S) drained / other undrained choice. Missing or
mixed groups use drained as the domain default. Every SPT proposal flags this
choice for engineer review. No SPT unit-weight correlation exists in the registry.
"""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np

from geotek.core.models.investigations import Borehole, USCS_SYMBOLS
from geotek.core.models.profile import LayeringSettings
from geotek.engine.insitu.spt import SPTProcessed
from geotek.engine.layering.common import (
    Layer, Proposal, Segment, edges, mean, merge_thin, proposal, sample_arrays,
)


def _layer(top, bottom, symbol, n_mean, description=""):
    return Layer(
        top=float(top), bottom=float(bottom), description=description or symbol or "",
        uscs=symbol, sbtn_zone=None, ic_mean=None, n60_mean=n_mean,
        gamma_suggested=None,
        behaviour="drained" if symbol is None or symbol.startswith(("G", "S")) else "undrained",
    )


def _warnings(processed):
    warnings = ["layering.warning.gamma_unavailable", "layering.warning.behaviour_assumed"]
    if processed is not None and processed.warnings:
        warnings.append("layering.warning.processing_warnings")
    return warnings


def spt_log_layers(
    borehole: Borehole, processed: SPTProcessed | None, settings: LayeringSettings,
) -> Proposal:
    """Preserve one layer per log interval, even thin intervals and unlogged gaps.

    Tests at shared boundaries belong to the lower interval (SoilProfile convention);
    a test at the final log bottom belongs to the final interval. Finite N60 alone
    contributes to means. A gap or uncovered test is flagged, never extrapolated.
    ``processed=None`` is permitted only for a borehole with no SPT tests.
    """
    if settings.method != "spt_log":
        raise ValueError("Log layering requires method='spt_log'")
    if not borehole.log:
        raise ValueError("SPT log layering needs at least one log interval")
    if processed is None:
        if borehole.spt:
            raise ValueError("SPT tests require processed N60 values")
        z, n = np.array([]), np.array([])
    else:
        if processed.borehole_id != borehole.id:
            raise ValueError("Processed SPT source differs from the borehole")
        z, n, _ = sample_arrays(processed.depth, processed.n60, allow_empty=True)
    warnings = _warnings(processed)
    if np.any(~np.isfinite(n) | (n == 0)):
        warnings.append("layering.warning.n_missing_or_zero")
    if np.any(n < 0):
        raise ValueError("N60 cannot be negative")
    covered = np.zeros(len(z), dtype=bool)
    layers = []
    for i, interval in enumerate(borehole.log):
        inside = (z >= interval.top) & (z < interval.bottom)
        if i == len(borehole.log) - 1:
            inside |= z == interval.bottom
        covered |= inside
        n_mean = mean(n[inside])
        if not inside.any():
            warnings.append("layering.warning.log_no_test")
        elif n_mean is None:
            warnings.append("layering.warning.n_missing_or_zero")
        if interval.uscs is None:
            warnings.append("layering.warning.uscs_missing")
        if (i == 0 and interval.top > 0) or (
            i > 0 and interval.top != borehole.log[i - 1].bottom
        ):
            warnings.append("layering.warning.log_gap")
        layers.append(_layer(interval.top, interval.bottom, interval.uscs,
                             n_mean, interval.description))
    if not covered.all():
        warnings.append("layering.warning.tests_outside_log")
    return proposal(borehole.id, settings, layers, warnings)


def spt_uscs_n_layers(
    processed: SPTProcessed, uscs: Sequence[str | None], settings: LayeringSettings,
) -> Proposal:
    """Split when the lab group changes or relative corrected N60 change exceeds settings.

    N_i and the current mean are finite corrected N60 observations. A zero mean
    followed by positive N starts a new segment; zero followed by zero does not.
    Missing N is ignored for comparison/statistics, with a warning. Missing USCS
    remains None and is a distinct group, never filled from a distant sample.
    Minimum-thickness merging prefers the same USCS group, then the closest finite
    N60 mean; undefined distances and ties select the upper neighbour. Mixed merged
    groups become None with a warning. All means are sample-weighted, not means of
    segment means. Settings are algorithm choices, not empirical soil thresholds.
    """
    if settings.method != "spt_uscs_n":
        raise ValueError("USCS/N layering requires method='spt_uscs_n'")
    z, n, order = sample_arrays(processed.depth, processed.n60)
    if len(uscs) != len(z):
        raise ValueError("USCS groups must align with SPT depths")
    groups = [uscs[i] for i in order]
    if any(g is not None and g not in USCS_SYMBOLS for g in groups):
        raise ValueError("Unknown USCS symbol")
    if np.any(n < 0):
        raise ValueError("N60 cannot be negative")
    warnings = _warnings(processed)
    if None in groups:
        warnings.append("layering.warning.uscs_missing")
    if np.any(~np.isfinite(n) | (n == 0)):
        warnings.append("layering.warning.n_missing_or_zero")
    boundaries = edges(z)
    segments = []
    start = 0
    total, count = 0.0, 0
    for i in range(len(z)):
        current = total / count if count else None
        changed = False
        if current is not None and np.isfinite(n[i]):
            changed = (n[i] > 0) if current == 0 else (
                abs(n[i] - current) / current > settings.n_change_ratio
            )
        if i > start and (groups[i] != groups[start] or changed):
            segments.append(Segment(start, i))
            start, total, count = i, 0.0, 0
        if np.isfinite(n[i]):
            total += n[i]
            count += 1
    segments.append(Segment(start, len(z)))

    def symbol(s):
        unique = set(groups[s.start:s.stop])
        return next(iter(unique)) if len(unique) == 1 else None

    def distance(a, b):
        ma, mb = mean(n[a.start:a.stop]), mean(n[b.start:b.stop])
        return (symbol(a) != symbol(b),
                abs(ma - mb) if ma is not None and mb is not None else float("inf"))

    merge_thin(segments, boundaries, settings.min_thickness, distance, warnings)
    layers = []
    for s in segments:
        if len(set(groups[s.start:s.stop])) > 1:
            warnings.append("layering.warning.uscs_mixed")
        layers.append(_layer(boundaries[s.start], boundaries[s.stop], symbol(s),
                             mean(n[s.start:s.stop])))
    return proposal(processed.borehole_id, settings, layers, warnings)
