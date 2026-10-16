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
from dataclasses import dataclass, field

import numpy as np

from geotek.config.codes import FactorLog
from geotek.core.errors import GeoTekError, MissingFactorsError
from geotek.core.models.project import Project
from geotek.core.models.structures import RetainingWallStructure, SheetPileStructure
from geotek.core.models.walls import Backfill, WallLoads, WallSettings
from geotek.engine.earth_pressure.coefficients import TBDY_R, mononobe_okabe_kpe, rankine_kp, tbdy_seismic_coefficients
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
    SRC_TBDY_DELTA, SRC_TBDY_SEISMIC, _ceil, proportion_for,
)

ProgressFn = Callable[[float, str], None]


@dataclass
class StructureWallResult(BasicWallResult):
    pressures: dict[str, PressureDistribution] = field(default_factory=dict)
    result_hash: str = ""


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
    return WallSettings(design_code=code, bearing_method="vesic", factor_overrides=overrides)


def _fingerprint(project, structure, code_id):
    payload = {
        "structure": structure.model_dump(mode="json", exclude={"result_hash"}),
        "design_code": code_id,
        "design_overrides": {p: v.model_dump(mode="json")
                             for p, v in project.design_overrides.get(code_id, {}).items()},
    }
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


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
    for seismic in ([False, True] if sds is not None else [False]):
        case = "seismic" if seismic and isinstance(structure, SheetPileStructure) else gwt_case
        for factor in required_layered_inputs(
            settings, approach=structure.approach, seismic=seismic,
            water=_water(structure.soil, base, case),
            include_equ=isinstance(structure, RetainingWallStructure),
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
    loads = WallLoads(surcharge=inp.surcharge, kh=kh or 0.0, kv=kv or 0.0, seismic_increment_height=0.5,
                      surcharge_resists=inp.surcharge_resists if structure.analysis_level == "advanced" else False)
    return loads, kh, kv


def _assumptions(structure, settings, D):
    gwt_case = structure.inputs.gwt_case
    out = [
        Assumption(text=f"Beton birim hacim ağırlığı {settings.concrete_unit_weight:g} kN/m³",
                   source="WallSettings; mevcut varsayılan 24 kN/m³, proje girdisi"),
        Assumption(text=f"YASS senaryosu {gwt_case}; arka derinlik "
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
                        "taban/ön arazi eğimi çarpanları 1; YASS taban altındaysa N_gamma geçiş "
                        "düzeltmesi yok", source="Mevcut bearing_capacity/profil adaptörü; Bowles, 5. baskı, Tablo 4-1/4-5"),
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
    out.append(Assumption(text="Ön ayak üzerindeki doğal zemin ağırlığı " +
                               ("dahil" if settings.include_toe_soil else "ihmal edildi"), source="WallSettings"))
    out.append(Assumption(text="Sürşarjın topuk üzerindeki düşey yükü " +
                               ("dengeleyici sayıldı" if structure.analysis_level == "advanced" and
                                structure.inputs.surcharge_resists else "dengeleyici sayılmadı"), source="WallDesignInputs"))
    if structure.analysis_level == "basic":
        out.append(Assumption(text="Temel seviye: ASD, Vesic, pasif ve ön ayak zemini kapalı; taban "
                                   "sürtünmesi onaylı katman değerinden (BASIC aktarımında tanδ=min(tanφ,0.6))",
                              source=SRC_TBDY_BASE + "; P1 §5"))
    if structure.inputs.sds is not None:
        r = structure.inputs.r if structure.inputs.r is not None else TBDY_R["gravity_80sds_mm"]
        out += [Assumption(text=f"k_h=0.4·S_DS/r, k_v=0.5·k_h, r={r:g}; dinamik itki artımı H_v/2'de",
                           source=SRC_TBDY_SEISMIC),
                Assumption(text="M-O katman bazında; hidrostatik su depremde değişmez; hidrodinamik "
                                "basınç, sıvılaşma ve fazla boşluk suyu basıncı hesaplanmaz; "
                                "drenajsız deprem itkisi ve M-O geçerlilik sınırı dışı durumlar durdurulur",
                           source="Mononobe & Matsuo (1929), Okabe (1926); FHWA GEC-3; E4 kapsam sınırı")]
    if structure.inputs.include_global_stability:
        out.append(Assumption(text="Bishop daireleri taban altından geçer; taşınan ağırlık taban izine "
                                   "eşdeğer yük olarak yayılır; kayma modelinde tek yatay su kotu için "
                                   "ön/arka YASS'ın yükseği alınır; bantlar yatay ve en alt bant sonsuzdur; "
                                   "ön taraftaki taban üstü ince şerit de tutulan taraf bantlarıyla temsil edilir; "
                                   "global dilimlerde k_v ve kısmi yük katsayıları uygulanmaz",
                              source="Bishop (1955); mevcut wall_global_stability yaklaşımı; E4 model varsayımı"))
    else:
        out.append(Assumption(text="Toptan göçme tahkiki kullanıcı girdisiyle kapalıdır", source="WallDesignInputs"))
    return out


def _case_key(state, analysis, code):
    return state if code.approach == "global_fs" else f"{state}:{analysis.case}"


def _evaluate_wall(structure, geometry, settings, loads, reporter, start, span, *, sizing):
    code = layered_design_code(settings)
    analyses, glob, slips, pressures = {}, {}, {}, {}
    states = [False, True] if structure.inputs.sds is not None else [False]
    selected = soil_at_case(structure.soil, structure.inputs.gwt_case)
    for i, seismic in enumerate(states):
        state = "seismic" if seismic else "static"
        reporter.emit(start + span * (0.08 + 0.30 * i), f"job.step.{state}_checks")
        for analysis in verify_wall_layered(
            geometry, selected, loads, settings, seismic=seismic,
            approach=structure.approach, backfill_slope=structure.backfill_slope,
        ):
            key = _case_key(state, analysis, code)
            analyses[key] = analysis
    if structure.inputs.include_global_stability and (not sizing or all(a.passed for a in analyses.values())):
        reporter.emit(start + span * 0.70, "job.step.global_stability")
        for seismic in states:
            state = "seismic" if seismic else "static"
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
                slip, check = wall_global_stability(
                    geometry, backfill, foundation, loads, settings, seismic=seismic,
                    water_level=water_level, retained_bands=retained,
                    required=case.r_global if case is not None else None,
                )
                key = state if case is None else f"{state}:{case.name}"
                if case is not None:
                    odf = slip.fs / case.r_global
                    check = CheckResult("global_stability", odf, 1.0, odf >= 1.0,
                                        f"F_d={slip.fs:.4f}, gamma_R={case.r_global:g}; {check.detail}",
                                        factors_used=list(case.factors_used))
                glob[key], slips[key] = check, slip
    return analyses, glob, slips, pressures


def _failures(analyses, glob):
    return ([f"{case}:{name}" for case, a in analyses.items() for name, check in a.checks.items() if not check.passed]
            + [f"{case}:global_stability" for case, check in glob.items() if not check.passed])


def _finish(project, structure, geometry, settings, loads, kh, kv, evaluated, iterations, governing):
    analyses, glob, slips, _ = evaluated
    code = layered_design_code(settings)
    pressures = {}
    selected = soil_at_case(structure.soil, structure.inputs.gwt_case)
    for seismic in ([False, True] if structure.inputs.sds is not None else [False]):
        state = "seismic" if seismic else "static"
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
                geometry, design, loads, settings, seismic=seismic, backfill_slope=structure.backfill_slope,
            ).items():
                pressures[f"{key}:{side}"] = distribution
    used = {}
    for result in list(analyses.values()) + list(glob.values()):
        for factor in result.factors_used:
            used[factor.path] = factor
    warnings = sorted({w for a in analyses.values() for w in a.warnings})
    if structure.soil.source_profile_id is not None:
        source = next((p for p in project.soil_profiles if p.id == structure.soil.source_profile_id), None)
        if structure.soil.is_stale(source):
            warnings.append("Yapıya kopyalanan zemin profili kaynak profile göre bayat; yapı kopyasıyla hesaplandı")
    fails = _failures(analyses, glob)
    if iterations and fails:
        warnings.insert(0, f"B=1.2H'ye kadar uygun genişlik bulunamadı; sağlanamayan: {governing}")
    return StructureWallResult(
        geometry=geometry, passed=not fails, analyses=analyses, global_stability=glob,
        governing=governing, assumptions=_assumptions(structure, settings, geometry.embedment),
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
    B = max(_ceil(0.3 * H), 0.9)
    count = int(round((1.2 * H - B) / STEP)) + 1
    best, last_fail, iterations, slot = None, [], 0, 0
    while B <= 1.2 * H + 1e-9:
        geometry = proportion_for(structure.wall_type, H, B, D)
        if geometry is not None:
            iterations += 1
            evaluated = _evaluate_wall(structure, geometry, settings, loads, reporter,
                                       0.95 * slot / count, 0.95 / count, sizing=True)
            fails = _failures(evaluated[0], evaluated[1])
            best = geometry, evaluated, fails
            if not fails:
                break
            last_fail = fails
        slot += 1
        reporter.emit(0.95 * slot / count, "job.step.sizing")
        B = round(B + STEP, 6)
    if best is None:
        raise GeoTekError("No feasible geometry for these proportions")
    geometry, evaluated, fails = best
    governing = (last_fail[0] if last_fail else "minimum width") if not fails else ", ".join(fails)
    result = _finish(project, structure, geometry, settings, loads, kh, kv, evaluated, iterations, governing)
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


def _sheet_case(structure, design_soil, *, seismic, passive_factor, active_factor=1.0,
                surcharge_factor=1.0, water_factor=1.0, seismic_factor=1.0):
    """Existing Blum/free-earth solver with independent active/passive structure profiles.

    Only the pressure adapter is new; numerical integration/root/section routines are
    shared with sheet_pile.py. No global monkeypatch or shared state is used.
    """
    H = structure.retained_height
    soil = soil_at_case(design_soil, "seismic" if seismic else "design")
    retained, front = soil.retained_profile(), soil.front_profile()
    bottom = soil.profile.bottom
    active = lateral_pressure(retained, bottom, surcharge=structure.surcharge, layerwise=True)
    zero = lateral_pressure(retained, bottom, layerwise=True)
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
        ae = lateral_pressure(retained, H, surcharge=structure.surcharge, method="coulomb",
                               kh=kh, kv=kv, layerwise=True)
        ast = lateral_pressure(retained, H, surcharge=structure.surcharge, layerwise=True)
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
                       source="Rankine (1857); P1 §1"),
            Assumption(text=f"Pasif basınç GS={factor:g} ile bölündü", source=code.source_of("safety.sheet_pile_passive.static").source),
            Assumption(text="Konsolda Blum gömülmesi %20 artırılır; ankrajlıda serbest zemin desteği",
                       source="Mevcut sheet_pile.py; USS Steel Sheet Piling Design Manual / USACE EM 1110-2-2504"),
        ]
        if seismic:
            assumptions.append(Assumption(text="r=1; M-O artımı H boyunca düzgün (bileşke H/2); "
                                                "katman başına pasif M-O/Rankine oranı en çok 1; drenajsız deprem durdurulur; "
                                                "hidrodinamik ve fazla boşluk suyu basıncı yok", source=SRC_TBDY_SEISMIC))
        reporter.emit(1.0, "job.step.sizing")
        return BasicSheetPileResult(result=result, assumptions=assumptions, kh=kh, warnings=list(result.warnings))
    results, used = {}, {}
    for seismic in ([False, True] if structure.sds is not None else [False]):
        if seismic:
            reporter.emit(0.5, "job.step.seismic_checks")
        case_soil = soil_at_case(structure.soil, "seismic" if seismic else "design")
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
    anchors = [r.anchor_force for r in results.values() if r.anchor_force is not None]
    reporter.emit(1.0, "job.step.sizing")
    return SheetPileDesign(cases=results, D_required=results[gd].D, M_design=results[gm].M_max,
                           anchor_force_design=max(anchors) if anchors else None,
                           governing_embedment=gd, governing_moment=gm, factors_used=used)
