"""At-rest (K0) lateral earth pressure on a vertical wall of height H through a soil profile.

Source: Das, lateral earth pressure notes (K0 diagram, slides 5-8): the pressure is the sum of a
surcharge rectangle P1 = K0 q H, the soil triangle P2 = K0 sigma'_v and the hydrostatic water
force Pw. K0 is the engineer-approved ``design.K0`` of every layer; no default is assumed.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

import numpy as np
from pydantic import BaseModel, ConfigDict, Field

from geotek.core.errors import LayerDesignError
from geotek.core.models.project import Project
from geotek.engine.earth_pressure.distribution import lateral_pressure, resultant
from geotek.services.parameters import refresh_profile

_EPS = 1e-12


class AtRestInput(BaseModel):
    """At-rest pressure request; the wall top is at the ground surface."""

    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    profile_id: str
    height: float = Field(gt=0)
    """Wall height H [m]."""
    surcharge: float = Field(0.0, ge=0)
    """Uniform surcharge q [kPa]."""
    gwt_case: Literal["insitu", "design", "seismic"] = "design"


@dataclass
class AtRestResult:
    z: list[float]
    """Depth below the top [m]; a layer boundary appears twice (pressure jump)."""
    sigma_h_eff: list[float]
    u: list[float]
    sigma_h: list[float]
    layers: list[dict] = field(default_factory=list)
    """``{layer_id, top, bottom, K0}`` for every layer within H."""
    components: list[dict] = field(default_factory=list)
    """``{name: soil|surcharge|water, force [kN/m], height [m above the base]}``."""
    total_force: float = 0.0
    total_height: float = 0.0
    """Height of the resultant above the base [m]."""
    warnings: list[str] = field(default_factory=list)


def _component(name: str, z, p, height: float) -> dict | None:
    force, depth = resultant(z, p)
    if abs(force) <= _EPS:
        return None
    return {"name": name, "force": float(force), "height": float(height - depth)}


def _require_approved_k0(project: Project, profile, height: float) -> None:
    """Every layer within ``height`` needs an approved, non-stale K0 selection (not just ``design.K0``).

    Staleness is judged on a refreshed copy (the stored profile is not modified): ``refresh_profile``
    clears ``approved`` when the basis hash of the layer bounds and inputs no longer matches.
    """
    refreshed = {layer.id: layer for layer in refresh_profile(project, profile.id).layers}
    for layer in profile.layers:
        if min(layer.bottom, height) <= layer.top:
            continue
        selection = refreshed.get(layer.id, layer).selections.get("K0")
        stale = getattr(selection, "stale_reason", None) is not None
        if selection is None or not selection.approved or stale or layer.design.K0 is None:
            raise LayerDesignError(layer, "k0_missing")


def at_rest_analysis(project: Project, inp: AtRestInput) -> AtRestResult:
    """At-rest pressure diagram, layer K0 table and P1 / P2 / Pw components.

    Raises ``LayerDesignError(layer, "k0_missing")`` when a layer has no approved K0 and
    ``KeyError`` for an unknown profile.
    """
    profile = project.profile(inp.profile_id)
    H = inp.height
    _require_approved_k0(project, profile, H)
    full = lateral_pressure(profile, H, state="at_rest", surcharge=inp.surcharge, gwt_case=inp.gwt_case)
    soil = (lateral_pressure(profile, H, state="at_rest", surcharge=0.0, gwt_case=inp.gwt_case)
            if inp.surcharge > 0 else full)
    z = full.z
    components = [
        _component("surcharge", z, full.sigma_h_eff - soil.sigma_h_eff, H) if inp.surcharge > 0 else None,
        _component("soil", z, soil.sigma_h_eff, H),
        _component("water", z, full.u, H),
    ]
    layers = [{"layer_id": layer.id, "top": float(max(layer.top, 0.0)), "bottom": float(min(layer.bottom, H)),
               "K0": float(layer.design.K0)}
              for layer in profile.layers if min(layer.bottom, H) > layer.top]
    total_height = float(H - full.z_resultant) if np.isfinite(full.z_resultant) else 0.0
    return AtRestResult(
        z=[float(v) for v in z], sigma_h_eff=[float(v) for v in full.sigma_h_eff],
        u=[float(v) for v in full.u], sigma_h=[float(v) for v in full.sigma_h],
        layers=layers, components=[c for c in components if c is not None],
        total_force=float(full.force), total_height=total_height, warnings=list(full.warnings))
