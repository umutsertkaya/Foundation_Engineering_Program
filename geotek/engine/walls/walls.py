"""Gravity and cantilever wall analyses (external stability, ASD).

Gravity wall: Coulomb-type thrust on the actual back face (wall friction delta, default
2/3 phi), computed with the trial wedge so that slope, surcharge and seismic coefficients
are handled consistently.

Cantilever wall: thrust on a vertical "virtual back" through the heel tip with delta = beta
(equivalent to Rankine for a sloping backfill); the soil above the heel moves with the wall
and is part of the resisting weight (and inertia in the seismic case).

Partial-factor verification (EC7, LRFD) lives in ``limit_state.py`` and reuses
``wall_forces``.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from geotek.core.models.walls import (
    Backfill,
    CantileverGeometry,
    FoundationSoil,
    GravityGeometry,
    WallLoads,
    WallSettings,
)
from geotek.engine.walls.base import (
    Force,
    KeySliding,
    WallAnalysis,
    earth_thrust_forces,
    attach_without_key,
    evaluate_checks,
    key_sliding_basic,
    key_warnings,
    key_weight_forces,
    passive_force,
    seismic_passive_ratio,
    strip_key,
    weight_forces,
)


@dataclass
class WallForces:
    forces: list[Force]
    width: float
    embedment: float
    warnings: list[str]
    key: KeySliding | None = None
    """Layered path only: shear key passive resistance and key-tip plane data."""


def gravity_wall_polygon(g: GravityGeometry):
    x_back_top = g.base_width - g.back_offset
    return [(0.0, 0.0), (g.base_width, 0.0), (x_back_top, g.height), (x_back_top - g.top_width, g.height)]


def cantilever_polygons(g: CantileverGeometry, slope: float):
    """Base slab, stem, soil over the heel and soil over the toe (to the embedment level)."""
    t, xb, h = g.base_thickness, g.x_stem_back, g.height
    base = [(0.0, 0.0), (g.width, 0.0), (g.width, t), (0.0, t)]
    stem = [(g.toe, t), (xb, t), (xb, h), (xb - g.stem_top, h)]
    rise = g.heel * math.tan(math.radians(slope))
    heel_soil = [(xb, t), (g.width, t), (g.width, h + rise), (xb, h)]
    toe_soil = [(0.0, t), (g.toe, t), (g.toe, g.embedment), (0.0, g.embedment)] if g.embedment > t else []
    return base, stem, heel_soil, toe_soil


def wall_forces(
    geometry: CantileverGeometry | GravityGeometry,
    backfill: Backfill,
    loads: WallLoads,
    settings: WallSettings,
    *,
    seismic: bool,
) -> WallForces:
    """Unfactored forces on the wall system, each tagged with its load type."""
    gc = settings.concrete_unit_weight
    forces: list[Force] = []
    if isinstance(geometry, GravityGeometry):
        g = geometry
        forces += weight_forces("Wall", gravity_wall_polygon(g), gc, loads, seismic, "DC")
        forces += key_weight_forces(g, settings, loads, seismic)
        theta = math.degrees(math.atan2(g.back_offset, g.height))
        delta = backfill.delta if backfill.delta is not None else 2 * backfill.phi / 3
        thrust, warnings = earth_thrust_forces(
            backfill=backfill, loads=loads, seismic=seismic, H=g.height,
            base_point=(g.base_width, 0.0), theta=theta, delta=delta,
        )
        if g.back_offset > 0:
            warnings.append("Soil resting on the battered back face is accounted for through the "
                            "Coulomb thrust (theta), not as a separate weight")
        return WallForces(forces + thrust, g.base_width, g.embedment, warnings + key_warnings(g))

    g = geometry
    base, stem, heel_soil, toe_soil = cantilever_polygons(g, backfill.slope)
    forces += weight_forces("Base slab", base, gc, loads, seismic, "DC")
    forces += weight_forces("Stem", stem, gc, loads, seismic, "DC")
    forces += key_weight_forces(g, settings, loads, seismic)
    forces += weight_forces("Soil over heel", heel_soil, backfill.gamma, loads, seismic, "EV")
    if settings.include_toe_soil and toe_soil:
        forces += weight_forces("Soil over toe", toe_soil, backfill.gamma, loads, seismic, "EV")
    if loads.surcharge > 0 and loads.surcharge_resists:
        forces.append(Force("Surcharge over heel", 0.0, -loads.surcharge * g.heel, g.x_stem_back + g.heel / 2,
                            g.height + g.heel * math.tan(math.radians(backfill.slope)), "LS"))
    h_virtual = g.height + g.heel * math.tan(math.radians(backfill.slope))
    thrust, warnings = earth_thrust_forces(
        backfill=backfill, loads=loads, seismic=seismic, H=h_virtual,
        base_point=(g.width, 0.0), theta=0.0, delta=backfill.slope,
    )
    return WallForces(forces + thrust, g.width, g.embedment, warnings + key_warnings(g))


def _analyze(geometry, backfill, foundation, loads, settings, seismic) -> WallAnalysis:
    loads = loads or WallLoads()
    settings = settings or WallSettings()
    wf = wall_forces(geometry, backfill, loads, settings, seismic=seismic)
    phi_front = 0.0 if foundation.drainage == "undrained" else foundation.phi
    passive = passive_force(foundation, wf.embedment, settings, backfill.gamma,
                            seismic_ratio=seismic_passive_ratio(phi_front, loads, seismic))
    key = key_sliding_basic(geometry, foundation, settings, backfill.gamma, backfill=backfill, loads=loads,
                            seismic=seismic)
    result = evaluate_checks(case="seismic" if seismic else "static", width=wf.width, forces=wf.forces,
                             passive=passive, foundation=foundation, embedment=wf.embedment,
                             settings=settings, warnings=wf.warnings, key=key)
    if key is not None:
        attach_without_key([result], [_analyze(strip_key(geometry), backfill, foundation, loads, settings, seismic)])
    return result


def analyze_gravity_wall(geometry: GravityGeometry, backfill: Backfill, foundation: FoundationSoil,
                         loads: WallLoads | None = None, settings: WallSettings | None = None,
                         *, seismic: bool = False) -> WallAnalysis:
    return _analyze(geometry, backfill, foundation, loads, settings, seismic)


def analyze_cantilever_wall(geometry: CantileverGeometry, backfill: Backfill, foundation: FoundationSoil,
                            loads: WallLoads | None = None, settings: WallSettings | None = None,
                            *, seismic: bool = False) -> WallAnalysis:
    return _analyze(geometry, backfill, foundation, loads, settings, seismic)
