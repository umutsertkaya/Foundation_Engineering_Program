"""Ground anchor design: unbonded length, bond length, tendon and design/test/lock-off loads.

Method (FHWA GEC-4, FHWA-IF-99-015, sections 5.3.2-5.3.8; EN 1537 gives the same
quantities with its own partial factors, which are not applied here):

* Load: ``T = T_h,i s / cos α`` (Eq. 19-20), ``T_v = T sin α`` (Eq. 21).
* Failure surface: straight line from the excavation corner at ``45° + φ'/2`` to the
  horizontal (section 5.3.2). With ``k = tan(45° - φ'/2)`` and a head at depth ``z_h``
  the horizontal distance to the surface along the anchor line is
  ``x = (H + e - z_h) k / (1 + k tan α)``; the anchor length to it is ``x / cos α``.
* Unbonded length ``L_free = max(L_wedge + max(1.5 m, 0.2 H), L_min)`` with
  ``L_min`` 4.5 m (strand) / 3 m (bar) (section 5.3.4).
* Bond length ``L_b = T FS / q_u`` with ``q_u = π d_h τ_ult`` when given as bond stress.
* Tendon: design load <= 0.60 SMTS, lock-off <= 0.70 SMTS, test load <= 0.80 SMTS
  (section 5.3.8); strand count is the smallest integer meeting all three.

Safety factor, load transfer and lock-off ratio are never assumed: missing ones raise
``MissingAnchorInputsError`` listing every absent field.
"""

from __future__ import annotations

import hashlib
import json
import math

from geotek.core.errors import GeoTekError
from geotek.core.models.anchors import (
    AnchorCheck,
    AnchorDesignInputs,
    AnchorDesignResult,
    Notice,
    TendonResult,
)
from geotek.engine import anchor_tables as tables

_EPS = 1e-9
ENGINE_VERSION = "1"
"""Part of the inputs hash: bump when a formula or table value changes."""


def _within(load: float, limit: float) -> bool:
    """One tolerance for counting tendons and for the checks."""
    return load <= limit * (1.0 + _EPS)


class MissingAnchorInputsError(GeoTekError):
    """Engineering inputs the design needs but the caller did not provide."""

    def __init__(self, missing: list[str]):
        self.missing = list(missing)
        super().__init__("Missing anchor design inputs: " + ", ".join(self.missing))


def inputs_hash(inputs: AnchorDesignInputs) -> str:
    """Stable digest of the inputs, used to mark a stored result as out of date."""
    payload = json.dumps([ENGINE_VERSION, inputs.model_dump(mode="json")], sort_keys=True,
                         separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def missing_inputs(inputs: AnchorDesignInputs) -> list[str]:
    """Required engineering inputs without a value (empty when the design can run)."""
    missing: list[str] = []
    if inputs.safety_factor is None:
        missing.append("safety_factor")
    if inputs.ultimate_transfer_load is None:
        if inputs.ultimate_bond_stress is None:
            missing.append("ultimate_transfer_load|ultimate_bond_stress")
        elif inputs.hole_diameter is None:
            missing.append("hole_diameter")
    if inputs.lock_off_ratio is None:
        missing.append("lock_off_ratio")
    return missing


def wedge_geometry(inputs: AnchorDesignInputs) -> tuple[float, float]:
    """Return (horizontal distance, length along the anchor) from the wall to the failure surface."""
    k = math.tan(math.radians(45.0 - inputs.phi_deg / 2.0))
    alpha = math.radians(inputs.inclination_deg)
    rise = inputs.excavation_height + inputs.wedge_origin_below_base - inputs.head_depth
    x = rise * k / (1.0 + k * math.tan(alpha))
    return x, x / math.cos(alpha)


def _select_tendon(inputs: AnchorDesignInputs, design: float, lock_off: float, test: float,
                   warnings: list[Notice]) -> TendonResult:
    spec = inputs.tendon
    limits = {"design": (design, inputs.design_limit), "lock_off": (lock_off, inputs.lock_off_limit),
              "test": (test, inputs.test_limit)}

    if spec.custom_smts_kn is not None:
        kind, label, source = "custom", f"custom {spec.type}", "user input"
        smts, area = spec.custom_smts_kn, spec.custom_area_mm2
    else:
        lib_id = spec.library_id
        if lib_id is None and spec.type == "strand":
            lib_id = tables.STRAND_15MM_ID
        if lib_id is not None:
            section = tables.TENDON_BY_ID.get(lib_id)
            if section is None or section.type != spec.type:
                raise GeoTekError(f"Unknown {spec.type} tendon id: {lib_id!r}")
            smts, area, kind = section.smts_kn, section.area_mm2, spec.type
            label, source = section.label, section.source
        else:  # bar, automatic: smallest library bar meeting every limit
            bars = sorted((t for t in tables.TENDONS if t.type == "bar"), key=lambda t: t.smts_kn)
            for section in bars:
                if all(_within(load, ratio * section.smts_kn) for load, ratio in limits.values()):
                    break
            else:
                raise GeoTekError(
                    f"No library bar carries {design:.0f} kN within the load limits; "
                    "use several anchors or a custom tendon")
            smts, area, kind = section.smts_kn, section.area_mm2, "bar"
            label, source = section.label, section.source

    governing = "user"
    if spec.type == "strand":
        needed = {name: math.ceil(load / (ratio * smts) / (1.0 + _EPS)) for name, (load, ratio) in limits.items()}
        required = max(1, *needed.values())
        governing = max(needed, key=lambda n: (needed[n], n == "design"))
        count = spec.count if spec.count is not None else required
        if spec.count is not None:
            governing = "user"
            if count < required:
                raise GeoTekError(
                    f"{count} strand(s) exceed a tendon load limit; at least {required} are required")
        if spec.custom_smts_kn is None and count not in (1, 3, 4, 5, 7, 9, 12, 15, 19):
            warnings.append(Notice(code="strand_count_not_in_table", params={"count": count}))
    else:
        count = 1
        for name, (load, ratio) in limits.items():
            if not _within(load, ratio * smts):
                raise GeoTekError(
                    f"The selected bar exceeds the {name} load limit ({load:.0f} kN > "
                    f"{ratio * smts:.0f} kN)")

    total = smts * count
    return TendonResult(
        type=kind, label=label, source=source, count=count, smts_each=smts, smts_total=total,
        area_total_mm2=None if area is None else area * count,
        design_utilisation=design / total, lock_off_utilisation=lock_off / total,
        test_utilisation=test / total, count_governing=governing,
    )


def design_anchor(inputs: AnchorDesignInputs) -> AnchorDesignResult:
    """Design one ground anchor. Raises MissingAnchorInputsError / GeoTekError, never assumes."""
    missing = missing_inputs(inputs)
    if missing:
        raise MissingAnchorInputsError(missing)

    warnings: list[Notice] = []
    assumptions: list[Notice] = []
    alpha = math.radians(inputs.inclination_deg)
    H = inputs.excavation_height

    # Loads (Eq. 19-21)
    if inputs.horizontal_load_per_m is not None:
        t_h = inputs.horizontal_load_per_m * inputs.spacing
        design = t_h / math.cos(alpha)
        source = "horizontal_per_m"
    else:
        design = inputs.axial_load
        t_h = design * math.cos(alpha)
        source = "axial"
    t_v = design * math.sin(alpha)
    lock_off = inputs.lock_off_ratio * design
    test = inputs.test_factor * design

    # Unbonded length
    x_wedge, l_wedge = wedge_geometry(inputs)
    if inputs.beyond_wedge is None:
        beyond = max(1.5, 0.2 * H)
        assumptions.append(Notice(code="beyond_wedge_default", params={"value": round(beyond, 3)}))
    else:
        beyond = inputs.beyond_wedge
    l_required = l_wedge + beyond
    if inputs.min_free_length is not None:
        l_min = inputs.min_free_length
    else:
        l_min = tables.MIN_FREE_LENGTH[inputs.tendon.type]
        assumptions.append(Notice(code="min_free_length_default",
                                  params={"value": l_min, "tendon": inputs.tendon.type}))
    l_free = max(l_required, l_min)
    free_governing = "wedge" if l_required >= l_min else "minimum"
    if inputs.wedge_origin_below_base == 0:
        assumptions.append(Notice(code="wedge_origin_at_corner"))
    assumptions.append(Notice(code="level_ground_vertical_wall"))

    # Defaults and relaxations are always visible
    defaults = AnchorDesignInputs.model_fields
    if inputs.test_factor == defaults["test_factor"].default:
        assumptions.append(Notice(code="gec4_test_factor", params={"value": inputs.test_factor}))
    elif inputs.test_factor < defaults["test_factor"].default:
        warnings.append(Notice(code="test_factor_below_gec4", params={"value": inputs.test_factor}))
    for name, code in (("design_limit", "design"), ("lock_off_limit", "lock_off"), ("test_limit", "test")):
        value = getattr(inputs, name)
        if value > defaults[name].default:
            warnings.append(Notice(code="limit_above_gec4", params={"limit": code, "value": value}))
    if (inputs.design_limit, inputs.lock_off_limit, inputs.test_limit) == (0.6, 0.7, 0.8):
        assumptions.append(Notice(code="gec4_tendon_limits"))
    if inputs.min_free_length is not None and inputs.min_free_length < tables.MIN_FREE_LENGTH[inputs.tendon.type]:
        warnings.append(Notice(code="min_free_length_below_gec4",
                               params={"value": inputs.min_free_length,
                                       "gec4": tables.MIN_FREE_LENGTH[inputs.tendon.type]}))
    guidance = min(v for _, v, _ in tables.SAFETY_FACTOR_GUIDANCE)
    if inputs.safety_factor < guidance:
        warnings.append(Notice(code="safety_factor_below_guidance",
                               params={"value": inputs.safety_factor, "guidance": guidance}))
    if inputs.transfer_load_ref is None:
        warnings.append(Notice(code="transfer_load_unreferenced"))
    else:
        assumptions.append(Notice(code="transfer_load_ref", params={"ref": inputs.transfer_load_ref}))

    # Bond length
    if inputs.ultimate_transfer_load is not None:
        q_u, q_source = inputs.ultimate_transfer_load, "direct"
    else:
        q_u = math.pi * inputs.hole_diameter * inputs.ultimate_bond_stress
        q_source = "bond_stress"
    fs = inputs.safety_factor
    l_b_calc = design * fs / q_u
    l_b = l_b_calc
    bond_governing = "calculated"
    if inputs.min_bond_length is not None and inputs.min_bond_length > l_b_calc:
        l_b, bond_governing = inputs.min_bond_length, "minimum"
    if l_b > tables.TYPICAL_BOND_LENGTH_MAX:
        warnings.append(Notice(code="bond_length_exceeds_typical",
                               params={"bond_length": round(l_b, 2), "typical_max": tables.TYPICAL_BOND_LENGTH_MAX}))
    capacity = q_u * l_b / fs

    tendon = _select_tendon(inputs, design, lock_off, test, warnings)

    # Geometry checks (GEC-4 5.3.6, 5.3.7)
    lo, hi = tables.INCLINATION_RANGE
    if not lo <= inputs.inclination_deg <= hi:
        warnings.append(Notice(code="inclination_outside_range",
                               params={"inclination": inputs.inclination_deg, "min": lo, "max": hi}))
    centre_depth = inputs.head_depth + (l_free + l_b / 2.0) * math.sin(alpha)
    checks = [
        AnchorCheck(id="tendon_design", demand=design, limit=inputs.design_limit * tendon.smts_total,
                    ok=_within(design, inputs.design_limit * tendon.smts_total)),
        AnchorCheck(id="tendon_lock_off", demand=lock_off, limit=inputs.lock_off_limit * tendon.smts_total,
                    ok=_within(lock_off, inputs.lock_off_limit * tendon.smts_total)),
        AnchorCheck(id="tendon_test", demand=test, limit=inputs.test_limit * tendon.smts_total,
                    ok=_within(test, inputs.test_limit * tendon.smts_total)),
    ]
    if inputs.max_bond_length is not None:
        checks.append(AnchorCheck(id="bond_length_limit", demand=l_b, limit=inputs.max_bond_length,
                                  ok=_within(l_b, inputs.max_bond_length)))
    if inputs.ground == "soil":
        row = AnchorCheck(id="overburden", demand=inputs.min_overburden, limit=centre_depth,
                          ok=centre_depth * (1.0 + _EPS) >= inputs.min_overburden)
        checks.append(row)
        if not row.ok:
            warnings.append(Notice(code="overburden_low",
                                   params={"depth": round(centre_depth, 2), "required": inputs.min_overburden}))
    else:
        assumptions.append(Notice(code="overburden_not_checked_rock"))
    if inputs.phi_deg == 0:
        warnings.append(Notice(code="phi_zero_wedge"))

    sources = [
        f"{tables.GEC4} sections 5.3.2-5.3.4, 5.3.6-5.3.8 (free length, bond length, tendon limits)",
        f"{tables.GEC4} Eq. 19-21, p. 66-67 (anchor load)",
    ]
    return AnchorDesignResult(
        load_source=source,
        horizontal_load_per_anchor=t_h, design_load=design, vertical_load_per_anchor=t_v,
        vertical_load_per_m=(t_v / inputs.spacing if inputs.spacing is not None else None),
        lock_off_load=lock_off, test_load=test,
        wedge_angle_deg=45.0 + inputs.phi_deg / 2.0, wedge_distance=x_wedge, wedge_length=l_wedge,
        beyond_wedge=beyond, free_length_required=l_required, free_length_minimum=l_min,
        free_length=l_free, free_length_governing=free_governing,
        transfer_load=q_u, transfer_load_source=q_source, safety_factor=fs,
        bond_length_calculated=l_b_calc, bond_length=l_b, bond_length_governing=bond_governing,
        transfer_load_ref=inputs.transfer_load_ref, bond_capacity=capacity, total_length=l_free + l_b, bond_centre_depth=centre_depth,
        tendon=tendon, checks=checks, warnings=warnings, assumptions=assumptions, sources=sources,
    )
