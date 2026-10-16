"""Elastic modulus correlations [kPa]."""

from __future__ import annotations

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
