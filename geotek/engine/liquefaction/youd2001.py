"""NCEER/NSF simplified procedure (Seed & Idriss based).

References
----------
Youd, T.L. et al. (2001). Liquefaction resistance of soils: summary report from the 1996
NCEER and 1998 NCEER/NSF workshops. J. Geotech. Geoenviron. Eng., 127(10), 817-833.
Robertson, P.K. & Wride, C.E. (1998). Evaluating cyclic liquefaction potential using the
cone penetration test. Can. Geotech. J., 35(3), 442-459.
"""

from __future__ import annotations

import numpy as np

from geotek.core.constants import PA
from geotek.engine.classification.robertson import soil_behaviour_index

NAME = "youd2001"
MAX_DEPTH = 30.0
"""Evaluation limit with the Robertson & Wride (1998) r_d extension; deeper points are not evaluated."""
SPT_NCS_LIMIT = 30.0
"""(N1)60cs >= 30: too dense to liquefy (Youd et al. 2001)."""
CPT_QCS_LIMIT = 160.0
"""q_c1Ncs >= 160: too dense to liquefy (Robertson & Wride 1998)."""
CQ_MAX = 1.7


def stress_reduction(z, mw=None):
    """r_d from Youd et al. (2001), Eq. (2), through 23 m.

    The 23-30 m branch is the Robertson & Wride (1998) extension.
    Depths greater than 30 m return NaN.
    """
    z = np.asarray(z, dtype=float)
    return np.select(
        [z <= 9.15, z <= 23.0, z <= 30.0],
        [1.0 - 0.00765 * z, 1.174 - 0.0267 * z, 0.744 - 0.008 * z],
        default=np.nan,
    )


def magnitude_scaling(mw: float, resistance=None, test_type: str = "SPT", *, variant: str = "idriss"):
    """MSF. 'idriss': 10^2.24 / M^2.56 (lower bound of the NCEER range);
    'andrus_stokoe': (M / 7.5)^-3.3 (upper bound, for M < 7.5)."""
    if variant == "idriss":
        value = 10**2.24 / mw**2.56
    elif variant == "andrus_stokoe":
        value = (mw / 7.5) ** -3.3
    else:
        raise ValueError(f"Unknown MSF variant {variant!r}")
    return np.full(np.shape(resistance) if resistance is not None else (), value, dtype=float)


def overburden_factor(sigma_v_eff, resistance=None, test_type: str = "SPT", *, f: float = 0.7):
    """K_sigma = (sigma'_v0 / Pa)^(f - 1), applied only for sigma'_v0 > Pa (K_sigma <= 1).

    f = 0.7-0.8 for D_r 40-60 %, 0.6-0.7 for D_r 60-80 % (Youd et al. 2001).
    """
    if not 0.6 <= f <= 0.8:
        raise ValueError("Youd et al. (2001) recommend f between 0.6 and 0.8")
    ratio = np.asarray(sigma_v_eff, dtype=float) / PA
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(ratio > 1.0, ratio ** (f - 1.0), 1.0)


# --- SPT ---------------------------------------------------------------------------------


def fines_correction_spt(n1_60, fc):
    """(N1)60cs = alpha + beta (N1)60 (Idriss & Seed, in Youd et al. 2001 eqs. 6-7)."""
    fc = np.asarray(fc, dtype=float)
    with np.errstate(divide="ignore", over="ignore"):
        alpha = np.select([fc <= 5, fc < 35], [0.0, np.exp(1.76 - 190.0 / fc**2)], default=5.0)
        beta = np.select([fc <= 5, fc < 35], [1.0, 0.99 + fc**1.5 / 1000.0], default=1.2)
    return alpha + beta * np.asarray(n1_60, dtype=float)


def crr75_spt(n1_60cs):
    """CRR7.5 = 1/(34 - N) + N/135 + 50/(10N + 45)^2 - 1/200, for N = (N1)60cs < 30."""
    n = np.asarray(n1_60cs, dtype=float)
    with np.errstate(divide="ignore", invalid="ignore"):
        crr = 1.0 / (34.0 - n) + n / 135.0 + 50.0 / (10.0 * n + 45.0) ** 2 - 1.0 / 200.0
    return np.where(n < SPT_NCS_LIMIT, crr, np.nan)


def spt_resistance(n60, n1_60, fc, sigma_v_eff_test):
    """Returns ((N1)60cs, CRR7.5, dense mask). (N1)60 uses the Liao & Whitman C_N."""
    ncs = fines_correction_spt(n1_60, fc)
    return ncs, crr75_spt(ncs), ncs >= SPT_NCS_LIMIT


# --- CPT ---------------------------------------------------------------------------------


def _normalised(qc, fs, sigma_v, sigma_v_eff, n):
    """Q and F from Youd et al. (2001), Eqs. (15)-(17), using net q_c."""
    with np.errstate(divide="ignore", invalid="ignore"):
        net = qc - sigma_v
        F = np.where(net > 0, fs / net * 100.0, np.nan)
        Q = np.where(
            n == 1.0,
            net / sigma_v_eff,
            (net / PA) * (PA / sigma_v_eff) ** n,
        )
        Q = np.where((Q > 0) & (sigma_v_eff > 0), Q, np.nan)
    return Q, F


def robertson_wride_ic(qc, fs, sigma_v, sigma_v_eff):
    """Iterative I_c following Youd et al. (2001), Eqs. (14)-(17).

    Uses n = 1 (clay), 0.5 (sand), or 0.7 (intermediate), rather than
    the intermediate exponent 0.75 of Robertson & Wride (1998).
    Returns (Ic, n, F).
    """
    qc, fs = np.asarray(qc, dtype=float), np.asarray(fs, dtype=float)
    Q1, F = _normalised(qc, fs, sigma_v, sigma_v_eff, 1.0)
    ic1 = soil_behaviour_index(Q1, F)
    Q05, _ = _normalised(qc, fs, sigma_v, sigma_v_eff, 0.5)
    ic05 = soil_behaviour_index(Q05, F)
    Q07, _ = _normalised(qc, fs, sigma_v, sigma_v_eff, 0.7)
    ic07 = soil_behaviour_index(Q07, F)
    n = np.where(ic1 > 2.6, 1.0, np.where(ic05 <= 2.6, 0.5, 0.7))
    ic = np.select([n == 1.0, n == 0.5], [ic1, ic05], default=ic07)
    return ic, n, F


def kc_factor(ic, F=None):
    """Grain characteristic correction K_c from Youd et al. (2001), Eq. (19).

    Depends only on I_c. F is accepted for call compatibility and ignored;
    the low-friction-ratio shortcut of Robertson & Wride (1998) is not used.
    """
    ic = np.asarray(ic, dtype=float)
    poly = -0.403 * ic**4 + 5.581 * ic**3 - 21.63 * ic**2 + 33.75 * ic - 17.88
    kc = np.where(ic <= 1.64, 1.0, poly)
    return kc


def crr75_cpt(qc1ncs):
    """CRR7.5 from q_c1Ncs (Robertson & Wride 1998); NaN for q_c1Ncs >= 160."""
    q = np.asarray(qc1ncs, dtype=float)
    crr = np.where(q < 50.0, 0.833 * q / 1000.0 + 0.05, 93.0 * (q / 1000.0) ** 3 + 0.08)
    return np.where(q < CPT_QCS_LIMIT, crr, np.nan)


def cpt_resistance(qc, fs, sigma_v, sigma_v_eff_test, *, ic_cutoff: float = 2.6):
    """Returns dict with qc1Ncs, CRR7.5, Ic, Kc, dense and clay-like masks.

    Uses q_c (not q_t) as in Robertson & Wride (1998).
    """
    ic, n, F = robertson_wride_ic(qc, fs, sigma_v, sigma_v_eff_test)
    with np.errstate(divide="ignore", invalid="ignore"):
        cq = np.minimum((PA / np.asarray(sigma_v_eff_test, dtype=float)) ** n, CQ_MAX)
    qc1n = cq * np.asarray(qc, dtype=float) / PA
    kc = kc_factor(ic, F)
    qc1ncs = kc * qc1n
    return {
        "resistance": qc1ncs, "crr75": crr75_cpt(qc1ncs), "ic": ic, "kc": kc,
        "dense": qc1ncs >= CPT_QCS_LIMIT, "clay_like": ic > ic_cutoff,
    }
