"""Pure, traceable layer parameter selection and explicit engineer approval.

Refresh changes only candidates/selection bookkeeping. In particular an input-only
change revokes approval without rewriting the engineering content or its hash
(P1 section 1.6); structure staleness remains the profile model's responsibility.
"""

from __future__ import annotations

import hashlib
import json
import math
import statistics
from datetime import datetime
from typing import get_args

from geotek.core.models.investigations import LabRecord
from geotek.core.models.parameters import (
    DerivedParameter,
    DesignKey,
    ParameterSelection,
    ParameterStats,
)
from geotek.core.models.profile import SoilLayer, SoilProfile
from geotek.core.models.project import Project
from geotek.engine.classification.uscs import classify_lab_record
from geotek.engine.correlations import registry
from geotek.engine.insitu.cpt import process_cpt
from geotek.engine.insitu.spt import process_borehole

__all__ = (
    "layer_points", "evaluate_candidates", "suggest", "resolve", "approve",
    "basis_hash", "refresh_profile",
)

DELTA_BASE_REFERENCE = (
    "EN 1997-1 6.5.3(10): δd = φ'cv,d (yerinde dökme beton); "
    "TBDY 2018 16.8.4.3, Tablo 16.3: tan δ ≤ 0.6 (yerinde dökme beton – sıkıştırılmış taban zemini)"
)


def _unit(key: DesignKey) -> str:
    return {
        "phi_eff": "deg", "c_eff": "kPa", "su": "kPa", "E": "kPa",
        "gamma": "kN/m3", "gamma_sat": "kN/m3", "delta_base": "deg",
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


def _lab_point(lab: LabRecord) -> dict[str, float]:
    return {key: float(value) for key, value in lab.model_dump().items()
            if value is not None and math.isfinite(value)}


def layer_points(
    project: Project, profile: SoilProfile, layer: SoilLayer,
) -> list[dict[str, float]]:
    """Process this layer's sources in ``[top, bottom)`` using the supplied profile.

    Lab samples are independent depth points: no interpolation, nearest-sample
    substitution, or replication of a PI measurement at every SPT depth. Numeric
    raw lab fields are retained too, so changing a measured value changes the basis.
    Soundings are cropped before processing, allowing them to extend below the profile.
    Nonfinite processed inputs are absent rather than available to correlations.
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
        processed = process_borehole(borehole.model_copy(update={"spt": records}), profile)
        columns = {
            "depth": processed.depth, "N": processed.n_field,
            "N60": processed.n60, "N1_60": processed.n1_60,
            "refusal": processed.refusal, "C_R": processed.c_r, "C_N": processed.c_n,
            "sigma_v": processed.sigma_v, "sigma_v_eff": processed.sigma_v_eff,
            "u0": processed.u0,
        }
        for i in range(len(records)):
            point = {name: float(values[i]) for name, values in columns.items()
                     if math.isfinite(values[i])}
            point.update(C_B=float(processed.c_b), C_S=float(processed.c_s),
                         energy_ratio=float(borehole.energy_ratio))
            points.append(point)
    for sounding in project.investigations.cpts:
        if sounding.id not in ids:
            continue
        indices = [i for i, depth in enumerate(sounding.depth)
                   if layer.top <= depth < layer.bottom]
        if not indices:
            continue
        cropped = {name: [getattr(sounding, name)[i] for i in indices]
                   for name in ("depth", "qc", "fs")}
        if sounding.u2 is not None:
            cropped["u2"] = [sounding.u2[i] for i in indices]
        processed = process_cpt(sounding.model_copy(update=cropped), profile)
        columns = {name: getattr(processed, name) for name in (
            "depth", "qc", "qt", "fs", "u2", "u0", "sigma_v", "sigma_v_eff",
            "Rf", "Fr", "Bq", "Qt1", "Qtn", "n", "Ic", "converged",
        )}
        columns.update(FC=processed.fc, SBTn=processed.zone)
        for i in range(len(indices)):
            point = {name: float(values[i]) for name, values in columns.items()
                     if values is not None and math.isfinite(values[i])}
            point["area_ratio"] = float(sounding.area_ratio)
            points.append(point)
    points.extend(_lab_point(lab) for lab in _layer_lab(project, profile, layer))
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


def evaluate_candidates(
    points: list[dict[str, float]], key: DesignKey, lab: list[LabRecord],
) -> list[DerivedParameter]:
    """One mean and depth spread per registry method, plus measured lab values.

    Lab records supplied separately also provide registry inputs (e.g. PI). Exact
    lab rows already emitted by ``layer_points`` are consumed once, not duplicated.
    A PI correlation has source 'lab' but is not a direct lab measurement.
    """
    unit = _unit(key)
    evaluation_points = list(points)
    unmatched = list(points)
    for record in lab:
        point = _lab_point(record)
        if point in unmatched:
            unmatched.remove(point)
        else:
            evaluation_points.append(point)
    by_method: dict[str, list[DerivedParameter]] = {}
    for point in evaluation_points:
        inputs = {name: float(value) for name, value in point.items() if math.isfinite(value)}
        for correlation in registry.applicable(key, inputs):
            try:
                result = registry.evaluate(correlation.id, inputs)
            except (ArithmeticError, ValueError) as exc:
                # Some registered scalar formulae divide before reaching numpy's
                # errstate (e.g. qc / sigma'_v at the ground surface).
                result = DerivedParameter(
                    value=math.nan, unit=correlation.unit, method_id=correlation.id,
                    reference=correlation.reference, source=correlation.source,
                    reliability=correlation.reliability, validity_ok=False,
                    inputs_used=dict(correlation.options),
                    warnings=["parameters.warning.value_not_computable: reason="
                              + json.dumps(str(exc), ensure_ascii=False)],
                )
            result.inputs_used = {**inputs, **result.inputs_used}
            by_method.setdefault(result.method_id, []).append(result)
    candidates = [_representative(by_method[method]) for method in sorted(by_method)]
    measured = [float(value) for record in lab
                if (value := getattr(record, key, None)) is not None and math.isfinite(value)]
    if measured:
        candidates.append(DerivedParameter(
            value=statistics.mean(measured), unit=unit, source="lab", method_id=f"lab_{key}",
            reference="Laboratory measurement", stats=_spread(measured),
        ))
    return candidates


def _is_lab_measurement(candidate: DerivedParameter) -> bool:
    if candidate.source != "lab":
        return False
    try:
        registry.get(candidate.method_id)
    except KeyError:
        return True
    return False


def suggest(
    candidates: list[DerivedParameter], key: DesignKey, layer: SoilLayer,
) -> DerivedParameter | None:
    """Prefer measurements, otherwise combine valid registry candidates only."""
    _unit(key)
    valid = [c for c in candidates if c.validity_ok and math.isfinite(c.value)]
    measured = [c for c in valid if _is_lab_measurement(c)]
    if measured:
        return measured[0].model_copy(deep=True)
    if valid:
        return registry.combine(valid)
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
        phi = layer.design.phi_eff
        if phi is None:
            selection = layer.selections.get("phi_eff")
            proposal = selection.suggested if selection is not None else layer.params.get("phi_eff")
            if proposal is not None and proposal.validity_ok:
                phi = proposal.value
        if phi is not None and math.isfinite(phi):
            # EN 1997-1 6.5.3(10) takes delta_d = phi'_cv,d for cast in-situ concrete; the model
            # has no phi'_cv, so phi' stands in for it (unconservative when phi' is a peak value)
            # and the suggestion carries a warning. TBDY 2018 16.8.4.3 caps tan(delta) at 0.6.
            return DerivedParameter(
                value=math.degrees(math.atan(min(math.tan(math.radians(phi)), 0.6))),
                unit="deg", method_id="TBDY2018_delta_base", source="combined",
                reference=DELTA_BASE_REFERENCE,
                inputs_used={"phi_eff": phi},
                warnings=[f"parameters.warning.phi_cv_assumed_equal_phi_eff: phi_eff={phi:g}"],
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
        )
    else:
        raise ValueError("Selection needs an explicit mode")
    if not math.isfinite(selected.value) or selected.unit != unit:
        raise ValueError("Selected value must be finite and have the parameter's unit")
    result.selected = selected
    result.approved = False
    result.approved_at = None
    result.basis_hash = None
    return result


def _invalidate_delta_approval(layer: SoilLayer) -> None:
    """Keep the design/approval trace, but revoke delta when its phi basis changed."""
    delta = layer.selections.get("delta_base")
    phi = layer.design.phi_eff
    if delta is not None and delta.approved and phi is not None:
        # Missing provenance on a legacy approval cannot establish a matching basis.
        if delta.selected.inputs_used.get("phi_eff") != phi:
            delta.approved = False


def approve(layer: SoilLayer, keys: list[DesignKey], basis_hash: str, now: datetime) -> SoilLayer:
    """Atomically resolve/approve requested choices and validate the resulting layer."""
    if not basis_hash:
        raise ValueError("Approval needs a nonempty basis_hash")
    data = layer.model_dump()
    # Resolve phi first so a joint approval has the same basis in either key order.
    for key in sorted(dict.fromkeys(keys), key=lambda key: key != "phi_eff"):
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
        selection.approved = True
        selection.approved_at = now
        selection.basis_hash = basis_hash
        data["selections"][key] = selection.model_dump()
        if key in ("gamma", "gamma_sat"):
            data[key] = selection.selected.value
        else:
            data["design"][key] = selection.selected.value
    # model_copy(update=...) alone would bypass the engineering range validators.
    approved = SoilLayer.model_validate(data)
    _invalidate_delta_approval(approved)
    return approved


def _point_json(point: dict[str, float]) -> str:
    # Canonical float representation also handles explicitly supplied NaN/Inf.
    values = {key: float(value) if math.isfinite(value) else str(float(value))
              for key, value in point.items()}
    return json.dumps(values, sort_keys=True, separators=(",", ":"), allow_nan=False)


def basis_hash(layer: SoilLayer, points: list[dict[str, float]]) -> str:
    """SHA-256 of bounds and the input multiset; ordering/bookkeeping do not matter."""
    data = json.dumps(
        {"top": float(layer.top), "bottom": float(layer.bottom),
         "points": sorted(_point_json(point) for point in points)},
        sort_keys=True, separators=(",", ":"), allow_nan=False,
    )
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def refresh_profile(project: Project, profile_id: str) -> SoilProfile:
    """Return refreshed candidates and suggestions without modifying project/design.

    Stale selections retain selected/approved_at/basis_hash as the previous approval
    trace, with approved=False. Approval requires matching inputs and dependent phi.
    """
    profile = project.profile(profile_id)
    refreshed = profile.model_copy(deep=True)
    for layer in refreshed.layers:
        points = layer_points(project, profile, layer)
        lab = _layer_lab(project, profile, layer)
        current_basis = basis_hash(layer, points)
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
        for key in get_args(DesignKey):
            selection = layer.selections.get(key, ParameterSelection(parameter=key))
            selection.candidates = evaluate_candidates(points, key, lab)
            selection.suggested = suggest(selection.candidates, key, context)
            if (fine_grained and key == "c_eff" and selection.suggested is not None
                    and selection.suggested.method_id == "FHWA_GEC5_c_eff"):
                # Contrary lab evidence vetoes the granular default, not measurements.
                selection.suggested = None
            if selection.approved and selection.basis_hash != current_basis:
                selection.approved = False
            layer.selections[key] = selection
            context.selections[key] = selection
            if selection.suggested is not None:
                context.params[key] = selection.suggested.model_copy(deep=True)
            else:
                context.params.pop(key, None)
        layer.params = context.params
        _invalidate_delta_approval(layer)
    return refreshed
