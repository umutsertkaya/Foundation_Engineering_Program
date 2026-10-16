"""Shear strength correlations: phi' and s_u. Stresses in kPa, angles in degrees."""

from __future__ import annotations

import numpy as np

from geotek.core.constants import PA
from geotek.engine.correlations.checks import all_of, clay_like, in_range, sand_like
from geotek.engine.correlations.registry import register

# --- phi' from SPT -----------------------------------------------------------------------


@register(
    id="KM1990_phi_SPT", parameter="phi_eff", unit="deg", source="SPT",
    inputs=("N60", "sigma_v_eff"),
    reference="Kulhawy & Mayne (1990), EPRI EL-6800 (after Schmertmann 1975)",
    reliability="B",
    validity="Clean, uncemented sands; gravel inflates N",
    check=all_of(sand_like, in_range("N60", 0, 60)),
)
def phi_kulhawy_mayne_spt(N60, sigma_v_eff):
    """phi' = atan[(N60 / (12.2 + 20.3 sigma'_v0/Pa))^0.34]."""
    return np.degrees(np.arctan((N60 / (12.2 + 20.3 * sigma_v_eff / PA)) ** 0.34))


@register(
    id="HU1996_phi_SPT", parameter="phi_eff", unit="deg", source="SPT",
    inputs=("N1_60",),
    reference="Hatanaka & Uchida (1996), Soils and Foundations 36(4)",
    reliability="B",
    validity="Sands, approx. 3.5 <= (N1)60 <= 30 (range pending source verification)",
    check=all_of(sand_like, in_range("N1_60", 3.5, 30)),
)
def phi_hatanaka_uchida(N1_60):
    """phi' = sqrt(20 (N1)60) + 20."""
    return np.sqrt(20.0 * N1_60) + 20.0


@register(
    id="PHT1974_phi_SPT", parameter="phi_eff", unit="deg", source="SPT",
    inputs=("N1_60",),
    reference="Peck, Hanson & Thornburn (1974), fit by Wolff (1989)",
    reliability="B",
    validity="Sands, (N1)60 <= ~50",
    check=all_of(sand_like, in_range("N1_60", 0, 50)),
)
def phi_peck_wolff(N1_60):
    """phi' = 27.1 + 0.3 (N1)60 - 0.00054 (N1)60^2."""
    return 27.1 + 0.3 * N1_60 - 0.00054 * N1_60**2


# --- phi' from CPT -----------------------------------------------------------------------


@register(
    id="RC1983_phi_CPT", parameter="phi_eff", unit="deg", source="CPT",
    inputs=("qc", "sigma_v_eff"),
    reference="Robertson & Campanella (1983), Can. Geotech. J. 20(4)",
    reliability="B",
    validity="Uncemented, unaged quartz sands (I_c < 2.6)",
    check=sand_like,
)
def phi_robertson_campanella(qc, sigma_v_eff):
    """tan phi' = (1/2.68) [log(q_c / sigma'_v0) + 0.29]."""
    return np.degrees(np.arctan((np.log10(qc / sigma_v_eff) + 0.29) / 2.68))


@register(
    id="KM1990_phi_CPT", parameter="phi_eff", unit="deg", source="CPT",
    inputs=("qt", "sigma_v_eff"),
    reference="Kulhawy & Mayne (1990); Mayne (2007) NCHRP Synthesis 368",
    reliability="B",
    validity="Clean sands (I_c < 2.6)",
    check=sand_like,
)
def phi_kulhawy_mayne_cpt(qt, sigma_v_eff):
    """phi' = 17.6 + 11.0 log[(q_t/Pa) / (sigma'_v0/Pa)^0.5]."""
    return 17.6 + 11.0 * np.log10((qt / PA) / np.sqrt(sigma_v_eff / PA))


# --- phi' from plasticity ----------------------------------------------------------------


@register(
    id="TPM1996_phi_PI", parameter="phi_eff", unit="deg", source="lab",
    inputs=("PI",),
    reference="Terzaghi, Peck & Mesri (1996), after Kenney (1959) (attribution pending verification)",
    reliability="C",
    validity="Normally consolidated clays, 5 <= PI <= 80 (range pending verification)",
    check=in_range("PI", 5, 80),
)
def phi_from_pi(PI):
    """sin phi' = 0.8 - 0.094 ln(PI)."""
    return np.degrees(np.arcsin(0.8 - 0.094 * np.log(PI)))


# --- s_u ---------------------------------------------------------------------------------


@register(
    id="CPT_su_Nkt", parameter="su", unit="kPa", source="CPT",
    inputs=("qt", "sigma_v"),
    reference="Lunne, Robertson & Powell (1997); Robertson & Cabal (2015) CPT Guide",
    reliability="A",
    validity="Clay-like soils (I_c > 2.6); N_kt 10-20, calibrate locally",
    options={"Nkt": 14.0},
    check=all_of(clay_like, in_range("Nkt", 10, 20)),
)
def su_nkt(qt, sigma_v, Nkt):
    """s_u = (q_t - sigma_v0) / N_kt."""
    return (qt - sigma_v) / Nkt


@register(
    id="CPTu_su_Ndu", parameter="su", unit="kPa", source="CPT",
    inputs=("u2", "u0"),
    reference="Lunne, Robertson & Powell (1997)",
    reliability="B",
    validity="Soft, sensitive clays; N_du 4-10",
    options={"Ndu": 7.0},
    check=all_of(clay_like, in_range("Ndu", 4, 10)),
)
def su_ndu(u2, u0, Ndu):
    """s_u = (u2 - u0) / N_du."""
    return (u2 - u0) / Ndu


@register(
    id="Stroud1974_su_SPT", parameter="su", unit="kPa", source="SPT",
    inputs=("N60",),
    reference="Stroud (1974), European Symp. on Penetration Testing",
    reliability="C",
    validity="Insensitive overconsolidated clays; f1 = 3.5-6.5 kPa depending on PI",
    options={"f1": 4.4},
    check=all_of(clay_like, in_range("f1", 3.5, 6.5)),
)
def su_stroud(N60, f1):
    """s_u = f1 N60."""
    return f1 * N60


@register(
    id="Hara1974_su_SPT", parameter="su", unit="kPa", source="SPT",
    inputs=("N60",),
    reference="Hara et al. (1974), Soils and Foundations 14(3)",
    reliability="C",
    validity="Clays; low reliability, use only for preliminary estimates",
    check=clay_like,
)
def su_hara(N60):
    """s_u = 29 N60^0.72 [kPa]."""
    return 29.0 * N60**0.72
