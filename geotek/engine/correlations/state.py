"""State and small-strain parameters: relative density, OCR, K0, constrained modulus, Vs, G_max.

Sources are the formulae shown in the course exercise set ``Field_Tests_2026`` (Istanbul University
Cerrahpasa, Foundation Engineering 2) with the original authors it cites; none is checked against the
original papers yet (``verified`` stays False). Stresses in kPa, Vs in m/s, moduli in kPa.
"""

from __future__ import annotations

import numpy as np

from geotek.core.constants import G, PA
from geotek.engine.correlations.checks import all_of, clay_like, in_range, sand_like
from geotek.engine.correlations.registry import register

@register(
    id="Jamiolkowski1985_Dr_CPT", parameter="Dr", unit="%", source="CPT",
    inputs=("qc", "sigma_v_eff"),
    reference="Jamiolkowski et al. (1985), as given in the course exercise set (slide heading says 1990, figure caption 1985)",
    reliability="C",
    validity="Clean, uncemented, normally consolidated sands (I_c < 2.6); compressibility changes the fit",
    check=sand_like,
)
def dr_jamiolkowski_cpt(qc, sigma_v_eff):
    """D_r = -98 + 66 log10[q_c / sqrt(sigma'_v0)] with q_c and sigma'_v0 in t/m2 (1 t/m2 ~ 10 kPa)."""
    return -98.0 + 66.0 * np.log10((qc / 10.0) / np.sqrt(sigma_v_eff / 10.0))


@register(
    id="KM1990_OCR_SPT", parameter="OCR", unit="-", source="SPT",
    inputs=("N60", "sigma_v_eff"),
    reference="Kulhawy & Mayne (1990), as given in the course exercise set",
    reliability="C",
    validity="Intact clays; fissured clays plot above the line. The source slide writes N without stating "
             "the energy correction and its worked example uses a (N1)60 column: N60 is used here; "
             "Pa = 101.325 kPa",
    check=clay_like,
)
def ocr_kulhawy_mayne_spt(N60, sigma_v_eff):
    """OCR = 0.58 N60 Pa / sigma'_v0."""
    return 0.58 * N60 * PA / sigma_v_eff


@register(
    id="KM1990_K0_CPT", parameter="K0", unit="-", source="CPT",
    inputs=("qt", "sigma_v", "sigma_v_eff"),
    reference="Kulhawy & Mayne (1990), as given in the course exercise set",
    reliability="C",
    validity="Intact clays (I_c >= 2.6); source data reach (q_t - sigma_v0)/sigma'_v0 of about 50; "
             "fissured clays plot above the line",
    check=clay_like,
)
def k0_kulhawy_mayne_cpt(qt, sigma_v, sigma_v_eff):
    """K0 = 0.10 (q_t - sigma_v0) / sigma'_v0."""
    return 0.10 * (qt - sigma_v) / sigma_v_eff


@register(
    id="KM1990_M_CPT", parameter="M", unit="kPa", source="CPT",
    inputs=("qt", "sigma_v"),
    reference="Kulhawy & Mayne (1990), as given in the course exercise set",
    reliability="C",
    validity="Clays (I_c >= 2.6); source data span (q_t - sigma_v0)/Pa of about 1-55, scatter is large "
             "(S.D. = 67 Pa in the source), sensitive clays plot above the line",
    check=clay_like,
)
def m_kulhawy_mayne_cpt(qt, sigma_v):
    """M = 8.25 (q_t - sigma_v0)."""
    return 8.25 * (qt - sigma_v)


def _vs(coefficient: float, exponent: float):
    return lambda N60: coefficient * N60**exponent


def _gmax(coefficient: float, exponent: float):
    return lambda N60, gamma_layer: gamma_layer / G * (coefficient * N60**exponent) ** 2


_R = {"all": 0.71, "clay": 0.56, "sand": 0.75}
_HASANCEBI = {
    "all": (104.79, 0.26, None),
    "clay": (131.0, 0.205, clay_like),
    "sand": (107.63, 0.237, sand_like),
}
for _name, (_c, _e, _scope) in _HASANCEBI.items():
    _check = all_of(*(c for c in (_scope, in_range("N60", 1, 50)) if c is not None))
    _ref = "Hasancebi & Ulusay (2007), as given in the course exercise set"
    _valid = (f"{_name} soils, fit on N60 of about 3-45 (Turkish data, r = {_R[_name]}); the soil type "
              "is only checked when I_c or the layer behaviour is known")
    register(
        id=f"HU2007_Vs_{_name}_SPT", parameter="Vs", unit="m/s", source="SPT", inputs=("N60",),
        reference=_ref, reliability="C", validity=_valid, check=_check,
    )(_vs(_c, _e))
    register(
        id=f"HU2007_Gmax_{_name}_SPT", parameter="Gmax", unit="kPa", source="SPT",
        inputs=("N60", "gamma_layer"), reference=_ref + "; G_max = rho Vs^2", reliability="C",
        validity=_valid + "; rho from the layer unit weight gamma (above-GWT value)", check=_check,
    )(_gmax(_c, _e))
