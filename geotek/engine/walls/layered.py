"""Layered external wall stability, in the structure depth frame (z down, base z=H).

The legacy homogeneous wall engine is deliberately left untouched. See
``docs/contracts/E4_FORMULAS.md`` for the local-coefficient approximation and limits.
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING

import numpy as np

from geotek.core.constants import GAMMA_W
from geotek.core.errors import GeoTekError, LayerDesignError
from geotek.core.warning_codes import format_warning
from geotek.core.models.profile import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.core.models.structures import GwtCase, StructureSoilModel
from geotek.core.models.walls import CantileverGeometry, FoundationSoil, GravityGeometry, WallLoads, WallSettings
from geotek.engine.bearing import bearing_capacity
from geotek.engine.earth_pressure.distribution import PressureDistribution, lateral_pressure, resultant
from geotek.engine.sheet_pile import _evaluate
from geotek.engine.stability import SoilBand
from geotek.engine.walls.base import (
    CheckResult, Force, KeySliding, try_bearing_capacity, WallAnalysis, attach_without_key, clip_polygon_y, evaluate_checks,
    key_band_force, key_passive_from_diagram, key_warnings, key_weight_forces, seismic_passive_ratio,
    strip_key, weight_forces,
)
from geotek.engine.walls.walls import WallForces, cantilever_polygons, gravity_wall_polygon

if TYPE_CHECKING:
    from geotek.services.walls_basic import BasicWallInput


def soil_from_basic(inp: BasicWallInput, D: float) -> StructureSoilModel:
    """Explicit compatibility adapter; does not change the legacy basic service."""
    if not 0 <= D < inp.height:
        raise GeoTekError("Need 0 <= embedment < wall height")
    if not inp.gwt_below_base:
        raise GeoTekError("Basic soil conversion requires groundwater below the base")
    bottom = inp.height + max(3 * inp.height, 10.0)
    db = math.degrees(math.atan(min(math.tan(math.radians(inp.foundation_phi)), 0.6)))
    foundation = SoilLayer(
        id="basic-foundation", top=0.0, bottom=bottom, gamma=inp.foundation_gamma,
        behaviour=inp.foundation_drainage,
        design=DesignParameters(phi_eff=inp.foundation_phi, c_eff=inp.foundation_c,
                                su=inp.foundation_su, delta_base=db),
    )
    fill = SoilLayer(id="basic-fill", top=0.0, bottom=inp.height, gamma=inp.backfill_gamma,
                     design=DesignParameters(phi_eff=inp.backfill_phi))
    return StructureSoilModel(
        profile=SoilProfile(id="basic-structure", layers=[foundation],
                            gwt=GroundwaterCondition(depth_insitu=bottom + 1.0)),
        retained_fill=[fill],
    )


def foundation_from_structure(soil: StructureSoilModel, front_depth: float, base_depth: float,
                              width: float, gwt_case: GwtCase = "design", *,
                              gwt_bearing_correction: bool = True) -> tuple[FoundationSoil, list[str]]:
    """Base stratum only; front q is effective (drained) or total (undrained)."""
    soil.zones(front_depth, base_depth)
    if width <= 0:
        raise GeoTekError("Foundation width must be positive")
    profile = soil.front_profile()
    layer = profile.layer_at(base_depth)
    d = layer.design
    gwt = profile.gwt.depth_for(gwt_case)
    undrained = layer.behaviour == "undrained"
    gamma = (layer.require_gamma_sat() if undrained else layer.require_gamma_sat() - GAMMA_W) if gwt <= base_depth else layer.gamma
    if gwt_bearing_correction and not undrained and base_depth < gwt < base_depth + width:
        gamma_sub = layer.require_gamma_sat() - GAMMA_W
        gamma = gamma_sub + (gwt - base_depth) / width * (layer.gamma - gamma_sub)
    stress_index = 0 if undrained else 2
    q = float(profile.stresses(base_depth, gwt_case)[stress_index]
              - profile.stresses(front_depth, gwt_case)[stress_index])
    if undrained:
        # Only the remaining soil column plus free water above the front ground.
        q += GAMMA_W * max(front_depth - gwt, 0.0)
    if gamma <= 0 or q < -1e-9:
        raise GeoTekError("Non-positive effective foundation weight or negative effective overburden")
    warnings = []
    if layer.behaviour == "undrained":
        if d.su is None or d.su <= 0:
            raise LayerDesignError(layer, "su_not_positive")
        foundation = FoundationSoil(drainage="undrained", su=d.su, gamma=gamma, overburden=max(q, 0.0))
    else:
        if d.phi_eff is None:
            raise LayerDesignError(layer, "phi_missing")
        foundation = FoundationSoil(phi=d.phi_eff, c=d.c_eff, gamma=gamma,
                                    overburden=max(q, 0.0), delta_base=d.delta_base)
    for lower in profile.layers:
        if lower.top <= base_depth or lower.top >= base_depth + width:
            continue
        ld = lower.design
        mixed = lower.behaviour != layer.behaviour
        if layer.behaviour == lower.behaviour == "undrained":
            weaker = ld.su is None or ld.su < d.su
        elif layer.behaviour == lower.behaviour == "drained":
            weaker = (ld.phi_eff is None or ld.phi_eff < d.phi_eff or ld.c_eff < d.c_eff)
        else:
            weaker = True  # unlike stress paths cannot be ranked by an invented conversion
        if weaker:
            warnings.append(
                f"Taban altında B derinliği içinde {'farklı drenajlı, olası daha zayıf' if mixed else 'daha zayıf'} "
                f"katman {lower.id} var; iki tabakalı taşıma gücü hesaplanmadı")
    if profile.bottom < base_depth + width:
        warnings.append("Profil taban altında B derinliğini kapsamıyor; daha derin zayıf katman dışlanamaz")
    return foundation, warnings


def _profile_bands(profile: SoilProfile, a: float, b: float, base: float,
                   *, water_depth: float | None = None) -> list[SoilBand]:
    out = []
    gwt = profile.gwt.depth_for("design") if water_depth is None else water_depth
    for layer in profile.layers:
        top, bottom = max(a, layer.top), min(b, layer.bottom)
        if bottom <= top:
            continue
        d = layer.design
        if layer.behaviour == "undrained":
            if d.su is None:
                raise LayerDesignError(layer, "su_missing")
            c, phi = d.su, 0.0
        else:
            if d.phi_eff is None:
                raise LayerDesignError(layer, "phi_missing")
            c, phi = d.c_eff, d.phi_eff
        if top == 0.0 and gwt == 0.0:
            # A zero-thickness dry cap becomes finite above z=0 on sloping ground.
            # The first band's upward extension must not use saturated unit weight.
            out.append(SoilBand(top=base, gamma=layer.gamma, c=c, phi=phi))
        nodes = [top] + ([gwt] if top < gwt < bottom else []) + [bottom]
        for za, zb in zip(nodes, nodes[1:]):
            gamma = layer.gamma if zb <= gwt else layer.require_gamma_sat()
            out.append(SoilBand(top=base - za, gamma=gamma, c=c, phi=phi))
    return out


def bands_from_structure(soil: StructureSoilModel, base_depth: float) -> tuple[list[SoilBand], list[SoilBand]]:
    """Retained bands above the base, natural foundation bands below; y=0 at base.

    Foundation weights use the Bishop water envelope (higher front/retained GWT).
    Retained weights use their own design GWT. Select cases with ``soil_at_case``.
    """
    soil.zones(base_depth, base_depth)
    retained, front = soil.retained_profile(), soil.front_profile()
    water_depth = min(retained.gwt.depth_for("design"), front.gwt.depth_for("design"))
    return (_profile_bands(retained, 0.0, base_depth, base_depth),
            _profile_bands(front, base_depth, soil.profile.bottom, base_depth, water_depth=water_depth))


def soil_at_case(soil: StructureSoilModel, case: GwtCase) -> StructureSoilModel:
    """Independent copy with the selected water heads exposed as the design heads."""
    def water(gwt):
        z = gwt.depth_for(case)
        return GroundwaterCondition(depth_insitu=z, depth_design=z, depth_seismic=z)
    return soil.model_copy(update={
        "profile": soil.profile.model_copy(update={"gwt": water(soil.profile.gwt)}),
        "gwt_retained": water(soil.gwt_retained or soil.profile.gwt),
        "gwt_front": water(soil.gwt_front or soil.profile.gwt),
    })


def _plane(geometry, slope):
    if isinstance(geometry, CantileverGeometry):
        rise = geometry.heel * math.tan(math.radians(slope))
        return geometry.height + rise, rise, 0.0
    return geometry.height, 0.0, math.degrees(math.atan2(geometry.back_offset, geometry.height))


def _plane_profile(profile, rise):
    if rise == 0:
        return profile
    layers = [layer.model_copy(update={"top": layer.top + rise if i else 0.0,
                                       "bottom": layer.bottom + rise})
              for i, layer in enumerate(profile.layers)]
    gwt = GroundwaterCondition(**{f"depth_{c}": profile.gwt.depth_for(c) + rise
                                  for c in ("insitu", "design", "seismic")})
    return profile.model_copy(update={"layers": layers, "gwt": gwt})


def _submerged_dynamic(profile, hv, loads, settings, q, common, static):
    """TBDY 16.26; compare horizontal soil increments plus ONE 16.20 water force.

    Mixed permeability uses the full water head if any wetted layer is pervious
    (unverified engineering approach; no layered hydrodynamic model is claimed).
    """
    gwt = profile.gwt.depth_for(common["gwt_case"])
    wet = [l for l in profile.layers if min(l.bottom, hv) > max(l.top, gwt)]
    mode = settings.submerged_seismic
    unknown, fixed = [], {}
    if mode == "by_permeability":
        for layer in wet:
            if layer.permeability is None:
                unknown.append(layer.id)
            else:
                fixed[layer.id] = "impervious" if layer.permeability < 5e-4 else "pervious"
    else:
        unknown = [l.id for l in wet]

    def diagram(choices):
        equivalent = {}
        for layer in wet:
            buoyant = layer.require_gamma_sat() - GAMMA_W
            if buoyant <= 0:
                raise GeoTekError(f"Katman {layer.id}: TBDY Denk. 16.26 için γ_sat > γ_w olmalıdır")
            numerator = layer.require_gamma_sat() if choices[layer.id] == "impervious" else layer.gamma
            # Existing M-O computes psi=atan(kh/(1-kv)); keep face lean separate.
            equivalent[layer.id] = numerator / buoyant * loads.kh
        return lateral_pressure(profile, hv, surcharge=q, kh=loads.kh, kv=loads.kv,
                                submerged_kh=equivalent, **common)

    def choices(branch):
        return {**fixed, **dict.fromkeys(unknown, branch)}

    candidates = []
    if mode in ("impervious", "pervious"):
        selected = choices(mode)
        candidates.append((selected, diagram(selected)))
    else:
        ci, cp = choices("impervious"), choices("pervious")
        di, dp = diagram(ci), diagram(cp)
        if mode == "envelope":
            candidates = [(ci, di), (cp, dp)]
        elif unknown:
            # Local soil forces are independent of the other layers' choices.
            # Maximise their sum, then enforce at least one pervious layer for
            # the candidate containing the single full-head dynamic water load.
            fi = _integrals(di, di.sigma_h_eff, profile)
            fp = _integrals(dp, dp.sigma_h_eff, profile)
            best = {**fixed, **{key: "impervious" if fi[key][0] >= fp[key][0] else "pervious"
                               for key in unknown}}
            variants = [ci, best]
            if "pervious" not in best.values():
                variants += [{**best, key: "pervious"} for key in unknown]
            candidates = [(c, diagram(c)) for c in variants]
        else:
            candidates = [(ci, di)]

    if any("pervious" in c.values() for c, _ in candidates) and loads.water_kh is None:
        raise GeoTekError("TBDY Denk. 16.20 için WallLoads.water_kh=0.4·S_DS girilmelidir (r=1)")
    d_su = hv - gwt
    water = (7 / 12) * (loads.water_kh or 0.0) * GAMMA_W * d_su**2
    static_soil = static.component("effective")[0]
    selected, dynamic = max(candidates, key=lambda item:
                            item[1].component("effective")[0] - static_soil
                            + (water if "pervious" in item[0].values() else 0.0))
    dynamic_water = water if "pervious" in selected.values() else 0.0
    governing = list(dict.fromkeys(selected.values()))
    for branch in governing:
        dynamic.warnings.append(
            "Su altındaki dolgu: deprem itkisi TBDY 2018 Denk. 16.26 ile hesaplandı "
            f"(EN 1998-5 Ek E ile uyumlu); seçim: {mode}, yöneten: {branch}.")
    if mode == "by_permeability":
        for layer in wet:
            dynamic.warnings.append(f"Katman {layer.id}: su altı deprem sınıfı {selected[layer.id]}.")
        for key in unknown:
            dynamic.warnings.append(
                f"Katman {key}: permeabilite k girilmedi; su altı deprem hesabında envelope zarfı kullanıldı.")
    if len(governing) > 1:
        dynamic.warnings.append("Karışık geçirgenlik: dinamik su itkisi tam su yüksekliği için bir kez "
                                "eklendi; doğrulanmamış mühendislik yaklaşımı; katmanlar arası su "
                                "hareketi modellenmedi — sonucu kontrol edin.")
    if 0 < gwt < hv:
        dynamic.warnings.append("Kısmen su altındaki dolgu yönetmelik formüllerinin kapsamı dışındadır; "
                                "katman bazında mühendislik yargısı uygulandı — sonucu kontrol edin.")
    dynamic.warnings.append("Kazı Destek Yapıları Tasarım ve Uygulama Esasları (16.07.2026 değişikliği) "
                            "ek şartları kontrol edilmelidir; bu belge yazılımda incelenmedi.")
    return dynamic, dynamic_water


def _retained_pressures(geometry, soil, loads, settings, seismic, slope, gwt_case):
    H = geometry.height
    if not 0 <= geometry.embedment < H:
        raise GeoTekError("Need 0 <= embedment < wall height")
    soil.zones(H - geometry.embedment, H)
    hv, rise, theta = _plane(geometry, slope)
    profile = _plane_profile(soil.retained_profile(), rise)
    if (theta or slope) and any(l.behaviour == "undrained" and l.top < hv for l in profile.layers):
        raise GeoTekError("Undrained retained layers require a vertical face and horizontal ground")
    common = dict(method="coulomb", beta=slope, theta=theta, layerwise=True, gwt_case=gwt_case,
                  steep_seismic=True)
    if isinstance(geometry, GravityGeometry):
        common["delta_ratio"] = 2 / 3
    else:
        common["delta"] = slope
    # q acts per horizontal length, as in trial_wedge (inclined actual back face).
    q = loads.surcharge / (1 + math.tan(math.radians(theta)) * math.tan(math.radians(slope)))
    zero = lateral_pressure(profile, hv, **common)
    static = lateral_pressure(profile, hv, surcharge=q, **common) if q else zero
    dynamic_water = 0.0
    if seismic and (loads.kh or loads.kv) and profile.gwt.depth_for(gwt_case) < hv:
        dynamic, dynamic_water = _submerged_dynamic(profile, hv, loads, settings, q, common, static)
    else:
        dynamic = (lateral_pressure(profile, hv, surcharge=q, kh=loads.kh, kv=loads.kv, **common)
                   if seismic and (loads.kh or loads.kv) else static)
    return profile, hv, theta, zero, static, dynamic, dynamic_water


def _integrals(dist, values, profile):
    """Force and first depth moment per material, including signed differences later."""
    out = {}
    for i in range(len(dist.z) - 1):
        a, b = float(dist.z[i]), float(dist.z[i + 1])
        if b <= a:
            continue  # zero-width layer jump
        pa, pb = float(values[i]), float(values[i + 1])
        f = (pa + pb) * (b - a) / 2
        m = (b - a) / 6 * (pa * (2 * a + b) + pb * (a + 2 * b))
        key = profile.layer_at((a + b) / 2).id
        old_f, old_m = out.get(key, (0.0, 0.0))
        out[key] = old_f + f, old_m + m
    return out


def _thrusts(geometry, profile, hv, theta, zero, static, dynamic, loads, seismic, slope):
    forces = []
    diagrams = [("Earth pressure", "EH", [(zero, 1.0)])]
    if loads.surcharge:
        diagrams.append(("Surcharge pressure", "LS", [(static, 1.0), (zero, -1.0)]))
    if seismic and (loads.kh or loads.kv):
        diagrams.append(("Seismic increment", "EQ", [(dynamic, 1.0), (static, -1.0)]))
    layers = [l for l in profile.layers if l.top < hv]
    for name, kind, terms in diagrams:
        integrals = {}
        for dist, sign in terms:
            for key, (f, m) in _integrals(dist, dist.sigma_h_eff, profile).items():
                old_f, old_m = integrals.get(key, (0.0, 0.0))
                integrals[key] = old_f + sign * f, old_m + sign * m
        for layer in layers:
            f, m = integrals.get(layer.id, (0.0, 0.0))
            if abs(f) < 1e-12:
                continue
            delta = (0.0 if layer.behaviour == "undrained" else
                     2 * layer.design.phi_eff / 3 if isinstance(geometry, GravityGeometry) else slope)
            y = loads.seismic_increment_height * hv if kind == "EQ" else hv - m / f
            x = geometry.width - y * math.tan(math.radians(theta))
            label = name if len(layers) == 1 else f"{name} ({layer.id})"
            forces.append(Force(label, -f, -f * math.tan(math.radians(delta + theta)), x, y, kind))
    water, depth = zero.component("water")
    if water > 0:
        y = hv - depth
        forces.append(Force("Water (retained)", -water, -water * math.tan(math.radians(theta)),
                            geometry.width - y * math.tan(math.radians(theta)), y, "WA"))
    return forces


def _soil_weights(name, polygon, profile, base, loads, seismic):
    if not polygon:
        return []
    out = []
    gwt = profile.gwt.depth_for("design")
    for i, layer in enumerate(profile.layers):
        a, b = (-math.inf if i == 0 else layer.top), layer.bottom
        cuts = [a] + ([gwt] if a < gwt < b else []) + [b]
        for top, bottom in zip(cuts, cuts[1:]):
            poly = clip_polygon_y(polygon, base - bottom, base - top)
            if len(poly) >= 3:
                gamma = layer.gamma if bottom <= gwt else layer.require_gamma_sat()
                out += weight_forces(f"{name} ({layer.id})", poly, gamma, loads, seismic, "EV")
    return out


def _front_pressure(geometry, soil, settings):
    """Front ground starts at H-D. Water is never reduced as passive soil resistance."""
    D, H = geometry.embedment, geometry.height
    profile = soil.front_profile()
    water = front_water_distribution(soil, H - D, H, top=H - D)
    if D > 0 and settings.use_passive:
        pond = GAMMA_W * max(H - D - profile.gwt.depth_for("design"), 0.0)
        dist = lateral_pressure(profile, D, top=H - D, state="passive", layerwise=True,
                                total_stress_surcharge=pond)
        left = np.r_[np.diff(dist.z) == 0, False]
        dist.u = _evaluate(water, dist.z, which="u", left=left)
        dist.sigma_h = dist.sigma_h_eff + dist.u
        dist.force, dist.z_resultant = resultant(dist.z, dist.sigma_h)
        return dist
    return water


def front_water_distribution(soil, front_depth, base_depth, *, top=0.0):
    """Front hydrostatic diagram, including free water above the front ground.

    Soil intervals treated in total stress have no second water component. Depths
    in this diagram are measured from ``top`` in the structure frame.
    """
    profile = soil.front_profile()
    gwt = profile.gwt.depth_for("design")
    nodes = sorted({top, base_depth,
                    *(v for v in (gwt, front_depth) if top < v < base_depth),
                    *(l.top for l in profile.layers if top < l.top < base_depth),
                    *(l.bottom for l in profile.layers if top < l.bottom < base_depth)})
    zz, pressures = [], []
    for a, b in zip(nodes, nodes[1:]):
        total_stress = a >= front_depth and profile.layer_at((a + b) / 2).behaviour == "undrained"
        zz += [a - top, b - top]
        pressures += [0.0 if total_stress else GAMMA_W * max(z - gwt, 0.0) for z in (a, b)]
    if not zz:
        zz, pressures = [0.0, 0.0], [0.0, 0.0]
    z, u = np.array(zz), np.array(pressures)
    zeros = np.zeros_like(z)
    f, depth = resultant(z, u)
    return PressureDistribution(z, zeros.copy(), zeros.copy(), zeros.copy(), u, u.copy(),
                                 f, depth, "passive", "hydrostatic")


def _front_water(geometry, soil):
    dist = front_water_distribution(soil, geometry.height - geometry.embedment, geometry.height)
    if dist.force <= 0:
        return None
    y = geometry.height - dist.z_resultant
    a = ((geometry.base_width - geometry.back_offset - geometry.top_width) / geometry.height
         if isinstance(geometry, GravityGeometry) else 0.0)
    # For x=a*y, pressure normal to the wetted face gives dFy=-a*dFx.
    # The projected vertical diagram integrates both force and face centroid.
    return Force("Water (front)", dist.force, -a * dist.force, a * y, y, "WA")


def wall_pressures_layered(geometry, soil, loads, settings, *, seismic, backfill_slope=0.0,
                           gwt_case: GwtCase = "design") -> dict[str, PressureDistribution]:
    """Unfactored diagnostic diagrams; retained depths are from the virtual plane top."""
    selected = soil_at_case(soil, gwt_case)
    _, _, _, zero, static, dynamic, _ = _retained_pressures(
        geometry, selected, loads, settings, seismic, backfill_slope, "design")
    front = _front_pressure(geometry, selected, settings)
    return {"retained": dynamic, "retained_static": static, "retained_soil": zero, "front": front,
            "front_water": front_water_distribution(selected, geometry.height - geometry.embedment,
                                                      geometry.height)}


def _front_passive_ratio(soil: StructureSoilModel, top: float, bottom: float, loads: WallLoads,
                         seismic: bool) -> float:
    """Smallest seismic passive ratio (1 - kv) K_PE / K_P over the front layers in [top, bottom]."""
    if not seismic or (loads.kh == 0 and loads.kv == 0):
        return 1.0
    layers = [l for l in soil.front_profile().layers if l.bottom > top and l.top < bottom]
    return min((seismic_passive_ratio(0.0 if l.behaviour == "undrained" else l.design.phi_eff or 0.0,
                                      loads, seismic) for l in layers), default=1.0)


def _key_sliding_layered(geometry, soil: StructureSoilModel, settings: WallSettings, loads: WallLoads,
                         *, seismic: bool, backfill_slope: float) -> KeySliding:
    """Shear key passive resistance from the layered front profile, the key-tip foundation and
    the actions on the block above the key-tip plane (see ``_key_zone_forces``)."""
    key = geometry.key
    D, H, B = geometry.embedment, geometry.height, geometry.width
    profile = soil.front_profile()
    pond = GAMMA_W * max(H - D - profile.gwt.depth_for("design"), 0.0)
    try:
        dist = lateral_pressure(profile, D + key.depth, top=H - D, state="passive", layerwise=True,
                                total_stress_surcharge=pond)
    except ValueError as exc:
        raise GeoTekError(f"Shear key tip at {H + key.depth:g} m is outside the soil profile: {exc}") from exc
    full, arm = key_passive_from_diagram(dist.z, dist.sigma_h_eff, D, key.depth)
    ratio = _front_passive_ratio(soil, H - D, H + key.depth, loads, seismic)
    reduction = settings.passive_reduction
    x0, _ = key.span(B)
    force = Force("Shear key passive", full * reduction * ratio, 0.0, x0, -arm, "PASSIVE")
    try:
        deep, _ = foundation_from_structure(soil, H - D, H + key.depth, B,
                                            gwt_bearing_correction=settings.gwt_bearing_correction)
    except ValueError as exc:
        raise GeoTekError(f"Shear key tip at {H + key.depth:g} m is outside the soil profile: {exc}") from exc
    extra_v = 0.0
    sv, u, sve = profile.stresses(np.array([H, H + key.depth]), "design")
    if deep.drainage == "drained":
        extra_v = float((B - key.width) * (sve[1] - sve[0]) - key.width * (u[1] - u[0]))
        if seismic:
            extra_v *= 1.0 - loads.kv
    forces = _key_zone_forces(geometry, soil, loads, settings, seismic=seismic, slope=backfill_slope)
    if seismic and loads.kh > 0:
        block = (B - key.width) * float(sv[1] - sv[0])
        forces.append(Force("Soil beside key (inertia)", -loads.kh * block, 0.0, B / 2, -key.depth / 2, "EQ"))
    # Key-bottom uplift beyond the base-level uplift, interpolated front -> retained at the key centre like the
    # base uplift trapezoid (the key-tip plane keeps the front-profile ``extra_v``; the difference is put back).
    _, u_ret, _ = soil.retained_profile().stresses(np.array([H, H + key.depth]), "design")
    share = sum(key.span(B)) / 2 / B
    uplift = max(float(key.width * ((u[1] - u[0]) + ((u_ret[1] - u_ret[0]) - (u[1] - u[0])) * share)), 0.0)
    return KeySliding(key, force, full, arm, reduction, deep, extra_v, uplift=uplift, deep_forces=forces)


def _key_zone_forces(geometry, soil: StructureSoilModel, loads: WallLoads, settings: WallSettings,
                     *, seismic: bool, slope: float) -> list[Force]:
    """Horizontal actions between the base and the key-tip plane on the block above that plane.

    Retained side: active soil, surcharge and seismic increments on the vertical line through the
    heel, from base level to the key bottom (layer-local Coulomb, delta = beta, theta = 0), plus
    the water and TBDY 16.20 dynamic water increments. Front side: the hydrostatic increment.
    """
    key = geometry.key
    H, B, d = geometry.height, geometry.width, key.depth
    run = geometry.heel if isinstance(geometry, CantileverGeometry) else geometry.back_offset
    rise = run * math.tan(math.radians(slope))
    hv = H + rise
    profile = _plane_profile(soil.retained_profile(), rise)
    common = dict(method="coulomb", beta=slope, theta=0.0, delta=slope, layerwise=True, gwt_case="design",
                  steep_seismic=True)
    dyn = seismic and (loads.kh or loads.kv)
    try:
        if slope and any(l.behaviour == "undrained" and l.top < hv + d for l in profile.layers):
            raise GeoTekError("undrained layer with sloping backfill")
        zero = lateral_pressure(profile, hv + d, **common)
        static = lateral_pressure(profile, hv + d, surcharge=loads.surcharge, **common) if loads.surcharge else zero
        water_inc = 0.0
        if dyn and profile.gwt.depth_for("design") < hv + d:
            dynamic, water_ext = _submerged_dynamic(profile, hv + d, loads, settings, loads.surcharge, common, static)
            water_base = 0.0
            if profile.gwt.depth_for("design") < hv:
                short = lateral_pressure(profile, hv, surcharge=loads.surcharge, **common)
                _, water_base = _submerged_dynamic(profile, hv, loads, settings, loads.surcharge, common, short)
            water_inc = water_ext - water_base
        else:
            dynamic = (lateral_pressure(profile, hv + d, surcharge=loads.surcharge, kh=loads.kh, kv=loads.kv,
                                        **common) if dyn else static)
    except (GeoTekError, ValueError) as exc:
        raise GeoTekError(
            "Kayma dişi: diş derinliği boyunca arka aktif itki hesaplanamadı (drenajsız zeminde eğimli "
            "dolgu veya deprem desteklenmiyor, su diş ucunun üstündeyse depremde WallLoads.water_kh gerekir, "
            f"ya da profil yetersiz): {exc}") from exc

    soil0 = key_band_force(zero.z, zero.sigma_h_eff, hv, d)
    soil_q = key_band_force(static.z, static.sigma_h_eff, hv, d)
    soil_e = key_band_force(dynamic.z, dynamic.sigma_h_eff, hv, d)
    parts = [("Key zone earth pressure", soil0, "EH"),
             ("Key zone surcharge pressure", soil_q - soil0, "LS"),
             ("Key zone seismic increment", soil_e - soil_q if dyn else 0.0, "EQ"),
             ("Key zone dynamic water", water_inc, "EQ"),
             ("Key zone water (retained)", key_band_force(zero.z, zero.u, hv, d), "WA")]
    out = [Force(name, -f, 0.0, B, -d / 2, kind) for name, f, kind in parts if abs(f) > 1e-12]
    front = front_water_distribution(soil, H - geometry.embedment, H + d)
    fw = key_band_force(front.z, front.u, H, d)
    if fw > 1e-12:
        out.append(Force("Key zone water (front)", fw, 0.0, 0.0, -d / 2, "WA"))
    return out


def wall_forces_layered(geometry, soil: StructureSoilModel, loads: WallLoads, settings: WallSettings,
                        *, seismic: bool, backfill_slope: float = 0.0,
                        gwt_case: GwtCase = "design") -> WallForces:
    selected = soil_at_case(soil, gwt_case)
    profile, hv, theta, zero, static, dynamic, dynamic_water = _retained_pressures(
        geometry, selected, loads, settings, seismic, backfill_slope, "design")
    gc, H, B = settings.concrete_unit_weight, geometry.height, geometry.width
    warnings = list(dict.fromkeys(zero.warnings + static.warnings + dynamic.warnings))
    if isinstance(geometry, GravityGeometry):
        forces = weight_forces("Wall", gravity_wall_polygon(geometry), gc, loads, seismic)
        if geometry.back_offset:
            warnings.append("Eğimli arka yüzdeki zemin ağırlığı Coulomb itkisine dahildir; ayrıca eklenmedi")
    else:
        base, stem, heel, toe = cantilever_polygons(geometry, backfill_slope)
        forces = weight_forces("Base slab", base, gc, loads, seismic)
        forces += weight_forces("Stem", stem, gc, loads, seismic)
        forces += _soil_weights("Soil over heel", heel, selected.retained_profile(), H, loads, seismic)
        if settings.include_toe_soil:
            forces += _soil_weights("Soil over toe", toe, selected.front_profile(), H, loads, seismic)
        if loads.surcharge and loads.surcharge_resists:
            forces.append(Force("Surcharge over heel", 0.0, -loads.surcharge * geometry.heel,
                                geometry.x_stem_back + geometry.heel / 2, hv, "LS"))
    forces += key_weight_forces(geometry, settings, loads, seismic)
    forces += _thrusts(geometry, profile, hv, theta, zero, static, dynamic, loads, seismic, backfill_slope)
    if dynamic_water > 0:
        d_su = hv - profile.gwt.depth_for("design")
        y = 0.4 * d_su
        forces.append(Force("Dinamik su itkisi (TBDY Denk. 16.20)", -dynamic_water, 0.0,
                            B - y * math.tan(math.radians(theta)), y, "EQ"))
    uf = GAMMA_W * max(H - selected.front_profile().gwt.depth_for("design"), 0.0)
    ur = GAMMA_W * max(H - selected.retained_profile().gwt.depth_for("design"), 0.0)
    if uf + ur > 0:
        forces.append(Force("Uplift", 0.0, B * (uf + ur) / 2,
                            B * (uf + 2 * ur) / (3 * (uf + ur)), 0.0, "WA"))
    fw = _front_water(geometry, selected)
    if fw is not None:
        forces.append(fw)
    front = _front_pressure(geometry, selected, settings)
    warnings += front.warnings
    if settings.use_passive:
        f, z = front.component("effective")
        if f > 0:
            ratio = _front_passive_ratio(selected, H - geometry.embedment, H, loads, seismic)
            forces.append(Force("Passive (front)", f * settings.passive_reduction * ratio, 0.0,
                                0.0, geometry.embedment - z, "PASSIVE"))
    if any(l.behaviour == "undrained" and l.top < hv for l in profile.layers):
        warnings.append("Drenajsız katmanda toplam gerilme/s_u kullanıldı; ayrıca yatay su itkisi eklenmedi")
    if seismic and dynamic.component("effective")[0] < static.component("effective")[0]:
        warnings.append("Seismic thrust lower than static (kv effect); check inputs")
    key = None
    if geometry.key is not None:
        key = _key_sliding_layered(geometry, selected, settings, loads, seismic=seismic,
                                   backfill_slope=backfill_slope)
        warnings += key_warnings(geometry)
        if key.uplift > 1e-9:
            forces.append(Force("Key uplift", 0.0, key.uplift, sum(geometry.key.span(B)) / 2, 0.0, "WA"))
        tip = H + geometry.key.depth
        water = min(selected.front_profile().gwt.depth_for("design"), selected.retained_profile().gwt.depth_for("design"))
        if water < tip:
            warnings.append(format_warning("walls.warning.shear_key_water", depth=round(water, 3)))
    return WallForces(forces, B, geometry.embedment, list(dict.fromkeys(warnings)), key)


UPLIFT_NAMES = ('Uplift', 'Key uplift')


def _check_forward_loading(forces):
    # PASSIVE is sliding resistance, not an applied horizontal action.
    if -sum(f.fx for f in forces if f.kind != "PASSIVE") <= 0:
        raise GeoTekError("Önden baskın yatay yük: ters yönde kayma/devrilme tahkiki bu sürümde yok")


def _bearing_vertical_load(forces, foundation):
    """Gross V for total-stress bearing; existing contact eccentricity is retained."""
    if foundation.drainage == "undrained":
        return -sum(f.fy for f in forces if f.name not in UPLIFT_NAMES)
    return -sum(f.fy for f in forces)


def analyze_wall_layered(geometry, soil, loads, settings, *, seismic, backfill_slope=0.0,
                         gwt_case: GwtCase = "design") -> WallAnalysis:
    wf = wall_forces_layered(geometry, soil, loads, settings, seismic=seismic,
                             backfill_slope=backfill_slope, gwt_case=gwt_case)
    _check_forward_loading(wf.forces)
    foundation, warnings = foundation_from_structure(
        soil, geometry.height - geometry.embedment, geometry.height, geometry.width, gwt_case,
        gwt_bearing_correction=settings.gwt_bearing_correction)
    passive = next((f for f in wf.forces if f.kind == "PASSIVE"), None)
    forces = [f for f in wf.forces if f.kind != "PASSIVE"]
    result = evaluate_checks(
        case="seismic" if seismic else "static", width=wf.width,
        forces=forces, passive=passive,
        foundation=foundation, embedment=wf.embedment, settings=settings, warnings=wf.warnings + warnings,
        key=wf.key,
    )
    if wf.key is not None:
        attach_without_key([result], [analyze_wall_layered(strip_key(geometry), soil, loads, settings, seismic=seismic,
                                                           backfill_slope=backfill_slope, gwt_case=gwt_case)])
    if foundation.drainage == "undrained" and any(f.name in UPLIFT_NAMES for f in forces):
        # Keep the existing uplift/contact eccentricity convention. Only bearing
        # V (inclination and demand) uses total stress, without subtracting U.
        if abs(result.eccentricity) < wf.width / 2:
            v = _bearing_vertical_load(forces, foundation)
            bearing, failure = try_bearing_capacity(
                bearing_capacity,
                method=settings.bearing_method, B=wf.width, D=wf.embedment, phi=0.0, c=foundation.su,
                gamma=foundation.gamma, q=foundation.overburden, V=v, H=result.sum_h,
                e_B=result.eccentricity,
            )
            required = result.checks["bearing"].required
            if bearing is None:
                result.bearing = None
                result.checks["bearing"] = CheckResult(
                    "bearing", 0.0, required, False, f"Bearing capacity exhausted: {failure}")
            else:
                value = bearing.Q_ult / v
                result.bearing = bearing
                result.checks["bearing"] = CheckResult(
                    "bearing", value, required, value >= required,
                    f"q_ult = {bearing.q_ult:.0f} kPa on B' = {bearing.B_eff:.2f} m; "
                    f"q_total = {v / bearing.B_eff:.0f} kPa (V without uplift deduction)",
                )
    return result
