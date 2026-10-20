"""Transport-independent, editable layering proposals and deterministic merging helpers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np

from geotek.core.constants import DEPTH_TOL
from geotek.core.models.profile import LayeringSettings
from geotek.core.warning_codes import format_warning, parse_warning  # noqa: F401  (re-exported)


@dataclass
class Layer:
    """An unapproved interpretation; fields map directly to ProposedLayer."""

    top: float
    bottom: float
    description: str
    uscs: str | None
    sbtn_zone: int | None
    ic_mean: float | None
    n60_mean: float | None
    gamma_suggested: float | None
    behaviour: Literal["drained", "undrained"]


@dataclass
class Proposal:
    """Fields map directly to LayeringProposal without importing the HTTP package."""

    source_id: str
    settings: LayeringSettings
    layers: list[Layer]
    warnings: list[str]


@dataclass
class Segment:
    """Half-open sample indices; geometry comes from midpoint cell edges."""

    start: int
    stop: int


def sample_arrays(depth, values, *, allow_empty: bool = False):
    """Validate aligned 1-D samples, stable-sort depths, and reject duplicate depths."""
    z, v = np.asarray(depth, dtype=float), np.asarray(values, dtype=float)
    if z.ndim != 1 or v.shape != z.shape:
        raise ValueError("Layering needs aligned one-dimensional depth and value arrays")
    if not len(z) and not allow_empty:
        raise ValueError("Layering needs at least one sample")
    if not np.isfinite(z).all() or np.any(z < 0):
        raise ValueError("Layering depths must be finite and non-negative")
    order = np.argsort(z, kind="stable")
    z, v = z[order], v[order]
    if np.any(np.diff(z) <= 0):
        raise ValueError("Layering depths must be unique")
    return z, v, order


def edges(depth, *, bottom: float | None = None):
    """Start at ground surface, as SoilProfile requires; end at the last data depth.

    Internal edges are arithmetic midpoints, an algorithmic interpretation rather
    than a published soil threshold. A sole sample at zero has no positive extent.
    Callers use warn_no_data to disclose unsupported extensions and local gaps.
    """
    end = float(depth[-1]) if bottom is None else bottom
    if end <= 0:
        raise ValueError("Layering needs a positive final data depth")
    return np.r_[0.0, (depth[:-1] + depth[1:]) / 2.0, end]


def mean(values) -> float | None:
    """Arithmetic mean of finite observations; missing observations are not zero."""
    values = np.asarray(values, dtype=float)
    valid = values[np.isfinite(values)]
    return float(np.mean(valid)) if len(valid) else None


def interval_warning(warnings, code, top, bottom, **details):
    """Append a warning using the shared format and named SI-depth context."""
    warnings.append(format_warning(f"layering.warning.{code}",
                                   top=float(top), bottom=float(bottom), **details))


def warn_no_data(depth, warnings, *, original=None, bottom=None):
    """Flag extrapolation and gaps exceeding adjacent local sample spacing.

    Local spacing is the minimum of the available neighbouring acquisition
    increments: comparison with the smaller neighbour reports an interruption
    even when sampling density changes on the other side. This is an algorithmic
    reporting rule, not a soil property or a geological threshold. Discarded
    observations also supply spacing evidence. With only two original observations
    there is no independent reference spacing, so even a large separation cannot
    be reported as an internal gap; surface/trailing extensions are still flagged.
    DEPTH_TOL is only the existing numerical depth tolerance, not a geological
    gap threshold.
    """
    original = depth if original is None else original
    if depth[0] > 0:
        interval_warning(warnings, "no_data_interval", 0, depth[0])
    steps = np.diff(original)
    for a, b in zip(depth[:-1], depth[1:]):
        ia, ib = np.searchsorted(original, [a, b])
        local = steps[max(0, ia - 1):min(len(steps), ib + 1)]
        if len(local) and b - a > float(np.min(local)) + DEPTH_TOL:
            interval_warning(warnings, "no_data_interval", a, b)
    if bottom is not None and bottom > depth[-1]:
        interval_warning(warnings, "no_data_interval", depth[-1], bottom)


def merge_thin(segments, boundaries, minimum, distance, warnings, *, can_merge=None):
    """Merge the thinnest eligible segment first (equal thickness: upper).

    The most similar adjacent segment wins; equal distances choose the upper
    neighbour. A single segment is retained even when the record is thinner than
    the user setting. No geological coefficient is introduced.
    """
    while len(segments) > 1:
        candidates = []
        for i, s in enumerate(segments):
            thickness = boundaries[s.stop] - boundaries[s.start]
            neighbours = [j for j in (i - 1, i + 1) if 0 <= j < len(segments)
                          and (can_merge is None or can_merge(s, segments[j]))]
            if thickness < minimum and neighbours:
                candidates.append((thickness, i, neighbours))
        if not candidates:
            break
        _, i, neighbours = min(candidates)
        j = min(neighbours, key=lambda j: (distance(segments[i], segments[j]), j))
        lo, hi = sorted((i, j))
        segments[lo:hi + 1] = [Segment(segments[lo].start, segments[hi].stop)]
        warnings.append(format_warning("layering.warning.thin_merged"))
    return segments


def proposal(source_id, settings, layers, warnings):
    """Copy settings and deduplicate identical warning messages in occurrence order."""
    return Proposal(source_id, settings.model_copy(deep=True), layers, list(dict.fromkeys(warnings)))
