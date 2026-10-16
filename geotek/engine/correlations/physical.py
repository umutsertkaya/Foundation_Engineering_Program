"""Physical-state correlations: unit weight, relative density, preconsolidation, fines."""

from __future__ import annotations

import numpy as np

from geotek.core.constants import GAMMA_W, PA
from geotek.engine.correlations.checks import all_of, clay_like, in_range, sand_like
from geotek.engine.correlations.registry import register

RF_MIN = 0.01
"""Numerical floor on R_f [%] so that log(R_f) stays finite when f_s = 0."""


@register(
    id="RC2010_gamma_CPT", parameter="gamma", unit="kN/m3", source="CPT",
    inputs=("qt", "fs"),
    reference="Robertson & Cabal (2010), 2nd Int. Symp. on Cone Penetration Testing",
    reliability="B",
    validity="General; less reliable in organic/very soft soils",
)
def unit_weight_robertson_cabal(qt, fs):
    """gamma / gamma_w = 0.27 log R_f + 0.36 log(q_t/Pa) + 1.236, R_f = f_s/q_t * 100 [%]."""
    qt = np.asarray(qt, dtype=float)
    with np.errstate(divide="ignore", invalid="ignore"):
        rf = np.maximum(np.asarray(fs, dtype=float) / qt * 100.0, RF_MIN)
        ratio = 0.27 * np.log10(rf) + 0.36 * np.log10(qt / PA) + 1.236
    out = ratio * GAMMA_W
    return float(out) if out.ndim == 0 else out


@register(
    id="Skempton1986_Dr_SPT", parameter="Dr", unit="%", source="SPT",
    inputs=("N1_60",),
    reference="Skempton (1986), Geotechnique 36(3)",
    reliability="B",
    validity="Normally consolidated fine-medium sands; C_d ~ 55-65",
    options={"Cd": 60.0},
    check=all_of(sand_like, in_range("Cd", 55, 65)),
)
def dr_skempton(N1_60, Cd):
    """D_r = sqrt((N1)60 / C_d), in percent."""
    return 100.0 * np.sqrt(N1_60 / Cd)


@register(
    id="Mayne_sigp_CPT", parameter="sigma_p", unit="kPa", source="CPT",
    inputs=("qt", "sigma_v"),
    reference="Mayne (2007), NCHRP Synthesis 368",
    reliability="B",
    validity="Clays (I_c > 2.6); k = 0.2-0.5, default 0.33",
    options={"k": 0.33},
    check=all_of(clay_like, in_range("k", 0.2, 0.5)),
)
def sigma_p_mayne(qt, sigma_v, k):
    """sigma'_p = k (q_t - sigma_v0)."""
    return k * (qt - sigma_v)


@register(
    id="BI2014_FC_CPT", parameter="FC", unit="%", source="CPT",
    inputs=("Ic",),
    reference="Boulanger & Idriss (2014), Report UCD/CGM-14/01",
    reliability="C",
    validity="Generic; C_FC = 0 +/- 0.29 site-specific calibration recommended",
    options={"CFC": 0.0},
    check=in_range("CFC", -0.29, 0.29),
)
def fines_content_from_ic(Ic, CFC=0.0):
    """FC = 80 (I_c + C_FC) - 137, limited to 0-100 %."""
    out = np.clip(80.0 * (np.asarray(Ic, dtype=float) + CFC) - 137.0, 0.0, 100.0)
    return float(out) if out.ndim == 0 else out
