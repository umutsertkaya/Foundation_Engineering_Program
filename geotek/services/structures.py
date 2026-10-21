"""Structure-copy analyses. Inputs and project profiles are never mutated.

Pressure keys are ``<case>:<side>``; partial-factor cases also contain the combination
id (e.g. ``static:DA1-C2:retained``). Diagrams are unfactored, design-strength diagrams
for that combination. The seismic increment's design application height is reported
by the forces, not by the triangular M-O diagnostic diagram.
"""

from __future__ import annotations

import hashlib
import json
import math
from collections.abc import Callable
from dataclasses import dataclass, field, replace

import numpy as np

from geotek.config.codes import FactorLog
from geotek.core.errors import BearingFailureError, GeoTekError, MissingFactorsError
from geotek.core.warning_codes import format_warning
from geotek.core.models.project import Project
from geotek.core.models.profile import GroundwaterCondition
from geotek.core.models.structures import RetainingWallStructure, SheetPileStructure
from geotek.core.models.walls import Backfill, WallLoads, WallSettings
from geotek.engine.earth_pressure.coefficients import (
    TBDY_R, mononobe_okabe_kpe, rankine_kp, surcharge_per_horizontal, tbdy_seismic_coefficients,
)
from geotek.engine.earth_pressure.distribution import PressureDistribution, lateral_pressure
from geotek.engine.limit_state import (
    LimitStateCase, SheetPileDesign, _design_structure_soil, layered_design_code, layered_limit_state_cases,
    required_layered_inputs, verify_wall_layered,
)
from geotek.engine.sheet_pile import SheetPileResult, _cumulative, _evaluate, _internal_forces, _root, _section
from geotek.engine.walls.base import CheckResult
from geotek.engine.walls.global_stability import wall_global_stability
from geotek.engine.walls.layered import (
    bands_from_structure, front_water_distribution, soil_at_case, wall_pressures_layered,
)
from geotek.services.walls_advanced import MissingFactor
from geotek.services.walls_basic import (
    STEP, Assumption, BasicSheetPileResult, BasicWallResult, SRC_SIZING, SRC_TBDY_BASE,
    SRC_TBDY_DELTA, SRC_TBDY_SEISMIC, _ceil, key_assumptions, proportion_for,
)

ProgressFn = Callable[[float, str], None]


@dataclass
class StructureWallResult(BasicWallResult):
    pressures: dict[str, PressureDistribution] = field(default_factory=dict)
    result_hash: str = ""
    governing_check_ids: list[str] = field(default_factory=list)
    """Ids ("case:name") of failing checks, or the check that governed sizing when it passed."""
    minimum_width_governs: bool = False


class _Progress:
    def __init__(self, callback):
        self.callback, self.last = callback, -1.0

    def emit(self, fraction, key):
        fraction = max(0.0, min(float(fraction), 1.0))
        if fraction <= self.last:
            return
        self.last = fraction
        if self.callback is not None:
            self.callback(fraction, key)  # Cancelled deliberately propagates


def _wall(project, structure_id):
    structure = project.structure(structure_id)
    if not isinstance(structure, RetainingWallStructure):
        raise GeoTekError(f"Structure {structure_id!r} is not a retaining wall")
    return structure


def _settings(project, structure):
    basic = structure.analysis_level == "basic"
    code = "asd" if basic else (structure.settings.design_code if isinstance(structure, RetainingWallStructure)
                                  else structure.design_code)
    overrides = dict(project.design_overrides.get(code, {}))
    if isinstance(structure, RetainingWallStructure):
        overrides.update(structure.settings.factor_overrides)
        if not basic:
            return structure.settings.model_copy(update={"factor_overrides": overrides})
        return WallSettings(design_code=code, bearing_method="vesic", factor_overrides=overrides,
                            uplift_moment=structure.settings.uplift_moment,
                            gwt_bearing_correction=structure.settings.gwt_bearing_correction,
                            submerged_seismic=structure.settings.submerged_seismic,
                            kv_sign=structure.settings.kv_sign)
    return WallSettings(design_code=code, bearing_method="vesic", factor_overrides=overrides)


def _fingerprint(project, structure, code_id):
    dumped = structure.model_dump(mode="json", exclude={"name", "result_hash", "result"})
    # Inputs added later are left out at their defaults, so earlier results keep their fingerprint.
    sheet = dumped["kind"] == "sheet_pile"
    holder = dumped if sheet else dumped["inputs"]
    if holder["surcharge_basis"] == "horizontal":
        del holder["surcharge_basis"]
    if sheet and dumped["backfill_slope"] == 0:
        del dumped["backfill_slope"]
    if not sheet and dumped.get("geometry") and dumped["geometry"].get("key") is None:
        del dumped["geometry"]["key"]
    payload = {
        # The display name is not a calculation input; renaming must not stale the result.
        "structure": dumped,
        "design_code": code_id,
        "design_overrides": {p: v.model_dump(mode="json")
                             for p, v in project.design_overrides.get(code_id, {}).items()},
    }
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def calculation_fingerprint(
    project: Project, structure: RetainingWallStructure | SheetPileStructure,
) -> str:
    """Current input hash, using the same effective code as the calculation service."""
    return _fingerprint(project, structure, _settings(project, structure).design_code)


def _water(soil, base, case):
    return min(soil.front_profile().gwt.depth_for(case), soil.retained_profile().gwt.depth_for(case)) < base


def required_factors(project: Project, structure_id: str) -> list[MissingFactor]:
    structure = project.structure(structure_id)
    settings = _settings(project, structure)
    if isinstance(structure, RetainingWallStructure):
        base, sds, gwt_case = structure.height, structure.inputs.sds, structure.inputs.gwt_case
    else:
        # Water may load the embedded part even when it is below the dredge line.
        base, sds, gwt_case = structure.soil.profile.bottom, structure.sds, "design"
    missing = {}
    soil = (_sheet_soil(structure, structure.soil) if isinstance(structure, SheetPileStructure)
            else structure.soil)
    for seismic in ([False, True] if sds is not None else [False]):
        case = "seismic" if seismic else gwt_case
        for factor in required_layered_inputs(
            settings, approach=structure.approach, seismic=seismic,
            water=_water(soil, base, case),
            include_equ=isinstance(structure, RetainingWallStructure),
            include_global=(isinstance(structure, RetainingWallStructure)
                            and structure.inputs.include_global_stability),
        ):
            missing[factor.path] = factor
    return list(missing.values())


def _ensure_complete(project, structure_id):
    missing = required_factors(project, structure_id)
    if missing:
        raise MissingFactorsError(missing)


def _loads(structure):
    inp = structure.inputs
    kh = kv = None
    if inp.sds is not None:
        kh, kv = tbdy_seismic_coefficients(inp.sds, inp.r if inp.r is not None else TBDY_R["gravity_80sds_mm"])
        if structure.settings.kv_sign == "down":
            kv = -abs(kv)
    q = surcharge_per_horizontal(inp.surcharge, structure.backfill_slope, inp.surcharge_basis)
    loads = WallLoads(surcharge=q, kh=kh or 0.0, kv=kv or 0.0, seismic_increment_height=0.5,
                      water_kh=0.4 * inp.sds if inp.sds is not None else None,
                      surcharge_resists=inp.surcharge_resists if structure.analysis_level == "advanced" else False)
    return loads, kh, kv


LS_EXTREME_ASSUMPTION = ("Extreme Event I trafik/yaya yükü (LS) katsayısı 0.50 kabul edildi: bu bir AASHTO tablo "
                         "değeri değil, projeye özel γEQ varsayımıdır; projenin gerçek değeriyle değiştirilmelidir")
LS_EXTREME_SOURCE = "Proje varsayımı (karar 2026-10-20); aashto_lrfd.yaml load.LS.extreme_I, unverified"


def _assumptions(structure, settings, D):
    gwt_case = structure.inputs.gwt_case
    out = [
        Assumption(text=f"Beton birim hacim ağırlığı {settings.concrete_unit_weight:g} kN/m³",
                   source="WallSettings; mevcut varsayılan 24 kN/m³, proje girdisi"),
        Assumption(text=f"Statik YASS senaryosu {gwt_case}; arka derinlik "
                        f"{structure.soil.retained_profile().gwt.depth_for(gwt_case):g} m, ön derinlik "
                        f"{structure.soil.front_profile().gwt.depth_for(gwt_case):g} m",
                   source="StructureSoilModel; None olduğunda profil YASS'ı"),
        Assumption(text="Taban, tutulan zemin yüzeyinden H derinliktedir; ön zemin H-D kotundadır; "
                        "ön kazının kaldırdığı örtü gerilmesi hesaba katılmaz", source="P1 sözleşmesi §1 ve §5"),
        Assumption(text="Katmanlar yataydır; her katmanın Coulomb katsayısı tüm üst katmanların düşey "
                        "gerilmesine uygulanır; bu yaklaşım katmanlı bir kritik kama çözümü değildir",
                   source="Das, Principles of Foundation Engineering; P1 §5 yerel katsayı yaklaşımı"),
        Assumption(text="Coulomb drene itkide c' katkısı ihmal edilir; drenajsız yatay zeminde toplam "
                        "gerilme ve s_u kullanılır, yatay su ikinci kez eklenmez",
                   source="lateral_pressure sözleşmesi; Rankine toplam gerilme çözümü"),
        Assumption(text="Topuk üzerindeki zemin katman ve su kotlarında poligonlara bölünür; "
                        "su altında toplam γ_sat ağırlığı ve tabanda ayrıca kaldırma kullanılır",
                   source="Statik denge; Terzaghi etkin gerilme ilkesi"),
        Assumption(text="Arka/ön su seviyesi yapı YASS değeridir (yoksa profil YASS); hidrostatik yatay "
                        "basınç ve ön/arka taban basınçları arasında doğrusal kaldırma; sızma hesabı yok",
                   source="P1 §1.4; USACE EM 1110-2-2502 hidrostatik yük modeli"),
        Assumption(text="Taşıma gücü yalnız taban katmanıyla hesaplanır; B içinde daha zayıf katman uyarılır; "
                        "iki tabakalı taşıma gücü ve oturma hesabı yapılmaz", source="P1 §5"),
        Assumption(text="Taban delta_base değeri verilmemişse mevcut FoundationSoil varsayılanıyla "
                        "delta_base=phi kullanılır; aderans 0 alınır", source="FoundationSoil sözleşmesi"),
        Assumption(text=f"Taşıma gücü yöntemi: {settings.bearing_method}; eğik yük ve B'=B-2|e| dahil; "
                        "taban/ön arazi eğimi çarpanları 1",
                   source="Mevcut bearing_capacity/profil adaptörü; Bowles, 5. baskı, Tablo 4-1/4-5"),
        Assumption(text=("Kaldırma momenti devrilme talebine eklenir: FS_ot=M_R/(M_O+M_U)"
                         if settings.uplift_moment == "overturning" else
                         "Kaldırma momenti dirençten düşülür: FS_ot=(M_R−M_U)/M_O"),
                   source="Mühendis seçimi; varsayılan güvenli taraf"),
        Assumption(text=("Drene N_gamma YASS düzeltmesi açık: d_w ön suyun taban altı derinliği; "
                         "d_w≤0 için γ', 0<d_w<B için γ'+(d_w/B)(γ−γ'), d_w≥B için γ"
                         if settings.gwt_bearing_correction else
                         "Drene N_gamma YASS geçiş düzeltmesi kullanıcı seçimiyle kapalı; "
                         "tabanda/üstünde su için γ', taban altında γ kullanılır"),
                   source="Das, Principles of Foundation Engineering, taşıma gücüne yeraltı suyu etkisi (Durum III)"),
        Assumption(text=f"Gömülme D = {D:.2f} m; boyut araması 0.05 m adımla B ≤ 1.2H",
                   source=SRC_SIZING),
        Assumption(text="Boyutlandırmada kesit oranları mevcut proportion_for fonksiyonundan alınır",
                   source=SRC_SIZING),
        Assumption(text="ASD global GS durumunda yük katsayılanmaz; kısmi katsayıda WA ayrı kullanıcı "
                        "girdisidir ve G/EH katsayısından türetilmez; material.gamma uygulanmaz, "
                        "DC/EV yük katsayıları kullanılır", source="P1 §5; mevcut limit_state sözleşmesi"),
    ]
    if structure.wall_type == "cantilever":
        out.append(Assumption(text="Topuk ucundan düşey sanal düzlem: H_v=H+topuk·tanβ; ek üst kısım "
                                   "en üst katmandır; δ=β", source="Klasik konsol duvar yaklaşımı; P1 §5"))
    else:
        out.append(Assumption(text="İtki gerçek eğimli arka yüzde; θ=atan(arka kaçıklık/H), "
                                   "katman başına δ=2φ'/3", source=SRC_TBDY_DELTA))
    out.append(Assumption(text=(f"Pasif direnç açık; kullanıcı/ayar azaltımı {settings.passive_reduction:g}; "
                                "yalnız kaymaya katılır, yatay su azaltılmaz" if settings.use_passive else
                                "Pasif direnç hesaba katılmadı"),
                          source="Kullanıcı/WallSettings; varsayılan 0.5 için doğrulanmış normatif kaynak yok"))
    if settings.use_passive:
        out.append(Assumption(
            text=f"Pasif azaltma katsayısı = {settings.passive_reduction:g} — mühendis seçimi (yayımlanmış kaynak gösterilmedi)",
            source="Kullanıcı girdisi"))
    out += key_assumptions(structure.geometry.key if structure.geometry is not None else None,
                           settings.passive_reduction)
    out.append(Assumption(text="Ön ayak üzerindeki doğal zemin ağırlığı " +
                               ("dahil" if settings.include_toe_soil else "ihmal edildi"), source="WallSettings"))
    if structure.inputs.surcharge and structure.inputs.surcharge_basis == "inclined" and structure.backfill_slope:
        out.append(Assumption(
            text=f"Sürşarj eğimli yüzey alanına göre verildi; yatay izdüşümde q/cosβ = "
                 f"{structure.inputs.surcharge / math.cos(math.radians(structure.backfill_slope)):.2f} kPa",
            source="Das, Principles of Foundation Engineering Ch. 7; trial_wedge doğrulaması",
            code="wall.surcharge_inclined",
            params={"q": structure.inputs.surcharge, "beta": structure.backfill_slope}))
    out.append(Assumption(text="Sürşarjın topuk üzerindeki düşey yükü " +
                               ("dengeleyici sayıldı" if structure.analysis_level == "advanced" and
                                structure.inputs.surcharge_resists else "dengeleyici sayılmadı"), source="WallDesignInputs"))
    if structure.analysis_level == "basic":
        out.append(Assumption(text="Temel seviye: ASD, Vesic, pasif ve ön ayak zemini kapalı; taban "
                                   "sürtünmesi onaylı katman değerinden (BASIC aktarımında tanδ=min(tanφ,0.6))",
                              source=SRC_TBDY_BASE + "; P1 §5"))
    if structure.inputs.sds is not None:
        r = structure.inputs.r if structure.inputs.r is not None else TBDY_R["gravity_80sds_mm"]
        out += [Assumption(text=f"Deprem YASS senaryosu seismic; arka derinlik "
                                f"{structure.soil.retained_profile().gwt.depth_for('seismic'):g} m, ön derinlik "
                                f"{structure.soil.front_profile().gwt.depth_for('seismic'):g} m",
                           source="StructureSoilModel; depth_seismic, yoksa depth_insitu"),
                Assumption(text=f"k_h=0.4·S_DS/r, |k_v|=0.5·k_h, r={r:g}; dinamik itki artımı H_v/2'de",
                           source=SRC_TBDY_SEISMIC),
                Assumption(text="M-O katman bazında; statik su hidrostatiktir; sıvılaşma ve fazla "
                                "boşluk suyu basıncı hesaplanmaz; "
                                "drenajsız deprem itkisi durdurulur; β > φ' − ψ için "
                                "TBDY Denk. 16.24b kullanılır",
                           source="Mononobe & Matsuo (1929), Okabe (1926); TBDY Denk. 16.24b; E4 kapsam sınırı")]
        retained = structure.soil.retained_profile()
        if retained.gwt.depth_for("seismic") < structure.height:
            out.append(Assumption(
                text=f"Su altı deprem seçimi: {settings.submerged_seismic}; γ*=γ_sat−γ_w; "
                     "geçirimsiz tanψ=γ_sat/γ*·kh/(1−kv), geçirimli tanψ=γ/γ*·kh/(1−kv) "
                     "(γ doğal birim ağırlık); dinamik su kh=0.4·S_DS (r=1). "
                     "Taban sanal arka düzlemin altıdır; kısmi batıklık katman bazında mühendislik "
                     "yargısıdır; karışık geçirgenlikte herhangi bir geçirimli katman için tam su "
                     "yüksekliği bir kez kullanılır (doğrulanmamış mühendislik yaklaşımı); "
                     "dış serbest su modellenmez. Yöneten seçim "
                     "durum uyarılarında; dinamik suyun kuvvet ve konumu forces içindedir.",
                source="TBDY 2018 16.12.3.2, Denk. 16.26 ve 16.20"))
    if structure.inputs.include_global_stability:
        out.append(Assumption(text="Bishop daireleri taban altından geçer; taşınan ağırlık taban izine "
                                   "eşdeğer yük olarak yayılır; kayma modelinde tek yatay su kotu için "
                                   "ön/arka YASS'ın yükseği alınır; bantlar yatay ve en alt bant sonsuzdur; "
                                   "ön taraftaki taban üstü ince şerit de tutulan taraf bantlarıyla temsil edilir; "
                                   "global dilimlerde k_v uygulanmaz",
                              source="Bishop (1955); mevcut wall_global_stability yaklaşımı; E4 model varsayımı"))
        if layered_design_code(settings).approach != "global_fs":
            out.append(Assumption(
                text="Kısmi katsayılı global stabilitede sürşarj γ_Q (LS), taban izindeki beton/taşınan "
                     "zemin yükleri elverişsiz γ_G (DC/EV) ile çarpılır. Dilim zemini öz ağırlığı "
                     "karakteristik tutulur (DA1-C2/DA3 için 1.0); DA1-C1/DA2 zemin öz ağırlığı "
                     "katsayılaması uygulanmaz",
                source="EC7 tasarım yaklaşımı; E4 model sınırı"))
    else:
        out.append(Assumption(text="Toptan göçme tahkiki kullanıcı girdisiyle kapalıdır", source="WallDesignInputs"))
    return out


def _case_key(state, analysis, code):
    return state if code.approach == "global_fs" else f"{state}:{analysis.case}"


def _capacity_ratio(check):
    """Normalise FS/ODF and e/B checks so that the lowest ratio governs."""
    if check.comparison == "<=":
        return check.required / check.value if check.value else math.inf
    return check.value / check.required


def _seismic_loads(loads, settings):
    if loads.kv == 0:
        return (loads,)
    signs = (1, -1) if settings.kv_sign == "envelope" else (-1,) if settings.kv_sign == "down" else (1,)
    return tuple(loads.model_copy(update={"kv": sign * abs(loads.kv)}) for sign in signs)


def _kv_sign(loads):
    return None if loads.kv == 0 else "up" if loads.kv > 0 else "down"


def _kv_detail(check, loads):
    direction = "yukarı" if loads.kv > 0 else "aşağı"
    return replace(check, detail=f"kv {direction}: {check.detail}", kv_sign=_kv_sign(loads))


def _evaluate_wall(structure, geometry, settings, loads, reporter, start, span, *, sizing):
    code = layered_design_code(settings)
    analyses, glob, slips, case_loads, variants = {}, {}, {}, {}, {}
    states = [False, True] if structure.inputs.sds is not None else [False]
    for i, seismic in enumerate(states):
        state = "seismic" if seismic else "static"
        selected = soil_at_case(structure.soil, "seismic" if seismic else structure.inputs.gwt_case)
        reporter.emit(start + span * (0.08 + 0.30 * i), f"job.step.{state}_checks")
        for signed_loads in (_seismic_loads(loads, settings) if seismic else (loads,)):
            for analysis in verify_wall_layered(
                geometry, selected, signed_loads, settings, seismic=seismic,
                approach=structure.approach, backfill_slope=structure.backfill_slope,
            ):
                key = _case_key(state, analysis, code)
                variants.setdefault(key, []).append((analysis, signed_loads))
    for key, candidates in variants.items():
        governing, case_loads[key] = min(candidates, key=lambda item:
                                        min(_capacity_ratio(c) for c in item[0].checks.values()))
        if len(candidates) == 1:
            sign = _kv_sign(case_loads[key]) if key.startswith("seismic") else None
            analyses[key] = governing if sign is None else replace(governing, checks={
                name: replace(check, kv_sign=sign) for name, check in governing.checks.items()
            })
            continue
        checks, shear_key = {}, governing.shear_key
        for name in governing.checks:
            analysis, signed_loads = min(candidates, key=lambda item: _capacity_ratio(item[0].checks[name]))
            checks[name] = _kv_detail(analysis.checks[name], signed_loads)
            if name == "sliding":
                shear_key = analysis.shear_key  # key rows must describe the sliding check shown
        analyses[key] = replace(governing, checks=checks, shear_key=shear_key)
    if structure.inputs.include_global_stability and (not sizing or all(a.passed for a in analyses.values())):
        reporter.emit(start + span * 0.70, "job.step.global_stability")
        for seismic in states:
            state = "seismic" if seismic else "static"
            selected = soil_at_case(structure.soil, "seismic" if seismic else structure.inputs.gwt_case)
            cases = ([None] if code.approach == "global_fs" else layered_limit_state_cases(
                settings, seismic=seismic, approach=structure.approach,
                water=_water(selected, geometry.height, "design")))
            for case in cases:
                design = _design_structure_soil(selected, case) if case is not None else selected
                retained, foundation = bands_from_structure(design, geometry.height)
                top = design.retained_profile().layers[0]
                # Backfill is a legacy geometry carrier; actual strengths/weights come from bands.
                backfill = Backfill.model_construct(gamma=top.gamma, phi=top.design.phi_eff or 0.0,
                                                    delta=None, slope=structure.backfill_slope)
                water_level = geometry.height - min(design.retained_profile().gwt.depth_for("design"),
                                                     design.front_profile().gwt.depth_for("design"))
                key = state if case is None else f"{state}:{case.name}"
                load_cases = _seismic_loads(loads, settings) if seismic else (loads,)
                for signed_loads in load_cases:
                    slip, check = wall_global_stability(
                        geometry, backfill, foundation, signed_loads, settings, seismic=seismic,
                        water_level=water_level, retained_bands=retained,
                        required=case.r_global if case is not None else None,
                        surcharge_factor=case.unfavourable["LS"] if case is not None else 1.0,
                        footprint_factors=case.unfavourable if case is not None else None,
                    )
                    if case is not None:
                        odf = slip.fs / case.r_global
                        check = CheckResult("global_stability", odf, 1.0, odf >= 1.0,
                                            f"F_d={slip.fs:.4f}, gamma_R={case.r_global:g}; {check.detail}",
                                            factors_used=list(case.factors_used))
                    if len(load_cases) > 1:
                        check = _kv_detail(check, signed_loads)
                    elif seismic and _kv_sign(signed_loads):
                        check = replace(check, kv_sign=_kv_sign(signed_loads))
                    if key not in glob or _capacity_ratio(check) < _capacity_ratio(glob[key]):
                        glob[key], slips[key] = check, slip
    return analyses, glob, slips, case_loads


def _failures(analyses, glob):
    return ([f"{case}:{name}" for case, a in analyses.items() for name, check in a.checks.items() if not check.passed]
            + [f"{case}:global_stability" for case, check in glob.items() if not check.passed])


def _finish(project, structure, geometry, settings, loads, kh, kv, evaluated, iterations, governing,
            governing_ids=None, min_width=False):
    analyses, glob, slips, case_loads = evaluated
    code = layered_design_code(settings)
    pressures = {}
    for seismic in ([False, True] if structure.inputs.sds is not None else [False]):
        state = "seismic" if seismic else "static"
        selected = soil_at_case(structure.soil, "seismic" if seismic else structure.inputs.gwt_case)
        cases = ([None] if code.approach == "global_fs" else layered_limit_state_cases(
            settings, seismic=seismic, approach=structure.approach,
            water=_water(selected, geometry.height, "design")))
        if not seismic and code.approach == "partial_factors" and any(c.id == "EQU" for c in code.combinations):
            log = FactorLog(code)
            cases.append(LimitStateCase(name="EQU", code=code.id, tan_phi=log.value("EQU.material.tan_phi"),
                                         cohesion=log.value("EQU.material.c_eff"), su=log.value("EQU.material.su")))
        for case in cases:
            design = _design_structure_soil(selected, case) if case is not None else selected
            key = state if case is None else f"{state}:{case.name}"
            for side, distribution in wall_pressures_layered(
                geometry, design, case_loads.get(key, loads), settings, seismic=seismic,
                backfill_slope=structure.backfill_slope,
            ).items():
                pressures[f"{key}:{side}"] = distribution
    used = {}
    for result in list(analyses.values()) + list(glob.values()):
        for factor in result.factors_used:
            used[factor.path] = factor
    warnings = sorted({w for a in analyses.values() for w in a.warnings})
    warnings += _ignored_override_warnings(settings)
    if structure.inputs.sds is not None and loads.kv and settings.kv_sign == "envelope":
        warnings.append("Düşey deprem katsayısı ±kv zarfı uygulandı (TBDY 16.12.2.3); "
                        "yöneten işaret kontrol bazında detayda belirtilmiştir.")
    if structure.inputs.sds is not None:
        r = structure.inputs.r if structure.inputs.r is not None else TBDY_R["gravity_80sds_mm"]
        retained = structure.soil.retained_profile()
        foundation = structure.soil.front_profile()
        water_depth = min(retained.gwt.depth_for("seismic"), foundation.gwt.depth_for("seismic"))
        wet_retained = any(min(l.bottom, geometry.height) > max(l.top, retained.gwt.depth_for("seismic"))
                           for l in retained.layers)
        wet_foundation = any(l.bottom > max(geometry.height, water_depth) for l in foundation.layers)
        if structure.inputs.r is None and (wet_retained or wet_foundation):
            warnings.append(
                "coefficients.py notu: TBDY 2018 16.12.2.2 — boşluk suyu basıncı artışı olabilecek "
                "durumlarda r ≤ 1 gerekebilir; r değerini kontrol edin.")
        if wet_retained and r > 1:
            warnings.append(
                "Su altındaki dolgu: TBDY Denk. 16.20 dinamik su ve 16.26 r=1 varsayar "
                "(water_kh=0.4·S_DS); r>1 ile zemin itkisinin azaltılması mühendis tarafından gerekçelendirilmelidir.")
    if structure.soil.source_profile_id is not None:
        source = next((p for p in project.soil_profiles if p.id == structure.soil.source_profile_id), None)
        if structure.soil.is_stale(source):
            warnings.append("Yapıya kopyalanan zemin profili kaynak profile göre bayat; yapı kopyasıyla hesaplandı")
    assumptions = _assumptions(structure, settings, geometry.embedment)
    assumptions += _approach_assumption(code, structure.approach, "wall.default_approach")
    if "load.LS.extreme_I" in used:
        assumptions.append(Assumption(text=LS_EXTREME_ASSUMPTION, source=LS_EXTREME_SOURCE, code="wall.ls_extreme_i"))
        warnings.append(LS_EXTREME_ASSUMPTION)
    fails = _failures(analyses, glob)
    if iterations and fails:
        warnings.insert(0, f"B=1.2H'ye kadar uygun genişlik bulunamadı; sağlanamayan: {governing}")
    return StructureWallResult(
        geometry=geometry, passed=not fails, analyses=analyses, global_stability=glob,
        governing=governing, governing_check_ids=fails if governing_ids is None else governing_ids,
        minimum_width_governs=min_width, assumptions=assumptions,
        factors_used=list(used.values()), kh=kh, kv=kv, iterations=iterations, warnings=warnings,
        slip_results=slips, pressures=pressures, result_hash=_fingerprint(project, structure, code.id),
    )


def size_structure(project: Project, structure_id: str, progress: ProgressFn | None = None) -> StructureWallResult:
    structure = _wall(project, structure_id)
    _ensure_complete(project, structure_id)
    settings = _settings(project, structure)
    loads, kh, kv = _loads(structure)
    H = structure.height
    D = (structure.geometry.embedment if structure.geometry is not None else structure.embedment
         if structure.embedment is not None else max(0.6, _ceil(H / 10)))
    if D >= H:
        raise GeoTekError("Embedment must be less than wall height")
    reporter = _Progress(progress)
    reporter.emit(0.0, "job.step.sizing")
    key = structure.geometry.key if structure.geometry is not None else None
    B = max(_ceil(0.3 * H), 0.9)
    count = int(round((1.2 * H - B) / STEP)) + 1
    best, last_fail, last_error, iterations, slot = None, [], None, 0, 0
    while B <= 1.2 * H + 1e-9:
        geometry = proportion_for(structure.wall_type, H, B, D, key=key)
        if geometry is not None:
            iterations += 1
            try:
                evaluated = _evaluate_wall(structure, geometry, settings, loads, reporter,
                                           0.95 * slot / count, 0.95 / count, sizing=True)
            except BearingFailureError as exc:
                # This width cannot carry the load at all; a wider base may.
                last_error = exc
            else:
                fails = _failures(evaluated[0], evaluated[1])
                best = geometry, evaluated, fails
                if not fails:
                    break
                last_fail = fails
        slot += 1
        reporter.emit(0.95 * slot / count, "job.step.sizing")
        B = round(B + STEP, 6)
    if best is None:
        if last_error is not None:
            raise last_error
        raise GeoTekError("No feasible geometry for these proportions")
    geometry, evaluated, fails = best
    governing = (last_fail[0] if last_fail else "minimum width") if not fails else ", ".join(fails)
    ids = fails if fails else last_fail[:1]
    result = _finish(project, structure, geometry, settings, loads, kh, kv, evaluated, iterations, governing,
                     governing_ids=ids, min_width=not fails and not last_fail)
    reporter.emit(1.0, "job.step.sizing")
    return result


def check_structure(project: Project, structure_id: str, progress: ProgressFn | None = None) -> StructureWallResult:
    structure = _wall(project, structure_id)
    if structure.geometry is None:
        raise GeoTekError("Kontrol için yapı geometrisi gerekli; önce boyutlandırın")
    _ensure_complete(project, structure_id)
    settings = _settings(project, structure)
    loads, kh, kv = _loads(structure)
    reporter = _Progress(progress)
    reporter.emit(0.0, "job.step.static_checks")
    evaluated = _evaluate_wall(structure, structure.geometry, settings, loads, reporter, 0.0, 0.95, sizing=False)
    result = _finish(project, structure, structure.geometry, settings, loads, kh, kv, evaluated, 0,
                     ", ".join(_failures(evaluated[0], evaluated[1])))
    reporter.emit(1.0, "job.step.sizing")
    return result


@dataclass
class StructureSheetPileDesign(SheetPileDesign):
    """Service envelope with explicit structure input assumptions."""

    assumptions: list[Assumption] = field(default_factory=list)
    anchor_spacing_used: float = 1.0
    anchor_inclination_used: float = 0.0


@dataclass
class StructureBasicSheetPileResult(BasicSheetPileResult):
    """Basic envelope carrying structure anchor geometry for reporting."""

    anchor_spacing_used: float = 1.0
    anchor_inclination_used: float = 0.0


def _sheet_soil(structure, soil):
    """Apply the front water override to an independent structure soil copy."""
    if structure.front_water_depth is None:
        return soil
    return soil.model_copy(update={
        "gwt_front": GroundwaterCondition(depth_insitu=structure.front_water_depth),
    })


def _ignored_override_warnings(settings) -> list[str]:
    """Overrides accepted by the code tables but never read by the engine must not look applied.

    The material factor on unit weight (``<combination>.material.gamma``) is not used yet
    (docs/tasks/T12-MATERIAL-FACTORS.md).
    """
    return [format_warning("wall.warning.override_not_applied", path=path)
            for path in sorted(settings.factor_overrides) if path.endswith(".material.gamma")]


def _approach_assumption(code, approach, code_key):
    """Make the EC7-style default design approach visible instead of a silent choice."""
    if approach or code.approach != "partial_factors" or len(code.approaches) < 2:
        return []
    key = next(iter(code.approaches))
    return [Assumption(text=f"Tasarım yaklaşımı seçilmedi; {code.id} için ilk yaklaşım {key} kullanıldı",
                       source=f"{code.id} approaches", code=code_key, params={"approach": key})]


def _sheet_assumptions(structure):
    out = []
    beta = structure.backfill_slope
    if beta:
        out.append(Assumption(
            text=f"Eğimli arka zemin β={beta:g}°: Rankine eğimli dolgu katsayısı, bileşke zemin yüzeyine paralel; "
                 "kazı (pasif) tarafı yatay; Rankine'de c′ eğimli zeminde yok sayılır; deprem M-O (δ=β), "
                 "β > φ′−ψ ise durdurulur",
            source="Rankine (1857); Mononobe-Okabe; Das, Principles of Foundation Engineering Ch. 7",
            code="sheet_pile.backfill_slope", params={"beta": beta}))
    if structure.surcharge and structure.surcharge_basis == "inclined" and beta:
        out.append(Assumption(
            text=f"Sürşarj eğimli yüzey alanına göre; yatay izdüşümde q/cosβ = "
                 f"{structure.surcharge / math.cos(math.radians(beta)):.2f} kPa",
            source="Das, Principles of Foundation Engineering Ch. 7; trial_wedge doğrulaması",
            code="sheet_pile.surcharge_inclined", params={"q": structure.surcharge, "beta": beta}))
    if structure.depth_increase is not None:
        out.append(Assumption(
            text=f"Gömülme artışı: {structure.depth_increase:g}; D = D0 * (1 + artış)",
            source="SheetPileStructure.depth_increase; mevcut sheet_pile.py",
            code="sheet_pile.depth_increase", params={"increase": structure.depth_increase},
        ))
    if structure.front_water_depth is None:
        return out
    return out + [Assumption(
        text=f"Ön YASS üstten {structure.front_water_depth:g} m olarak geçersiz kılındı; "
             "tasarım ve deprem durumlarında aynı seviye kullanılır",
        source="SheetPileStructure.front_water_depth; mühendis girdisi",
        code="sheet_pile.front_water_depth", params={"depth": structure.front_water_depth},
    )]


def _sheet_case(structure, design_soil, *, seismic, passive_factor, active_factor=1.0,
                surcharge_factor=1.0, water_factor=1.0, seismic_factor=1.0):
    """Existing Blum/free-earth solver with independent active/passive structure profiles.

    Only the pressure adapter is new; numerical integration/root/section routines are
    shared with sheet_pile.py. No global monkeypatch or shared state is used.
    """
    H = structure.retained_height
    soil = soil_at_case(_sheet_soil(structure, design_soil), "seismic" if seismic else "design")
    retained, front = soil.retained_profile(), soil.front_profile()
    bottom = soil.profile.bottom
    beta = structure.backfill_slope
    q = surcharge_per_horizontal(structure.surcharge, beta, structure.surcharge_basis)
    slope = dict(beta=beta, slope_cohesion="ignore")  # Rankine-slope active side; front stays horizontal
    active = lateral_pressure(retained, bottom, surcharge=q, layerwise=True, **slope)
    zero = lateral_pressure(retained, bottom, layerwise=True, **slope)
    passive = lateral_pressure(front, bottom - H, top=H, state="passive", layerwise=True)
    front_water = front_water_distribution(soil, H, bottom)
    breaks = np.unique(np.concatenate([active.z, zero.z, passive.z + H, front_water.z, [H]]))
    grid = np.arange(0.0, bottom, 0.002)
    grid = grid[np.min(np.abs(grid[:, None] - breaks[None, :]), axis=1) > 1e-9]
    z = np.concatenate([grid, breaks, breaks])
    left = np.concatenate([np.zeros(grid.size, bool), np.ones(breaks.size, bool), np.zeros(breaks.size, bool)])
    order = np.lexsort((~left, z))
    z, left = z[order], left[order]
    aq, a0 = _evaluate(active, z, left=left), _evaluate(zero, z, left=left)
    pe = _evaluate(passive, z, offset=H, left=left)
    pe[(z < H) | ((z == H) & left)] = 0.0
    ua = _evaluate(active, z, which="u", left=left)
    up = _evaluate(front_water, z, which="u", left=left)
    net = active_factor * a0 + surcharge_factor * (aq - a0) - pe / passive_factor + water_factor * (ua - up)
    kh = None
    if seismic:
        kh, kv = tbdy_seismic_coefficients(structure.sds, TBDY_R["anchored_or_rigid"])
        # Coulomb with delta = beta equals the Rankine-slope coefficient at kh = kv = 0, so the
        # increment below is purely dynamic; M-O stops with a coded error when beta > phi' - psi.
        ae = lateral_pressure(retained, H, surcharge=q, method="coulomb", delta=beta, beta=beta,
                               kh=kh, kv=kv, layerwise=True)
        ast = lateral_pressure(retained, H, surcharge=q, layerwise=True, **slope)
        increment = (ae.component("effective")[0] - ast.component("effective")[0]) / H
        # Same H/2 uniform-increment convention as the existing basic sheet-pile service.
        net += seismic_factor * np.where((z < H) | ((z == H) & left), increment, 0.0)
        # Layer-local passive M-O/Rankine ratio, never increase passive resistance.
        ratio = np.ones_like(z)
        for i, depth in enumerate(z):
            if depth < H:
                continue
            layer = front.layer_at(min(max(depth - (1e-8 if left[i] else 0), H), bottom))
            if layer.behaviour == "undrained":
                raise GeoTekError("Seismic undrained sheet-pile passive pressure is not implemented")
            phi = layer.design.phi_eff
            ratio[i] = min(1.0, (1 - kv) * mononobe_okabe_kpe(phi, kh=kh, kv=kv) / rankine_kp(phi))
        net += pe * (1 - ratio) / passive_factor
    F, Fz = _cumulative(z, net), _cumulative(z, net * z)
    i_h = int(np.searchsorted(z, H))
    anchor = structure.anchor_depth if structure.support == "anchored" else None
    if anchor is None:
        toe = _root(lambda zz: np.interp(zz, z, F) * zz - np.interp(zz, z, Fz), z, i_h + 1)
        increase = 0.2
    else:
        toe = _root(lambda zz: np.interp(zz, z, Fz) - anchor * np.interp(zz, z, F), z, i_h + 1)
        increase = 0.0
    if toe is None:
        raise GeoTekError("No sheet-pile embedment equilibrium within the structure profile; deepen the profile")
    if structure.depth_increase is not None:
        increase = structure.depth_increase
    force = float(np.interp(toe, z, F))
    if anchor is not None and force <= 0:
        raise GeoTekError("Computed anchor force is not tensile")
    zz, pp, shear, moment, mmax, zm = _internal_forces(z, net, toe, anchor, force if anchor is not None else 0.0)
    D0 = toe - H
    warnings = [*active.warnings, *zero.warnings, *passive.warnings]
    if H + D0 * (1 + increase) > bottom:
        warnings.append("Design embedment extends below the soil profile")
    return SheetPileResult(
        support=structure.support, H=H, D0=D0, D=D0 * (1 + increase), anchor_depth=anchor,
        anchor_force=force if anchor is not None else None, toe_force=force if anchor is None else None,
        M_max=mmax, z_M_max=zm, z=zz, shear=shear, moment=moment, net=pp,
        section_modulus_cm3=_section(mmax, structure.allowable_stress_mpa), warnings=list(dict.fromkeys(warnings)),
    ), kh


def design_sheet_pile_structure(project: Project, structure_id: str, progress: ProgressFn | None = None):
    structure = project.structure(structure_id)
    if not isinstance(structure, SheetPileStructure):
        raise GeoTekError(f"Structure {structure_id!r} is not a sheet pile")
    _ensure_complete(project, structure_id)
    settings = _settings(project, structure)
    code = layered_design_code(settings)
    reporter = _Progress(progress)
    reporter.emit(0.0, "job.step.static_checks")
    if code.approach == "global_fs":
        seismic = structure.sds is not None
        if seismic:
            reporter.emit(0.3, "job.step.seismic_checks")
        log = FactorLog(code)
        # Preserve the basic sheet-pile convention (FS=static 1.5 even with seismic action).
        factor = log.value("safety.sheet_pile_passive.static")
        result, kh = _sheet_case(structure, structure.soil, seismic=seismic, passive_factor=factor)
        assumptions = [
            Assumption(text="Katmanlı Rankine aktif/pasif; ön/arka profil ve YASS ayrı; hidrostatik su; sızma yok",
                       source="Rankine (1857); P1 §1", code="sheet_pile.layered_rankine"),
            Assumption(text=f"Pasif basınç GS={factor:g} ile bölündü", source=code.source_of("safety.sheet_pile_passive.static").source,
                       code="sheet_pile.passive_factor", params={"factor": factor}),
            Assumption(text="Konsolda Blum gömülmesi %20 artırılır; ankrajlıda serbest zemin desteği",
                       source="Mevcut sheet_pile.py; USS Steel Sheet Piling Design Manual / USACE EM 1110-2-2504",
                       code="sheet_pile.support_method", params={"percent": 20}),
        ]
        if structure.depth_increase is not None:
            # The user-set increase replaces the default 20 % cantilever statement.
            assumptions = [a for a in assumptions if a.code != "sheet_pile.support_method"]
        assumptions.extend(_sheet_assumptions(structure))
        if seismic:
            assumptions.append(Assumption(text="r=1; M-O artımı H boyunca düzgün (bileşke H/2); "
                                                "katman başına pasif M-O/Rankine oranı en çok 1; drenajsız deprem durdurulur; "
                                                "hidrodinamik ve fazla boşluk suyu basıncı yok", source=SRC_TBDY_SEISMIC,
                                                code="sheet_pile.seismic", params={"r": 1, "passive_ratio_max": 1}))
        reporter.emit(1.0, "job.step.sizing")
        return StructureBasicSheetPileResult(
            result=result, assumptions=assumptions, kh=kh, warnings=list(result.warnings),
            anchor_spacing_used=structure.anchor_spacing, anchor_inclination_used=structure.anchor_inclination)
    results, used = {}, {}
    for seismic in ([False, True] if structure.sds is not None else [False]):
        if seismic:
            reporter.emit(0.5, "job.step.seismic_checks")
        case_soil = soil_at_case(_sheet_soil(structure, structure.soil), "seismic" if seismic else "design")
        for case in layered_limit_state_cases(
            settings, seismic=seismic, approach=structure.approach,
            water=_water(case_soil, case_soil.profile.bottom, "design"),
        ):
            design = _design_structure_soil(case_soil, case)
            key = f"{'seismic' if seismic else 'static'}:{case.name}"
            result, _ = _sheet_case(
                structure, design, seismic=seismic, passive_factor=case.r_sheet_passive,
                active_factor=case.unfavourable["EH"], surcharge_factor=case.unfavourable["LS"],
                water_factor=case.water, seismic_factor=case.unfavourable["EQ"],
            )
            results[key], used[key] = result, list(case.factors_used)
    gd, gm = max(results, key=lambda k: results[k].D), max(results, key=lambda k: results[k].M_max)
    results[gd].warnings.extend(_ignored_override_warnings(settings))
    anchors = [r.anchor_force for r in results.values() if r.anchor_force is not None]
    reporter.emit(1.0, "job.step.sizing")
    return StructureSheetPileDesign(cases=results, D_required=results[gd].D, M_design=results[gm].M_max,
                           anchor_force_design=max(anchors) if anchors else None,
                           governing_embedment=gd, governing_moment=gm, factors_used=used,
                           assumptions=_approach_assumption(code, structure.approach,
                                                            "sheet_pile.default_approach")
                           + _sheet_assumptions(structure),
                           anchor_spacing_used=structure.anchor_spacing,
                           anchor_inclination_used=structure.anchor_inclination)
