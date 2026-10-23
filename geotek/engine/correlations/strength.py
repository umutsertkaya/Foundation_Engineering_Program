"""Shear strength correlations: phi' and s_u. Stresses in kPa, angles in degrees."""

from __future__ import annotations

import numpy as np

from geotek.core.constants import PA
from geotek.core.warning_codes import format_warning
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


_SF_REFERENCE = ("Shioi & Fukui (1982), Japanese Railway Standards, as given in Bowles (1996) Eq. 3-5 "
                 "(Erol & Çekinmez 2014)")


@register(
    id="SF1982_phi_roads_SPT", parameter="phi_eff", unit="deg", source="SPT",
    inputs=("N1_60",),
    reference=_SF_REFERENCE + ", roads and bridges",
    reliability="C",
    validity="Japanese Railway Standards, roads and bridges; sands. N'70 = (N1)60 * 60/70",
    check=sand_like,
)
def phi_shioi_fukui_roads(N1_60):
    """phi' = sqrt(18 N'70) + 15, N'70 = (N1)60 * 60 / 70."""
    return np.sqrt(18.0 * (N1_60 * 60.0 / 70.0)) + 15.0


@register(
    id="SF1982_phi_buildings_SPT", parameter="phi_eff", unit="deg", source="SPT",
    inputs=("N60",),
    reference=_SF_REFERENCE + ", buildings",
    reliability="C",
    validity="Japanese Railway Standards, buildings; sands. N70 = N60 * 60/70",
    check=sand_like,
)
def phi_shioi_fukui_buildings(N60):
    """phi' = 0.36 N70 + 27, N70 = N60 * 60 / 70."""
    return 0.36 * (N60 * 60.0 / 70.0) + 27.0


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


STROUD_F1_UNKNOWN_PI = 4.0
"""f1 [kPa per blow] used without a PI: the lowest lower bound of the Stroud (1974) PI bands (20-30 band: 4-5)."""
_STROUD_REFERENCE = "Stroud (1974), European Symp. on Penetration Testing (f1 after Erol & Çekinmez 2014, App. 1.19)"


def stroud_f1(PI):
    """f1 [kPa] from PI [%]: lower bound of each band, PI < 20 -> 6.0, 20-30 -> 4.0, > 30 -> 4.2."""
    return 6.0 if PI < 20.0 else (4.0 if PI <= 30.0 else 4.2)


def _stroud_pi_unknown(inputs, opts) -> list[str]:
    return [format_warning("correlation.warning.stroud_f1_pi_unknown", f1=STROUD_F1_UNKNOWN_PI)]


@register(
    id="Stroud1974_su_SPT", parameter="su", unit="kPa", source="SPT",
    inputs=("N60", "PI"),
    reference=_STROUD_REFERENCE,
    reliability="C",
    validity="Insensitive overconsolidated clays; f1 from PI after Stroud (1974): lower bound of each PI band",
    check=clay_like,
)
def su_stroud(N60, PI):
    """s_u = f1 N60, f1 = 6.0 (PI < 20), 4.0 (20 <= PI <= 30), 4.2 (PI > 30) kPa."""
    return stroud_f1(PI) * N60


@register(
    id="Stroud1974_su_SPT_noPI", parameter="su", unit="kPa", source="SPT",
    inputs=("N60",),
    reference=_STROUD_REFERENCE + "; PI unknown",
    reliability="C",
    validity="Insensitive overconsolidated clays; PI unknown, f1 = 4.0 (lowest lower bound of the PI bands)",
    check=all_of(clay_like, _stroud_pi_unknown),
)
def su_stroud_no_pi(N60):
    """s_u = 4.0 N60 (f1 at the lowest lower bound of the Stroud PI bands)."""
    return STROUD_F1_UNKNOWN_PI * N60


_SOWERS_REFERENCE = "Sowers (1979), as given by Erol & Çekinmez (2014) Eq. 1.17"


def _sowers(coefficient: float):
    """s_u = c N60 with c = 12.5 (CH, MH), 7.5 (CL), 3.75 (ML, CL-ML, SC-SM, SM, SC) kPa."""
    return lambda N60: coefficient * N60


for _suffix, _coefficient, _symbols, _label in (
    ("high", 12.5, {"CH", "MH"}, "high plasticity"),
    ("medium", 7.5, {"CL"}, "medium plasticity"),
    ("low", 3.75, {"ML", "CL-ML", "SC-SM", "SM", "SC"},
     "low plasticity (source label 'SC-ML', mapped to these USCS symbols)"),
):
    register(
        id=f"Sowers1979_su_{_suffix}_SPT", parameter="su", unit="kPa", source="SPT",
        inputs=("N60",), reference=_SOWERS_REFERENCE, reliability="C",
        validity=f"Clays of {_label}; applies only when the layer USCS symbol is one of "
                 f"{', '.join(sorted(_symbols))}",
        check=clay_like, uscs=_symbols,
    )(_sowers(_coefficient))


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
