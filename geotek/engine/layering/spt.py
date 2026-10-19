"""SPT layering from supplied log intervals or depth-aligned laboratory USCS groups.

USCS symbols follow the existing ASTM D2487 classifier; no new classification
thresholds are introduced. USCS does not determine drainage: the required behaviour
field is a provisional coarse (G/S) drained / other undrained choice. Missing
groups use a provisional undrained value solely to satisfy the contract. Every
SPT proposal flags this choice for engineer review. No SPT unit-weight correlation
exists in the registry.
"""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np

from geotek.core.constants import DEPTH_TOL
from geotek.core.models.investigations import Borehole, USCS_SYMBOLS
from geotek.core.models.profile import LayeringSettings
from geotek.engine.insitu.spt import SPTProcessed
from geotek.engine.layering.common import (
    Layer, Proposal, Segment, edges, format_warning, interval_warning, mean, merge_thin, proposal,
    sample_arrays, warn_no_data,
)


def _layer(top, bottom, symbol, n_mean, description=""):
    return Layer(
        top=float(top), bottom=float(bottom), description=description or symbol or "",
        uscs=symbol, sbtn_zone=None, ic_mean=None, n60_mean=n_mean,
        gamma_suggested=None,
        behaviour="drained" if symbol and symbol.startswith(("G", "S")) else "undrained",
    )


def _warnings(processed):
    warnings = [format_warning("layering.warning.gamma_unavailable"),
                format_warning("layering.warning.behaviour_assumed")]
    if processed is not None and processed.warnings:
        warnings.append(format_warning("layering.warning.processing_warnings"))
    return warnings


def _refusals(processed, order):
    refusal = np.asarray(processed.refusal, dtype=bool)
    if refusal.shape != np.asarray(processed.depth).shape:
        raise ValueError("SPT refusal must align with depth")
    return refusal[order]


def _warn_refusal(z, refusal, top, bottom, warnings):
    if refusal.any():
        interval_warning(warnings, "refusal_in_layer", top, bottom,
                         depths=z[refusal].tolist())


def spt_log_layers(
    borehole: Borehole, processed: SPTProcessed | None, settings: LayeringSettings,
) -> Proposal:
    """Preserve log layers, absorbing unlogged gaps into the layer above.

    Tests at shared boundaries belong to the lower interval (SoilProfile convention);
    a test at the final log bottom belongs to the final interval. Finite non-refusal
    N60 alone contributes to means. All-refusal means are None: ResultNumber is
    float | None (api/schemas.py), with no lower-bound field. The first layer is
    extended to ground surface; all extensions are warned. Tests and means use
    the resulting contiguous intervals; tests below the final bottom are warned.
    Adjacent tops within Borehole's DEPTH_TOL are snapped to the previous bottom;
    intervals with non-positive thickness after snapping are dropped and warned
    before assigning tests. The final retained interval includes its bottom test.
    ``processed=None`` is permitted only for a borehole with no SPT tests.
    """
    if settings.method != "spt_log":
        raise ValueError("Log layering requires method='spt_log'")
    if not borehole.log:
        raise ValueError("SPT log layering needs at least one log interval")
    if processed is None:
        if borehole.spt:
            raise ValueError("SPT tests require processed N60 values")
        z, n, refusal = np.array([]), np.array([]), np.array([], dtype=bool)
    else:
        if processed.borehole_id != borehole.id:
            raise ValueError("Processed SPT source differs from the borehole")
        z, n, order = sample_arrays(processed.depth, processed.n60, allow_empty=True)
        refusal = _refusals(processed, order)
    warnings = _warnings(processed)
    if np.any(~np.isfinite(n) | (n == 0)):
        warnings.append(format_warning("layering.warning.n_missing_or_zero"))
    if np.any(n < 0):
        raise ValueError("N60 cannot be negative")
    n = np.where(refusal, np.nan, n)
    covered = np.zeros(len(z), dtype=bool)
    intervals = []
    for interval in borehole.log:
        top = interval.top
        previous = intervals[-1][2] if intervals else 0.0
        if intervals and abs(top - previous) <= DEPTH_TOL:
            top = previous
        elif top > previous:
            warnings.append(format_warning("layering.warning.log_gap"))
            interval_warning(warnings, "no_data_interval", previous, top)
            if intervals:
                upper, upper_top, _ = intervals[-1]
                intervals[-1] = (upper, upper_top, top)
            else:
                top = 0.0
        if interval.bottom <= top:
            interval_warning(warnings, "log_degenerate_interval", top, interval.bottom,
                             original_top=float(interval.top))
            continue
        intervals.append((interval, top, interval.bottom))
    layers = []
    for i, (interval, top, bottom) in enumerate(intervals):
        inside = (z >= top) & (z < bottom)
        if i == len(intervals) - 1:
            inside |= z == bottom
        covered |= inside
        n_mean = mean(n[inside])
        _warn_refusal(z[inside], refusal[inside], top, bottom, warnings)
        if not inside.any():
            warnings.append(format_warning("layering.warning.log_no_test"))
        elif n_mean is None and not refusal[inside].all():
            warnings.append(format_warning("layering.warning.n_missing_or_zero"))
        if interval.uscs is None:
            warnings.append(format_warning("layering.warning.uscs_missing"))
        layers.append(_layer(top, bottom, interval.uscs,
                             n_mean, interval.description))
    if not covered.all():
        warnings.append(format_warning("layering.warning.tests_outside_log"))
    return proposal(borehole.id, settings, layers, warnings)


def spt_uscs_n_layers(
    processed: SPTProcessed, uscs: Sequence[str | None], settings: LayeringSettings,
) -> Proposal:
    """Split when the lab group changes or relative corrected N60 change exceeds settings.

    N_i and the current mean are finite corrected N60 observations. A zero mean
    followed by positive N starts a new segment; zero followed by zero does not.
    Missing N is ignored for comparison/statistics, with a warning. Missing USCS
    remains None and is a distinct group, never filled from a distant sample.
    Minimum-thickness merging processes the thinnest segment (tie: upper), and
    prefers the same USCS group, then the closest finite N60 mean; undefined
    distances and ties select the upper neighbour. Mixed merged
    groups retain the dominant known group by midpoint-cell thickness, then sample
    count, then uppermost occurrence, with uscs_mixed. Behaviour remains provisional
    and warned. Refusal values are excluded from comparisons and means; all-refusal
    means are None (ResultNumber supports null, not a lower bound). All means are
    sample-weighted, not means of segment means. Settings are algorithm choices,
    not empirical soil thresholds.
    """
    if settings.method != "spt_uscs_n":
        raise ValueError("USCS/N layering requires method='spt_uscs_n'")
    z, n, order = sample_arrays(processed.depth, processed.n60)
    refusal = _refusals(processed, order)
    if len(uscs) != len(z):
        raise ValueError("USCS groups must align with SPT depths")
    groups = [uscs[i] for i in order]
    if any(g is not None and g not in USCS_SYMBOLS for g in groups):
        raise ValueError("Unknown USCS symbol")
    if np.any(n < 0):
        raise ValueError("N60 cannot be negative")
    warnings = _warnings(processed)
    if None in groups:
        warnings.append(format_warning("layering.warning.uscs_missing"))
    if np.any(~np.isfinite(n) | (n == 0)):
        warnings.append(format_warning("layering.warning.n_missing_or_zero"))
    n = np.where(refusal, np.nan, n)
    boundaries = edges(z)
    warn_no_data(z, warnings)
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
        known = {g for g in groups[s.start:s.stop] if g is not None}
        if not known:
            return None

        def rank(group):
            indices = [i for i in range(s.start, s.stop) if groups[i] == group]
            thickness = sum(boundaries[i + 1] - boundaries[i] for i in indices)
            return thickness, len(indices), -indices[0]

        return max(known, key=rank)

    def distance(a, b):
        ma, mb = mean(n[a.start:a.stop]), mean(n[b.start:b.stop])
        return (symbol(a) != symbol(b),
                abs(ma - mb) if ma is not None and mb is not None else float("inf"))

    merge_thin(segments, boundaries, settings.min_thickness, distance, warnings)
    layers = []
    for s in segments:
        if len(set(groups[s.start:s.stop])) > 1:
            warnings.append(format_warning("layering.warning.uscs_mixed"))
        _warn_refusal(z[s.start:s.stop], refusal[s.start:s.stop],
                      boundaries[s.start], boundaries[s.stop], warnings)
        layers.append(_layer(boundaries[s.start], boundaries[s.stop], symbol(s),
                             mean(n[s.start:s.stop])))
    return proposal(processed.borehole_id, settings, layers, warnings)
