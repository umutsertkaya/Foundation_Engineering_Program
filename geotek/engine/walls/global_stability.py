"""Global (overall) stability of a retaining wall with Bishop circles passing below the base.

Model (approximation, documented for the report):
- The wall and the soil it carries (soil over the heel, soil wedge on a battered back,
  optionally soil over the toe) act as a vertical load on the foundation over the base
  footprint, distributed linearly so that its resultant and moment are preserved.
- Behind the wall the backfill is part of the sliding mass (surface at the backfill level);
  the earth thrust is internal to the mass and is not applied.
- Soil bands: backfill above the base level, the given foundation bands below it.
  Elevations are measured from the base bottom (y = 0).
- Circles are restricted to pass below the base (tangent elevation < 0).
"""

from __future__ import annotations

import math

from geotek.config.codes import FactorLog, resolve_code
from geotek.core.models.walls import Backfill, CantileverGeometry, GravityGeometry, WallLoads, WallSettings
from geotek.engine.stability import SlipResult, SlopeModel, SoilBand, SurfaceLoad, search_critical_circle
from geotek.engine.walls.base import CheckResult, clip_polygon_y, polygon_area_centroid
from geotek.engine.walls.walls import cantilever_polygons, gravity_wall_polygon

EPS = 1e-6


def _footprint_load(weights, width):
    """Linear pressure over [0, width] carrying the total weight with its centroid preserved."""
    total = sum(w for w, _ in weights)
    xbar = sum(w * x for w, x in weights) / total
    e = width / 2 - xbar  # positive: resultant toward the toe
    if abs(e) <= width / 6:
        q_toe = total / width * (1 + 6 * e / width)
        q_heel = total / width * (1 - 6 * e / width)
        return [SurfaceLoad(0.0, width, q_toe, q_heel)]
    length = 3 * (width / 2 - abs(e))
    peak = 2 * total / length
    if e > 0:
        return [SurfaceLoad(0.0, length, peak, 0.0)]
    return [SurfaceLoad(width - length, width, 0.0, peak)]


def wall_global_stability(
    geometry: CantileverGeometry | GravityGeometry,
    backfill: Backfill,
    foundation_bands: list[SoilBand],
    loads: WallLoads | None = None,
    settings: WallSettings | None = None,
    *,
    seismic: bool = False,
    water_level: float | None = None,
    grid: int = 12,
    tan_phi_factor: float = 1.0,
    cohesion_factor: float = 1.0,
    required: float | None = None,
    retained_bands: list[SoilBand] | None = None,
    surcharge_factor: float = 1.0,
    footprint_factors: dict[str, float] | None = None,
) -> tuple[SlipResult, CheckResult]:
    """Critical Bishop circle and the global stability check.

    By default the required FS comes from the ASD design code. For partial-factor design the
    caller passes design-strength divisors (applied to tan phi and c of every band and the
    backfill) and the required factor (e.g. gamma_R;e, or 1/phi for LRFD).

    ``retained_bands`` supplies the horizontally layered retained mass above the base.
    Its first band extends upward to the sloping surface. None keeps the legacy model.
    ``surcharge_factor`` applies to the surface surcharge; ``footprint_factors``
    supplies unfavourable DC/EV factors for carried loads. Slice soil weights stay
    characteristic; DA1-C1/DA2 soil-weight factoring and vertical inertia are not modelled.
    """
    loads = loads or WallLoads()
    settings = settings or WallSettings()
    if tan_phi_factor != 1.0 or cohesion_factor != 1.0:
        phi_d = math.degrees(math.atan(math.tan(math.radians(backfill.phi)) / tan_phi_factor))
        backfill = backfill.model_copy(update={"phi": phi_d})
        foundation_bands = [
            SoilBand(top=b.top, gamma=b.gamma, c=b.c / cohesion_factor,
                     phi=math.degrees(math.atan(math.tan(math.radians(b.phi)) / tan_phi_factor)))
            for b in foundation_bands
        ]
        if retained_bands is not None:
            retained_bands = [
                SoilBand(top=b.top, gamma=b.gamma, c=b.c / cohesion_factor,
                         phi=math.degrees(math.atan(math.tan(math.radians(b.phi)) / tan_phi_factor)))
                for b in retained_bands
            ]
    tan_b = math.tan(math.radians(backfill.slope))
    gc = settings.concrete_unit_weight

    weights = []  # (W, x_centroid)
    carried_soil = []
    if isinstance(geometry, CantileverGeometry):
        base, stem, heel_soil, toe_soil = cantilever_polygons(geometry, backfill.slope)
        parts = [(base, gc, "DC"), (stem, gc, "DC"), (heel_soil, backfill.gamma, "EV")]
        if settings.include_toe_soil and toe_soil:
            parts.append((toe_soil, backfill.gamma, "EV"))
        if retained_bands is not None:
            carried_soil = [heel_soil] + ([toe_soil] if settings.include_toe_soil and toe_soil else [])
            parts = [(base, gc, "DC"), (stem, gc, "DC")]
        H, B = geometry.height, geometry.width
        x_ground0 = geometry.x_stem_back
    else:
        parts = [(gravity_wall_polygon(geometry), gc, "DC")]
        H, B = geometry.height, geometry.base_width
        x_ground0 = B - geometry.back_offset
        if geometry.back_offset > 0:
            poly = [(x_ground0, H), (B, 0.0), (B, H + geometry.back_offset * tan_b)]
            if retained_bands is None:
                parts.append((poly, backfill.gamma, "EV"))
            else:
                carried_soil.append(poly)
    if retained_bands is not None:
        if not retained_bands:
            raise ValueError("Retained bands must not be empty")
        ordered = sorted(retained_bands, key=lambda band: -band.top)
        for poly in carried_soil:
            for i, band in enumerate(ordered):
                upper = math.inf if i == 0 else band.top
                lower = ordered[i + 1].top if i + 1 < len(ordered) else 0.0
                clipped = clip_polygon_y(poly, lower, upper)
                if len(clipped) >= 3:
                    parts.append((clipped, band.gamma, "EV"))
    for poly, gamma, kind in parts:
        a, cx, _ = polygon_area_centroid(poly)
        if a > 0:
            weight = gamma * a
            if footprint_factors is not None:
                weight *= footprint_factors[kind]
            weights.append((weight, cx))

    D = geometry.embedment
    L = 4 * H
    y_back = H + (B - x_ground0) * tan_b
    surface = [(-L, D), (-EPS, D), (0.0, 0.0), (B, 0.0), (B + EPS, y_back), (B + L, y_back + L * tan_b)]
    surf_loads = _footprint_load(weights, B)
    if loads.surcharge > 0:
        q = loads.surcharge * surcharge_factor
        surf_loads.append(SurfaceLoad(B, B + L, q, q))

    bands = [SoilBand(top=y_back + L * tan_b + 1.0, gamma=backfill.gamma, c=0.0, phi=backfill.phi)]
    if retained_bands is not None:
        bands = sorted(retained_bands, key=lambda band: -band.top)
        first = bands[0]
        bands = [SoilBand(top=y_back + L * tan_b + 1.0, gamma=first.gamma, c=first.c, phi=first.phi)] + bands[1:]
    bands += [b for b in foundation_bands if b.top <= 0]
    if not foundation_bands or max(b.top for b in foundation_bands) < -EPS:
        raise ValueError("The top foundation band must start at the base level (top = 0)")
    model = SlopeModel(surface=surface, layers=bands, water_level=water_level, loads=surf_loads,
                       kh=loads.kh if seismic else 0.0)
    result = search_critical_circle(
        model, x_range=(-H, B + H), y_range=(0.5 * H, 3.0 * H), tangent_range=(-2.0 * H, -0.05),
        n_x=grid, n_y=grid, n_tangent=grid, min_width=0.5, exit_max=0.0, entry_min=B,
    )
    case = "seismic" if seismic else "static"
    used = []
    if required is None:
        log = FactorLog(resolve_code(settings.design_code, settings.factor_overrides))
        required = log.value(f"safety.global_stability.{case}")
        used = log.as_list()
    check = CheckResult("global_stability", result.fs, required, result.fs >= required,
                        f"Bishop circle centre ({result.xc:.2f}, {result.yc:.2f}), R = {result.radius:.2f} m",
                        factors_used=used)
    return result, check
