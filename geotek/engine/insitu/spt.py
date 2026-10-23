"""SPT corrections: N60 and (N1)60.

References
----------
Youd, T.L. et al. (2001). Liquefaction resistance of soils: summary report from the
1996 NCEER and 1998 NCEER/NSF workshops. J. Geotech. Geoenviron. Eng., 127(10). Table 2.
Liao, S.S.C. & Whitman, R.V. (1986). Overburden correction factors for SPT in sand.
J. Geotech. Eng., 112(3).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from geotek.core.constants import PA
from geotek.core.warning_codes import format_warning
from geotek.core.models.investigations import REFUSAL_BLOWS, Borehole
from geotek.core.models.profile import SoilProfile

CN_MAX = 1.7
ER_ASSUMED = 60.0
"""Energy ratio [%] used (with a warning) when neither the record nor the borehole states one."""
BOREHOLE_DIAMETER_RANGE_MM = (65.0, 200.0)
"""Diameters tabulated for C_B (Youd et al. 2001, Table 2); outside it the factor is an extrapolation."""


def rod_length_factor(rod_length):
    """C_R by rod length [m]: <3 m 0.75, 3-4 m 0.75, 4-6 m 0.85, 6-10 m 0.95, 10-30 m 1.0.

    The 3-4 m class takes 0.75 after Skempton (1986) and TBDY 2018 Table 16B.1; Youd et al. (2001),
    Table 2 gives 0.80 there. The lower value reduces N60 and (N1)60, which lowers phi', D_r and
    the CRR, so it is the safe side for those quantities.
    """
    L = np.asarray(rod_length, dtype=float)
    if not np.all(np.isfinite(L)) or np.any(L < 0):
        raise ValueError("SPT rod length must be finite and non-negative")
    out = np.select(
        [L < 3.0, L < 4.0, L < 6.0, L < 10.0],
        [0.75, 0.75, 0.85, 0.95],
        default=1.0,
    )
    return float(out) if out.ndim == 0 else out


def borehole_diameter_factor(diameter_mm: float) -> float:
    """C_B: 65-115 mm -> 1.0, 150 mm -> 1.05, 200 mm -> 1.15 (Youd et al. 2001)."""
    if diameter_mm <= 115:
        return 1.0
    if diameter_mm <= 150:
        return 1.05
    return 1.15


def sampler_factor(sampler: str, no_liner_factor: float = 1.2) -> float:
    """C_S: 1.0 for a standard sampler; 1.1-1.3 for a sampler without liners."""
    if sampler == "standard":
        return 1.0
    if not 1.1 <= no_liner_factor <= 1.3:
        raise ValueError("C_S for a sampler without liners must be within 1.1-1.3")
    return no_liner_factor


def n_from_blows(blows) -> int:
    """N = blows of the second and third 150 mm drives; the first (seating) drive is not counted."""
    if len(blows) != 3:
        raise ValueError("Three 150 mm blow counts are required")
    return int(blows[1]) + int(blows[2])


def is_refusal(blows) -> bool:
    """True when any 150 mm increment reached 50 blows (ASTM D1586 refusal criterion;
    the 100-blow and no-advance criteria need penetration data and are not tested here)."""
    return any(int(b) >= REFUSAL_BLOWS for b in blows)


def n60(n_field, energy_ratio: float, c_b: float = 1.0, c_s: float = 1.0, c_r=1.0):
    """N60 = N * (ER/60) * C_B * C_S * C_R."""
    return np.asarray(n_field, dtype=float) * (energy_ratio / 60.0) * c_b * c_s * np.asarray(c_r)


def overburden_factor_liao_whitman(sigma_v_eff, cap: float = CN_MAX):
    """C_N = (Pa / sigma'_v0)^0.5 <= 1.7 (Liao & Whitman 1986; NCEER cap)."""
    s = np.asarray(sigma_v_eff, dtype=float)
    with np.errstate(divide="ignore"):
        cn = np.sqrt(PA / s)
    out = np.minimum(cn, cap)
    return float(out) if out.ndim == 0 else out


@dataclass
class SPTProcessed:
    borehole_id: str
    depth: np.ndarray
    n_field: np.ndarray
    refusal: np.ndarray
    sigma_v: np.ndarray
    u0: np.ndarray
    sigma_v_eff: np.ndarray
    c_r: np.ndarray
    c_b: np.ndarray
    c_s: np.ndarray
    energy_ratio: np.ndarray
    c_n: np.ndarray
    n60: np.ndarray
    n1_60: np.ndarray
    warnings: list[str] = field(default_factory=list)

    def to_dataframe(self) -> pd.DataFrame:
        return pd.DataFrame({
            "depth": self.depth, "N": self.n_field, "refusal": self.refusal,
            "sigma_v": self.sigma_v, "u0": self.u0, "sigma_v_eff": self.sigma_v_eff,
            "C_R": self.c_r, "C_N": self.c_n, "N60": self.n60, "N1_60": self.n1_60,
        })


def equipment_corrections(
    borehole: Borehole, rod_stickup: float = 0.0, no_liner_factor: float = 1.2,
):
    """Stress-independent part of the SPT processing.

    Returns ``(depth, n_field, refusal, c_r, c_b, c_s, energy_ratio, n60, warnings)`` for all
    records. It needs no soil profile, so it still works when the profile cannot supply stresses
    (e.g. ``gamma_sat`` missing below the groundwater table).
    """
    if not borehole.spt:
        raise ValueError(f"Borehole {borehole.id!r} has no SPT records")
    depth = np.array([r.depth for r in borehole.spt])
    n_field = np.array([r.n_field for r in borehole.spt], dtype=float)
    refusal = np.array([r.refusal for r in borehole.spt])
    rod_given = np.array([r.rod_length is not None for r in borehole.spt])
    rod = np.array([r.rod_length if r.rod_length is not None else d + rod_stickup
                    for r, d in zip(borehole.spt, depth)])
    er_given = np.array([r.energy_ratio is not None or borehole.energy_ratio is not None
                         for r in borehole.spt])
    er = np.array([r.energy_ratio if r.energy_ratio is not None else
                   (borehole.energy_ratio if borehole.energy_ratio is not None else ER_ASSUMED)
                   for r in borehole.spt])
    diameter = np.array([r.borehole_diameter_mm or borehole.borehole_diameter_mm for r in borehole.spt])
    c_r = rod_length_factor(rod)
    c_b = np.array([borehole_diameter_factor(d) for d in diameter])
    c_s = np.array([sampler_factor(r.sampler or borehole.sampler, no_liner_factor)
                    for r in borehole.spt])
    n_60 = n60(n_field, er, c_b, c_s, c_r)

    warnings = []
    if refusal.any():
        warnings.append(format_warning(
            "insitu.warning.spt_refusal", count=int(refusal.sum()),
            depths=", ".join(f"{float(z):g}" for z in depth[refusal]),
        ))
    if not er_given.all():
        warnings.append(format_warning(
            "insitu.warning.spt_energy_ratio_assumed", count=int((~er_given).sum()),
            energy_ratio=ER_ASSUMED))
    if not rod_given.all():
        warnings.append(format_warning(
            "insitu.warning.spt_rod_length_assumed", count=int((~rod_given).sum()),
            stickup=float(rod_stickup)))
    lo, hi = BOREHOLE_DIAMETER_RANGE_MM
    for value in sorted({float(d) for d in diameter if not lo <= d <= hi}):
        warnings.append(format_warning(
            "insitu.warning.spt_borehole_diameter_out_of_range",
            diameter=value, minimum=lo, maximum=hi))
    return depth, n_field, refusal, c_r, c_b, c_s, er, n_60, warnings


def process_borehole(
    borehole: Borehole,
    profile: SoilProfile,
    *,
    gwt_case: str = "insitu",
    rod_stickup: float = 0.0,
    no_liner_factor: float = 1.2,
) -> SPTProcessed:
    """Apply energy, equipment and overburden corrections to all SPT records.

    Rod length is taken as test depth + ``rod_stickup`` (length above ground) [m].
    """
    depth, n_field, refusal, c_r, c_b, c_s, er, n_60, warnings = equipment_corrections(
        borehole, rod_stickup, no_liner_factor)
    sigma_v, u0, sigma_eff = profile.stresses(depth, gwt_case)
    c_n = overburden_factor_liao_whitman(sigma_eff)
    if np.any(sigma_eff > 200.0):
        # Same position as before the split: right after the refusal warning, if any.
        warnings.insert(1 if refusal.any() else 0, format_warning("insitu.warning.spt_cn_out_of_range"))

    return SPTProcessed(
        borehole_id=borehole.id, depth=depth, n_field=n_field, refusal=refusal,
        sigma_v=sigma_v, u0=u0, sigma_v_eff=sigma_eff, c_r=c_r, c_b=c_b, c_s=c_s,
        energy_ratio=er, c_n=c_n, n60=n_60, n1_60=c_n * n_60, warnings=warnings,
    )
