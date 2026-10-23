"""Advanced level: any design code, every option, user-entered factors, Module 1 profiles.

Before running, ``required_inputs`` lists every factor the chosen code/approach needs but
does not provide (with its source label and a hint), so the user can enter it. Analyses
refuse to run while a needed factor is missing and name all of them at once.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from geotek.config.codes import DesignCode, FactorOverride, FactorStatus, UsedFactor, resolve_code
from geotek.core.constants import GAMMA_W
from geotek.core.errors import GeoTekError, LayerDesignError
from geotek.core.models.profile import SoilProfile
from geotek.core.models.walls import (
    Backfill,
    CantileverGeometry,
    FoundationSoil,
    GravityGeometry,
    WallLoads,
    WallSettings,
)
from geotek.engine.limit_state import verify_wall, verify_wall_global_stability
from geotek.engine.stability import SoilBand
from geotek.engine.walls.base import CheckResult, WallAnalysis
from geotek.engine.walls.global_stability import wall_global_stability
from geotek.engine.walls.walls import analyze_cantilever_wall, analyze_gravity_wall

HINTS = {
    ("tbdy2018", "material"): "TBDY değer vermez. Karşılaştırma için EC7 M2: tanφ' 1.25, c' 1.25, c_u 1.4 "
                              "(bunlar EC7 değeridir, TBDY değil).",
    ("tbdy2018", "load"): "TBDY değer vermez (16.7.3.1). TS 500 uygulamasında 1.4G + 1.6Q + 1.6H ve 0.9G + 1.6H "
                          "kullanıldığı görülmektedir (TS 500 metni ile doğrulanmadı).",
}


class MissingFactor(BaseModel):
    path: str
    status: FactorStatus
    source: str
    hint: str = ""


def _paths(code: DesignCode, approach: str | None, seismic: bool) -> list[str]:
    if code.approach == "global_fs":
        case = "seismic" if seismic else "static"
        out = [f"safety.{k}.{case}" for k, v in code.safety_factors.items() if case in v]
        out += [f"eccentricity.{on}.{case}" for on, v in code.eccentricity_limits.items() if case in v]
        return out
    if code.approach == "lrfd":
        group = "extreme" if seismic else "strength"
        out = [f"load.{k}.{j}" for k, v in code.load_factors.items() for j in v]
        out += [f"resistance.{group}.{k}" for k in code.resistance_factors.get(group, {})]
        return out
    key = approach or next(iter(code.approaches))
    if key not in code.approaches:
        raise GeoTekError(f"Unknown design approach {key!r}; available: {sorted(code.approaches)}")
    case = "seismic" if seismic else "static"
    combos = [c for c in code.approaches[key] if case in code.combination(c).applies_to]
    if not seismic and any(c.id == "EQU" for c in code.combinations):
        combos.append("EQU")
    out = []
    for cid in combos:
        c = code.combination(cid)
        for table, values in (("load", c.load_factors), ("material", c.material_factors),
                              ("resistance", c.resistance_factors)):
            for k in values:
                if table == "load" and k == "EQ" and not seismic:
                    continue
                out.append(f"{cid}.{table}.{k}")
    return out


def required_inputs(code_id: str, *, approach: str | None = None, seismic: bool = False,
                    overrides: dict[str, FactorOverride] | None = None,
                    extra_dirs: list[str | Path] | None = None) -> list[MissingFactor]:
    """Factors the analysis needs but the code file (plus overrides) does not provide."""
    code = resolve_code(code_id, overrides, extra_dirs=extra_dirs)
    missing = []
    for path in _paths(code, approach, seismic):
        if code.get(path) is None:
            src = code.source_of(path)
            table = path.split(".")[1] if code.approach == "partial_factors" else path.split(".")[0]
            missing.append(MissingFactor(path=path, status=src.status, source=src.source,
                                         hint=HINTS.get((code.id, table), "")))
    return missing


class FactorRow(BaseModel):
    path: str
    value: float | None
    status: FactorStatus
    source: str


def list_factors(code_id: str, overrides: dict[str, FactorOverride] | None = None, *,
                 extra_dirs: list[str | Path] | None = None) -> list[FactorRow]:
    """Every factor of a design code with its value (None = not given) and source label."""
    code = resolve_code(code_id, overrides, extra_dirs=extra_dirs)
    paths: list[str] = []
    if code.approach == "global_fs":
        paths += [f"safety.{k}.{case}" for k, v in code.safety_factors.items() for case in v]
        paths += [f"eccentricity.{k}.{case}" for k, v in code.eccentricity_limits.items() for case in v]
    elif code.approach == "lrfd":
        paths += [f"load.{k}.{j}" for k, v in code.load_factors.items() for j in v]
        paths += [f"resistance.{k}.{j}" for k, v in code.resistance_factors.items() for j in v]
        paths += [f"eccentricity.{k}.{case}" for k, v in code.eccentricity_limits.items() for case in v]
    else:
        for c in code.combinations:
            for table, values in (("load", c.load_factors), ("material", c.material_factors),
                                  ("resistance", c.resistance_factors)):
                paths += [f"{c.id}.{table}.{k}" for k in values]
    rows = []
    for path in paths:
        src = code.source_of(path)
        rows.append(FactorRow(path=path, value=code.get(path), status=src.status, source=src.source))
    return rows


def _ensure_complete(code_id, approach, seismic, overrides):
    missing = required_inputs(code_id, approach=approach, seismic=seismic, overrides=overrides)
    if missing:
        lines = "; ".join(f"{m.path} ({m.status}: {m.source})" for m in missing)
        raise GeoTekError(f"Bu analiz için girilmesi gereken katsayılar eksik: {lines}")


# --- Module 1 -> Module 2 ------------------------------------------------------------------


def foundation_from_profile(profile: SoilProfile, base_depth: float, *,
                            drainage: Literal["drained", "undrained"] | None = None,
                            gwt_case: Literal["insitu", "design", "seismic"] = "design") -> FoundationSoil:
    """Foundation soil at the wall base from the layer's engineer-approved design parameters.

    ``base_depth`` is measured from the profile surface (front ground). gamma for the N_gamma
    term is effective if the water table is at or above the base; the overburden is the
    effective vertical stress at base level.
    """
    layer = profile.layer_at(base_depth + 1e-6)
    d = layer.design
    drainage = drainage or layer.behaviour
    gwt = profile.gwt.depth_for(gwt_case)
    gamma = (layer.require_gamma_sat() - GAMMA_W) if gwt <= base_depth else layer.gamma
    overburden = float(profile.stresses(base_depth, gwt_case)[2]) if base_depth > 0 else 0.0
    if drainage == "undrained":
        if d.su is None:
            raise LayerDesignError(layer, "su_missing")
        return FoundationSoil(drainage="undrained", su=d.su, gamma=gamma, overburden=overburden)
    if d.phi_eff is None:
        raise LayerDesignError(layer, "phi_missing")
    return FoundationSoil(phi=d.phi_eff, c=d.c_eff, gamma=gamma, overburden=overburden,
                          delta_base=d.delta_base)


def bands_from_profile(profile: SoilProfile, base_depth: float,
                       drainage: Literal["drained", "undrained"] | None = None) -> list[SoilBand]:
    """Soil bands below the base for global stability; elevation 0 = base level."""
    bands = []
    for layer in profile.layers:
        if layer.bottom <= base_depth:
            continue
        top = base_depth - max(layer.top, base_depth)
        mode = drainage or layer.behaviour
        d = layer.design
        if mode == "undrained":
            if d.su is None:
                raise LayerDesignError(layer, "su_missing")
            bands.append(SoilBand(top=top, gamma=layer.require_gamma_sat(), c=d.su, phi=0.0))
        else:
            if d.phi_eff is None:
                raise LayerDesignError(layer, "phi_missing")
            bands.append(SoilBand(top=top, gamma=layer.require_gamma_sat(), c=d.c_eff, phi=d.phi_eff))
    return bands


# --- analyses ------------------------------------------------------------------------------


@dataclass
class AdvancedWallResult:
    code: str
    approach: str | None
    analyses: list[WallAnalysis]
    global_stability: list[tuple[str, CheckResult]]
    factors_used: list[UsedFactor]
    warnings: list[str] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return all(a.passed for a in self.analyses) and all(c.passed for _, c in self.global_stability)


def analyze_wall_advanced(
    geometry: CantileverGeometry | GravityGeometry,
    backfill: Backfill,
    foundation: FoundationSoil,
    loads: WallLoads | None = None,
    settings: WallSettings | None = None,
    *,
    seismic: bool = False,
    approach: str | None = None,
    foundation_bands: list[SoilBand] | None = None,
    water_level: float | None = None,
) -> AdvancedWallResult:
    loads = loads or WallLoads()
    settings = settings or WallSettings()
    _ensure_complete(settings.design_code, approach, seismic, settings.factor_overrides)
    code = resolve_code(settings.design_code, settings.factor_overrides)
    if code.approach == "global_fs":
        analyze = analyze_cantilever_wall if isinstance(geometry, CantileverGeometry) else analyze_gravity_wall
        analyses = [analyze(geometry, backfill, foundation, loads, settings, seismic=seismic)]
        glob = []
        if foundation_bands:
            _, chk = wall_global_stability(geometry, backfill, foundation_bands, loads, settings,
                                           seismic=seismic, water_level=water_level)
            glob = [("seismic" if seismic else "static", chk)]
    else:
        analyses = verify_wall(geometry, backfill, foundation, loads, settings, seismic=seismic, approach=approach)
        glob = (verify_wall_global_stability(geometry, backfill, foundation_bands, loads, settings,
                                             seismic=seismic, approach=approach, water_level=water_level)
                if foundation_bands else [])
    used: dict[str, UsedFactor] = {}
    for a in analyses:
        for f in a.factors_used:
            used[f.path] = f
    for _, c in glob:
        for f in c.factors_used:
            used[f.path] = f
    warnings = sorted({w for a in analyses for w in a.warnings})
    if not foundation_bands:
        warnings.append("Toptan göçme tahkiki yapılmadı (temel zemini bantları verilmedi)")
    return AdvancedWallResult(code=code.id, approach=approach, analyses=analyses, global_stability=glob,
                              factors_used=list(used.values()), warnings=warnings)


def check_wall_advanced(
    geometry: CantileverGeometry | GravityGeometry,
    backfill: Backfill,
    foundation: FoundationSoil,
    loads: WallLoads | None = None,
    settings: WallSettings | None = None,
    *,
    include_seismic: bool = False,
    approach: str | None = None,
    foundation_bands: list[SoilBand] | None = None,
    water_level: float | None = None,
) -> AdvancedWallResult:
    """``analyze_wall_advanced`` for the static case and, if asked, the seismic case, merged."""
    parts = [analyze_wall_advanced(geometry, backfill, foundation, loads, settings, seismic=s, approach=approach,
                                   foundation_bands=foundation_bands, water_level=water_level)
             for s in ([False, True] if include_seismic else [False])]
    return _merge(parts, approach)


def _merge(parts: list[AdvancedWallResult], approach: str | None) -> AdvancedWallResult:
    used: dict[str, UsedFactor] = {}
    for p in parts:
        for f in p.factors_used:
            used[f.path] = f
    warnings = list(dict.fromkeys(w for p in parts for w in p.warnings))
    return AdvancedWallResult(code=parts[0].code, approach=approach,
                              analyses=[a for p in parts for a in p.analyses],
                              global_stability=[g for p in parts for g in p.global_stability],
                              factors_used=list(used.values()), warnings=warnings)


def _failing(result: AdvancedWallResult) -> list[str]:
    out = [f"{a.case}:{k}" for a in result.analyses for k, c in a.checks.items() if not c.passed]
    out += [f"{case}:global_stability" for case, c in result.global_stability if not c.passed]
    return out


@dataclass
class AdvancedSizingResult:
    geometry: CantileverGeometry | GravityGeometry
    result: AdvancedWallResult
    passed: bool
    governing: str
    """Check that set the width (the last one failing at B - step), or the failing ones."""
    iterations: int = 0
    warnings: list[str] = field(default_factory=list)


def size_wall_advanced(
    wall_type: Literal["cantilever", "gravity"],
    height: float,
    backfill: Backfill,
    foundation: FoundationSoil,
    loads: WallLoads | None = None,
    settings: WallSettings | None = None,
    *,
    embedment: float,
    include_seismic: bool = False,
    approach: str | None = None,
    foundation_bands: list[SoilBand] | None = None,
    water_level: float | None = None,
    max_width_ratio: float = 1.2,
) -> AdvancedSizingResult:
    """Smallest base width (0.05 m steps, basic-level proportions) passing every check of the code.

    Same search as ``walls_basic.size_wall``; the slow global stability check runs only once
    the external checks pass.
    """
    from geotek.services.walls_basic import STEP, _ceil, proportion_for

    settings = settings or WallSettings()
    for s in ([False, True] if include_seismic else [False]):
        _ensure_complete(settings.design_code, approach, s, settings.factor_overrides)

    def run(geom, with_global):
        return check_wall_advanced(geom, backfill, foundation, loads, settings, include_seismic=include_seismic,
                                   approach=approach, foundation_bands=foundation_bands if with_global else None,
                                   water_level=water_level)

    B = max(_ceil(0.3 * height), 0.9)
    best = None
    last_fail: list[str] = []
    it = 0
    while B <= max_width_ratio * height + 1e-9:
        geom = proportion_for(wall_type, height, B, embedment)
        if geom is not None:
            it += 1
            res = run(geom, with_global=False)
            fails = _failing(res)
            if not fails and foundation_bands:
                res = run(geom, with_global=True)
                fails = _failing(res)
            best = (geom, res, fails)
            if not fails:
                break
            last_fail = fails
        B = round(B + STEP, 6)
    if best is None:
        raise GeoTekError("No feasible geometry for these proportions")
    geom, res, fails = best
    passed = not fails
    governing = (last_fail[0] if last_fail else "minimum width") if passed else ", ".join(fails)
    warnings = [] if passed else [f"B = {max_width_ratio:g}H'ye kadar uygun genişlik bulunamadı; "
                                  f"sağlanamayan: {governing}"]
    return AdvancedSizingResult(geometry=geom, result=res, passed=passed, governing=governing, iterations=it,
                                warnings=warnings)
