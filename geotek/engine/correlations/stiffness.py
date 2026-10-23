"""Elastic modulus correlations [kPa]."""

from __future__ import annotations

import numpy as np

from geotek.core.constants import PA
from geotek.engine.correlations.checks import all_of, in_range, sand_like
from geotek.engine.correlations.registry import register


@register(
    id="KM1990_E_SPT", parameter="E", unit="kPa", source="SPT",
    inputs=("N60",),
    reference="Kulhawy & Mayne (1990); FHWA GEC-6 (FHWA-IF-02-054)",
    reliability="C",
    validity="Sands, drained; alpha = 5 (silty sand), 10 (clean NC sand), 15 (clean OC sand)",
    options={"alpha": 10.0},
    check=all_of(sand_like, in_range("alpha", 5, 15)),
)
def e_kulhawy_mayne_spt(N60, alpha):
    """E / Pa = alpha N60."""
    return alpha * PA * N60


@register(
    id="R2009_E_CPT", parameter="E", unit="kPa", source="CPT",
    inputs=("qt", "sigma_v", "Ic"),
    reference="Robertson (2009), Can. Geotech. J. 46(11)",
    reliability="B",
    validity="Young, uncemented silica sands (I_c < 2.6); strain ~0.1%",
    check=sand_like,
)
def e_robertson_cpt(qt, sigma_v, Ic):
    """E' = alpha_E (q_t - sigma_v0), alpha_E = 0.015 * 10^(0.55 I_c + 1.68)."""
    return 0.015 * 10.0 ** (0.55 * Ic + 1.68) * (qt - sigma_v)


# --- SPT-based E by USCS group (FHWA 2002a; Bowles 1996) --------------------------------------
# Tables as given in Keleşoğlu, Arazi Deneyleri (Erol & Çekinmez 2014; Bowles 1996 tables).

SAND_USCS = frozenset({"SP", "SW", "SP-SM", "SW-SM"})
"""Clean-sand groups of the E tables (FHWA 2002a 'sand'; Bowles 1996 'sand')."""

_E_REFERENCE = "{}, as given in Keleşoğlu, Arazi Deneyleri (Erol & Çekinmez 2014; Bowles 1996 tables)"
_FHWA = _E_REFERENCE.format("FHWA (2002a)")
_BOWLES = _E_REFERENCE.format("Bowles (1996)")


def _n55(N60):
    return N60 * 60.0 / 55.0


@register(
    id="FHWA2002_E_silt_SPT", parameter="E", unit="kPa", source="SPT", inputs=("N1_60",),
    reference=_FHWA, reliability="C",
    validity="Silts (ML, SM, SC-SM, CL-ML) by the layer USCS symbol; E = 400 (N1)60",
    uscs={"ML", "SM", "SC-SM", "CL-ML"},
)
def e_fhwa_silt(N1_60):
    """E = 400 (N1)60 [kPa]."""
    return 400.0 * N1_60


@register(
    id="FHWA2002_E_sand_SPT", parameter="E", unit="kPa", source="SPT", inputs=("N1_60",),
    reference=_FHWA, reliability="C",
    validity="Sands (SP, SW, SP-SM, SW-SM) by the layer USCS symbol; E = 700 (N1)60. The source's "
             "coarse-sand value 1000 cannot be told apart by USCS and is not used; 700 is the lower "
             "value (safe side)",
    check=sand_like, uscs=SAND_USCS,
)
def e_fhwa_sand(N1_60):
    """E = 700 (N1)60 [kPa]."""
    return 700.0 * N1_60


@register(
    id="FHWA2002_E_gravel_SPT", parameter="E", unit="kPa", source="SPT", inputs=("N1_60",),
    reference=_FHWA, reliability="C",
    validity="Gravels (GW, GP, GW-GM, GP-GM) by the layer USCS symbol; E = 1200 (N1)60",
    check=sand_like, uscs={"GW", "GP", "GW-GM", "GP-GM"},
)
def e_fhwa_gravel(N1_60):
    """E = 1200 (N1)60 [kPa]."""
    return 1200.0 * N1_60


@register(
    id="Bowles1996_E_sand_SPT", parameter="E", unit="kPa", source="SPT", inputs=("N60",),
    reference=_BOWLES, reliability="C",
    validity="Sands above the water table (points with below_gwt = 0); E = 500 (N55 + 15), "
             "N55 = N60 * 60/55",
    check=sand_like, uscs=SAND_USCS,
)
def e_bowles_sand(N60):
    """E = 500 (N55 + 15) [kPa]."""
    return 500.0 * (_n55(N60) + 15.0)


@register(
    id="Bowles1996_E_sand_sat_SPT", parameter="E", unit="kPa", source="SPT", inputs=("N60",),
    reference=_BOWLES, reliability="C",
    validity="Saturated sands (points with below_gwt = 1); E = 250 (N55 + 15), N55 = N60 * 60/55",
    check=sand_like, uscs=SAND_USCS,
)
def e_bowles_sand_saturated(N60):
    """E = 250 (N55 + 15) [kPa]."""
    return 250.0 * (_n55(N60) + 15.0)


@register(
    id="Bowles1996_E_clayey_sand_SPT", parameter="E", unit="kPa", source="SPT", inputs=("N60",),
    reference=_BOWLES, reliability="C",
    validity="Clayey sand (SC); E = 320 (N55 + 15), N55 = N60 * 60/55",
    check=sand_like, uscs={"SC"},
)
def e_bowles_clayey_sand(N60):
    """E = 320 (N55 + 15) [kPa]."""
    return 320.0 * (_n55(N60) + 15.0)


@register(
    id="Bowles1996_E_silt_SPT", parameter="E", unit="kPa", source="SPT", inputs=("N60",),
    reference=_BOWLES, reliability="C",
    validity="Silt (ML, CL-ML); E = 300 (N55 + 6), N55 = N60 * 60/55",
    uscs={"ML", "CL-ML"},
)
def e_bowles_silt(N60):
    """E = 300 (N55 + 6) [kPa]."""
    return 300.0 * (_n55(N60) + 6.0)


_NC_SAND = ("Normally consolidated sands above the water table (points with below_gwt = 0); "
            "N55 = N60 * 60/55; ")


@register(
    id="Bowles1996_E_sand_sqrt_SPT", parameter="E", unit="kPa", source="SPT", inputs=("N60",),
    reference=_BOWLES, reliability="C", validity=_NC_SAND + "E = 7000 sqrt(N55)",
    check=sand_like, uscs=SAND_USCS,
)
def e_bowles_sand_sqrt(N60):
    """E = 7000 sqrt(N55) [kPa]."""
    return 7000.0 * np.sqrt(_n55(N60))


@register(
    id="Bowles1996_E_sand_lin_SPT", parameter="E", unit="kPa", source="SPT", inputs=("N60",),
    reference=_BOWLES, reliability="C", validity=_NC_SAND + "E = 6000 N55",
    check=sand_like, uscs=SAND_USCS,
)
def e_bowles_sand_linear(N60):
    """E = 6000 N55 [kPa]."""
    return 6000.0 * _n55(N60)


@register(
    id="Bowles1996_E_sand_ln_SPT", parameter="E", unit="kPa", source="SPT", inputs=("N60",),
    reference=_BOWLES, reliability="C",
    validity=_NC_SAND + "E = 15000 ln(N55) (lower bound of the 15000-22000 range); not defined "
             "for N55 <= 1",
    check=sand_like, uscs=SAND_USCS,
)
def e_bowles_sand_ln(N60):
    """E = 15000 ln(N55) [kPa]; NaN for N55 <= 1."""
    n55 = np.asarray(_n55(N60), dtype=float)
    return np.where(n55 > 1.0, 15000.0 * np.log(np.where(n55 > 1.0, n55, 2.0)), np.nan)


@register(
    id="Bowles1996_E_sand_lin2_SPT", parameter="E", unit="kPa", source="SPT", inputs=("N60",),
    reference=_BOWLES, reliability="C",
    validity=_NC_SAND + "E = 2600 N55 (lower bound of the 2600-2900 range)",
    check=sand_like, uscs=SAND_USCS,
)
def e_bowles_sand_linear_low(N60):
    """E = 2600 N55 [kPa]."""
    return 2600.0 * _n55(N60)
