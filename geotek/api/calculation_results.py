"""Project existing service results into finite, contract-owned transport models."""

from __future__ import annotations

from dataclasses import replace
import math
import re

from geotek.api import schemas as dto
from geotek.engine.limit_state import SheetPileDesign
from geotek.services.structures import StructureWallResult
from geotek.core.warning_codes import parse_warning


def _check(case, check) -> dto.CheckDTO:
    divisor = check.value if check.comparison == ">=" else check.required
    numerator = check.required if check.comparison == ">=" else check.value
    return dto.CheckDTO(
        case=case, name=check.name, value=check.value, required=check.required,
        passed=check.passed, comparison=check.comparison,
        utilisation=numerator / divisor if divisor else None, detail=check.detail,
        kv_sign=getattr(check, "kv_sign", None),
    )


def wall_result(id: str, result: StructureWallResult, fingerprint: str) -> dto.WallResultDTO:
    """Retain cases, pressure sides, global checks and the service's governing check."""
    checks = [_check(case, check) for case, analysis in result.analyses.items()
              for check in analysis.checks.values()]
    checks.extend(_check(case, check) for case, check in result.global_stability.items())
    pressures = []
    for key, pressure in result.pressures.items():
        case, side = key.rsplit(":", 1)
        # The engine also returns diagnostic component diagrams (retained_static, retained_soil,
        # front_water); the API contract exposes only the two resultant sides.
        if side not in ("retained", "front"):
            continue
        pressures.append(dto.PressureDiagramDTO(
            side=side, case=case, z=pressure.z.tolist(),
            sigma_h_eff=pressure.sigma_h_eff.tolist(), u=pressure.u.tolist(),
            sigma_h=pressure.sigma_h.tolist(), force=pressure.force,
            z_resultant=pressure.z_resultant,
        ))
    return dto.WallResultDTO(
        structure_id=id, geometry=result.geometry, passed=result.passed,
        governing=result.governing, checks=checks,
        shear_key=[dto.ShearKeyResultDTO(case=case, **vars(analysis.shear_key))
                   for case, analysis in result.analyses.items() if analysis.shear_key is not None],
        governing_check_ids=list(getattr(result, "governing_check_ids", [])),
        minimum_width_governs=getattr(result, "minimum_width_governs", False),
        forces={case: [dto.ForceDTO.model_validate(force) for force in analysis.forces]
                for case, analysis in result.analyses.items()},
        pressures=pressures,
        slip_circles=[dto.SlipCircleDTO(case=case, xc=slip.xc, yc=slip.yc,
                                      radius=slip.radius, fs=slip.fs)
                      for case, slip in result.slip_results.items()],
        assumptions=[dto.AssumptionDTO.model_validate(item) for item in result.assumptions],
        factors_used=[dto.UsedFactorDTO.model_validate(item) for item in result.factors_used],
        warnings=result.warnings, kh=result.kh, kv=result.kv, iterations=result.iterations,
        result_hash=fingerprint,
    )


def _sheet_warning(text: str) -> dto.MessageDTO:
    """Map sheet/pressure diagnostics, retaining unknown text losslessly.

    Sources: structures._sheet_case, earth_pressure.distribution (including
    coefficient diagnostics), and the standalone anchored solver load message.
    Steep seismic/passive Coulomb diagnostics are covered defensively even though
    current _sheet_case defaults cannot emit them. Legacy strings stay unchanged.
    """
    if text.startswith("wall.warning.override_not_applied"):
        _, params = parse_warning(text)
        return dto.MessageDTO(code="override_not_applied", params=params)
    if text == "Design embedment extends below the soil profile":
        return dto.MessageDTO(code="sheet_pile.embedment_below_profile")
    patterns = [
        (r"Tension zone to ([-+\d.eE]+) m set to zero \(tension crack\)",
         "sheet_pile.tension_crack", ("depth",), (float,)),
        (r"Layer (.+): c' ignored by the (.+) solution",
         "sheet_pile.cohesion_ignored", ("layer", "method"), (str, str)),
        (r"Katman (.+): TBDY Denk. 16\.24b \(β > φ' − ψ\) uygulandı\.",
         "sheet_pile.steep_seismic", ("layer",), (str,)),
        (r"Layer (.+): c' ignored for sloping backfill \(Rankine\)",
         "sheet_pile.slope_cohesion_ignored", ("layer",), (str,)),
        (r"Layer (.+): Coulomb passive with delta > phi/2 is unconservative",
         "sheet_pile.passive_coulomb", ("layer",), (str,)),
        (r"Anchor load: ([-+\d.eE]+) kN per anchor \(spacing ([-+\d.eE]+) m, inclination ([-+\d.eE]+) deg\)",
         "sheet_pile.anchor_load", ("load", "spacing", "inclination"), (float, float, float)),
    ]
    for pattern, code, names, converters in patterns:
        match = re.fullmatch(pattern, text)
        if match:
            return dto.MessageDTO(code=code, params={
                name: convert(value) for name, convert, value in zip(names, converters, match.groups())
            })
    return dto.MessageDTO(code="generic", params={"text": text})


def sheet_pile_result(id: str, result) -> dto.SheetPileResultDTO:
    """Expose service design envelopes; curves belong to the governing moment case.

    The flat contract has no per-case series. For partial-factor designs, D/D0 and
    toe force come from the embedment case, moment curves and section modulus from
    the moment case, and anchor force from the service envelope. State that explicitly.
    """
    if isinstance(result, SheetPileDesign):
        depth = result.cases[result.governing_embedment]
        moment = result.cases[result.governing_moment]
        raw = replace(moment, D0=depth.D0, D=result.D_required, M_max=result.M_design,
                      anchor_force=result.anchor_force_design, toe_force=depth.toe_force)
        assumptions = [dto.AssumptionDTO(
            text=(f"Embedment and toe force: {result.governing_embedment}; moment, curves "
                  f"and section modulus: {result.governing_moment}; anchor force: case envelope."),
            source="geotek.services.structures.design_sheet_pile_structure / SheetPileDesign",
            code="sheet_pile.governing_cases", params={"embedment": result.governing_embedment,
                                                      "moment": result.governing_moment},
        )]
        warnings = list(dict.fromkeys(w for case in result.cases.values() for w in case.warnings))
        assumptions.extend(dto.AssumptionDTO.model_validate(item)
                           for item in getattr(result, "assumptions", []))
    else:
        raw = result.result
        assumptions = [dto.AssumptionDTO.model_validate(item) for item in result.assumptions]
        warnings = list(dict.fromkeys([*result.warnings, *raw.warnings]))
    # Engine defaults (anchored_sheet_pile): 1 m spacing, horizontal anchor; shown in the assumptions.
    spacing = getattr(result, "anchor_spacing_used", None)
    inclination = getattr(result, "anchor_inclination_used", None)
    spacing = 1.0 if spacing is None else spacing
    inclination = 0.0 if inclination is None else inclination
    per_anchor = None
    if raw.support == "anchored" and raw.anchor_force is not None:
        per_anchor = raw.anchor_force * spacing / math.cos(math.radians(inclination))
        assumptions.append(dto.AssumptionDTO(
            text=f"Anchor load = wall force × spacing / cos(inclination); spacing {spacing:g} m, inclination {inclination:g} deg",
            source="SheetPileStructure; geotek.engine.sheet_pile.anchored_sheet_pile",
            code="sheet_pile.anchor_geometry", params={"spacing": spacing, "inclination": inclination},
        ))
    return dto.SheetPileResultDTO(
        anchor_force_per_anchor=per_anchor,
        anchor_spacing_used=spacing if raw.support == "anchored" else None,
        anchor_inclination_used=inclination if raw.support == "anchored" else None,
        warning_items=[_sheet_warning(w) for w in warnings],
        structure_id=id, support=raw.support, H=raw.H, D0=raw.D0, D=raw.D,
        total_length=raw.H + raw.D, anchor_depth=raw.anchor_depth,
        anchor_force=raw.anchor_force, toe_force=raw.toe_force, M_max=raw.M_max,
        z_M_max=raw.z_M_max, z=raw.z.tolist(), shear=raw.shear.tolist(),
        moment=raw.moment.tolist(), net=raw.net.tolist(),
        section_modulus_cm3=raw.section_modulus_cm3, assumptions=assumptions,
        warnings=warnings,
    )


def liquefaction_result(result) -> dto.LiquefactionResultDTO:
    """Keep independent sounding errors and depth-aligned triggering statuses."""
    def one(item) -> dto.SoundingLiquefactionDTO:
        summary = item.summary()
        return dto.SoundingLiquefactionDTO(
            depth=item.depth.tolist(), CSR=item.csr.tolist(), CRR=item.crr.tolist(),
            FS=item.fs.tolist(), status=item.status.tolist(), warnings=item.warnings,
            LPI=summary["LPI"], LPI_category=summary["LPI_category"],
            LPI_incomplete=summary["LPI_incomplete"],
        )

    return dto.LiquefactionResultDTO(
        per_sounding={id: one(item) for id, item in result.liquefaction.items()},
        errors=result.errors,
    )
