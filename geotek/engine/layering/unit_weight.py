"""Unit-weight (gamma / gamma_sat) suggestions for proposed layers, in priority order.

Every value is an unapproved suggestion with its source recorded; nothing here selects a
design value. Sources, first found wins:

gamma
    1. mean of the laboratory unit weights in the layer (``lab``);
    2. mean of the CPT Robertson & Cabal (2010) estimates above the groundwater table, or of
       all points when the table is unknown (``cpt_rc2010``);
    3. SPT correlation of Bowles (1996, Table 3-4) for granular layers (``spt_bowles``).
gamma_sat
    1. phase relations of the laboratory samples with w and Gs at S = 1: e = w*Gs,
       gamma_sat = (Gs + e)*gamma_w/(1 + e), averaged (``phase``);
    2. mean laboratory unit weight (``lab``);
    3. mean CPT estimate below the groundwater table, else of all points (``cpt_rc2010``);
    4. the same Bowles value as gamma (``spt_bowles``; the moist/saturated distinction is
       not made by the user's source).

User-supplied values replace the suggestion of their layer (source ``user``).

Bowles (SPT, granular layers only, USCS G* or S*): at every SPT point
N'70 = N60 * (60/70) * C_N with C_N = min(sqrt(Pa/sigma'_v), 1.7) (Liao & Whitman 1986, NCEER
cap, reused from the SPT processing). sigma'_v integrates the unit weights of the layers above
(gamma above the groundwater table, gamma_sat - gamma_w below it) and the trial value of the
current layer. The layer N'70 is the mean of its points; the suggestion is the middle of the
Bowles range of the matching classes. The trial value starts at 18.0 kN/m3 and the step is
repeated until it changes by less than 0.01 kN/m3 (at most 50 steps). Layers are processed
top-down; a layer whose upper layers lack a needed unit weight gets no SPT suggestion.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from geotek.core.constants import DEPTH_TOL, GAMMA_W
from geotek.core.warning_codes import format_warning
from geotek.engine.correlations.physical import bowles_gamma_range
from geotek.engine.insitu.spt import overburden_factor_liao_whitman
from geotek.engine.lab.phase import phase_relations
from geotek.engine.layering.common import interval_warning, mean

BOWLES_START_GAMMA = 18.0
"""Starting unit weight [kN/m3] of the Bowles fixed-point iteration (designer-specified)."""
BOWLES_TOLERANCE = 0.01
"""Convergence tolerance [kN/m3] of the iteration."""
BOWLES_MAX_STEPS = 50
N60_TO_N70 = 60.0 / 70.0
"""Energy ratio conversion N'70 = N60 * 60/70."""


@dataclass
class WeightSuggestion:
    gamma: float | None
    gamma_source: str | None
    """``user``, ``lab``, ``phase``, ``cpt_rc2010`` or ``spt_bowles``."""
    gamma_sat: float | None
    gamma_sat_source: str | None
    range: tuple[float, float] | None = None
    """Bowles range [kN/m3] when the source is ``spt_bowles``."""


def _is_granular(symbol: str | None) -> bool:
    return bool(symbol) and symbol.strip().upper()[:1] in ("G", "S")


def _inside(depth: float, top: float, bottom: float, last: bool) -> bool:
    return top <= depth < bottom or (last and depth == bottom)


def _stress(depth, tops, bottoms, gammas, gamma_sats, gwt):
    """Effective vertical stress [kPa] at ``depth``; None when a needed unit weight is missing."""
    total = 0.0
    for top, bottom, gamma, gamma_sat in zip(tops, bottoms, gammas, gamma_sats):
        end = min(bottom, depth)
        if end <= top:
            continue
        dry_end = end if gwt is None else min(end, max(gwt, top))
        wet = end - dry_end
        if dry_end > top:
            if gamma is None:
                return None
            total += gamma * (dry_end - top)
        if wet > 0:
            if gamma_sat is None:
                return None
            total += (gamma_sat - GAMMA_W) * wet
    return total


def _bowles(index, layers, results, points, gwt, start_gamma, start_sat):
    """Fixed-point Bowles suggestion for layer ``index``: (value, range, converged) or None.

    ``start_gamma`` / ``start_sat`` are the already known values of this layer; unknown ones
    follow the trial value.
    """
    tops = [layer.top for layer in layers[:index + 1]]
    bottoms = [layer.bottom for layer in layers[:index + 1]]
    known = [(r.gamma, r.gamma_sat) for r in results]
    value = BOWLES_START_GAMMA
    for _ in range(BOWLES_MAX_STEPS):
        gammas = [g for g, _ in known] + [value if start_gamma is None else start_gamma]
        sats = [s for _, s in known] + [value if start_sat is None else start_sat]
        n70 = []
        for depth, n60 in points:
            sigma = _stress(depth, tops, bottoms, gammas, sats, gwt)
            if sigma is None or sigma < 0:
                continue
            n70.append(n60 * N60_TO_N70 * overburden_factor_liao_whitman(sigma))
        if not n70:
            return None
        low, high = bowles_gamma_range(sum(n70) / len(n70))
        new = (low + high) / 2.0
        if abs(new - value) < BOWLES_TOLERANCE:
            return new, (low, high), True
        value = new
    return value, (low, high), False


def suggest_unit_weights(
    layers: Sequence, *, gwt: float | None,
    lab: Sequence[tuple[float, float | None, float | None, float | None]],
    cpt_points: Sequence[tuple[float, float]],
    spt_points: Sequence[tuple[float, float]],
    supplied: Mapping[int, tuple[float, float | None]] | None = None,
) -> tuple[list[WeightSuggestion], list[str]]:
    """Suggest gamma / gamma_sat per layer (objects with ``top``, ``bottom``, ``uscs``).

    ``lab`` holds (depth, gamma, w [%], Gs) samples, ``cpt_points`` (depth, RC2010 gamma),
    ``spt_points`` (depth, N60; refusal and non-finite values already removed), ``supplied``
    the user's {layer index: (gamma, gamma_sat | None)} and ``gwt`` the groundwater depth in
    metres (None = unknown). Depths are in the layers' frame. Returns one suggestion per layer
    and the warnings (``layering.warning.*`` codes).
    """
    supplied = {} if supplied is None else supplied
    results: list[WeightSuggestion] = []
    warnings: list[str] = []
    for i, layer in enumerate(layers):
        if i in supplied:
            gamma, gamma_sat = supplied[i]
            results.append(WeightSuggestion(
                gamma, "user", gamma_sat, None if gamma_sat is None else "user"))
            continue
        last = i == len(layers) - 1

        def in_layer(depth):
            return _inside(depth, layer.top, layer.bottom, last)

        samples = [s for s in lab if in_layer(s[0])]
        cpt = [(d, g) for d, g in cpt_points if in_layer(d)]
        lab_gamma = mean([s[1] for s in samples if s[1] is not None])
        phase = []
        for _, _, w, gs in samples:
            if w is None or gs is None:
                continue
            try:
                value = phase_relations(w_percent=w, Gs=gs, S=1.0).gamma_sat
            except ValueError:
                continue
            if value is not None:
                phase.append(value)
        above = [g for d, g in cpt if gwt is None or d <= gwt + DEPTH_TOL]
        below = [g for d, g in cpt if gwt is not None and d > gwt + DEPTH_TOL]

        gamma, gamma_source = None, None
        if lab_gamma is not None:
            gamma, gamma_source = lab_gamma, "lab"
        elif above:
            gamma, gamma_source = mean(above), "cpt_rc2010"
        elif cpt:
            # Same disclosed fallback as the CPT layering: all points below the table.
            gamma, gamma_source = mean([g for _, g in cpt]), "cpt_rc2010"
            interval_warning(warnings, "gamma_above_gwt_from_below", layer.top, layer.bottom)

        gamma_sat, sat_source = None, None
        if phase:
            gamma_sat, sat_source = mean(phase), "phase"
        elif lab_gamma is not None:
            gamma_sat, sat_source = lab_gamma, "lab"
        elif cpt:
            gamma_sat, sat_source = mean(below or [g for _, g in cpt]), "cpt_rc2010"

        weights = WeightSuggestion(gamma, gamma_source, gamma_sat, sat_source)
        points = [p for p in spt_points if in_layer(p[0])]
        if (gamma is None or gamma_sat is None) and points:
            if not _is_granular(layer.uscs):
                interval_warning(warnings, "spt_gamma_granular_only", layer.top, layer.bottom)
            else:
                if _fill_bowles(i, layers, results, points, gwt, weights, warnings) and gwt is None:
                    warnings.append(format_warning("layering.warning.gwt_unknown_for_gamma"))
        results.append(weights)
    return results, list(dict.fromkeys(warnings))


def _fill_bowles(i, layers, results, points, gwt, weights, warnings) -> bool:
    """Complete ``weights`` of layer ``i`` from the SPT correlation when the layers above allow it.

    Returns True when a Bowles value was computed.
    """
    layer = layers[i]
    for k, upper in enumerate(layers[:i]):
        has_dry = gwt is None or upper.top < gwt
        has_wet = gwt is not None and upper.bottom > gwt
        if (has_dry and results[k].gamma is None) or (has_wet and results[k].gamma_sat is None):
            interval_warning(warnings, "gamma_above_missing", layer.top, layer.bottom)
            return False
    found = _bowles(i, layers, results, points, gwt, weights.gamma, weights.gamma_sat)
    if found is None:
        return False
    value, bounds, converged = found
    if not converged:
        interval_warning(warnings, "gamma_not_converged", layer.top, layer.bottom)
    if weights.gamma is None:
        weights.gamma, weights.gamma_source = value, "spt_bowles"
    if weights.gamma_sat is None:
        weights.gamma_sat, weights.gamma_sat_source = value, "spt_bowles"
    weights.range = bounds
    return True


def apply_suggestions(layers: Sequence, suggestions: Sequence[WeightSuggestion]) -> None:
    """Write the suggestions onto engine ``Layer`` objects in place."""
    for layer, item in zip(layers, suggestions):
        layer.gamma_suggested, layer.gamma_source = item.gamma, item.gamma_source
        layer.gamma_sat_suggested, layer.gamma_sat_source = item.gamma_sat, item.gamma_sat_source
        layer.gamma_range = item.range
