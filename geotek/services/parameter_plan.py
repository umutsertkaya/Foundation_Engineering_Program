"""Data inventory of a layer: which inputs exist and which correlations can run on them."""

from __future__ import annotations

import math
from typing import get_args

from geotek.core.models.parameters import DesignKey
from geotek.core.models.profile import SoilLayer, SoilProfile
from geotek.core.models.project import Project
from geotek.engine.correlations import registry
from geotek.services.parameters import layer_points


def _has(point: dict[str, float], name: str) -> bool:
    value = point.get(name)
    return value is not None and math.isfinite(value)


def layer_inventory(project: Project, profile: SoilProfile, layer: SoilLayer) -> dict:
    """Input availability per name and, per design key, every registry method with its missing inputs.

    ``ready`` counts the points at which all inputs of a method exist; a method with zero such
    points lists the inputs that no point supplies. Nothing is evaluated or assumed here.
    """
    points = layer_points(project, profile, layer)
    names = sorted({name for point in points for name in point})
    inputs = {name: sum(_has(p, name) for p in points) for name in names}
    keys = []
    for key in get_args(DesignKey):
        methods = []
        for c in sorted((c for c in registry.REGISTRY.values() if c.parameter == key), key=lambda c: c.id):
            ready = sum(all(_has(p, n) for n in c.inputs) for p in points)
            missing = [n for n in c.inputs if inputs.get(n, 0) == 0]
            methods.append({
                "id": c.id, "reference": c.reference, "source": c.source,
                "inputs": list(c.inputs), "ready_points": ready,
                "missing_inputs": missing if ready == 0 else [],
            })
        keys.append({"parameter": key, "methods": methods})
    return {"layer_id": layer.id, "point_count": len(points), "inputs": inputs, "keys": keys}
