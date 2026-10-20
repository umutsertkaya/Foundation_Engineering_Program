"""Basic level: few inputs, safe defaults, automatic preliminary sizing.

Basis: ASD global factors of safety (``asd.yaml``) with TBDY 2018 seismic coefficients
(kh = 0.4 S_DS / r, kv = 0.5 kh, dynamic thrust at H/2). Every default is recorded as a
labelled assumption so the engineer sees exactly what was assumed and where it comes from.
Any ASD factor can be replaced by the user (``factor_overrides``); it is then labelled
"Kullanıcı girdisi".

Not covered at this level (use the advanced level): water behind the wall, layered
foundation soil, partial-factor codes, passive resistance in front of the toe.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from geotek.config.codes import FactorOverride, UsedFactor
from geotek.core.constants import GAMMA_W
from geotek.core.errors import GeoTekError
from geotek.core.models.profile import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.core.models.walls import (
    Backfill,
    CantileverGeometry,
    FoundationSoil,
    GravityGeometry,
    WallLoads,
    WallSettings,
)
from geotek.engine.earth_pressure.coefficients import (
    TBDY_R,
    mononobe_okabe_kae,
    mononobe_okabe_kpe,
    rankine_ka,
    rankine_kp,
    tbdy_seismic_coefficients,
)
from geotek.engine.sheet_pile import SheetPileResult, anchored_sheet_pile, cantilever_sheet_pile
from geotek.engine.stability import SlipResult, SoilBand
from geotek.engine.walls.base import CheckResult, WallAnalysis
from geotek.engine.walls.global_stability import wall_global_stability
from geotek.engine.walls.walls import analyze_cantilever_wall, analyze_gravity_wall

STEP = 0.05
"""Dimension rounding and sizing step [m]."""
TAN_DELTA_BASE_MAX = 0.6
"""TBDY 2018 Table 16.3: cast-in-place concrete on compacted ground."""

SRC_SIZING = "Ön boyutlandırma oranları (Das, Principles of Foundation Engineering; mühendislik yargısı)"
SRC_TBDY_DELTA = "TBDY 2018 16.12.2.9 (aktif durumda δ ≤ 2φ'/3)"
SRC_TBDY_BASE = "TBDY 2018 Tablo 16.3 (tan δ ≤ 0.6, yerinde dökme beton)"
SRC_TBDY_SEISMIC = "TBDY 2018 Denk. 16.22, Tablo 16.7, 16.12.2.8"
SRC_CONSERVATIVE = "Temel seviye güvenli varsayımı"


class Assumption(BaseModel):
    text: str
    source: str
    code: str | None = None
    params: dict = Field(default_factory=dict)


class BasicWallInput(BaseModel):
    wall_type: Literal["cantilever", "gravity"]
    height: float = Field(gt=0.5, le=15, description="Base bottom to top of wall [m]")
    backfill_gamma: float = Field(gt=10, lt=25)
    backfill_phi: float = Field(gt=15, lt=45)
    backfill_slope: float = Field(0.0, ge=0, lt=35)
    foundation_drainage: Literal["drained", "undrained"] = "drained"
    foundation_phi: float = Field(0.0, ge=0, lt=45)
    foundation_c: float = Field(0.0, ge=0)
    foundation_su: float | None = Field(None, gt=0)
    foundation_gamma: float = Field(gt=10, lt=25)
    surcharge: float = Field(0.0, ge=0)
    embedment: float | None = Field(None, ge=0)
    sds: float | None = Field(None, gt=0, lt=3, description="TBDY S_DS; None = no seismic case")
    r: float | None = Field(None, gt=0, le=2)
    """TBDY Table 16.7 r; None = by wall type (cantilever / gravity 1.5)."""
    gwt_below_base: bool = True
    water_level: float | None = Field(None, description="Groundwater elevation above the base bottom [m]")
    """Only used by the global stability (Bishop) check; must not be above the base at this level."""
    include_global_stability: bool = True
    factor_overrides: dict[str, FactorOverride] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _check(self) -> BasicWallInput:
        if self.water_level is not None and self.water_level > 0:
            self.gwt_below_base = False
        if self.backfill_slope > self.backfill_phi:
            raise ValueError("Backfill slope cannot exceed phi")
        if self.foundation_drainage == "undrained" and self.foundation_su is None:
            raise ValueError("Undrained foundation needs s_u")
        if self.foundation_drainage == "drained" and self.foundation_phi == 0 and self.foundation_c == 0:
            raise ValueError("Drained foundation needs phi or c")
        return self


@dataclass
class BasicWallResult:
    geometry: CantileverGeometry | GravityGeometry
    passed: bool
    analyses: dict[str, WallAnalysis]
    """'static' and, when S_DS is given, 'seismic'."""
    global_stability: dict[str, CheckResult]
    governing: str
    """Check that set the width (the last one failing at B - step), or the failing one."""
    assumptions: list[Assumption]
    factors_used: list[UsedFactor]
    kh: float | None = None
    kv: float | None = None
    iterations: int = 0
    warnings: list[str] = field(default_factory=list)
    slip_results: dict[str, SlipResult] = field(default_factory=dict)
    """Critical Bishop circle per case; empty when global stability was not checked."""

    def summary_rows(self):
        """(case, check, value, required, passed, comparison) for a compact table."""
        rows = []
        for case, a in self.analyses.items():
            for c in a.checks.values():
                rows.append((case, c.name, c.value, c.required, c.passed, c.comparison))
        for case, c in self.global_stability.items():
            rows.append((case, c.name, c.value, c.required, c.passed, c.comparison))
        return rows


def _ceil(x: float, step: float = STEP) -> float:
    return math.ceil(round(x / step, 6)) * step


def _round(x: float, step: float = STEP) -> float:
    return round(round(x / step) * step, 6)


def proportion(inp: BasicWallInput, B: float, D: float):
    """Geometry for base width B from the preliminary sizing ratios (None if not feasible)."""
    return proportion_for(inp.wall_type, inp.height, B, D)


def proportion_for(wall_type: str, H: float, B: float, D: float):
    """``proportion`` without an input model (shared with the advanced-level sizing)."""
    if wall_type == "gravity":
        top = max(0.30, _ceil(H / 12))
        if top > B:
            return None
        return GravityGeometry(height=H, base_width=B, top_width=top, back_offset=0.0, embedment=D)
    t_base = max(0.40, _ceil(H / 12))
    stem_bottom = max(0.30, _ceil(H / 12))
    stem_top = min(0.30, stem_bottom)
    toe = _round(B / 3)
    heel = _round(B - toe - stem_bottom)
    if heel < 0.30 or t_base >= H - 0.5:
        return None
    return CantileverGeometry(stem_height=H - t_base, stem_top=stem_top, stem_bottom=stem_bottom,
                              toe=toe, heel=heel, base_thickness=t_base, embedment=D)


def _assumptions(inp: BasicWallInput, D: float, r: float | None) -> list[Assumption]:
    out = [
        Assumption(text="Pasif direnç (ön ayak önü) ihmal edildi", source=SRC_CONSERVATIVE),
        Assumption(text="Sürşarj yükü devrilme ve kaymada dengeleyici sayılmadı", source=SRC_CONSERVATIVE),
        Assumption(text="Dolgu drene; duvar arkasında su basıncı yok", source=SRC_CONSERVATIVE),
        Assumption(text=f"Taban sürtünmesi tan δ_b = min(tan φ, {TAN_DELTA_BASE_MAX})", source=SRC_TBDY_BASE),
        Assumption(text="Taşıma gücü: Vesic (eğik yük ve eksantrisite dahil)", source="Vesic (1975)"),
        Assumption(text=f"Gömülme D = {D:.2f} m" + (" (varsayılan max(0.6 m, H/10))" if inp.embedment is None else ""),
                   source=SRC_SIZING if inp.embedment is None else "Kullanıcı girdisi"),
        Assumption(text="Kesit oranları: konsol taban kalınlığı ve gövde alt genişliği ≈ H/12, gövde üst 0.30 m, "
                        "ön ayak ≈ B/3; ağırlık duvarı üst genişlik ≈ max(0.30 m, H/12), düşey arka yüz",
                   source=SRC_SIZING),
    ]
    if inp.wall_type == "gravity":
        out.append(Assumption(text="Duvar-dolgu sürtünmesi δ = 2φ'/3", source=SRC_TBDY_DELTA))
    else:
        out.append(Assumption(text="Topuk ucundan geçen sanal düşey düzlemde itki, δ = β (Rankine eşdeğeri)",
                              source="Klasik konsol duvar yaklaşımı"))
    if inp.sds is not None:
        out.append(Assumption(text=f"k_h = 0.4·S_DS/r, k_v = 0.5·k_h, r = {r:g}"
                                   + (" (duvar tipine göre)" if inp.r is None else ""), source=SRC_TBDY_SEISMIC))
        out.append(Assumption(text="Dinamik itki artımı duvar yüksekliğinin ortasında (H/2)", source=SRC_TBDY_SEISMIC))
    return out


def _foundation(inp: BasicWallInput, D: float) -> FoundationSoil:
    if inp.foundation_drainage == "undrained":
        return FoundationSoil(drainage="undrained", su=inp.foundation_su, gamma=inp.foundation_gamma,
                              overburden=inp.foundation_gamma * D)
    tan_b = min(math.tan(math.radians(inp.foundation_phi)), TAN_DELTA_BASE_MAX)
    return FoundationSoil(phi=inp.foundation_phi, c=inp.foundation_c, gamma=inp.foundation_gamma,
                          overburden=inp.foundation_gamma * D, delta_base=math.degrees(math.atan(tan_b)))


def _bands(inp: BasicWallInput) -> list[SoilBand]:
    if inp.foundation_drainage == "undrained":
        return [SoilBand(top=0.0, gamma=inp.foundation_gamma, c=inp.foundation_su, phi=0.0)]
    return [SoilBand(top=0.0, gamma=inp.foundation_gamma, c=inp.foundation_c, phi=inp.foundation_phi)]


def size_wall(inp: BasicWallInput, *, max_width_ratio: float = 1.2) -> BasicWallResult:
    """Smallest base width (in 0.05 m steps) satisfying every ASD check, static and seismic."""
    if not inp.gwt_below_base:
        raise GeoTekError("Temel seviye, yeraltı suyunun taban altında olduğunu varsayar; su etkisi için "
                          "ileri seviye analizi kullanın")
    H = inp.height
    D = inp.embedment if inp.embedment is not None else max(0.6, _ceil(H / 10))
    r = inp.r if inp.r is not None else TBDY_R["gravity_80sds_mm"]
    kh = kv = None
    loads = WallLoads(surcharge=inp.surcharge)
    if inp.sds is not None:
        kh, kv = tbdy_seismic_coefficients(inp.sds, r)
        loads = WallLoads(surcharge=inp.surcharge, kh=kh, kv=kv, seismic_increment_height=0.5)
    settings = WallSettings(design_code="asd", bearing_method="vesic", factor_overrides=inp.factor_overrides)
    backfill = Backfill(gamma=inp.backfill_gamma, phi=inp.backfill_phi, slope=inp.backfill_slope)
    foundation = _foundation(inp, D)
    analyze = analyze_cantilever_wall if inp.wall_type == "cantilever" else analyze_gravity_wall
    cases = ["static"] + (["seismic"] if inp.sds is not None else [])

    slips: dict[str, SlipResult] = {}

    def evaluate(geom, with_global: bool):
        slips.clear()
        analyses = {c: analyze(geom, backfill, foundation, loads, settings, seismic=(c == "seismic")) for c in cases}
        glob: dict[str, CheckResult] = {}
        if with_global and inp.include_global_stability and all(a.passed for a in analyses.values()):
            for c in cases:
                slip, chk = wall_global_stability(geom, backfill, _bands(inp), loads, settings,
                                                  seismic=(c == "seismic"), water_level=inp.water_level)
                glob[c] = chk
                slips[c] = slip
        return analyses, glob

    def failing(analyses, glob):
        names = [f"{c}:{k}" for c, a in analyses.items() for k, chk in a.checks.items() if not chk.passed]
        names += [f"{c}:global_stability" for c, chk in glob.items() if not chk.passed]
        return names

    B = max(_ceil(0.3 * H), 0.9)
    last_fail: list[str] = []
    best = None
    it = 0
    while B <= max_width_ratio * H + 1e-9:
        geom = proportion(inp, B, D)
        if geom is not None:
            it += 1
            analyses, glob = evaluate(geom, with_global=True)
            fails = failing(analyses, glob)
            if inp.include_global_stability and not glob and not fails:
                fails = ["global_stability"]
            best = (geom, analyses, glob, fails, dict(slips))
            if not fails:
                break
            last_fail = fails
        B = round(B + STEP, 6)

    if best is None:
        raise GeoTekError("No feasible geometry for these proportions")
    geom, analyses, glob, fails, best_slips = best
    passed = not fails
    governing = (last_fail[0] if last_fail else "minimum width") if passed else ", ".join(fails)
    used: dict[str, UsedFactor] = {}
    for a in analyses.values():
        for f in a.factors_used:
            used[f.path] = f
    for c in glob.values():
        for f in c.factors_used:
            used[f.path] = f
    warnings = sorted({w for a in analyses.values() for w in a.warnings})
    if not passed:
        warnings.insert(0, f"B = {max_width_ratio:g}H'ye kadar uygun genişlik bulunamadı; sağlanamayan: {governing}")
        if any("sliding" in f for f in fails):
            warnings.insert(1, "Kayma, taban genişliğiyle iyileşmiyor (yatay ve düşey yük birlikte artıyor). "
                               "Kayma dişi, ön ayak önündeki pasif direnç veya daha yüksek taban sürtünmesi "
                               "gerekir; bunlar ileri seviyede değerlendirilmelidir.")
    return BasicWallResult(
        geometry=geom, passed=passed, analyses=analyses, global_stability=glob, governing=governing,
        assumptions=_assumptions(inp, D, r if inp.sds is not None else None),
        factors_used=list(used.values()), kh=kh, kv=kv, iterations=it, warnings=warnings,
        slip_results=best_slips,
    )


def check_wall(inp: BasicWallInput, geometry: CantileverGeometry | GravityGeometry) -> BasicWallResult:
    """Check user-entered dimensions with the same basis as ``size_wall`` (no sizing loop)."""
    if not inp.gwt_below_base:
        raise GeoTekError("Temel seviye, yeraltı suyunun taban altında olduğunu varsayar; su etkisi için "
                          "ileri seviye analizi kullanın")
    D = geometry.embedment
    r = inp.r if inp.r is not None else TBDY_R["gravity_80sds_mm"]
    kh = kv = None
    loads = WallLoads(surcharge=inp.surcharge)
    if inp.sds is not None:
        kh, kv = tbdy_seismic_coefficients(inp.sds, r)
        loads = WallLoads(surcharge=inp.surcharge, kh=kh, kv=kv, seismic_increment_height=0.5)
    settings = WallSettings(design_code="asd", bearing_method="vesic", factor_overrides=inp.factor_overrides)
    backfill = Backfill(gamma=inp.backfill_gamma, phi=inp.backfill_phi, slope=inp.backfill_slope)
    foundation = _foundation(inp, D)
    analyze = analyze_cantilever_wall if isinstance(geometry, CantileverGeometry) else analyze_gravity_wall
    cases = ["static"] + (["seismic"] if inp.sds is not None else [])
    analyses = {c: analyze(geometry, backfill, foundation, loads, settings, seismic=(c == "seismic")) for c in cases}
    glob: dict[str, CheckResult] = {}
    slips: dict[str, SlipResult] = {}
    if inp.include_global_stability:
        for c in cases:
            slips[c], glob[c] = wall_global_stability(geometry, backfill, _bands(inp), loads, settings,
                                                      seismic=(c == "seismic"), water_level=inp.water_level)
    fails = [f"{c}:{k}" for c, a in analyses.items() for k, chk in a.checks.items() if not chk.passed]
    fails += [f"{c}:global_stability" for c, chk in glob.items() if not chk.passed]
    used: dict[str, UsedFactor] = {}
    for a in analyses.values():
        for f in a.factors_used:
            used[f.path] = f
    for c in glob.values():
        for f in c.factors_used:
            used[f.path] = f
    return BasicWallResult(
        geometry=geometry, passed=not fails, analyses=analyses, global_stability=glob,
        governing=", ".join(fails) if fails else "", assumptions=_assumptions(inp, D, r if inp.sds is not None else None),
        factors_used=list(used.values()), kh=kh, kv=kv, iterations=0,
        warnings=sorted({w for a in analyses.values() for w in a.warnings}), slip_results=slips,
    )


# --- sheet piles -------------------------------------------------------------------------

PASSIVE_FS_BASIC = 1.5
SRC_SHEET_PASSIVE = ("Pasif dirence GS = 1.5 — USS Steel Sheet Piling Design Manual / USACE EM 1110-2-2504 "
                     "uygulaması (doğrulanmadı)")


class BasicSheetPileInput(BaseModel):
    support: Literal["cantilever", "anchored"] = "cantilever"
    retained_height: float = Field(gt=0.5, le=12)
    anchor_depth: float | None = Field(None, ge=0)
    gamma: float = Field(gt=10, lt=25)
    gamma_sat: float | None = Field(None, gt=10, lt=25)
    drainage: Literal["drained", "undrained"] = "drained"
    phi: float | None = Field(None, gt=10, lt=45)
    c: float = Field(0.0, ge=0)
    su: float | None = Field(None, gt=0)
    gwt_depth: float = Field(100.0, ge=0, description="Below the retained ground surface [m]")
    surcharge: float = Field(0.0, ge=0)
    sds: float | None = Field(None, gt=0, lt=3)
    allowable_stress_mpa: float | None = Field(None, gt=0)

    @model_validator(mode="after")
    def _check(self) -> BasicSheetPileInput:
        if self.support == "anchored" and self.anchor_depth is None:
            raise ValueError("Anchored wall needs anchor_depth")
        if self.drainage == "drained" and self.phi is None:
            raise ValueError("Drained soil needs phi")
        if self.drainage == "undrained" and self.su is None:
            raise ValueError("Undrained soil needs s_u")
        return self


@dataclass
class BasicSheetPileResult:
    result: SheetPileResult
    assumptions: list[Assumption]
    kh: float | None = None
    warnings: list[str] = field(default_factory=list)


def design_sheet_pile_basic(inp: BasicSheetPileInput) -> BasicSheetPileResult:
    """Homogeneous soil; FS 1.5 on passive; Blum +20 % for cantilevers; TBDY seismic (r = 1)."""
    H = inp.retained_height
    depth = H + max(3 * H, 12.0)
    layer = SoilLayer(id="S", top=0.0, bottom=depth, gamma=inp.gamma, gamma_sat=inp.gamma_sat or inp.gamma,
                      design=DesignParameters(phi_eff=inp.phi, c_eff=inp.c, su=inp.su))
    profile = SoilProfile(id="basic", gwt=GroundwaterCondition(depth_insitu=inp.gwt_depth), layers=[layer])
    assumptions = [
        Assumption(text="Homojen zemin, hidrostatik su (sızma yok)", source=SRC_CONSERVATIVE),
        Assumption(text="Rankine aktif/pasif, duvar sürtünmesi ihmal", source=SRC_CONSERVATIVE),
        Assumption(text=f"Pasif basınçlar {PASSIVE_FS_BASIC} ile bölündü", source=SRC_SHEET_PASSIVE),
    ]
    kw: dict = dict(surcharge=inp.surcharge, passive_factor=PASSIVE_FS_BASIC, drainage=inp.drainage,
                    allowable_stress_mpa=inp.allowable_stress_mpa)
    warnings: list[str] = []
    kh = None
    if inp.sds is not None:
        if inp.drainage == "undrained":
            warnings.append("Drenajsız zeminde deprem etkisi temel seviyede hesaplanmadı; ileri seviye kullanın")
        else:
            kh, kv = tbdy_seismic_coefficients(inp.sds, TBDY_R["anchored_or_rigid"])
            g_eff = inp.gamma if inp.gwt_depth >= H else inp.gamma_sat - GAMMA_W if inp.gamma_sat else inp.gamma
            dK = mononobe_okabe_kae(inp.phi, kh=kh, kv=kv) * (1 - kv) - rankine_ka(inp.phi)
            kw["seismic_increment"] = 0.5 * g_eff * H**2 * dK / H  # uniform over H, resultant at H/2
            kw["passive_seismic_ratio"] = min(1.0, mononobe_okabe_kpe(inp.phi, kh=kh, kv=kv) * (1 - kv)
                                              / rankine_kp(inp.phi))
            assumptions += [
                Assumption(text=f"k_h = 0.4·S_DS/r = {kh:.3f}, r = 1.0 (palplanş/ankrajlı)", source=SRC_TBDY_SEISMIC),
                Assumption(text="Dinamik aktif artım (M-O) kazı yüksekliği boyunca düzgün, bileşke H/2'de; "
                                "pasif K_PE/K_P oranıyla azaltıldı", source=SRC_TBDY_SEISMIC + "; Mononobe-Okabe"),
            ]
    if inp.support == "cantilever":
        res = cantilever_sheet_pile(profile, H, depth_increase=0.2, **kw)
        assumptions.append(Assumption(text="Sabit uç (Blum), gömülme %20 artırıldı",
                                      source="Blum yöntemi (USS Steel Sheet Piling Design Manual)"))
    else:
        res = anchored_sheet_pile(profile, H, inp.anchor_depth, depth_increase=0.0, **kw)
        assumptions.append(Assumption(text="Serbest uç yöntemi", source="USS Steel Sheet Piling Design Manual"))
    return BasicSheetPileResult(result=res, assumptions=assumptions, kh=kh, warnings=warnings + res.warnings)
