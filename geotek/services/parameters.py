"""Pure, traceable layer parameter selection and explicit engineer approval.

Refresh changes only candidates/selection bookkeeping. In particular an input-only
change revokes approval without rewriting the engineering content or its hash
(P1 section 1.6); structure staleness remains the profile model's responsibility.

An approval records a *selection basis*: ``<data_hash>.<stress_hash>`` of exactly the inputs
the selected value was computed from. Raw data (qt, N60, lab values) and the stress group
(sigma_v, sigma'_v, gamma_point, ...) are hashed apart, so changing a unit weight does not
withdraw approvals whose value does not depend on stresses.
"""

from __future__ import annotations

import hashlib
import json
import math
import statistics
from collections.abc import Callable, Mapping
from datetime import datetime
from typing import get_args

import numpy as np

from geotek.core.constants import DEPTH_TOL
from geotek.core.errors import LayerDesignError
from geotek.core.models.investigations import LabRecord
from geotek.core.models.parameters import (
    DerivedParameter,
    DesignKey,
    ParameterSelection,
    ParameterStats,
    SelectionMode,
)
from geotek.core.models.profile import SoilLayer, SoilProfile
from geotek.core.models.project import Project
from geotek.engine.classification.uscs import classify_lab_record
from geotek.engine.correlations import registry
from geotek.engine.insitu.cpt import corrected_tip_resistance, process_cpt
from geotek.engine.insitu.spt import equipment_corrections, process_borehole
from geotek.engine.lab.phase import phase_relations
from geotek.engine.layering.common import format_warning

__all__ = (
    "layer_points", "evaluate_candidates", "suggest", "resolve", "approve", "reapprove",
    "basis_hash", "selection_basis", "refresh_profile", "STRESS_FIELDS", "POINT_FILTERS",
    "ReapproveMismatch", "spt_class", "classify_layer", "evaluation_uscs", "layer_lab", "k0_candidates",
    "methods_for", "mean_lab_pi", "approved_phi", "approved_ocr",
)

DELTA_BASE_REFERENCE = (
    "EN 1997-1 6.5.3(10): δd = φ'cv,d (yerinde dökme beton); "
    "TBDY 2018 16.8.4.3, Tablo 16.3: tan δ ≤ 0.6 (yerinde dökme beton – sıkıştırılmış taban zemini)"
)

STRESS_FIELDS = frozenset({
    "sigma_v", "sigma_v_eff", "u0", "C_N", "N1_60", "Qt1", "Qtn", "n", "Ic",
    "Fr", "Bq", "SBTn", "FC", "converged", "gamma_point", "below_gwt", "N1_70",
})
"""Point fields derived from the profile's unit weights and groundwater depth (the 'stress group').

Every other point field is raw data. CPT ``Fr``, ``Bq``, ``Ic``, ``FC`` and ``SBTn`` depend on the
stresses; ``qt``, ``Rf``, ``qc``, ``fs`` and ``u2`` do not."""

_LEGACY_FIELDS = ("gamma_point", "below_gwt", "N1_70")
"""Point fields added after the single-hash basis; removed to reproduce a legacy hash."""

DERIVED_K0 = ("JAKY_K0", "MK1982_K0")
PHASE_GAMMA_SAT = "PHASE_gamma_sat_lab"
LAB_GAMMA_SAT_BELOW_GWT = "lab_gamma_sat_below_gwt"

BOWLES_GAMMA_CLASSES = (
    # (name, N'70 lower bound or None, upper bound or None, gamma low, gamma high) [kN/m3]
    ("very_loose", None, 6.0, 11.0, 16.0),
    ("loose", 3.0, 9.0, 14.0, 18.0),
    ("medium", 7.0, 25.0, 17.0, 20.0),
    ("dense", 16.0, 45.0, 17.0, 22.0),
    ("very_dense", 40.0, None, 20.0, 23.0),
)
"""Bowles (1996) Table 3-4 unit weights of granular soil by N'70 (union of the fine/medium/coarse rows)."""


def _above(inputs: Mapping[str, float]) -> bool:
    return inputs.get("below_gwt") == 0.0


def _below(inputs: Mapping[str, float]) -> bool:
    return inputs.get("below_gwt") == 1.0


POINT_FILTERS: dict[str, Callable[[Mapping[str, float]], bool]] = {
    "RC2010_gamma_sat_CPT": _below,
    "Bowles1996_E_sand_SPT": _above,
    "Bowles1996_E_sand_sat_SPT": _below,
    "Bowles1996_E_sand_sqrt_SPT": _above,
    "Bowles1996_E_sand_lin_SPT": _above,
    "Bowles1996_E_sand_ln_SPT": _above,
    "Bowles1996_E_sand_lin2_SPT": _above,
    "Stroud1974_su_SPT_noPI": lambda inputs: "PI" not in inputs,
}
"""Method id -> predicate on a point's inputs; a point failing it is not used by that method."""


def _unit(key: DesignKey) -> str:
    return {
        "phi_eff": "deg", "c_eff": "kPa", "su": "kPa", "E": "kPa",
        "gamma": "kN/m3", "gamma_sat": "kN/m3", "delta_base": "deg",
        "Dr": "%", "OCR": "-", "K0": "-", "Vs": "m/s", "Gmax": "kPa", "M": "kPa",
    }[key]


def _source_ids(profile: SoilProfile, layer: SoilLayer) -> set[str]:
    # An empty manual profile has no investigation inputs, not all project inputs.
    return set(layer.source_ids or profile.source_ids)


def _layer_lab(project: Project, profile: SoilProfile, layer: SoilLayer) -> list[LabRecord]:
    ids = _source_ids(profile, layer)
    return [
        lab for borehole in project.investigations.boreholes if borehole.id in ids
        for lab in borehole.lab if layer.top <= lab.depth < layer.bottom
    ]


layer_lab = _layer_lab
"""Laboratory records inside a layer (public alias for the inventory and readiness views)."""


def _lab_point(lab: LabRecord) -> dict[str, float]:
    return {key: float(value) for key, value in lab.model_dump().items()
            if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)}


def _is_below(depth: float, profile: SoilProfile) -> bool:
    return depth > profile.gwt.depth_insitu + DEPTH_TOL


def _gamma_point(layer: SoilLayer, below: bool) -> float | None:
    """Unit weight used for the stress at a point: gamma above the in-situ GWT, gamma_sat below."""
    return layer.gamma_sat if below else layer.gamma


def layer_points(
    project: Project, profile: SoilProfile, layer: SoilLayer,
) -> list[dict[str, float]]:
    """Process this layer's sources in ``[top, bottom)`` using the supplied profile.

    Lab samples are independent depth points: no interpolation, nearest-sample
    substitution, or replication of a PI measurement at every SPT depth. Numeric
    raw lab fields are retained too, so changing a measured value changes the basis.
    Soundings are cropped before processing, allowing them to extend below the profile.
    Nonfinite processed inputs are absent rather than available to correlations.

    Every point carries ``below_gwt`` (1.0 below the in-situ groundwater table, else 0.0);
    SPT and CPT points also carry ``gamma_point``, the unit weight their stress used. When the
    profile cannot supply stresses because ``gamma_sat`` is missing below the table
    (``LayerDesignError``), the points keep only their stress-free fields.
    """
    ids = _source_ids(profile, layer)
    known = {b.id for b in project.investigations.boreholes} | {
        c.id for c in project.investigations.cpts
    }
    if missing := ids - known:
        raise KeyError(f"Unknown layer sources: {sorted(missing)}")
    points: list[dict[str, float]] = []
    for borehole in project.investigations.boreholes:
        if borehole.id not in ids:
            continue
        records = [r for r in borehole.spt if layer.top <= r.depth < layer.bottom]
        if not records:
            continue
        subset = borehole.model_copy(update={"spt": records})
        try:
            processed = process_borehole(subset, profile)
        except LayerDesignError:
            processed = None
        if processed is not None:
            columns = {
                "depth": processed.depth, "N": processed.n_field,
                "N60": processed.n60, "N1_60": processed.n1_60,
                "refusal": processed.refusal, "C_R": processed.c_r, "C_N": processed.c_n,
                "sigma_v": processed.sigma_v, "sigma_v_eff": processed.sigma_v_eff,
                "u0": processed.u0,
            }
            c_b, c_s, energy = processed.c_b, processed.c_s, processed.energy_ratio
        else:
            depth, n_field, refusal, c_r, c_b, c_s, energy, n_60, _ = equipment_corrections(subset)
            columns = {"depth": depth, "N": n_field, "N60": n_60, "refusal": refusal, "C_R": c_r}
        for i in range(len(records)):
            point = {name: float(values[i]) for name, values in columns.items()
                     if math.isfinite(values[i])}
            point.update(C_B=float(c_b[i]), C_S=float(c_s[i]), energy_ratio=float(energy[i]))
            below = _is_below(point["depth"], profile)
            point["below_gwt"] = 1.0 if below else 0.0
            if processed is not None:
                if "N1_60" in point:
                    point["N1_70"] = point["N1_60"] * 60.0 / 70.0
                if (gamma := _gamma_point(layer, below)) is not None:
                    point["gamma_point"] = float(gamma)
            points.append(point)
    for sounding in project.investigations.cpts:
        if sounding.id not in ids:
            continue
        indices = [i for i, depth in enumerate(sounding.depth)
                   if layer.top <= depth < layer.bottom and depth >= sounding.predrill_depth]
        if not indices:
            continue
        cropped = {name: [getattr(sounding, name)[i] for i in indices]
                   for name in ("depth", "qc", "fs") if getattr(sounding, name) is not None}
        if sounding.u2 is not None:
            cropped["u2"] = [sounding.u2[i] for i in indices]
        try:
            processed = process_cpt(sounding.model_copy(update=cropped), profile)
        except LayerDesignError:
            processed = None
        if processed is not None:
            columns = {name: getattr(processed, name) for name in (
                "depth", "qc", "qt", "fs", "u2", "u0", "sigma_v", "sigma_v_eff",
                "Rf", "Fr", "Bq", "Qt1", "Qtn", "n", "Ic", "converged",
            )}
            columns.update(FC=processed.fc, SBTn=processed.zone)
        else:
            depth = np.asarray(cropped["depth"], dtype=float)
            qc = np.asarray(cropped["qc"], dtype=float)
            u2 = np.asarray(cropped["u2"], dtype=float) if "u2" in cropped else None
            qt = np.asarray(corrected_tip_resistance(qc, u2, sounding.area_ratio), dtype=float)
            columns = {"depth": depth, "qc": qc, "qt": qt}
            if "fs" in cropped:
                fs = np.asarray(cropped["fs"], dtype=float)
                columns["fs"] = fs
                with np.errstate(divide="ignore", invalid="ignore"):
                    columns["Rf"] = fs / qt * 100.0
            if u2 is not None:
                columns["u2"] = u2
        for i in range(len(indices)):
            point = {name: float(values[i]) for name, values in columns.items()
                     if values is not None and math.isfinite(values[i])}
            point["area_ratio"] = float(sounding.area_ratio)
            below = _is_below(point["depth"], profile)
            point["below_gwt"] = 1.0 if below else 0.0
            if processed is not None and (gamma := _gamma_point(layer, below)) is not None:
                point["gamma_point"] = float(gamma)
            points.append(point)
    for lab in _layer_lab(project, profile, layer):
        point = _lab_point(lab)
        point["below_gwt"] = 1.0 if _is_below(point["depth"], profile) else 0.0
        points.append(point)
    return sorted(points, key=lambda point: (point["depth"], _point_json(point)))


def _spread(values: list[float]) -> ParameterStats:
    return ParameterStats(
        n=len(values), min=min(values), mean=statistics.mean(values), max=max(values),
    )


def _representative(results: list[DerivedParameter]) -> DerivedParameter:
    """Keep one method's trace; any invalid point flags the whole representative."""
    result = results[0].model_copy(deep=True)
    values = [r.value for r in results if math.isfinite(r.value)]
    result.value = statistics.mean(values) if values else math.nan
    result.stats = _spread(values) if values else None
    result.validity_ok = all(r.validity_ok and math.isfinite(r.value) for r in results)
    result.warnings = list(dict.fromkeys(w for r in results for w in r.warnings))
    # Include context (notably Ic) as well as the registry's required inputs/options.
    names = set().union(*(r.inputs_used for r in results))
    result.inputs_used = {
        name: statistics.mean([r.inputs_used[name] for r in results
                               if name in r.inputs_used and math.isfinite(r.inputs_used[name])])
        for name in sorted(names)
        if any(name in r.inputs_used and math.isfinite(r.inputs_used[name]) for r in results)
    }
    return result


def _check_scope(correlation_id: str) -> str | None:
    """Return 'sand' / 'clay' when the registered check is restricted by soil behaviour.

    Probes the existing check with an extreme I_c; the formulae and checks are untouched.
    """
    try:
        check = registry.get(correlation_id).check
    except KeyError:
        return None
    if check is None:
        return None
    for ic, token, scope in ((3.5, "sand-like", "sand"), (1.5, "clay-like", "clay")):
        try:
            if any(token in w for w in check({"Ic": ic}, {})):
                return scope
        except (ArithmeticError, KeyError, ValueError, TypeError):
            continue
    return None


def _apply_layer_context(candidates: list[DerivedParameter], context: str) -> None:
    """Invalidate sand-only (clay-only) correlations on a known clay (sand) layer."""
    for candidate in candidates:
        if _is_lab_measurement(candidate):
            continue
        scope = _check_scope(candidate.method_id)
        if scope is None or scope == context:
            continue
        candidate.validity_ok = False
        candidate.warnings = [*candidate.warnings, format_warning(
            "parameters.warning.layer_behaviour_mismatch",
            method_id=candidate.method_id, scope=scope, layer=context)]


def _strip_derived(point: Mapping[str, float]) -> dict[str, float]:
    return {name: value for name, value in point.items() if name != "below_gwt"}


def _evaluation_points(
    points: list[dict[str, float]], lab: list[LabRecord],
) -> tuple[list[dict[str, float]], list[float | None]]:
    """Points plus lab rows not yet among them, and each lab record's ``below_gwt`` (None = unknown).

    Exact lab rows already emitted by ``layer_points`` are consumed once, not duplicated.
    """
    evaluation_points = list(points)
    unmatched = list(points)
    flags: list[float | None] = []
    for record in lab:
        target = _lab_point(record)
        index = next((i for i, point in enumerate(unmatched) if _strip_derived(point) == target), None)
        if index is None:
            evaluation_points.append(target)
            flags.append(None)
        else:
            flags.append(unmatched.pop(index).get("below_gwt"))
    return evaluation_points, flags


def mean_lab_pi(lab: list[LabRecord]) -> float | None:
    values = [record.PI for record in lab if record.PI is not None and math.isfinite(record.PI)]
    return statistics.mean(values) if values else None


def methods_for(
    key: str, inputs: Mapping[str, float], uscs: str | None, layer_pi: float | None,
) -> list[tuple[registry.Correlation, Mapping[str, float]]]:
    """Registry methods usable at one point, each with the inputs it is evaluated on.

    The layer's mean lab PI is evaluation context only for methods needing both N60 and PI
    (Stroud): it is never copied into the point, so a PI measurement is not replicated at every
    SPT depth for the other PI correlations. Point filters (below/above the water table, PI
    unknown) are applied here.
    """
    context = dict(inputs)
    injected = layer_pi is not None and "PI" not in inputs and "N60" in inputs
    if injected:
        context["PI"] = layer_pi
    result = []
    for correlation in registry.applicable(key, context, uscs=uscs):
        if injected and "PI" in correlation.inputs and "N60" not in correlation.inputs:
            continue
        predicate = POINT_FILTERS.get(correlation.id)
        if predicate is not None and not predicate(context):
            continue
        result.append((correlation, context if "PI" in correlation.inputs else inputs))
    return result


def _phase_candidate(lab: list[LabRecord]) -> DerivedParameter | None:
    """gamma_sat of every sample with gamma, w and Gs: gamma_d = gamma/(1+w), e = Gs gamma_w/gamma_d - 1."""
    values, warnings, used = [], [], {"gamma": [], "w": [], "Gs": []}
    for record in lab:
        if record.gamma is None or record.w is None or record.Gs is None:
            continue
        result = phase_relations(gamma=record.gamma, w_percent=record.w, Gs=record.Gs)
        warnings.extend(result.warnings)
        if result.gamma_sat is None or not math.isfinite(result.gamma_sat):
            continue
        values.append(result.gamma_sat)
        used["gamma"].append(record.gamma)
        used["w"].append(record.w)
        used["Gs"].append(record.Gs)
    if not values:
        return None
    return DerivedParameter(
        value=statistics.mean(values), unit="kN/m3", source="lab", method_id=PHASE_GAMMA_SAT,
        reference="Phase relations: gamma_d = gamma/(1+w), e = Gs*gamma_w/gamma_d - 1, "
                  "gamma_sat = (Gs+e)*gamma_w/(1+e)",
        reliability="A", stats=_spread(values),
        inputs_used={name: statistics.mean(v) for name, v in used.items()},
        warnings=list(dict.fromkeys(warnings)),
    )


def _bowles_gamma_range(n70: float) -> tuple[float, float]:
    """Union of the Bowles (1996) gamma ranges of every N'70 class containing ``n70``."""
    rows = [row for row in BOWLES_GAMMA_CLASSES
            if (row[1] is None or n70 >= row[1]) and (row[2] is None or n70 <= row[2])]
    return min(row[3] for row in rows), max(row[4] for row in rows)


def _warn_gamma_outside_bowles(
    candidates: list[DerivedParameter], points: list[dict[str, float]],
) -> None:
    """Warn (never replace) when a gamma lies outside Bowles' range for the layer's mean N'70."""
    values = [p["N1_70"] for p in points if "N1_70" in p and math.isfinite(p["N1_70"])]
    if not values:
        return
    n70 = statistics.mean(values)
    low, high = _bowles_gamma_range(n70)
    for candidate in candidates:
        if math.isfinite(candidate.value) and not low <= candidate.value <= high:
            candidate.warnings = [*candidate.warnings, format_warning(
                "parameters.warning.gamma_outside_bowles_range",
                gamma=round(candidate.value, 3), n70=round(n70, 3), low=low, high=high)]


def evaluate_candidates(
    points: list[dict[str, float]], key: DesignKey, lab: list[LabRecord],
    layer_context: str | None = None, uscs: str | None = None,
    layer_pi: float | None = None,
) -> list[DerivedParameter]:
    """One mean and depth spread per registry method, plus measured lab values.

    Lab records supplied separately also provide registry inputs (e.g. PI). Exact
    lab rows already emitted by ``layer_points`` are consumed once, not duplicated.
    A PI correlation has source 'lab' but is not a direct lab measurement.
    ``uscs`` is the layer symbol for soil-class-restricted correlations; ``layer_pi`` is the
    layer's mean lab PI used as context by methods needing N60 and PI together.
    """
    unit = _unit(key)
    evaluation_points, below_flags = _evaluation_points(points, lab)
    by_method: dict[str, list[DerivedParameter]] = {}
    for point in evaluation_points:
        base = {name: float(value) for name, value in point.items() if math.isfinite(value)}
        for correlation, inputs in methods_for(key, base, uscs, layer_pi):
            try:
                result = registry.evaluate(correlation.id, inputs)
            except (ArithmeticError, ValueError):
                # Some registered scalar formulae divide before reaching numpy's
                # errstate (e.g. qc / sigma'_v at the ground surface).
                result = DerivedParameter(
                    value=math.nan, unit=correlation.unit, method_id=correlation.id,
                    reference=correlation.reference, source=correlation.source,
                    reliability=correlation.reliability, validity_ok=False,
                    inputs_used=dict(correlation.options),
                    warnings=[format_warning(
                        "parameters.warning.value_not_computable", method_id=correlation.id)],
                )
            result.inputs_used = {**inputs, **result.inputs_used}
            by_method.setdefault(result.method_id, []).append(result)
    candidates = [_representative(by_method[method]) for method in sorted(by_method)]
    if key == "gamma_sat":
        if (phase := _phase_candidate(lab)) is not None:
            candidates.append(phase)
        below = [float(record.gamma) for record, flag in zip(lab, below_flags)
                 if flag == 1.0 and record.gamma is not None and math.isfinite(record.gamma)]
        if below:
            candidates.append(DerivedParameter(
                value=statistics.mean(below), unit=unit, source="lab",
                method_id=LAB_GAMMA_SAT_BELOW_GWT, reliability="B", stats=_spread(below),
                reference="Laboratory measurement of the unit weight below the groundwater table "
                          "(assumed saturated)",
                warnings=[format_warning("parameters.warning.gamma_below_gwt_assumed_saturated")],
            ))
    else:
        measured = [float(value) for record, flag in zip(lab, below_flags)
                    if (key != "gamma" or flag != 1.0)
                    and (value := getattr(record, key, None)) is not None and math.isfinite(value)]
        if measured:
            candidates.append(DerivedParameter(
                value=statistics.mean(measured), unit=unit, source="lab", method_id=f"lab_{key}",
                reference="Laboratory measurement", stats=_spread(measured),
            ))
    if key == "gamma" and layer_context == "sand":
        _warn_gamma_outside_bowles(candidates, points)
    if layer_context in ("clay", "sand"):
        _apply_layer_context(candidates, layer_context)
    return candidates


def _is_lab_measurement(candidate: DerivedParameter) -> bool:
    if candidate.source != "lab":
        return False
    try:
        registry.get(candidate.method_id)
    except KeyError:
        return True
    return False


def _measurement_rank(candidate: DerivedParameter) -> int:
    """Phase-relation gamma_sat first, then lab gamma below the table, then any other measurement."""
    return {PHASE_GAMMA_SAT: 0, LAB_GAMMA_SAT_BELOW_GWT: 1}.get(candidate.method_id, 2)


def _approved_design(layer: SoilLayer, key: str) -> float | None:
    """The design value of ``key`` only while its selection is approved; never a mere proposal."""
    selection = layer.selections.get(key)
    if selection is None or not selection.approved:
        return None
    value = getattr(layer.design, key)
    return value if value is not None and math.isfinite(value) else None


def _phi_source(layer: SoilLayer) -> float | None:
    """The approved design phi' (delta_base and K0 derive from it); None when not approved."""
    return _approved_design(layer, "phi_eff")


def approved_phi(layer: SoilLayer) -> float | None:
    """Public alias of the approved-phi' reader."""
    return _phi_source(layer)


def approved_ocr(layer: SoilLayer) -> float | None:
    """Public alias of the approved-OCR reader."""
    return _ocr_source(layer)


def _ocr_source(layer: SoilLayer) -> float | None:
    """The approved design OCR (Mayne & Kulhawy K0); None when not approved."""
    return _approved_design(layer, "OCR")


def k0_candidates(layer: SoilLayer) -> list[DerivedParameter]:
    """Jaky (NC) and, with an approved OCR, Mayne & Kulhawy K0 from the layer's phi' source.

    Derived like delta_base, outside the registry: K0 = 1 - sin(phi'); K0 = (1 - sin(phi')) OCR^sin(phi').
    Only an approved phi' (and approved OCR for Mayne & Kulhawy) is used; otherwise no candidate.
    A value above the model bound (UPPER_BOUNDS) is flagged invalid.
    """
    phi = _phi_source(layer)
    if phi is None:
        return []
    sin_phi = math.sin(math.radians(phi))
    out = []
    specs = [("JAKY_K0", 1.0 - sin_phi, {"phi_eff": phi},
              "Jaky (1944): K0 = 1 - sin(phi') (normally consolidated)")]
    ocr = _ocr_source(layer)
    if ocr is not None:
        specs.append(("MK1982_K0", (1.0 - sin_phi) * ocr ** sin_phi, {"phi_eff": phi, "OCR": ocr},
                      "Mayne & Kulhawy (1982): K0 = (1 - sin(phi')) OCR^sin(phi')"))
    bound = registry.UPPER_BOUNDS["K0"]
    for method_id, value, used, reference in specs:
        invalid = not math.isfinite(value) or value > bound or value < 0
        out.append(DerivedParameter(
            value=value, unit="-", method_id=method_id, source="combined", reference=reference,
            reliability="B", inputs_used=used, validity_ok=not invalid,
            warnings=[f"K0 = {value:.4g} outside 0-{bound:g}; result marked invalid"] if invalid else [],
        ))
    return out


def suggest(
    candidates: list[DerivedParameter], key: DesignKey, layer: SoilLayer,
) -> DerivedParameter | None:
    """Prefer measurements, otherwise combine valid registry candidates only."""
    _unit(key)
    valid = [c for c in candidates if c.validity_ok and math.isfinite(c.value)]
    measured = sorted((c for c in valid if _is_lab_measurement(c)), key=_measurement_rank)
    if measured:
        return measured[0].model_copy(deep=True)
    registry_valid = [c for c in valid if c.method_id not in DERIVED_K0]
    if registry_valid:
        return registry.combine(registry_valid)
    if key == "K0":
        # Derived values only when no registry method applies: Mayne & Kulhawy before Jaky.
        for method_id in ("MK1982_K0", "JAKY_K0"):
            derived = next((c for c in valid if c.method_id == method_id), None)
            if derived is not None:
                return derived.model_copy(deep=True)
    if key == "c_eff":
        ic = layer.params.get("Ic")
        granular = bool(layer.uscs and layer.uscs.strip().upper().startswith(("G", "S")))
        granular = granular or bool(ic is not None and math.isfinite(ic.value) and ic.value < 2.6)
        if granular:
            return DerivedParameter(
                value=0.0, unit="kPa", method_id="FHWA_GEC5_c_eff", source="combined",
                reference="FHWA GEC-5: granüler zeminde c' = 0",
                inputs_used={"Ic": ic.value} if ic is not None and math.isfinite(ic.value) else {},
            )
    if key == "delta_base":
        phi = _phi_source(layer)
        if phi is not None:
            # EN 1997-1 6.5.3(10) takes delta_d = phi'_cv,d for cast in-situ concrete; the model
            # has no phi'_cv, so phi' stands in for it (unconservative when phi' is a peak value)
            # and the suggestion carries a warning. TBDY 2018 16.8.4.3 caps tan(delta) at 0.6.
            return DerivedParameter(
                value=math.degrees(math.atan(min(math.tan(math.radians(phi)), 0.6))),
                unit="deg", method_id="TBDY2018_delta_base", source="combined",
                reference=DELTA_BASE_REFERENCE,
                inputs_used={"phi_eff": phi},
                warnings=[format_warning(
                    "parameters.warning.phi_cv_assumed_equal_phi_eff", phi_eff=phi)],
            )
    return None


def resolve(selection: ParameterSelection) -> ParameterSelection:
    """Resolve an explicit choice, revoking any previous approval on the copy.

    Statistics use valid finite candidate representatives, with population standard
    deviation (ddof=0). No mode means no engineer choice and raises ValueError.
    """
    result = selection.model_copy(deep=True)
    unit = _unit(selection.parameter)
    if selection.mode == "manual":
        if selection.manual_value is None or not math.isfinite(selection.manual_value):
            raise ValueError("Manual selection needs a finite manual_value")
        selected = DerivedParameter(
            value=selection.manual_value, unit=unit, method_id="user", source="user",
            reference="User-entered value", user_override=True,
        )
    elif selection.mode == "correlation":
        pool = list(selection.candidates)
        if selection.suggested is not None:
            pool.append(selection.suggested)
        selected = next((c for c in pool if c.method_id == selection.method_id), None)
        if selected is None:
            raise ValueError(f"Chosen method {selection.method_id!r} is unavailable")
        selected = selected.model_copy(deep=True)
    elif selection.mode == "statistic":
        pool = [c for c in selection.candidates if c.validity_ok and math.isfinite(c.value)]
        if not pool:
            raise ValueError("Statistic selection needs valid candidates")
        if any(c.unit != unit for c in pool):
            raise ValueError("Candidate units do not match the selected parameter")
        values = [c.value for c in pool]
        match selection.statistic:
            case "mean":
                value = statistics.mean(values)
            case "median":
                value = statistics.median(values)
            case "min":
                value = min(values)
            case "max":
                value = max(values)
            case "mean_minus_k_sd":
                if selection.k_sd is None:
                    raise ValueError("mean_minus_k_sd needs a user-entered k_sd")
                # Population SD across method candidates, not sample/depth-point SD.
                value = statistics.mean(values) - selection.k_sd * statistics.pstdev(values)
            case _:
                raise ValueError("Statistic selection needs a statistic")
        selected = DerivedParameter(
            value=value, unit=unit, method_id=f"statistic:{selection.statistic}",
            source="combined", reference="; ".join(c.reference for c in pool),
            inputs_used={"k_sd": selection.k_sd} if selection.k_sd is not None else {},
            stats=_spread(values),
            # A < B < C: max intentionally keeps the least reliable grade (conservative).
            reliability=max((c.reliability for c in pool if c.reliability), default=None),
            based_on=[c.method_id for c in pool],
        )
    else:
        raise ValueError("Selection needs an explicit mode")
    if not math.isfinite(selected.value) or selected.unit != unit:
        raise ValueError("Selected value must be finite and have the parameter's unit")
    result.selected = selected
    result.approved = False
    result.approved_at = None
    result.basis_hash = None
    result.stale_reason = None
    result.refreshed = None
    return result


# --- selection basis -------------------------------------------------------------------------


def _digest(obj: object) -> str:
    data = json.dumps(obj, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return hashlib.sha256(data.encode("utf-8")).hexdigest()[:32]


def _canonical(values: Mapping[str, float]) -> str:
    return _point_json(dict(values))


def _method_ids(selected: DerivedParameter) -> list[str]:
    """Pool of a combined (``mean(a,b)``) or statistic value."""
    if selected.based_on:
        return sorted(dict.fromkeys(selected.based_on))
    method = selected.method_id
    if method.startswith("mean(") and method.endswith(")"):
        return sorted(dict.fromkeys(part for part in method[5:-1].split(",") if part))
    raise ValueError(f"Combined value {method!r} does not list the methods it is based on")


def _lab_samples(
    method_id: str, lab: list[LabRecord], flags: list[float | None],
) -> list[list[float]]:
    """Measured values a laboratory candidate is built from, in sorted order."""
    if method_id == PHASE_GAMMA_SAT:
        rows = [[r.depth, r.gamma, r.w, r.Gs] for r in lab
                if r.gamma is not None and r.w is not None and r.Gs is not None]
    elif method_id == LAB_GAMMA_SAT_BELOW_GWT:
        rows = [[r.depth, r.gamma] for r, flag in zip(lab, flags)
                if flag == 1.0 and r.gamma is not None]
    else:
        attribute = method_id[len("lab_"):]
        if attribute not in LabRecord.model_fields:
            raise ValueError(f"Unknown laboratory method {method_id!r}")
        rows = [[r.depth, getattr(r, attribute)] for r, flag in zip(lab, flags)
                if getattr(r, attribute) is not None and (attribute != "gamma" or flag != 1.0)]
    return sorted([float(v) for v in row] for row in rows)


def _method_parts(
    layer: SoilLayer, key: DesignKey, method_id: str, evaluation_points: list[dict[str, float]],
    lab: list[LabRecord], flags: list[float | None], uscs: str | None, layer_pi: float | None,
) -> tuple[object, object]:
    """(data part, stress part) of one method's dependence on the layer's points."""
    if method_id == "FHWA_GEC5_c_eff":
        return {"rule": "granular"}, {}
    if method_id in DERIVED_K0:
        used = {"phi_eff": _phi_source(layer)}
        if method_id == "MK1982_K0":
            used["OCR"] = _ocr_source(layer)
        return {name: value for name, value in used.items() if value is not None}, {}
    if method_id == "TBDY2018_delta_base":
        phi = _phi_source(layer)
        return ({} if phi is None else {"phi_eff": phi}), {}
    if method_id == PHASE_GAMMA_SAT or method_id.startswith("lab_"):
        return {"samples": _lab_samples(method_id, lab, flags)}, {}
    try:
        correlation = registry.get(method_id)
    except KeyError:
        raise ValueError(f"Unknown parameter method {method_id!r}") from None
    data, stress = [], []
    for point in evaluation_points:
        base = {name: float(value) for name, value in point.items() if math.isfinite(value)}
        for candidate, inputs in methods_for(key, base, uscs, layer_pi):
            if candidate.id != correlation.id:
                continue
            data.append(_canonical({n: inputs[n] for n in correlation.inputs if n not in STRESS_FIELDS}))
            stress.append(_canonical({n: inputs[n] for n in correlation.inputs if n in STRESS_FIELDS}))
    return ({"points": sorted(data), "options": dict(sorted(correlation.options.items()))},
            {"points": sorted(stress)})


def selection_basis(
    layer: SoilLayer, key: DesignKey, selected: DerivedParameter, mode: SelectionMode,
    points: list[dict[str, float]], lab: list[LabRecord],
) -> str:
    """'<data_hash>.<stress_hash>' of exactly what the selected value depends on.

    The data part holds the layer bounds and the raw inputs of the selected method; the stress
    part holds its stress-group inputs (``STRESS_FIELDS``). A manual value depends on neither
    (except delta_base and K0, which depend on phi'/OCR). A combined or statistic value hashes
    the parts of every method it is based on. An unknown method raises ``ValueError``.
    """
    method = selected.method_id
    used = selected.inputs_used
    if key == "delta_base" or method == "TBDY2018_delta_base":
        data: object = {"phi_eff": used["phi_eff"]} if "phi_eff" in used else {}
        stress: object = {}
    elif method in DERIVED_K0 or (key == "K0" and mode == "manual"):
        data = {name: used[name] for name in ("phi_eff", "OCR") if name in used}
        stress = {}
    elif mode == "manual":
        data, stress = {}, {}
    elif method == "FHWA_GEC5_c_eff":
        data, stress = {"rule": "granular"}, {}
    else:
        evaluation_points, flags = _evaluation_points(points, lab)
        uscs, layer_pi = _evaluation_context(layer, points, lab)
        if method.startswith(("statistic:", "mean(")):
            parts = [_method_parts(layer, key, member, evaluation_points, lab, flags, uscs, layer_pi)
                     for member in _method_ids(selected)]
            data, stress = [part[0] for part in parts], [part[1] for part in parts]
        else:
            data, stress = _method_parts(
                layer, key, method, evaluation_points, lab, flags, uscs, layer_pi)
    bounds = {"top": float(layer.top), "bottom": float(layer.bottom)}
    return f"{_digest({**bounds, 'data': data})}.{_digest(stress)}"


def _evaluation_context(
    layer: SoilLayer, points: list[dict[str, float]], lab: list[LabRecord],
) -> tuple[str | None, float | None]:
    """Layer USCS symbol (stored, else the temporary lab one) and mean lab PI for evaluation."""
    return evaluation_uscs(layer, lab), mean_lab_pi(lab)


def evaluation_uscs(layer: SoilLayer, lab: list[LabRecord]) -> str | None:
    """USCS symbol used to select soil-class-restricted correlations.

    The stored layer symbol wins; otherwise the most common lab symbol of the layer (a tie goes
    to the symbol met first in depth order). It is an evaluation input only: it is never written
    back to the layer and does not feed the c' = 0 rule of granular layers.
    """
    if layer.uscs and layer.uscs.strip():
        return layer.uscs
    ordered = sorted(lab, key=lambda record: record.depth)
    symbols = [classification.symbol for record in ordered
               if (classification := classify_lab_record(record)).symbol is not None]
    if not symbols:
        return None
    counts = {symbol: symbols.count(symbol) for symbol in symbols}
    best = max(counts.values())
    return next(symbol for symbol in symbols if counts[symbol] == best)


def _classify_layer(
    layer: SoilLayer, points: list[dict[str, float]], lab: list[LabRecord],
) -> tuple[SoilLayer, str | None, bool]:
    """Evaluation context copy of the layer (Ic evidence, temporary USCS), behaviour class, fine flag."""
    context = layer.model_copy(deep=True)
    ic_values = [p["Ic"] for p in points if "Ic" in p]
    if ic_values:
        # Existing CPT processing supplies Ic; this is evidence for the c'=0
        # rule, not an additional correlation or design parameter suggestion.
        context.params["Ic"] = DerivedParameter(
            value=statistics.mean(ic_values), unit="-", method_id="CPT_Ic", source="CPT",
            reference="Robertson (2009): processed soil behaviour index",
            stats=_spread(ic_values),
        )
    elif context.params.get("Ic") is not None and context.params["Ic"].method_id == "CPT_Ic":
        context.params.pop("Ic")
    symbols = [classification.symbol for record in lab
               if (classification := classify_lab_record(record)).symbol is not None]
    # ASTM D2487: FC >= 50% is fine-grained even without LL/PI and a symbol.
    fine_grained = any(record.FC is not None and record.FC >= 50 for record in lab)
    fine_grained = fine_grained or any(
        symbol and not symbol.strip().upper().startswith(("G", "S"))
        for symbol in [*symbols, context.uscs]
    )
    if context.uscs is None and not fine_grained:
        if symbols and all(symbol.startswith(("G", "S")) for symbol in symbols):
            # Temporary classification only: refreshing must not alter uscs/hash.
            context.uscs = symbols[0]
    layer_context: str | None = None
    if layer.behaviour == "undrained" or fine_grained:
        layer_context = "clay"
    elif context.uscs and context.uscs.strip().upper().startswith(("G", "S")):
        layer_context = "sand"
    return context, layer_context, fine_grained


classify_layer = _classify_layer


def _dependency_changed(layer: SoilLayer, key: str, selection: ParameterSelection) -> bool:
    """True when the phi'/OCR a delta_base / K0 value was derived from no longer matches the layer."""
    selected = selection.selected
    if selected is None or key not in ("delta_base", "K0"):
        return False
    used = selected.inputs_used
    strict = key == "delta_base" or selected.method_id in DERIVED_K0
    # A basis that is gone (None / unapproved) counts as changed, not only a different value.
    if ("phi_eff" in used or strict) and used.get("phi_eff") != _phi_source(layer):
        return True
    if ("OCR" in used or selected.method_id == "MK1982_K0") and used.get("OCR") != _ocr_source(layer):
        return True
    return False


def _revoke_dependents(layer: SoilLayer) -> None:
    """Withdraw approved delta_base / K0 values whose phi'/OCR basis changed; trace is kept."""
    for key in ("delta_base", "K0"):
        selection = layer.selections.get(key)
        if selection is not None and selection.approved and _dependency_changed(layer, key, selection):
            selection.approved = False
            selection.stale_reason = "dependency_changed"


def approve(
    layer: SoilLayer, keys: list[DesignKey], points: list[dict[str, float]],
    lab: list[LabRecord], now: datetime,
) -> SoilLayer:
    """Atomically resolve/approve requested choices and validate the resulting layer.

    Each key records its own selection basis (``selection_basis``), computed from the resolved
    value and the layer's current points and lab records.
    """
    data = layer.model_dump()
    # Resolve phi (and OCR) first so a joint approval has the same basis in either key order.
    order = {"phi_eff": 0, "OCR": 1}
    for key in sorted(dict.fromkeys(keys), key=lambda key: order.get(key, 2)):
        selection = resolve(layer.selections[key])
        if key == "delta_base":
            context = SoilLayer.model_validate(data)
            proposal = suggest([], "delta_base", context)
            if selection.selected.method_id == "TBDY2018_delta_base":
                if proposal is None:
                    raise ValueError("Delta approval needs a finite phi_eff basis")
                selection.selected = proposal
                selection.suggested = proposal.model_copy(deep=True)
            if proposal is not None:
                # Manual delta approvals also depend on the phi available at approval.
                selection.selected.inputs_used["phi_eff"] = proposal.inputs_used["phi_eff"]
        elif key == "K0":
            context = SoilLayer.model_validate(data)
            derived = {c.method_id: c for c in k0_candidates(context)}
            method = selection.selected.method_id
            if method in DERIVED_K0:
                if method not in derived:
                    raise ValueError("K0 approval needs a finite phi_eff basis"
                                     + (" and an approved OCR" if method == "MK1982_K0" else ""))
                selection.selected = derived[method].model_copy(deep=True)
                if not selection.selected.validity_ok:
                    raise ValueError("Derived K0 is outside the accepted range")
            elif selection.mode == "manual":
                # Manual K0 approvals also depend on the phi'/OCR available at approval.
                if (phi := _phi_source(context)) is not None:
                    selection.selected.inputs_used["phi_eff"] = phi
                if (ocr := _ocr_source(context)) is not None:
                    selection.selected.inputs_used["OCR"] = ocr
        selection.approved = True
        selection.approved_at = now
        selection.basis_hash = selection_basis(
            layer, key, selection.selected, selection.mode, points, lab)
        selection.stale_reason = None
        selection.refreshed = None
        data["selections"][key] = selection.model_dump()
        if key in ("gamma", "gamma_sat"):
            data[key] = selection.selected.value
        else:
            data["design"][key] = selection.selected.value
    # model_copy(update=...) alone would bypass the engineering range validators.
    approved = SoilLayer.model_validate(data)
    _revoke_dependents(approved)
    return approved


def _point_json(point: dict[str, float]) -> str:
    # Canonical float representation also handles explicitly supplied NaN/Inf.
    values = {key: float(value) if math.isfinite(value) else str(float(value))
              for key, value in point.items()}
    return json.dumps(values, sort_keys=True, separators=(",", ":"), allow_nan=False)


def basis_hash(layer: SoilLayer, points: list[dict[str, float]]) -> str:
    """Legacy whole-layer basis: SHA-256 of bounds and the input multiset.

    Kept only to recognise approvals stored before ``selection_basis`` existed.
    """
    data = json.dumps(
        {"top": float(layer.top), "bottom": float(layer.bottom),
         "points": sorted(_point_json(point) for point in points)},
        sort_keys=True, separators=(",", ":"), allow_nan=False,
    )
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def _legacy_points(points: list[dict[str, float]]) -> list[dict[str, float]]:
    return [{name: value for name, value in point.items() if name not in _LEGACY_FIELDS}
            for point in points]


def _derives_from_layer(key: str, selection: ParameterSelection) -> bool:
    """delta_base and phi'/OCR-derived K0 (derived or manual) depend on other approved values."""
    method = selection.selected.method_id
    return key == "delta_base" or method in DERIVED_K0 or (key == "K0" and selection.mode == "manual")


def _stale_reason(
    layer: SoilLayer, key: str, selection: ParameterSelection, points: list[dict[str, float]],
    lab: list[LabRecord],
) -> tuple[str | None, str | None]:
    """(stale reason, current basis) of a selection that carries a stored basis.

    The reason is None while the stored basis still describes the current inputs. A legacy
    single-part basis is recognised against the old whole-layer hash: equal means the data did not
    change since approval (the basis is then rewritten in the new form by the caller).
    """
    stored = selection.basis_hash
    derived = _derives_from_layer(key, selection)
    if derived and _dependency_changed(layer, key, selection):
        return "dependency_changed", None
    try:
        current = selection_basis(layer, key, selection.selected, selection.mode, points, lab)
    except ValueError:
        return "method_upgraded", None
    if "." not in stored:
        if basis_hash(layer, _legacy_points(points)) != stored:
            return "method_upgraded", current
        return None, current
    if stored == current:
        return None, current
    if derived:
        return "dependency_changed", current
    stored_data, _ = stored.split(".", 1)
    data, _ = current.split(".", 1)
    return ("data_changed" if stored_data != data else "stress_changed"), current


def _reresolved(selection: ParameterSelection) -> DerivedParameter | None:
    """The selection's mode/method re-resolved from its (already current) candidates."""
    try:
        return resolve(selection.model_copy(deep=False)).selected
    except ValueError:
        return None


def _refresh_approval(
    layer: SoilLayer, key: str, selection: ParameterSelection, points: list[dict[str, float]],
    lab: list[LabRecord],
) -> None:
    """Keep, migrate or withdraw an approval; always recompute reason/refreshed for the display."""
    selection.stale_reason = None
    selection.refreshed = None
    if selection.basis_hash is None or selection.selected is None:
        return
    reason, current = _stale_reason(layer, key, selection, points, lab)
    if reason is None:
        if selection.approved and "." not in selection.basis_hash:
            selection.basis_hash = current
        return
    selection.approved = False
    selection.stale_reason = reason
    selection.refreshed = _reresolved(selection)


def refresh_profile(project: Project, profile_id: str) -> SoilProfile:
    """Return refreshed candidates and suggestions without modifying project/design.

    Stale selections retain selected/approved_at/basis_hash as the previous approval
    trace, with approved=False, a ``stale_reason`` and the ``refreshed`` value (same
    mode/method, current inputs). Approval requires an equal selection basis; delta_base and
    K0 additionally require the phi'/OCR they were derived from.
    """
    profile = project.profile(profile_id)
    refreshed = profile.model_copy(deep=True)
    for layer in refreshed.layers:
        points = layer_points(project, profile, layer)
        lab = _layer_lab(project, profile, layer)
        context, layer_context, fine_grained = _classify_layer(layer, points, lab)
        layer_pi = mean_lab_pi(lab)
        eval_uscs = evaluation_uscs(layer, lab)
        for key in get_args(DesignKey):
            selection = layer.selections.get(key, ParameterSelection(parameter=key))
            selection.candidates = evaluate_candidates(
                points, key, lab, layer_context, eval_uscs, layer_pi)
            if key == "K0":
                selection.candidates.extend(k0_candidates(context))
            selection.suggested = suggest(selection.candidates, key, context)
            if (fine_grained and key == "c_eff" and selection.suggested is not None
                    and selection.suggested.method_id == "FHWA_GEC5_c_eff"):
                # Contrary lab evidence vetoes the granular default, not measurements.
                selection.suggested = None
            layer.selections[key] = selection
            context.selections[key] = selection
            if selection.suggested is not None:
                context.params[key] = selection.suggested.model_copy(deep=True)
            else:
                context.params.pop(key, None)
            # Dependencies (phi', OCR) are read from the layer as stored; the proposals above
            # are already current because phi_eff and OCR precede delta_base and K0.
            _refresh_approval(_dependency_view(layer, context), key, selection, points, lab)
        layer.params = context.params
    return refreshed


def _dependency_view(layer: SoilLayer, context: SoilLayer) -> SoilLayer:
    """The stored layer with the evaluation context's current phi'/OCR proposals attached."""
    view = layer.model_copy(update={"selections": context.selections, "params": context.params})
    return view


# --- bulk re-approval ------------------------------------------------------------------------


class ReapproveMismatch(ValueError):
    """The value the caller saw is not the value a re-approval would now produce."""

    def __init__(self, layer_id: str, key: str):
        super().__init__(f"Layer {layer_id!r}, {key}: the refreshed value differs from the expected one")
        self.layer_id = layer_id
        self.key = key


def reapprove(
    project: Project, profile_id: str, items: list[tuple[str, DesignKey, float]], now: datetime,
) -> SoilProfile:
    """Approve exactly the listed withdrawn selections again, with their refreshed values.

    ``items`` are ``(layer_id, key, expected_value)``. Each item must have a ``refreshed`` value
    equal to ``expected_value`` (a selection that is already approved and current is accepted
    when its value equals it); otherwise ``ReapproveMismatch``. Nothing else is approved. The
    selections are resolved from current candidates in the same mode/method and approved per layer.
    """
    profile = project.profile(profile_id)
    refreshed = refresh_profile(project, profile_id)
    by_layer: dict[str, list[DesignKey]] = {}
    for layer_id, key, expected in items:
        layer = next((l for l in refreshed.layers if l.id == layer_id), None)
        if layer is None:
            raise KeyError(f"Unknown layer {layer_id!r}")
        selection = layer.selections[key]
        if selection.refreshed is not None:
            current = selection.refreshed.value
        elif selection.approved and selection.selected is not None:
            # Already approved and current: idempotent when the value is the expected one.
            if not math.isclose(selection.selected.value, expected, rel_tol=1e-9, abs_tol=1e-12):
                raise ReapproveMismatch(layer_id, key)
            continue
        else:
            raise ReapproveMismatch(layer_id, key)
        if not math.isclose(current, expected, rel_tol=1e-9, abs_tol=1e-12):
            raise ReapproveMismatch(layer_id, key)
        by_layer.setdefault(layer_id, []).append(key)
    layers = {layer.id: layer for layer in refreshed.layers}
    stored = {layer.id: layer for layer in profile.layers}
    for layer_id, keys in by_layer.items():
        points = layer_points(project, profile, stored[layer_id])
        lab = _layer_lab(project, profile, stored[layer_id])
        layers[layer_id] = approve(layers[layer_id], keys, points, lab, now)
    return refreshed.model_copy(update={"layers": [layers[layer.id] for layer in refreshed.layers]})


# --- information -----------------------------------------------------------------------------

_SPT_CLASSES = {
    "sand": (("very_loose", 0.0), ("loose", 3.0), ("medium_dense", 8.0), ("dense", 25.0),
             ("very_dense", 42.0)),
    "clay": (("very_soft", 0.0), ("soft", 4.0), ("firm", 8.0), ("stiff", 15.0),
             ("very_stiff", 30.0), ("hard", 60.0)),
}
"""Clayton (1993), Erol & Çekinmez (2014) Table 1.7: lower bound of each class; a boundary value
belongs to the upper class. Sand uses the mean (N1)60, clay the mean N60. Information only."""


def spt_class(layer_context: str | None, points: list[dict[str, float]]) -> str | None:
    """'<sand|clay>.<class>' of the layer's mean SPT value, or None without data or soil class."""
    if layer_context not in _SPT_CLASSES:
        return None
    name = "N1_60" if layer_context == "sand" else "N60"
    values = [p[name] for p in points if name in p and "N" in p and math.isfinite(p[name])]
    if not values:
        return None
    mean = statistics.mean(values)
    chosen = [label for label, low in _SPT_CLASSES[layer_context] if mean >= low]
    return f"{layer_context}.{chosen[-1]}" if chosen else None
