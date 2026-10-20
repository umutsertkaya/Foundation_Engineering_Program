"""CPT(u) processing: q_t, normalised parameters and the iterative Q_tn / I_c solution.

References
----------
Robertson, P.K. (2009). Interpretation of cone penetration tests - a unified approach.
Can. Geotech. J., 46(11).
Robertson, P.K. & Cabal, K.L. (2010). Estimating soil unit weight from CPT.
2nd Int. Symp. on Cone Penetration Testing.
Boulanger, R.W. & Idriss, I.M. (2014). CPT and SPT based liquefaction triggering
procedures. Report UCD/CGM-14/01 (fines content from I_c).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from geotek.core.constants import GAMMA_W, PA
from geotek.core.errors import ProfileError
from geotek.core.models.investigations import CPTSounding
from geotek.core.models.profile import SoilProfile
from geotek.core.warning_codes import format_warning
from geotek.engine.classification.robertson import sbtn_zone, soil_behaviour_index
from geotek.engine.correlations.physical import (
    fines_content_from_ic,
    unit_weight_robertson_cabal,
)


def corrected_tip_resistance(qc, u2, area_ratio: float):
    """q_t = q_c + u2 (1 - a). Without u2, q_t = q_c."""
    qc = np.asarray(qc, dtype=float)
    if u2 is None:
        return qc.copy()
    return qc + np.asarray(u2, dtype=float) * (1.0 - area_ratio)


def stress_exponent(Ic, sigma_v_eff):
    """n = 0.381 I_c + 0.05 (sigma'_v0 / Pa) - 0.15, limited to <= 1.0 (Robertson 2009)."""
    n = 0.381 * Ic + 0.05 * (sigma_v_eff / PA) - 0.15
    return np.clip(n, 0.0, 1.0)


def normalise_iterative(qt, fs, sigma_v, sigma_v_eff, *, tol: float = 1e-3, max_iter: int = 50):
    """Solve Q_tn, n and I_c simultaneously (Robertson 2009).

    Returns (Qtn, Fr, Ic, n, converged) as arrays; invalid points (q_t <= sigma_v0,
    sigma'_v0 <= 0 or f_s <= 0, where I_c is undefined) are NaN and count as converged.
    """
    net = qt - sigma_v
    valid = (net > 0) & (sigma_v_eff > 0) & (fs > 0)
    net_v = np.where(valid, net, np.nan)
    s_eff = np.where(valid, sigma_v_eff, np.nan)
    Fr = fs / net_v * 100.0

    n = np.ones_like(qt, dtype=float)
    converged = ~valid
    with np.errstate(invalid="ignore", divide="ignore"):
        for _ in range(max_iter):
            Qtn = (net_v / PA) * (PA / s_eff) ** n
            Ic = soil_behaviour_index(Qtn, Fr)
            n_new = stress_exponent(Ic, s_eff)
            done = np.abs(n_new - n) < tol
            n = np.where(converged, n, n_new)
            converged = converged | done
            if converged.all():
                break
        Qtn = (net_v / PA) * (PA / s_eff) ** n
        Ic = soil_behaviour_index(Qtn, Fr)
    return Qtn, Fr, Ic, n, converged


def stresses_from_unit_weight(depth, gamma, gwt_depth: float, gamma_w: float = GAMMA_W):
    """Integrate a unit-weight log: sigma_v by trapezoids from the surface, hydrostatic u."""
    depth = np.asarray(depth, dtype=float)
    gamma = np.asarray(gamma, dtype=float)
    increments = np.concatenate([[gamma[0] * depth[0]], 0.5 * (gamma[1:] + gamma[:-1]) * np.diff(depth)])
    sigma_v = np.cumsum(increments)
    u0 = gamma_w * np.maximum(0.0, depth - gwt_depth)
    return sigma_v, u0, sigma_v - u0


@dataclass
class CPTProcessed:
    sounding_id: str
    depth: np.ndarray
    qc: np.ndarray
    fs: np.ndarray
    u2: np.ndarray | None
    qt: np.ndarray
    gamma: np.ndarray | None
    """Unit weight used for stresses when estimated from the CPT (None if from a profile)."""
    sigma_v: np.ndarray
    u0: np.ndarray
    sigma_v_eff: np.ndarray
    Rf: np.ndarray
    Fr: np.ndarray
    Bq: np.ndarray | None
    Qt1: np.ndarray
    Qtn: np.ndarray
    n: np.ndarray
    Ic: np.ndarray
    zone: np.ndarray
    fc: np.ndarray
    converged: np.ndarray
    warnings: list[str] = field(default_factory=list)

    def to_dataframe(self) -> pd.DataFrame:
        cols = {
            "depth": self.depth, "qc": self.qc, "fs": self.fs, "qt": self.qt,
            "sigma_v": self.sigma_v, "u0": self.u0, "sigma_v_eff": self.sigma_v_eff,
            "Rf": self.Rf, "Fr": self.Fr, "Qt1": self.Qt1, "Qtn": self.Qtn, "n": self.n,
            "Ic": self.Ic, "SBTn": self.zone, "FC": self.fc, "converged": self.converged,
        }
        if self.u2 is not None:
            cols["u2"] = self.u2
            cols["Bq"] = self.Bq
        if self.gamma is not None:
            cols["gamma"] = self.gamma
        return pd.DataFrame(cols)


def process_cpt(
    sounding: CPTSounding,
    profile: SoilProfile | None = None,
    *,
    gwt_case: str = "insitu",
    gwt_depth: float | None = None,
    c_fc: float = 0.0,
    include_zones_8_9: bool = False,
    tol: float = 1e-3,
    max_iter: int = 50,
) -> CPTProcessed:
    """Process a CPT sounding.

    Stresses come from ``profile`` when given; otherwise unit weight is estimated from the
    CPT itself (Robertson & Cabal 2010) and ``gwt_depth`` (or the sounding's own GWT) is used.
    """
    a = sounding.arrays()
    depth, qc, fs = a["depth"], a["qc"], a["fs"]
    u2 = a.get("u2")
    qt = corrected_tip_resistance(qc, u2, sounding.area_ratio)
    warnings: list[str] = []
    if u2 is None:
        warnings.append(format_warning("insitu.warning.cpt_no_u2"))

    gamma = None
    if profile is not None:
        if depth[-1] > profile.bottom:
            raise ProfileError(
                f"CPT {sounding.id!r} extends to {depth[-1]} m, below the profile ({profile.bottom} m)"
            )
        sigma_v, u0, sigma_eff = profile.stresses(depth, gwt_case)
    else:
        gwt = gwt_depth if gwt_depth is not None else sounding.gwt_depth
        if gwt is None:
            raise ValueError("Groundwater depth is required when no soil profile is given")
        gamma = unit_weight_robertson_cabal(qt, fs)
        missing = ~np.isfinite(gamma)
        if missing.all():
            raise ValueError(f"CPT {sounding.id!r}: unit weight cannot be estimated (q_t <= 0 throughout)")
        if missing.any():
            # q_t <= 0 leaves gamma undefined; integrating NaN would void every deeper stress, so
            # take the nearest estimated value and report it as a visible assumption.
            good = np.flatnonzero(~missing)
            nearest = good[np.abs(depth[good][None, :] - depth[missing][:, None]).argmin(axis=1)]
            gamma = gamma.copy()
            gamma[missing] = gamma[nearest]
            warnings.append(format_warning(
                "insitu.warning.cpt_gamma_nearest", count=int(missing.sum()),
                depths=", ".join(f"{float(z):g}" for z in depth[missing]),
            ))
        sigma_v, u0, sigma_eff = stresses_from_unit_weight(depth, gamma, gwt)

    with np.errstate(divide="ignore", invalid="ignore"):
        net = qt - sigma_v
        Rf = fs / qt * 100.0
        Qt1 = np.where((net > 0) & (sigma_eff > 0), net / sigma_eff, np.nan)
        Bq = (u2 - u0) / np.where(net > 0, net, np.nan) if u2 is not None else None

    Qtn, Fr, Ic, n, converged = normalise_iterative(qt, fs, sigma_v, sigma_eff, tol=tol, max_iter=max_iter)
    zone = sbtn_zone(Qtn, Fr, Ic, include_zones_8_9=include_zones_8_9)
    fc = fines_content_from_ic(Ic, c_fc)

    invalid = np.isnan(Ic)
    if invalid.any():
        warnings.append(format_warning("insitu.warning.cpt_points_skipped", count=int(invalid.sum())))
    if not converged.all():
        warnings.append(format_warning("insitu.warning.cpt_not_converged",
                                       count=int((~converged).sum())))

    return CPTProcessed(
        sounding_id=sounding.id, depth=depth, qc=qc, fs=fs, u2=u2, qt=qt, gamma=gamma,
        sigma_v=sigma_v, u0=u0, sigma_v_eff=sigma_eff, Rf=Rf, Fr=Fr, Bq=Bq, Qt1=Qt1,
        Qtn=Qtn, n=n, Ic=Ic, zone=zone, fc=fc, converged=converged, warnings=warnings,
    )
