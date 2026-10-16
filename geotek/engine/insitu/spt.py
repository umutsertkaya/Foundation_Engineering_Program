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
from geotek.core.models.investigations import Borehole
from geotek.core.models.profile import SoilProfile

CN_MAX = 1.7


def rod_length_factor(rod_length):
    """C_R by rod length [m] (Youd et al. 2001, Table 2)."""
    L = np.asarray(rod_length, dtype=float)
    out = np.select(
        [L < 3.0, L < 4.0, L < 6.0, L < 10.0],
        [0.75, 0.80, 0.85, 0.95],
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
    c_b: float
    c_s: float
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
    if not borehole.spt:
        raise ValueError(f"Borehole {borehole.id!r} has no SPT records")
    depth = np.array([r.depth for r in borehole.spt])
    n_field = np.array([r.n_field for r in borehole.spt], dtype=float)
    refusal = np.array([r.refusal for r in borehole.spt])

    sigma_v, u0, sigma_eff = profile.stresses(depth, gwt_case)
    c_r = rod_length_factor(depth + rod_stickup)
    c_b = borehole_diameter_factor(borehole.borehole_diameter_mm)
    c_s = sampler_factor(borehole.sampler, no_liner_factor)
    n_60 = n60(n_field, borehole.energy_ratio, c_b, c_s, c_r)
    c_n = overburden_factor_liao_whitman(sigma_eff)

    warnings = []
    if refusal.any():
        warnings.append(
            f"{int(refusal.sum())} record(s) at refusal: N is a lower bound at depth(s) "
            f"{depth[refusal].tolist()} m"
        )
    if np.any(sigma_eff > 200.0):
        warnings.append("sigma'_v0 > 200 kPa: Liao & Whitman C_N is outside its recommended range")

    return SPTProcessed(
        borehole_id=borehole.id, depth=depth, n_field=n_field, refusal=refusal,
        sigma_v=sigma_v, u0=u0, sigma_v_eff=sigma_eff, c_r=c_r, c_b=c_b, c_s=c_s,
        c_n=c_n, n60=n_60, n1_60=c_n * n_60, warnings=warnings,
    )
