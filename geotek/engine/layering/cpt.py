"""Ic layering using existing Robertson classification and registered unit weight.

Robertson (2009/2010): Ic = sqrt((3.47-log10(Qtn))**2 +
(log10(Fr)+1.22)**2), with zone bounds 1.31, 2.05, 2.60, 2.95, 3.60;
the sand-like criterion is Ic < 2.60. Both decisions are delegated to
``zone_from_ic`` / ``is_sand_like``; processing already computes Ic.
"""

from __future__ import annotations

import numpy as np

from geotek.core.models.profile import LayeringSettings
from geotek.engine.classification.robertson import ZONE_NAMES, is_sand_like, zone_from_ic
from geotek.engine.correlations.physical import unit_weight_robertson_cabal
from geotek.engine.insitu.cpt import CPTProcessed
from geotek.engine.layering.common import (
    Layer, Proposal, Segment, edges, mean, merge_thin, proposal, sample_arrays,
)


def cpt_layers(processed: CPTProcessed, settings: LayeringSettings) -> Proposal:
    """Propose layers from processed Ic; never mutate the input or approve values.

    A centred window of total depth width ``smoothing_window`` includes both
    endpoints and averages finite samples with equal weight (not a sample-count
    window). Non-finite Ic samples are omitted with a warning; the original final
    depth is retained. Midpoints of retained samples define internal boundaries.
    Contiguous smoothed zones are merged first for minimum thickness, then for
    strict |mean Ic difference| < ``merge_ic_tol``. Ties select the upper neighbour;
    tolerance scanning restarts at the top after each merge. Layer statistics and
    merge distances use original, unsmoothed Ic observations, not averages of means.

    gamma_suggested is the mean of the existing registered RC2010_gamma_CPT
    correlation evaluated at each retained observation: Robertson & Cabal (2010),
    gamma/gamma_w = 0.27 log10(Rf) + 0.36 log10(qt/Pa) + 1.236.
    Its existing numerical Rf floor is reused unchanged. Non-positive/non-finite
    qt or negative/non-finite fs give no suggestion for the affected layer.
    """
    if settings.method != "cpt_ic":
        raise ValueError("CPT layering requires method='cpt_ic'")
    z, ic, order = sample_arrays(processed.depth, processed.Ic)
    bottom = float(z[-1])
    qt = np.asarray(processed.qt, dtype=float)
    fs = np.asarray(processed.fs, dtype=float)
    if qt.shape != z.shape or fs.shape != z.shape:
        raise ValueError("CPT qt and fs must align with depth")
    qt, fs = qt[order], fs[order]
    warnings = []
    if processed.warnings:
        warnings.append("layering.warning.processing_warnings")
    valid = np.isfinite(ic)
    if not valid.all():
        warnings.append("layering.warning.invalid_ic")
    z, ic, qt, fs = z[valid], ic[valid], qt[valid], fs[valid]
    if not len(z):
        raise ValueError("CPT layering has no finite Ic samples")
    boundaries = edges(z, bottom=bottom)
    half = settings.smoothing_window / 2.0
    left = np.searchsorted(z, z - half, side="left")
    right = np.searchsorted(z, z + half, side="right")
    smoothed = np.array([np.mean(ic[a:b]) for a, b in zip(left, right)])
    zones = zone_from_ic(smoothed)
    starts = np.r_[0, np.flatnonzero(zones[1:] != zones[:-1]) + 1]
    stops = np.r_[starts[1:], len(z)]
    segments = [Segment(int(a), int(b)) for a, b in zip(starts, stops)]

    def ic_mean(s):
        return float(np.mean(ic[s.start:s.stop]))

    def distance(a, b):
        return abs(ic_mean(a) - ic_mean(b))

    merge_thin(segments, boundaries, settings.min_thickness, distance, warnings)
    while True:
        i = next((i for i in range(len(segments) - 1)
                  if distance(segments[i], segments[i + 1]) < settings.merge_ic_tol), None)
        if i is None:
            break
        segments[i:i + 2] = [Segment(segments[i].start, segments[i + 1].stop)]
        warnings.append("layering.warning.similar_merged")
    layers = []
    for s in segments:
        value = ic_mean(s)
        zone = int(zone_from_ic(value))
        q, f = qt[s.start:s.stop], fs[s.start:s.stop]
        gamma = None
        if np.all(np.isfinite(q) & (q > 0) & np.isfinite(f) & (f >= 0)):
            estimates = np.asarray(unit_weight_robertson_cabal(q, f))
            if np.all(np.isfinite(estimates) & (estimates > 0)):
                gamma = mean(estimates)
        if gamma is None:
            warnings.append("layering.warning.gamma_unavailable")
        layers.append(Layer(
            top=float(boundaries[s.start]), bottom=float(boundaries[s.stop]),
            description=ZONE_NAMES[zone]["en"], uscs=None, sbtn_zone=zone,
            ic_mean=value, n60_mean=None, gamma_suggested=gamma,
            behaviour="drained" if bool(is_sand_like(value)) else "undrained",
        ))
    return proposal(processed.sounding_id, settings, layers, warnings)
