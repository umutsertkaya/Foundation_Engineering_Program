"""Common layering from one CPT sounding and nearby boreholes (SPT logs / laboratory USCS).

Pure and deterministic; the result is an editable proposal, never an approved profile.

1. Elevation alignment: with ground elevations on both records a borehole depth ``d`` maps to
   the CPT frame as ``d' = d + (elev_cpt - elev_bh)``; without them ``d' = d`` and the proposal
   warns (``layering.warning.depth_not_aligned``).
2. Distance: horizontal CPT-borehole distance when both have x, y. No threshold is applied.
3. Boundaries: CPT boundaries plus the aligned borehole boundaries. A borehole boundary closer
   than ``settings.min_thickness`` to an already kept one is merged into it (the CPT position
   wins); every boundary records its source (cpt, borehole, both).
4. Soil type: the majority USCS of the laboratory samples in the layer (a tie goes to the
   shallowest symbol, as ``evaluation_uscs``), else the USCS of the borehole layer that overlaps
   most, else the CPT SBTn zone only.
5. Conflict: CPT group from the layer mean Ic (< 2.05 coarse, > 2.60 fine, else transitional)
   against the USCS group (G*/S* coarse, other fine). A coarse/fine contradiction is flagged;
   the engineer resolves it (``uscs`` or ``cpt``) before a profile can be created.
6. Behaviour: coarse drained, fine undrained (existing rule); a transitional CPT group follows
   the USCS group, or Ic < 2.6 (Robertson 2009) when there is no USCS.
7. Unit weights: ``suggest_unit_weights`` with every source of all investigations.

The Ic limits 2.05 / 2.60 are the designer's task-card values (the Robertson zone 3/4 and 5/6
bounds), not new correlation coefficients.
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass

import numpy as np

from geotek.core.models.investigations import LabRecord
from geotek.core.models.profile import LayeringSettings
from geotek.engine.classification.robertson import is_sand_like, zone_from_ic
from geotek.engine.classification.uscs import dominant_symbol
from geotek.engine.correlations.physical import GAMMA_MIN_RC2010
from geotek.engine.layering.common import (
    Layer, Proposal, format_warning, interval_warning, mean, parse_warning,
)
from geotek.engine.layering.unit_weight import apply_suggestions, suggest_unit_weights

IC_COARSE_MAX = 2.05
"""CPT group is coarse for a layer mean Ic below this value."""
IC_FINE_MIN = 2.60
"""CPT group is fine for a layer mean Ic above this value."""

_KEPT_WARNINGS = frozenset({
    "layering.warning.drainage_ic_based", "layering.warning.processing_warnings",
    "layering.warning.invalid_ic", "layering.warning.uscs_qualified", "layering.warning.gamma_floor",
})


@dataclass
class Site:
    """Position of one investigation."""

    id: str
    x: float | None = None
    y: float | None = None
    elevation: float | None = None


@dataclass
class CPTPoints:
    """Per-point CPT data in the CPT depth frame; gamma is the RC2010 estimate (NaN = none)."""

    depth: np.ndarray
    ic: np.ndarray
    gamma: np.ndarray
    floored: np.ndarray | None = None
    """True where the RC2010 estimate hit the numerical floor GAMMA_MIN_RC2010."""


def cpt_group(ic_mean: float | None) -> str | None:
    """'coarse', 'fine' or 'transitional' from a mean Ic; None without Ic."""
    if ic_mean is None:
        return None
    if ic_mean < IC_COARSE_MAX:
        return "coarse"
    return "fine" if ic_mean > IC_FINE_MIN else "transitional"


def uscs_group(symbol: str | None) -> str | None:
    """'coarse' for G*/S* symbols (dual symbols by their first letter), else 'fine'."""
    if not symbol:
        return None
    return "coarse" if symbol.strip().upper()[:1] in ("G", "S") else "fine"


def _inside(depth: float, top: float, bottom: float, last: bool) -> bool:
    return top <= depth < bottom or (last and depth == bottom)


def _boundaries(cpt_bottoms, borehole_bottoms, minimum, total):
    """Merged internal boundaries as (depth, source) pairs, sorted by depth.

    Inputs are the bottoms of every layer except the last of each proposal.
    """
    kept = [[float(d), "cpt"] for d in cpt_bottoms if 0 < d < total]
    for bottoms in borehole_bottoms:
        for depth in bottoms:
            depth = float(depth)
            if not 0 < depth < total or depth < minimum or total - depth < minimum:
                continue
            near = [k for k in kept if abs(k[0] - depth) < minimum]
            if not near:
                kept.append([depth, "borehole"])
                continue
            nearest = min(near, key=lambda k: (abs(k[0] - depth), k[0]))
            if nearest[1] == "cpt":
                nearest[1] = "both"
    return sorted((tuple(k) for k in kept), key=lambda k: k[0])


def combined_layers(
    cpt_proposal: Proposal, spt_proposals: Mapping[str, Proposal], cpt_points: CPTPoints,
    labs: Mapping[str, Sequence[LabRecord]], *, cpt_site: Site, sites: Mapping[str, Site],
    spt_points: Mapping[str, Sequence[tuple[float, float]]], settings: LayeringSettings,
    gwt: float | None, supplied: Mapping[int, tuple[float, float | None]] | None = None,
) -> Proposal:
    """Merge a CPT proposal and borehole proposals into one common layering proposal.

    ``spt_proposals``, ``labs``, ``sites`` and ``spt_points`` (depth, N60 without refusal) are
    keyed by borehole id in the borehole's own depth frame; ``gwt`` is in the CPT frame.
    """
    warnings = [w for p in (cpt_proposal, *spt_proposals.values()) for w in p.warnings
                if parse_warning(w)[0] in _KEPT_WARNINGS]
    shifts, distances = {}, {}
    for bid in spt_proposals:
        site = sites[bid]
        if cpt_site.elevation is not None and site.elevation is not None:
            shifts[bid] = cpt_site.elevation - site.elevation
        else:
            shifts[bid] = 0.0
            warnings.append(format_warning("layering.warning.depth_not_aligned", borehole=bid))
        if None not in (cpt_site.x, cpt_site.y, site.x, site.y):
            distances[bid] = math.hypot(cpt_site.x - site.x, cpt_site.y - site.y)

    aligned = {bid: [(layer, layer.top + shifts[bid], layer.bottom + shifts[bid])
                     for layer in proposal.layers] for bid, proposal in spt_proposals.items()}
    total = max([cpt_proposal.layers[-1].bottom,
                 *(bottom for rows in aligned.values() for _, _, bottom in rows)])
    boundaries = _boundaries(
        [layer.bottom for layer in cpt_proposal.layers[:-1]],
        [[bottom for _, _, bottom in rows[:-1]] for rows in aligned.values()],
        settings.min_thickness, total)
    edges = [0.0, *(b for b, _ in boundaries), total]
    sources = [None, *(s for _, s in boundaries)]

    lab_records, n60_points = [], []
    for bid in spt_proposals:
        dropped = 0
        for record in labs.get(bid, ()):
            if record.depth + shifts[bid] < 0:
                dropped += 1
            else:
                lab_records.append((bid, record.depth + shifts[bid], record))
        for depth, n in spt_points.get(bid, ()):
            if depth + shifts[bid] < 0:
                dropped += 1
            else:
                n60_points.append((depth + shifts[bid], n))
        if dropped:
            # The borehole starts above the CPT ground surface: those samples have no CPT depth.
            warnings.append(format_warning(
                "layering.warning.points_above_cpt_ground", borehole=bid, count=dropped))
    layers = []
    for i, (top, bottom) in enumerate(zip(edges[:-1], edges[1:])):
        last = i == len(edges) - 2
        in_layer = [record.model_copy(update={"depth": depth}) for _, depth, record in lab_records
                    if _inside(depth, top, bottom, last)]
        symbol = dominant_symbol(in_layer)
        if symbol is None:
            best = 0.0
            for rows in aligned.values():
                for layer, a, b in rows:
                    overlap = min(b, bottom) - max(a, top)
                    if layer.uscs and overlap > best:
                        best, symbol = overlap, layer.uscs
        mask = np.array([_inside(float(d), top, bottom, last) for d in cpt_points.depth], dtype=bool)
        ic_mean = mean(cpt_points.ic[mask]) if mask.any() else None
        n60_mean = mean([n for d, n in n60_points if _inside(d, top, bottom, last)])
        group, soil = cpt_group(ic_mean), uscs_group(symbol)
        conflict = None
        if {group, soil} == {"coarse", "fine"}:
            conflict = {"cpt": group, "uscs": symbol, "ic_mean": ic_mean}
        decisive = group if group in ("coarse", "fine") else soil
        if decisive is None and ic_mean is not None:
            decisive = "coarse" if bool(is_sand_like(ic_mean)) else "fine"
        if cpt_points.floored is not None and mask.any() and cpt_points.floored[mask].any():
            interval_warning(warnings, "gamma_floor", top, bottom, gamma_min=GAMMA_MIN_RC2010)
        if decisive is None:
            warnings.append(format_warning("layering.warning.behaviour_assumed"))
        layers.append(Layer(
            top=top, bottom=bottom, description=symbol or "", uscs=symbol,
            sbtn_zone=int(zone_from_ic(ic_mean)) if ic_mean is not None else None,
            ic_mean=ic_mean, n60_mean=n60_mean, gamma_suggested=None,
            behaviour="drained" if decisive == "coarse" else "undrained",
            top_source=sources[i], conflict=conflict,
        ))

    finite = np.isfinite(cpt_points.gamma) & (cpt_points.gamma > 0)
    suggestions, gamma_warnings = suggest_unit_weights(
        layers, gwt=gwt,
        lab=[(d, r.gamma, r.w, r.Gs) for _, d, r in lab_records],
        cpt_points=[(float(d), float(g)) for d, g in
                    zip(cpt_points.depth[finite], cpt_points.gamma[finite])],
        spt_points=n60_points, supplied=supplied)
    apply_suggestions(layers, suggestions)
    warnings.extend(gamma_warnings)
    if any(layer.gamma_suggested is None for layer in layers):
        warnings.append(format_warning("layering.warning.gamma_unavailable"))
    source_ids = [cpt_proposal.source_id, *spt_proposals]
    return Proposal(cpt_proposal.source_id, settings.model_copy(deep=True), layers,
                    list(dict.fromkeys(warnings)), source_ids=source_ids, distances=distances)


def resolve_behaviour(symbol: str | None, resolution: str, cpt: str | None) -> str:
    """Behaviour after the engineer resolves a conflict: 'uscs' or 'cpt' group decides."""
    group = uscs_group(symbol) if resolution == "uscs" else cpt
    return "drained" if group == "coarse" else "undrained"
