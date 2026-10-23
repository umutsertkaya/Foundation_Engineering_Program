"""Data inventory of a layer: which inputs exist and which correlations can run on them."""

from __future__ import annotations

import math
from typing import get_args

from geotek.core.constants import DEPTH_TOL
from geotek.core.models.parameters import DesignKey
from geotek.core.models.profile import SoilLayer, SoilProfile
from geotek.core.models.project import Project
from geotek.engine.correlations import registry
from geotek.services import parameters
from geotek.services.parameters import layer_points


def _has(point: dict[str, float], name: str) -> bool:
    value = point.get(name)
    return value is not None and math.isfinite(value)


def stress_issue(profile: SoilProfile, layer: SoilLayer) -> str | None:
    """'gamma_sat_missing' when the layer reaches below the in-situ water table without gamma_sat."""
    if layer.gamma_sat is None and layer.bottom > profile.gwt.depth_insitu + DEPTH_TOL:
        return "gamma_sat_missing"
    return None


def layer_inventory(project: Project, profile: SoilProfile, layer: SoilLayer) -> dict:
    """Input availability per name and, per design key, every registry method with its missing inputs.

    ``ready`` counts the points at which the method can run: all inputs exist (the layer's mean
    lab PI counts as the PI of a method that needs N60 and PI), the point passes the method's
    filter (e.g. below the water table) and the layer's USCS symbol belongs to the method's soil
    classes. A method with zero ready points lists the inputs that no point supplies, plus
    ``uscs`` when the layer symbol is missing or outside the method's classes. Nothing is
    evaluated or assumed here.
    """
    points = layer_points(project, profile, layer)
    lab = parameters.layer_lab(project, profile, layer)
    context, layer_context, _ = parameters.classify_layer(layer, points, lab)
    uscs = parameters.evaluation_uscs(layer, lab)
    layer_pi = parameters.mean_lab_pi(lab)
    symbol = registry.normalise_uscs(uscs)
    names = sorted({name for point in points for name in point})
    inputs = {name: sum(_has(p, name) for p in points) for name in names}
    keys = []
    for key in get_args(DesignKey):
        runnable: dict[str, int] = {}
        for point in points:
            for c, _ in parameters.methods_for(key, point, uscs, layer_pi):
                runnable[c.id] = runnable.get(c.id, 0) + 1
        methods = []
        for c in sorted((c for c in registry.REGISTRY.values() if c.parameter == key), key=lambda c: c.id):
            ready = runnable.get(c.id, 0)
            pi_from_lab = layer_pi is not None and "N60" in c.inputs
            missing = [n for n in c.inputs
                       if inputs.get(n, 0) == 0 and not (n == "PI" and pi_from_lab)]
            if c.uscs is not None and (symbol is None or symbol not in c.uscs):
                missing.append("uscs")
            methods.append({
                "id": c.id, "reference": c.reference, "source": c.source,
                "inputs": list(c.inputs), "ready_points": ready,
                "missing_inputs": missing if ready == 0 else [],
            })
        methods.extend(_derived_methods(layer, key))
        keys.append({"parameter": key, "methods": methods})
    return {
        "layer_id": layer.id, "point_count": len(points), "inputs": inputs, "keys": keys,
        "stress_issue": stress_issue(profile, layer),
        "spt_class": parameters.spt_class(layer_context, points),
    }


def _derived_methods(layer: SoilLayer, key: str) -> list[dict]:
    """delta_base and K0 derivations: ready only from an approved phi' (and OCR for Mayne & Kulhawy)."""
    phi = parameters.approved_phi(layer) is not None
    ocr = parameters.approved_ocr(layer) is not None
    specs = {
        "delta_base": [("TBDY2018_delta_base", parameters.DELTA_BASE_REFERENCE, ["phi_eff"], phi, "phi_approved")],
        "K0": [("JAKY_K0", "Jaky (1944)", ["phi_eff"], phi, "phi_approved"),
               ("MK1982_K0", "Mayne & Kulhawy (1982)", ["phi_eff", "OCR"], phi and ocr, None)],
    }.get(key, [])
    out = []
    for method_id, reference, inputs, ready, _ in specs:
        missing = [] if ready else (["phi_approved"] if not phi else []) + (
            ["ocr_approved"] if "OCR" in inputs and not ocr else [])
        out.append({"id": method_id, "reference": reference, "source": "combined", "inputs": inputs,
                    "ready_points": 1 if ready else 0, "missing_inputs": missing})
    return out


def profile_readiness(project: Project, profile: SoilProfile) -> list[dict]:
    """Per layer: which unit weights are approved, what is missing below the water table, what is stale.

    ``gamma_sat_equals_gamma_unapproved`` makes a gamma_sat that merely equals gamma (the silent
    assumption of older files) visible: the values are equal and gamma_sat was never approved.
    ``stale_keys`` are the selections whose approval was withdrawn because their inputs changed.
    """
    refreshed = parameters.refresh_profile(project, profile.id)
    result = []
    for layer, fresh in zip(profile.layers, refreshed.layers):
        gamma = layer.selections.get("gamma")
        gamma_sat = layer.selections.get("gamma_sat")
        gamma_sat_approved = bool(gamma_sat is not None and gamma_sat.approved)
        result.append({
            "layer_id": layer.id,
            "gamma_approved": bool(gamma is not None and gamma.approved),
            "gamma_sat_approved": gamma_sat_approved,
            "gamma_sat_missing_below_gwt": stress_issue(profile, layer) is not None,
            "gamma_sat_equals_gamma_unapproved": (
                layer.gamma_sat is not None and layer.gamma_sat == layer.gamma
                and not gamma_sat_approved),
            "stale_keys": [key for key in get_args(DesignKey)
                           if fresh.selections[key].stale_reason is not None],
        })
    return result
