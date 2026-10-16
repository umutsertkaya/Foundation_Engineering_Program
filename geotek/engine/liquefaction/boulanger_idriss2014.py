"""Boulanger & Idriss (2014) SPT- and CPT-based liquefaction triggering.

References
----------
Boulanger, R.W. & Idriss, I.M. (2014). CPT and SPT based liquefaction triggering
procedures. Report UCD/CGM-14/01, University of California, Davis.
Idriss, I.M. & Boulanger, R.W. (2008). Soil liquefaction during earthquakes. EERI MNO-12.
"""

from __future__ import annotations

import numpy as np

from geotek.core.constants import PA

NAME = "bi2014"
MAX_DEPTH = 34.0
"""r_d relationship is defined to z = 34 m."""
CN_MAX = 1.7
SPT_NCS_M_CAP = 46.0
CPT_QCS_M_RANGE = (21.0, 254.0)
KSIGMA_MAX = 1.1
CSIGMA_MAX = 0.3
MSF_MAX_CAP = 2.2


def stress_reduction(z, mw: float):
    """r_d = exp[alpha(z) + beta(z) M]; NaN below 34 m."""
    z = np.asarray(z, dtype=float)
    alpha = -1.012 - 1.126 * np.sin(z / 11.73 + 5.133)
    beta = 0.106 + 0.118 * np.sin(z / 11.28 + 5.142)
    return np.where(z <= MAX_DEPTH, np.exp(alpha + beta * mw), np.nan)


def msf_max(resistance, test_type: str):
    r = np.asarray(resistance, dtype=float)
    raw = 1.09 + (r / 31.5) ** 2 if test_type == "SPT" else 1.09 + (r / 180.0) ** 3
    return np.minimum(raw, MSF_MAX_CAP)


def magnitude_scaling(mw: float, resistance, test_type: str):
    """MSF = 1 + (MSF_max - 1)(8.64 exp(-M/4) - 1.325)."""
    return 1.0 + (msf_max(resistance, test_type) - 1.0) * (8.64 * np.exp(-mw / 4.0) - 1.325)


def c_sigma(resistance, test_type: str):
    r = np.asarray(resistance, dtype=float)
    with np.errstate(invalid="ignore", divide="ignore"):
        if test_type == "SPT":
            c = 1.0 / (18.9 - 2.55 * np.sqrt(r))
        else:
            c = 1.0 / (37.3 - 8.27 * r**0.264)
    # A non-positive denominator means a very dense soil: C_sigma takes its cap
    return np.where((c > 0) & (c < CSIGMA_MAX), c, CSIGMA_MAX)


def overburden_factor(sigma_v_eff, resistance, test_type: str):
    """K_sigma = 1 - C_sigma ln(sigma'_v0 / Pa) <= 1.1."""
    s = np.asarray(sigma_v_eff, dtype=float)
    with np.errstate(divide="ignore", invalid="ignore"):
        k = 1.0 - c_sigma(resistance, test_type) * np.log(s / PA)
    return np.minimum(k, KSIGMA_MAX)


# --- SPT ---------------------------------------------------------------------------------


def delta_n_fines(fc):
    """Delta(N1)60 = exp[1.63 + 9.7/(FC + 0.01) - (15.7/(FC + 0.01))^2]."""
    fc = np.asarray(fc, dtype=float) + 0.01
    return np.exp(1.63 + 9.7 / fc - (15.7 / fc) ** 2)


def crr75_spt(n1_60cs):
    """CRR(M=7.5, 1 atm) = exp[N/14.1 + (N/126)^2 - (N/23.6)^3 + (N/25.4)^4 - 2.8]."""
    n = np.asarray(n1_60cs, dtype=float)
    return np.exp(n / 14.1 + (n / 126.0) ** 2 - (n / 23.6) ** 3 + (n / 25.4) ** 4 - 2.8)


def spt_resistance(n60, n1_60, fc, sigma_v_eff_test, *, tol: float = 1e-4, max_iter: int = 50):
    """Iterative (N1)60cs with C_N = (Pa/sigma')^m, m = 0.784 - 0.0768 sqrt((N1)60cs).

    ``n1_60`` from other procedures is ignored; N60 is re-normalised here.
    Returns ((N1)60cs, CRR7.5, dense mask (always False), converged).
    """
    n60 = np.asarray(n60, dtype=float)
    s = np.asarray(sigma_v_eff_test, dtype=float)
    dn = delta_n_fines(fc)
    ncs = n60 + dn
    converged = np.zeros(n60.shape, dtype=bool)
    with np.errstate(divide="ignore", invalid="ignore"):
        for _ in range(max_iter):
            m = 0.784 - 0.0768 * np.sqrt(np.minimum(ncs, SPT_NCS_M_CAP))
            cn = np.minimum((PA / s) ** m, CN_MAX)
            new = cn * n60 + dn
            converged = np.abs(new - ncs) < tol
            ncs = new
            if converged.all():
                break
    return ncs, crr75_spt(ncs), np.zeros(n60.shape, dtype=bool), converged


# --- CPT ---------------------------------------------------------------------------------


def delta_qc1n_fines(qc1n, fc):
    """Delta q_c1N = (11.9 + q_c1N/14.6) exp[1.63 - 9.7/(FC + 2) - (15.7/(FC + 2))^2]."""
    fc = np.asarray(fc, dtype=float) + 2.0
    return (11.9 + np.asarray(qc1n) / 14.6) * np.exp(1.63 - 9.7 / fc - (15.7 / fc) ** 2)


def crr75_cpt(qc1ncs):
    """CRR(M=7.5, 1 atm) = exp[q/113 + (q/1000)^2 - (q/140)^3 + (q/137)^4 - 2.8]."""
    q = np.asarray(qc1ncs, dtype=float)
    return np.exp(q / 113.0 + (q / 1000.0) ** 2 - (q / 140.0) ** 3 + (q / 137.0) ** 4 - 2.8)


def cpt_resistance(qt, sigma_v_eff_test, fc, ic, *, ic_cutoff: float = 2.6,
                   tol: float = 1e-4, max_iter: int = 50):
    """Iterative q_c1Ncs with m = 1.338 - 0.249 q_c1Ncs^0.264 (q_c1Ncs limited to 21-254).

    Uses q_t in place of q_c (Boulanger & Idriss recommend q_t where u2 is measured).
    """
    qt = np.asarray(qt, dtype=float)
    s = np.asarray(sigma_v_eff_test, dtype=float)
    fc = np.asarray(fc, dtype=float)
    qcs = qt / PA
    converged = np.zeros(qt.shape, dtype=bool)
    with np.errstate(divide="ignore", invalid="ignore"):
        for _ in range(max_iter):
            m = 1.338 - 0.249 * np.clip(qcs, *CPT_QCS_M_RANGE) ** 0.264
            cn = np.minimum((PA / s) ** m, CN_MAX)
            qc1n = cn * qt / PA
            new = qc1n + delta_qc1n_fines(qc1n, fc)
            converged = np.abs(new - qcs) < tol
            qcs = new
            if converged.all():
                break
    return {
        "resistance": qcs, "crr75": crr75_cpt(qcs), "ic": np.asarray(ic, dtype=float),
        "dense": np.zeros(qt.shape, dtype=bool), "clay_like": np.asarray(ic) > ic_cutoff,
        "converged": converged,
    }
