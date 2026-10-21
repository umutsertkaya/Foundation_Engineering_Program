"""Partial-factor (limit state) verification: Eurocode 7 and AASHTO LRFD.

Every check is reported as an over-design factor ODF = R_d / E_d with 1.0 required.

Eurocode 7 (EN 1997-1), factored-actions approach
- Design strengths: tan phi'_d = tan phi'_k / gamma_phi, c'_d = c'_k / gamma_c,
  s_u,d = s_u,k / gamma_cu. Earth pressures and resistances are recomputed with them.
- Actions: two sets per combination. "Stabilising": structure and soil weights x gamma_G,fav,
  earth pressure x gamma_G (unfavourable), surcharge thrust x gamma_Q, surcharge over the heel
  x 0. "All unfavourable" (bearing): every permanent action x gamma_G, variables x gamma_Q.
- Sliding and eccentricity use the stabilising set; bearing uses the unfavourable set.
- Overturning: EQU (gamma_G,dst, gamma_G,stb, gamma_Q,dst; EQU material factors).
- Eccentricity: resultant within the middle two-thirds (e <= B/3), EN 1997-1 6.5.4.
- Design approaches: DA1 (C1 and C2), DA2, DA3 as given in the code file.
- Seismic design (EN 1998-5) is not implemented.

AASHTO LRFD
- Strength I: "Ia" (DC, EV at gamma_min; EH at gamma_max) for sliding and eccentricity;
  "Ib" (all gamma_max) for bearing. Extreme Event I adds EQ x 1.0 with LS x gamma_EQ.
- Resistance factors phi multiply nominal resistances; overturning is replaced by the
  eccentricity limit (AASHTO 11.6.3.3).

Factor values come from the YAML design code files, which are still marked draft until
verified against the standards (Phase 0).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Literal

from geotek.config.codes import DesignCode, FactorLog, FactorOverride, FactorSource, UsedFactor, resolve_code
from geotek.core.errors import GeoTekError, MissingFactorsError
from geotek.core.models.profile import DesignParameters, SoilProfile
from geotek.core.models.walls import (
    Backfill,
    CantileverGeometry,
    FoundationSoil,
    GravityGeometry,
    WallLoads,
    WallSettings,
)
from geotek.engine.bearing import bearing_capacity
from geotek.engine.sheet_pile import SheetPileResult, anchored_sheet_pile, cantilever_sheet_pile
from geotek.engine.stability import SoilBand
from geotek.engine.walls.base import (
    CheckResult, Force, KeySliding, WallAnalysis, attach_without_key, key_result, key_sliding_basic,
    overturning_moments, passive_force, seismic_passive_ratio, strip_key,
)
from geotek.engine.walls.global_stability import wall_global_stability
from geotek.engine.walls.walls import wall_forces

@dataclass
class LimitStateCase:
    name: str
    code: str
    tan_phi: float = 1.0
    cohesion: float = 1.0
    su: float = 1.0
    stabilising: dict[str, float] = field(default_factory=dict)
    """Load factors by kind for sliding / eccentricity (vertical LS gets key 'LS_v')."""
    unfavourable: dict[str, float] = field(default_factory=dict)
    """Load factors by kind for bearing."""
    water: float = 1.0
    r_bearing: float = 1.0
    r_sliding: float = 1.0
    r_passive: float = 1.0
    r_global: float = 1.0
    r_sheet_passive: float = 1.0
    """All resistance factors stored as divisors (gamma_R; LRFD 1/phi)."""
    r_overturning: float | None = None
    """Required M_R / M_O within the combination (TBDY gamma_Rdev); None = no such check."""
    passive_participation: float = 1.0
    """Fraction of the design passive resistance usable against sliding (TBDY 0.3)."""
    e_limit: float = 1 / 3
    seismic: bool = False
    factors_used: list[UsedFactor] = field(default_factory=list)


def _partial_case(code: DesignCode, combo_id: str, seismic: bool) -> LimitStateCase:
    c = code.combination(combo_id)
    log = FactorLog(code)

    def f(table: str, key: str, default: float | None = None) -> float:
        return log.value(f"{combo_id}.{table}.{key}", default)

    g_unf, g_fav, q_unf = f("load", "G_unfav"), f("load", "G_fav"), f("load", "Q_unfav")
    q_fav = f("load", "Q_fav", 0.0) if "Q_fav" in c.load_factors else 0.0
    eq = f("load", "EQ") if seismic else 0.0
    case = LimitStateCase(
        name=combo_id, code=code.id,
        tan_phi=f("material", "tan_phi"), cohesion=f("material", "c_eff"), su=f("material", "su"),
        stabilising={"DC": g_fav, "EV": g_fav, "EH": g_unf, "LS": q_unf, "LS_v": q_fav, "EQ": eq},
        unfavourable={"DC": g_unf, "EV": g_unf, "EH": g_unf, "LS": q_unf, "LS_v": q_unf, "EQ": eq},
        # Legacy water scalar only: WA is never inferred from G. E4 always
        # installs an explicit WA factor via layered_limit_state_cases.
        water=g_unf,
        r_bearing=f("resistance", "bearing"), r_sliding=f("resistance", "sliding"),
        r_passive=f("resistance", "earth_resistance"), r_global=f("resistance", "global_stability"),
        r_sheet_passive=f("resistance", "earth_resistance"),
        r_overturning=f("resistance", "overturning") if "overturning" in c.resistance_factors else None,
        passive_participation=c.passive_participation,
        e_limit=1 / 3, seismic=seismic,
    )
    assert "WA" not in case.stabilising and "WA" not in case.unfavourable, "E4 must set WA explicitly"
    case.factors_used = log.as_list()
    return case


def _lrfd_case(code: DesignCode, seismic: bool) -> LimitStateCase:
    log = FactorLog(code)
    group = "extreme" if seismic else "strength"
    ls = log.value(f"load.LS.{'extreme_I' if seismic else 'strength_I'}")
    eq = log.value("load.EQ.extreme_I") if seismic else 0.0

    def inv(key: str, fallback: str | None = None) -> float:
        path = f"resistance.{group}.{key}"
        if fallback and key not in code.resistance_factors.get(group, {}):
            path = f"resistance.{group}.{fallback}"
        return 1.0 / log.value(path)

    case = LimitStateCase(
        name="Extreme Event I" if seismic else "Strength I", code=code.id,
        stabilising={"DC": log.value("load.DC.min"), "EV": log.value("load.EV.min"),
                     "EH": log.value("load.EH_active.max"), "LS": ls, "LS_v": 0.0, "EQ": eq},
        unfavourable={"DC": log.value("load.DC.max"), "EV": log.value("load.EV.max"),
                      "EH": log.value("load.EH_active.max"), "LS": ls, "LS_v": ls, "EQ": eq},
        water=1.0,
        r_bearing=inv("bearing"),
        r_sliding=inv("sliding_cast_in_place_on_sand", "sliding"),
        r_passive=inv("passive_resistance"),
        r_global=inv("global_stability"),
        r_sheet_passive=inv("sheet_pile_passive", "passive_resistance"),
        e_limit=log.value(f"eccentricity.soil.{'extreme' if seismic else 'strength'}"),
        seismic=seismic,
    )
    case.factors_used = log.as_list()
    return case


def limit_state_cases(code_id: str | DesignCode, *, seismic: bool = False,
                      approach: str | None = None,
                      overrides: dict[str, FactorOverride] | None = None) -> list[LimitStateCase]:
    """Combinations to verify. ``approach`` names an entry of the code's ``approaches``
    (EC7: DA1, DA2, DA3); default is the first one. ``overrides`` are user factor values."""
    code = code_id if isinstance(code_id, DesignCode) else resolve_code(code_id, overrides)
    if not code.is_usable:
        raise GeoTekError(f"Design code {code.id!r} is incomplete; enter its factors first")
    if code.approach == "partial_factors":
        if not code.approaches:
            raise GeoTekError(f"Design code {code.id!r} defines no design approaches")
        key = approach or next(iter(code.approaches))
        if key not in code.approaches:
            raise GeoTekError(f"Unknown design approach {key!r}; available: {sorted(code.approaches)}")
        case = "seismic" if seismic else "static"
        combos = [cid for cid in code.approaches[key] if case in code.combination(cid).applies_to]
        if not combos:
            raise GeoTekError(
                f"Design code {code.id!r} has no {case} combination in {key}"
                + (" (seismic EC7 design needs EN 1998-5, not implemented)" if seismic else "")
            )
        return [_partial_case(code, cid, seismic) for cid in combos]
    if code.approach == "lrfd":
        return [_lrfd_case(code, seismic)]
    raise GeoTekError(f"Design code {code.id!r} uses global factors of safety; use the ASD functions")


# --- helpers -----------------------------------------------------------------------------


def _design_angle(phi: float, factor: float) -> float:
    return math.degrees(math.atan(math.tan(math.radians(phi)) / factor))


def _design_backfill(backfill: Backfill, case: LimitStateCase) -> Backfill:
    phi_d = _design_angle(backfill.phi, case.tan_phi)
    if backfill.slope > phi_d:
        raise GeoTekError(f"{case.name}: backfill slope {backfill.slope} exceeds the design phi {phi_d:.1f}")
    delta = None if backfill.delta is None else _design_angle(backfill.delta, case.tan_phi)
    return backfill.model_copy(update={"phi": phi_d, "delta": delta})


def _design_foundation(f: FoundationSoil, case: LimitStateCase) -> FoundationSoil:
    upd = {"phi": _design_angle(f.phi, case.tan_phi), "c": f.c / case.cohesion,
           "adhesion": f.adhesion / case.cohesion}
    if f.su is not None:
        upd["su"] = f.su / case.su
    if f.delta_base is not None:
        upd["delta_base"] = _design_angle(f.delta_base, case.tan_phi)
    return f.model_copy(update=upd)


def _factor_forces(forces: list[Force], factors: dict[str, float]) -> list[Force]:
    out = []
    for f in forces:
        key = "LS_v" if f.kind == "LS" and f.fx == 0 else f.kind
        if key not in factors:
            raise GeoTekError(f"No load factor for kind {key!r} (force {f.name!r})")
        k = factors[key]
        out.append(Force(f.name, f.fx * k, f.fy * k, f.x, f.y, f.kind))
    return out


def _sums(forces):
    v = -sum(f.fy for f in forces)
    h = -sum(f.fx for f in forces)
    m_res = -sum(f.x * f.fy for f in forces)
    m_ot = -sum(f.y * f.fx for f in forces)
    return v, h, m_res, m_ot


def _odf(name, rd, ed, detail):
    value = rd / ed if ed > 0 else math.inf
    return CheckResult(name, value, 1.0, value >= 1.0, f"R_d = {rd:.1f}, E_d = {ed:.1f}; {detail}")


# --- walls -------------------------------------------------------------------------------


def verify_wall(
    geometry: CantileverGeometry | GravityGeometry,
    backfill: Backfill,
    foundation: FoundationSoil,
    loads: WallLoads | None = None,
    settings: WallSettings | None = None,
    *,
    seismic: bool = False,
    approach: str | None = None,
) -> list[WallAnalysis]:
    """External stability for each limit-state combination of ``settings.design_code``.

    EC7 adds an 'EQU' entry holding the overturning check.
    """
    loads = loads or WallLoads()
    settings = settings or WallSettings()
    code = resolve_code(settings.design_code, settings.factor_overrides)
    results = []
    for case in limit_state_cases(code, seismic=seismic, approach=approach):
        bf_d = _design_backfill(backfill, case)
        fd_d = _design_foundation(foundation, case)
        wf = wall_forces(geometry, bf_d, loads, settings, seismic=seismic)
        B = wf.width
        checks: dict[str, CheckResult] = {}

        stab = _factor_forces(wf.forces, case.stabilising)
        v, h, m_res, m_ot = _sums(stab)
        e = B / 2 - (m_res - m_ot) / v
        checks["eccentricity"] = CheckResult(
            "eccentricity", case.e_limit / (abs(e) / B) if e else math.inf, 1.0,
            abs(e) / B <= case.e_limit, f"e = {e:.3f} m, e/B = {abs(e) / B:.3f} (limit {case.e_limit:.3f})")

        b_eff = max(B - 2 * abs(e), 0.0)
        if fd_d.drainage == "undrained":
            r_base, detail = fd_d.su * b_eff, "s_u,d B'"
        else:
            db = fd_d.delta_base if fd_d.delta_base is not None else fd_d.phi
            r_base = v * math.tan(math.radians(db)) + fd_d.adhesion * b_eff
            detail = f"V_d tan({db:.1f})"
        rd = r_base / case.r_sliding
        phi_front = 0.0 if fd_d.drainage == "undrained" else fd_d.phi
        pp = passive_force(fd_d, wf.embedment, settings, bf_d.gamma, reduction=1.0,
                           seismic_ratio=seismic_passive_ratio(phi_front, loads, seismic))
        toe_term = 0.0
        if pp is not None:
            toe_term = case.passive_participation * pp.fx / case.r_passive
            rd += toe_term
            share = "" if case.passive_participation == 1 else f"{case.passive_participation:g} x "
            detail += f" + {share}P_p,d"
        key = key_sliding_basic(geometry, fd_d, settings, bf_d.gamma, reduction=1.0, backfill=bf_d,
                                loads=loads, seismic=seismic)
        key_res, h_sl = None, h
        if key is not None:
            key_res, rd, h_sl, detail = _key_sliding(case, key, rd, toe_term, v, b_eff, h, detail)
        checks["sliding"] = _odf("sliding", rd, h_sl, detail)
        if case.r_overturning is not None:
            checks["overturning"] = _odf("overturning", m_res / case.r_overturning, m_ot,
                                         f"M_R / gamma_Rdev (gamma_Rdev = {case.r_overturning:g}) vs M_O")

        unf = _factor_forces(wf.forces, case.unfavourable)
        vb, hb, mrb, mob = _sums(unf)
        eb = B / 2 - (mrb - mob) / vb
        bearing = None
        if abs(eb) < B / 2:
            phi = 0.0 if fd_d.drainage == "undrained" else fd_d.phi
            c = fd_d.su if fd_d.drainage == "undrained" else fd_d.c
            bearing = bearing_capacity(method=settings.bearing_method, B=B, D=wf.embedment, phi=phi, c=c,
                                       gamma=fd_d.gamma, q=fd_d.overburden, V=vb, H=max(hb, 0.0), e_B=eb)
            checks["bearing"] = _odf("bearing", bearing.Q_ult / case.r_bearing, vb,
                                     f"q_ult = {bearing.q_ult:.0f} kPa on B' = {bearing.B_eff:.2f} m")
        else:
            checks["bearing"] = CheckResult("bearing", 0.0, 1.0, False, "Resultant outside the base")

        q_avg = vb / B
        q_max = q_avg * (1 + 6 * abs(eb) / B) if abs(eb) <= B / 6 else 2 * vb / (3 * max(B / 2 - abs(eb), 1e-9))
        q_min = max(q_avg * (1 - 6 * abs(eb) / B), 0.0) if abs(eb) <= B / 6 else 0.0
        results.append(WallAnalysis(
            case=case.name, width=B, forces=stab, sum_v=v, sum_h=h, m_resisting=m_res,
            m_overturning=m_ot, eccentricity=e, q_max=q_max, q_min=q_min, bearing=bearing,
            checks=checks, warnings=list(wf.warnings), factors_used=list(case.factors_used),
            shear_key=key_res,
        ))
        if key is not None:
            results[-1].forces.append(key.passive)

    if geometry.key is not None:
        attach_without_key(results, verify_wall(strip_key(geometry), backfill, foundation, loads, settings,
                                                seismic=seismic, approach=approach))
    if not seismic and any(c.id == "EQU" for c in code.combinations):
        results.append(_ec7_equ(code, geometry, backfill, loads, settings))
    return results


def _key_sliding(case: LimitStateCase, key: KeySliding, rd_base: float, toe_term: float, v: float,
                 b_eff: float, driving: float, detail: str):
    """Shear key sliding in partial-factor form: R_d of the base surface (``rd_base`` incl. toe
    passive) and of the plane through the key tip, each plus the design key passive.

    Returns (ShearKeyResult, governing R_d, detail). The key passive is divided by gamma_R,e and
    multiplied by the passive participation, like the toe passive.
    """
    key_term = case.passive_participation * key.passive.fx / case.r_passive
    if key.deep.drainage == "undrained":
        deep = key.deep.su * b_eff / case.r_sliding
    else:
        v_deep = v + case.stabilising["EV"] * key.extra_v
        deep = (v_deep * math.tan(math.radians(key.deep.phi)) + key.deep.c * b_eff) / case.r_sliding
    rb, rt = rd_base + key_term, deep + toe_term + key_term
    driving_deep = driving - sum(f.fx for f in _factor_forces(key.deep_forces, case.stabilising))
    res = key_result(key, rb, rt, driving, key_term, driving_deep)
    # The sliding check reports R_d and E_d of the governing surface.
    rd_eq, ed_eq = (rb, driving) if res.governing == "base" else (rt, driving_deep)
    return res, rd_eq, ed_eq, (f"{detail} + key P_p,d; governing surface: {res.governing} "
                              f"(base {res.fs_base_surface:.3f}, key tip {res.fs_deep_surface:.3f})")


def _ec7_equ(code, geometry, backfill, loads, settings) -> WallAnalysis:
    combo = code.combination("EQU")
    log = FactorLog(code)
    case = LimitStateCase(name="EQU", code=code.id, tan_phi=log.value("EQU.material.tan_phi"))
    wf = wall_forces(geometry, _design_backfill(backfill, case), loads, settings, seismic=False)
    stb = log.value("EQU.load.G_stb")
    q_stb = log.value("EQU.load.Q_stb") if "Q_stb" in combo.load_factors else 0.0
    factors = {"DC": stb, "EV": stb, "EH": log.value("EQU.load.G_dst"),
               "LS": log.value("EQU.load.Q_dst"), "LS_v": q_stb}
    forces = _factor_forces(wf.forces, factors)
    v, h, m_res, m_ot = _sums(forces)
    check = _odf("overturning", m_res, m_ot, "M_stb,d / M_dst,d about the toe")
    return WallAnalysis(case="EQU", width=wf.width, forces=forces, sum_v=v, sum_h=h, m_resisting=m_res,
                        m_overturning=m_ot, eccentricity=wf.width / 2 - (m_res - m_ot) / v,
                        q_max=math.nan, q_min=math.nan, bearing=None, checks={"overturning": check},
                        warnings=list(wf.warnings), factors_used=log.as_list())


# The WA extension is local to the new structure engine. Inserting a null WA in a
# built-in YAML would also change the legacy required_inputs contract for dry walls.
def layered_design_code(settings: WallSettings) -> DesignCode:
    """Code copy with explicit, project-supplied WA paths; never infer WA from G/EH.

    Partial-code tables support null. LRFD load tables currently accept floats only,
    so an absent WA key is the missing value until an override supplies that float.
    Nothing is written to a code file and the legacy code reader is unchanged.
    """
    def is_water(path):
        return path.endswith(".load.WA") or path.startswith("load.WA.")

    normal = {p: v for p, v in settings.factor_overrides.items() if not is_water(p)}
    water = {p: v for p, v in settings.factor_overrides.items() if is_water(p)}
    for path, value in water.items():
        ov = FactorOverride.model_validate(value)
        if not math.isfinite(ov.value) or ov.value < 0:
            raise GeoTekError(f"WA load factor {path!r} must be finite and non-negative")
    code = resolve_code(settings.design_code, normal).model_copy(deep=True)
    if code.approach == "global_fs":
        if water:
            raise GeoTekError("ASD global FS does not apply WA load factors")
        return code
    source = FactorSource(
        source="GeoTek E4: ayrı WA yük katsayısı mevcut doğrulanmış kaynak paketinde verilmedi; "
               "proje mühendisi kaynak belirterek girmeli", status="not_in_source")
    if code.approach == "partial_factors":
        for combo in code.combinations:
            combo.load_factors.setdefault("WA", None)
            code.factor_sources.setdefault(f"{combo.id}.load.WA", source)
    else:
        code.load_factors.setdefault("WA", {})
        for key in ("strength_I", "extreme_I"):
            code.factor_sources.setdefault(f"load.WA.{key}", source)
        for path, value in water.items():
            if path not in {"load.WA.strength_I", "load.WA.extreme_I"}:
                raise GeoTekError(f"Unknown WA factor path {path!r}")
            ov = FactorOverride.model_validate(value)
            code.load_factors["WA"][path.rsplit(".", 1)[1]] = ov.value
    return code.with_overrides(water)


def required_layered_inputs(settings: WallSettings, *, approach=None, seismic=False, water=False,
                            include_equ=True, include_global=False):
    """The existing code path/source mechanism, scoped to actions present in this wall."""
    # Lazy import: walls_advanced itself imports the legacy engines in this module.
    from geotek.services.walls_advanced import HINTS, MissingFactor, _paths

    code = layered_design_code(settings)
    paths = list(_paths(code, approach, seismic))
    if include_global:
        # Enumerate required surface-action paths even if a code table omits a key.
        if code.approach == "partial_factors":
            key = approach or next(iter(code.approaches))
            state = "seismic" if seismic else "static"
            for cid in code.approaches[key]:
                if state in code.combination(cid).applies_to:
                    paths += [f"{cid}.load.G_unfav", f"{cid}.load.Q_unfav"]
        elif code.approach == "lrfd":
            paths += ["load.DC.max", "load.EV.max",
                      f"load.LS.{'extreme_I' if seismic else 'strength_I'}"]
    if not include_equ:
        paths = [p for p in paths if not p.startswith("EQU.")]
    paths = [p for p in paths if not (p.endswith(".load.WA") or p.startswith("load.WA.")) or water]
    if code.approach == "lrfd":
        paths = [p for p in paths if not p.startswith("load.WA.")]
        if water:
            paths.append(f"load.WA.{'extreme_I' if seismic else 'strength_I'}")
    missing = []
    for path in dict.fromkeys(paths):
        try:
            value = code.get(path)
        except GeoTekError:
            value = None
        if value is None:
            src = code.source_of(path)
            table = path.split(".")[1] if code.approach == "partial_factors" else path.split(".")[0]
            missing.append(MissingFactor(
                path=path, status=src.status, source=src.source,
                hint=("Su itkisi ve kaldırma için ayrı WA katsayısı girin; G/EH katsayısı otomatik kullanılmaz"
                      if ".WA" in path else HINTS.get((code.id, table), "")),
            ))
    return missing


def _design_structure_soil(soil, case):
    def profile_design(profile):
        prof = _design_profile(profile, case)
        layers = []
        for layer in prof.layers:
            db = layer.design.delta_base
            if db is not None:
                layer = layer.model_copy(update={"design": layer.design.model_copy(
                    update={"delta_base": _design_angle(db, case.tan_phi)})})
            layers.append(layer)
        return prof.model_copy(update={"layers": layers})

    retained = profile_design(soil.retained_profile())
    fill_ids = {l.id for l in soil.retained_fill}
    return soil.model_copy(update={"profile": profile_design(soil.profile),
                                   "retained_fill": [l for l in retained.layers if l.id in fill_ids]})


def layered_limit_state_cases(settings, *, seismic=False, approach=None, water=False):
    """Layered combinations with the WA factor recorded only if water acts."""
    code = layered_design_code(settings)
    cases = limit_state_cases(code, seismic=seismic, approach=approach)
    if water:
        for case in cases:
            path = (f"{case.name}.load.WA" if code.approach == "partial_factors" else
                    f"load.WA.{'extreme_I' if seismic else 'strength_I'}")
            log = FactorLog(code)
            case.water = log.value(path)
            case.stabilising["WA"] = case.unfavourable["WA"] = case.water
            case.factors_used += log.as_list()
    return cases


def verify_wall_layered(geometry, soil, loads, settings, *, seismic: bool,
                        approach: str | None, backfill_slope: float = 0.0,
                        gwt_case="design") -> list[WallAnalysis]:
    """External stability of the structure copy, using design strengths in every layer."""
    from geotek.engine.walls.layered import (
        _bearing_vertical_load, _check_forward_loading, analyze_wall_layered,
        foundation_from_structure, soil_at_case, wall_forces_layered,
    )

    code = layered_design_code(settings)
    if code.approach == "global_fs":
        return [analyze_wall_layered(geometry, soil, loads, settings, seismic=seismic,
                                     backfill_slope=backfill_slope, gwt_case=gwt_case)]
    selected = soil_at_case(soil, gwt_case)
    # With a shear key the key-zone water forces (WA) reach the key tip.
    water_level = geometry.height + (geometry.key.depth if geometry.key is not None else 0.0)
    water = min(selected.front_profile().gwt.depth_for("design"),
                selected.retained_profile().gwt.depth_for("design")) < water_level
    missing = required_layered_inputs(settings, approach=approach, seismic=seismic, water=water)
    if missing:
        raise MissingFactorsError(missing)
    results = []
    for case in layered_limit_state_cases(settings, seismic=seismic, approach=approach, water=water):
        design_soil = _design_structure_soil(selected, case)
        wf = wall_forces_layered(geometry, design_soil, loads, settings, seismic=seismic,
                                 backfill_slope=backfill_slope)
        fd, warnings = foundation_from_structure(
            design_soil, geometry.height - geometry.embedment, geometry.height, geometry.width,
            gwt_bearing_correction=settings.gwt_bearing_correction)
        forces = [f for f in wf.forces if f.kind != "PASSIVE"]
        _check_forward_loading(forces)
        passive = next((f for f in wf.forces if f.kind == "PASSIVE"), None)
        stab = _factor_forces(forces, case.stabilising)
        _check_forward_loading(stab)
        v, h, mr, mo = _sums(stab)
        if v <= 0:
            raise GeoTekError(f"{case.name}: net vertical load is not compressive")
        B = wf.width
        e = B / 2 - (mr - mo) / v
        checks = {"eccentricity": CheckResult(
            "eccentricity", case.e_limit / (abs(e) / B) if e else math.inf, 1.0,
            abs(e) / B <= case.e_limit, f"e = {e:.3f} m, limit e/B = {case.e_limit:g}")}
        be = max(B - 2 * abs(e), 0.0)
        if fd.drainage == "undrained":
            resistance, detail = fd.su * be, "s_u,d B'"
        else:
            db = fd.delta_base if fd.delta_base is not None else fd.phi
            resistance = v * math.tan(math.radians(db)) + fd.adhesion * be
            detail = f"V_d tan({db:.3f}) + c_a B'"
        rd = resistance / case.r_sliding
        toe_term = 0.0
        if passive is not None:
            toe_term = case.passive_participation * passive.fx / case.r_passive
            rd += toe_term
        key_res, h_sl = None, h
        if wf.key is not None:
            key_res, rd, h_sl, detail = _key_sliding(case, wf.key, rd, toe_term, v, be, h, detail)
        checks["sliding"] = _odf("sliding", rd, h_sl, detail)
        if case.r_overturning is not None:
            mr_ot, mo_ot = overturning_moments(stab, mr, mo, settings)
            checks["overturning"] = _odf("overturning", mr_ot / case.r_overturning, mo_ot,
                                         f"M_R / gamma_Rdev; uplift_moment={settings.uplift_moment}")
        unf = _factor_forces(forces, case.unfavourable)
        _check_forward_loading(unf)
        vb, hb, mrb, mob = _sums(unf)
        if vb <= 0:
            raise GeoTekError(f"{case.name}: bearing vertical load is not compressive")
        eb = B / 2 - (mrb - mob) / vb
        vb_contact = vb
        vb = _bearing_vertical_load(unf, fd)
        bearing = None
        if abs(eb) < B / 2:
            bearing = bearing_capacity(
                method=settings.bearing_method, B=B, D=wf.embedment,
                phi=0.0 if fd.drainage == "undrained" else fd.phi,
                c=fd.su if fd.drainage == "undrained" else fd.c,
                gamma=fd.gamma, q=fd.overburden, V=vb, H=max(hb, 0.0), e_B=eb,
            )
            checks["bearing"] = _odf("bearing", bearing.Q_ult / case.r_bearing, vb,
                                     f"q_ult = {bearing.q_ult:.3f} kPa, B' = {bearing.B_eff:.3f} m")
        else:
            checks["bearing"] = CheckResult("bearing", 0.0, 1.0, False, "Resultant outside the base")
        qmax = (vb_contact / B * (1 + 6 * abs(eb) / B) if abs(eb) <= B / 6 else
                2 * vb_contact / (3 * (B / 2 - abs(eb))) if abs(eb) < B / 2 else math.inf)
        qmin = max(vb_contact / B * (1 - 6 * abs(eb) / B), 0.0) if abs(eb) <= B / 6 else 0.0
        results.append(WallAnalysis(
            case=case.name, width=B, forces=stab + ([passive] if passive is not None else []),
            sum_v=v, sum_h=h, m_resisting=mr, m_overturning=mo, eccentricity=e,
            q_max=qmax, q_min=qmin, bearing=bearing, checks=checks,
            warnings=wf.warnings + warnings, factors_used=list(case.factors_used), shear_key=key_res,
        ))
        if wf.key is not None:
            results[-1].forces.append(wf.key.passive)
    if geometry.key is not None:
        attach_without_key(results, verify_wall_layered(
            strip_key(geometry), soil, loads, settings, seismic=seismic, approach=approach,
            backfill_slope=backfill_slope, gwt_case=gwt_case))
    if not seismic and any(c.id == "EQU" for c in code.combinations):
        log = FactorLog(code)
        combo = code.combination("EQU")
        case = LimitStateCase(name="EQU", code=code.id, tan_phi=log.value("EQU.material.tan_phi"),
                              cohesion=log.value("EQU.material.c_eff"), su=log.value("EQU.material.su"))
        wf = wall_forces_layered(geometry, _design_structure_soil(selected, case), loads, settings,
                                 seismic=False, backfill_slope=backfill_slope)
        factors = {"DC": log.value("EQU.load.G_stb"), "EV": log.value("EQU.load.G_stb"),
                   "EH": log.value("EQU.load.G_dst"), "LS": log.value("EQU.load.Q_dst"),
                   "LS_v": log.value("EQU.load.Q_stb") if "Q_stb" in combo.load_factors else 0.0}
        if water:
            factors["WA"] = log.value("EQU.load.WA")
        forces = _factor_forces([f for f in wf.forces if f.kind != "PASSIVE"], factors)
        _check_forward_loading(wf.forces)
        _check_forward_loading(forces)
        v, h, mr, mo = _sums(forces)
        if v <= 0:
            raise GeoTekError("EQU: net vertical load is not compressive")
        mr_ot, mo_ot = overturning_moments(forces, mr, mo, settings)
        results.append(WallAnalysis(
            case="EQU", width=wf.width, forces=forces, sum_v=v, sum_h=h,
            m_resisting=mr, m_overturning=mo, eccentricity=wf.width / 2 - (mr - mo) / v,
            q_max=math.nan, q_min=math.nan, bearing=None,
            checks={"overturning": _odf("overturning", mr_ot, mo_ot,
                                        f"M_stb,d / M_dst,d; uplift_moment={settings.uplift_moment}")},
            warnings=list(wf.warnings), factors_used=log.as_list(),
        ))
    return results


def verify_wall_global_stability(
    geometry: CantileverGeometry | GravityGeometry,
    backfill: Backfill,
    foundation_bands: list[SoilBand],
    loads: WallLoads | None = None,
    settings: WallSettings | None = None,
    *,
    seismic: bool = False,
    approach: str | None = None,
    water_level: float | None = None,
    retained_bands: list[SoilBand] | None = None,
) -> list[tuple[str, CheckResult]]:
    """Bishop with design strengths; retained bands select E4 surface-action factoring.

    ODF = F_d / gamma_R,e (EC7) or F x phi (LRFD). None keeps the legacy path.
    """
    settings = settings or WallSettings()
    layered = retained_bands is not None
    if layered:
        missing = required_layered_inputs(settings, approach=approach, seismic=seismic,
                                          include_equ=False, include_global=True)
        if missing:
            raise MissingFactorsError(missing)
    code = (layered_design_code(settings) if layered else
            resolve_code(settings.design_code, settings.factor_overrides))
    out = []
    for case in limit_state_cases(code, seismic=seismic, approach=approach):
        slip, chk = wall_global_stability(
            geometry, backfill, foundation_bands, loads, settings, seismic=seismic, water_level=water_level,
            tan_phi_factor=case.tan_phi, cohesion_factor=case.cohesion, required=case.r_global,
            retained_bands=retained_bands,
            surcharge_factor=case.unfavourable["LS"] if layered else 1.0,
            footprint_factors=case.unfavourable if layered else None,
        )
        odf = slip.fs / case.r_global
        out.append((case.name, CheckResult("global_stability", odf, 1.0, odf >= 1.0,
                                           f"F_d = {slip.fs:.3f}, required {case.r_global:.3f}; {chk.detail}",
                                           factors_used=list(case.factors_used))))
    return out


# --- sheet piles -------------------------------------------------------------------------


def _design_profile(profile: SoilProfile, case: LimitStateCase) -> SoilProfile:
    layers = []
    for layer in profile.layers:
        d = layer.design
        upd = {"c_eff": d.c_eff / case.cohesion}
        if d.phi_eff is not None:
            upd["phi_eff"] = _design_angle(d.phi_eff, case.tan_phi)
        if d.su is not None:
            upd["su"] = d.su / case.su
        layers.append(layer.model_copy(update={"design": DesignParameters(**{**d.model_dump(), **upd})}))
    return profile.model_copy(update={"layers": layers})


@dataclass
class SheetPileDesign:
    cases: dict[str, SheetPileResult]
    D_required: float
    M_design: float
    anchor_force_design: float | None
    governing_embedment: str
    governing_moment: str
    factors_used: dict[str, list[UsedFactor]] = field(default_factory=dict)


def design_sheet_pile(
    profile: SoilProfile,
    H: float,
    *,
    code: str,
    support: Literal["cantilever", "anchored"] = "cantilever",
    anchor_depth: float | None = None,
    approach: str | None = None,
    surcharge: float = 0.0,
    depth_increase: float | None = None,
    overrides: dict[str, FactorOverride] | None = None,
    **pressure_kwargs,
) -> SheetPileDesign:
    """Embedment, design moment and anchor force for every combination, plus the envelope.

    Driving soil pressure x gamma_G (EC7) or EH (LRFD), surcharge x gamma_Q / LS, water behind
    x gamma_G (EC7) or 1.0 (LRFD); passive resistance / gamma_R,e (EC7) or x phi (LRFD).
    The Blum depth increase for cantilevers (default 20 %) models the toe reaction and is kept.
    """
    if "passive_factor" in pressure_kwargs:
        raise GeoTekError("passive_factor is set by the design code in partial-factor design")
    results: dict[str, SheetPileResult] = {}
    used: dict[str, list[UsedFactor]] = {}
    for case in limit_state_cases(code, approach=approach, overrides=overrides):
        used[case.name] = list(case.factors_used)
        prof = _design_profile(profile, case)
        common = dict(surcharge=surcharge, passive_factor=case.r_sheet_passive,
                      active_factor=case.unfavourable["EH"], surcharge_factor=case.unfavourable["LS"],
                      water_factor=case.water, **pressure_kwargs)
        if support == "cantilever":
            r = cantilever_sheet_pile(prof, H, depth_increase=0.2 if depth_increase is None else depth_increase,
                                      **common)
        else:
            if anchor_depth is None:
                raise GeoTekError("anchor_depth is required for an anchored wall")
            r = anchored_sheet_pile(prof, H, anchor_depth, depth_increase=depth_increase or 0.0, **common)
        results[case.name] = r
    gov_d = max(results, key=lambda k: results[k].D)
    gov_m = max(results, key=lambda k: results[k].M_max)
    t = [r.anchor_force for r in results.values() if r.anchor_force is not None]
    return SheetPileDesign(cases=results, D_required=results[gov_d].D, M_design=results[gov_m].M_max,
                           anchor_force_design=max(t) if t else None,
                           governing_embedment=gov_d, governing_moment=gov_m, factors_used=used)
