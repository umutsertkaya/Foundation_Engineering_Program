"""Transport-independent, editable layering proposals and deterministic merging helpers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np

from geotek.core.models.profile import LayeringSettings


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


def merge_thin(segments, boundaries, minimum, distance, warnings):
    """Merge the first thin segment, recomputing distances after every merge.

    The most similar adjacent segment wins; equal distances choose the upper
    neighbour. A single segment is retained even when the record is thinner than
    the user setting. No geological coefficient is introduced.
    """
    while len(segments) > 1:
        i = next((i for i, s in enumerate(segments)
                  if boundaries[s.stop] - boundaries[s.start] < minimum), None)
        if i is None:
            break
        neighbours = [j for j in (i - 1, i + 1) if 0 <= j < len(segments)]
        j = min(neighbours, key=lambda j: (distance(segments[i], segments[j]), j))
        lo, hi = sorted((i, j))
        segments[lo:hi + 1] = [Segment(segments[lo].start, segments[hi].stop)]
        warnings.append("layering.warning.thin_merged")
    return segments


def proposal(source_id, settings, layers, warnings):
    """Copy settings and deduplicate warning codes in first-occurrence order."""
    return Proposal(source_id, settings.model_copy(deep=True), layers, list(dict.fromkeys(warnings)))
