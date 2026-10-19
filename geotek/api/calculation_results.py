"""Project existing service results into finite, contract-owned transport models."""

from __future__ import annotations

from dataclasses import replace

from geotek.api import schemas as dto
from geotek.engine.limit_state import SheetPileDesign
from geotek.services.structures import StructureWallResult


def _check(case, check) -> dto.CheckDTO:
    divisor = check.value if check.comparison == ">=" else check.required
    numerator = check.required if check.comparison == ">=" else check.value
    return dto.CheckDTO(
        case=case, name=check.name, value=check.value, required=check.required,
        passed=check.passed, comparison=check.comparison,
        utilisation=numerator / divisor if divisor else None, detail=check.detail,
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
        )]
        warnings = list(dict.fromkeys(w for case in result.cases.values() for w in case.warnings))
    else:
        raw = result.result
        assumptions = [dto.AssumptionDTO.model_validate(item) for item in result.assumptions]
        warnings = list(dict.fromkeys([*result.warnings, *raw.warnings]))
    return dto.SheetPileResultDTO(
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
    return dto.LiquefactionResultDTO(
        per_sounding={id: dto.SoundingLiquefactionDTO(
            depth=item.depth.tolist(), CSR=item.csr.tolist(), CRR=item.crr.tolist(),
            FS=item.fs.tolist(), status=item.status.tolist(), warnings=item.warnings,
        ) for id, item in result.liquefaction.items()},
        errors=result.errors,
    )
