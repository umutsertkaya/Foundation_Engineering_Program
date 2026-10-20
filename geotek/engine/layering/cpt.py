"""Ic layering using existing Robertson classification and registered unit weight.

Robertson (2009/2010): Ic = sqrt((3.47-log10(Qtn))**2 +
(log10(Fr)+1.22)**2), with zone bounds 1.31, 2.05, 2.60, 2.95, 3.60;
the sand-like criterion is Ic < 2.60. Both decisions are delegated to
``zone_from_ic`` / ``is_sand_like``; processing already computes Ic.
"""

from __future__ import annotations

import numpy as np

from geotek.core.models.profile import LayeringSettings
from geotek.engine.classification.robertson import is_sand_like, zone_from_ic
from geotek.engine.correlations.physical import rc2010_below_floor, unit_weight_robertson_cabal
from geotek.engine.insitu.cpt import CPTProcessed
from geotek.engine.layering.common import (
    Layer, Proposal, Segment, edges, format_warning, interval_warning, mean, merge_thin, proposal,
    sample_arrays, warn_no_data,
)


def cpt_layers(processed: CPTProcessed, settings: LayeringSettings) -> Proposal:
    """Propose layers from processed Ic; never mutate the input or approve values.

    A centred window of total depth width ``smoothing_window`` includes both
    endpoints and averages finite samples with equal weight (not a sample-count
    window). Non-finite Ic samples are omitted with a warning; the original final
    depth is retained. Midpoints of retained samples define internal boundaries.
    Contiguous smoothed zones are merged thinnest first (tie: upper) for minimum
    thickness, then for strict |mean Ic difference| < ``merge_ic_tol``.
    Ties select the upper neighbour;
    tolerance scanning restarts at the top after each merge. Layer statistics and
    merge distances use original, unsmoothed Ic observations, not averages of means.
    A mean-Ic zone can differ from individual members' zones. Upstream exceptional
    sbtn_zone zones 1/8/9 are protected from smoothing and both merge passes.
    Zone 1 provisionally uses undrained behaviour because Robertson ZONE_NAMES
    identifies it as sensitive, fine grained. Zones 8/9 use is_sand_like on the
    layer mean Ic: their exceptional zone number alone supplies no drainage rule.
    All exceptional behaviours carry behaviour_assumed for engineer review.
    Every proposal warns that the Ic < 2.6 criterion (Robertson 2009) alone does
    not establish drainage for the loading case; straddling layers also warn.
    Every raw-zone run differing from its final layer zone is reported, including
    single samples; discarded samples break runs. At most one lens_smoothed
    warning per final layer lists its runs (observed depth ranges and raw zones).

    gamma_suggested is the mean of the existing registered RC2010_gamma_CPT
    correlation evaluated at each retained observation: Robertson & Cabal (2010),
    gamma/gamma_w = 0.27 log10(Rf) + 0.36 log10(qt/Pa) + 1.236.
    Its existing numerical Rf floor is reused unchanged. Non-positive/non-finite
    qt or negative/non-finite fs are excluded, with a warning; gamma uses the
    remaining valid estimates. No SBT zone i18n key exists in geotek/i18n/tr.json,
    so descriptions are left empty for the engineer/UI.
    """
    if settings.method != "cpt_ic":
        raise ValueError("CPT layering requires method='cpt_ic'")
    z, ic, order = sample_arrays(processed.depth, processed.Ic)
    bottom = float(z[-1])
    qt = np.asarray(processed.qt, dtype=float)
    fs = np.asarray(processed.fs, dtype=float)
    upstream = np.asarray(processed.zone)
    if qt.shape != z.shape or fs.shape != z.shape or upstream.shape != z.shape:
        raise ValueError("CPT qt, fs and zone must align with depth")
    qt, fs, upstream = qt[order], fs[order], upstream[order]
    warnings = [format_warning(
        "layering.warning.drainage_ic_based",
        message="Behaviour is derived only from Ic < 2.6 (Robertson 2009, is_sand_like) "
                "and must be confirmed by the engineer for the loading case; "
                "zone 1 uses the provisional sensitive fine-grained assumption.",
    )]
    if processed.warnings:
        warnings.append(format_warning("layering.warning.processing_warnings"))
    valid = np.isfinite(ic)
    if not valid.all():
        warnings.append(format_warning("layering.warning.invalid_ic"))
    original_z = z
    z, ic, qt, fs, upstream = z[valid], ic[valid], qt[valid], fs[valid], upstream[valid]
    if not len(z):
        raise ValueError("CPT layering has no finite Ic samples")
    boundaries = edges(z, bottom=bottom)
    warn_no_data(z, warnings, original=original_z, bottom=bottom)
    # Only sbtn_zone (Robertson 2010) assigns these outside the Ic bands.
    exceptional = np.isin(upstream, [1, 8, 9])
    raw_zones = np.where(exceptional, upstream, zone_from_ic(ic)).astype(int)
    # Smooth within each exceptional/non-exceptional run, never across a barrier.
    run_starts = np.r_[0, np.flatnonzero(
        (exceptional[1:] != exceptional[:-1]) |
        (exceptional[1:] & (upstream[1:] != upstream[:-1]))) + 1]
    run_stops = np.r_[run_starts[1:], len(z)]
    half = settings.smoothing_window / 2.0
    left = np.searchsorted(z, z - half, side="left")
    right = np.searchsorted(z, z + half, side="right")
    for a, b in zip(run_starts, run_stops):
        left[a:b] = np.maximum(left[a:b], a)
        right[a:b] = np.minimum(right[a:b], b)
    smoothed = np.array([np.mean(ic[a:b]) for a, b in zip(left, right)])
    zones = np.where(exceptional, upstream, zone_from_ic(smoothed)).astype(int)
    starts = np.r_[0, np.flatnonzero(zones[1:] != zones[:-1]) + 1]
    stops = np.r_[starts[1:], len(z)]
    segments = [Segment(int(a), int(b)) for a, b in zip(starts, stops)]

    def ic_mean(s):
        return float(np.mean(ic[s.start:s.stop]))

    def distance(a, b):
        return abs(ic_mean(a) - ic_mean(b))

    def can_merge(a, b):
        return not (exceptional[a.start:a.stop].any() or exceptional[b.start:b.stop].any())

    merge_thin(segments, boundaries, settings.min_thickness, distance, warnings,
               can_merge=can_merge)
    while True:
        i = next((i for i in range(len(segments) - 1)
                  if can_merge(segments[i], segments[i + 1]) and
                  distance(segments[i], segments[i + 1]) < settings.merge_ic_tol), None)
        if i is None:
            break
        segments[i:i + 2] = [Segment(segments[i].start, segments[i + 1].stop)]
        warnings.append(format_warning("layering.warning.similar_merged"))
    layers = []
    final_zones = np.empty(len(z), dtype=int)
    for s in segments:
        value = ic_mean(s)
        protected = bool(exceptional[s.start])
        zone = int(upstream[s.start]) if protected else int(zone_from_ic(value))
        final_zones[s.start:s.stop] = zone
        top, end = boundaries[s.start], boundaries[s.stop]
        behaviour = "undrained" if zone == 1 else (
            "drained" if bool(is_sand_like(value)) else "undrained")
        if end - top < settings.min_thickness and len(segments) > 1:
            interval_warning(warnings, "thin_retained", top, end, raw_zone=zone)
        if protected:
            interval_warning(warnings, "behaviour_assumed", top, end, raw_zone=zone,
                             behaviour=behaviour, provisional=True)
        sand_like = is_sand_like(ic[s.start:s.stop])
        if sand_like.any() and not sand_like.all():
            interval_warning(warnings, "drainage_transitional", top, end)
        q, f = qt[s.start:s.stop], fs[s.start:s.stop]
        good = np.isfinite(q) & (q > 0) & np.isfinite(f) & (f >= 0)
        estimates = np.asarray(unit_weight_robertson_cabal(q[good], f[good]))
        if rc2010_below_floor(q[good], f[good]).any():
            interval_warning(warnings, "gamma_floor", top, end)
        valid_gamma = np.isfinite(estimates) & (estimates > 0)
        gamma = mean(estimates[valid_gamma])
        if not good.all() or not valid_gamma.all() or gamma is None:
            warnings.append(format_warning("layering.warning.gamma_unavailable"))
        layers.append(Layer(
            top=float(boundaries[s.start]), bottom=float(boundaries[s.stop]),
            description="", uscs=None, sbtn_zone=zone,
            ic_mean=value, n60_mean=None, gamma_suggested=gamma,
            behaviour=behaviour,
        ))
    mismatch = raw_zones != final_zones
    original_indices = np.searchsorted(original_z, z)
    for s in segments:
        runs = []
        i = s.start
        while i < s.stop:
            j = i + 1
            if mismatch[i]:
                while (j < s.stop and mismatch[j] and raw_zones[j] == raw_zones[i]
                       and original_indices[j] == original_indices[j - 1] + 1):
                    j += 1
                runs.append(dict(top=float(z[i]), bottom=float(z[j - 1]),
                                 raw_zone=int(raw_zones[i])))
            i = j
        if runs:
            interval_warning(warnings, "lens_smoothed", boundaries[s.start],
                             boundaries[s.stop], runs=runs)
    return proposal(processed.sounding_id, settings, layers, warnings)
