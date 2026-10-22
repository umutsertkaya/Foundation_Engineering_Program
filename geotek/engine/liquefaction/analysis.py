"""Liquefaction triggering analysis for processed SPT and CPT data.

Penetration resistance is normalised with stresses at the time of testing (from the
processed record); CSR and K_sigma use stresses at the time of the earthquake (seismic GWT).
"""

from __future__ import annotations

from typing import Literal

import numpy as np

from geotek.core.models.profile import SoilProfile
from geotek.core.warning_codes import format_warning
from geotek.engine.correlations.physical import fines_content_from_ic
from geotek.engine.insitu.cpt import CPTProcessed
from geotek.engine.insitu.spt import SPTProcessed
from geotek.engine.liquefaction import boulanger_idriss2014 as bi
from geotek.engine.liquefaction import youd2001 as youd
from geotek.engine.liquefaction.common import (
    SIMPLIFIED_DEPTH_WARNING,
    LiquefactionResult,
    assign_status,
    cyclic_stress_ratio,
    seismic_stresses,
)

Method = Literal["youd2001", "bi2014"]
CLAY_LIKE_PI = 7.0
"""PI >= 7: clay-like behaviour (Idriss & Boulanger 2008)."""


def _check_inputs(method: str, amax_g: float, mw: float, target_fs: float):
    if method not in ("youd2001", "bi2014"):
        raise ValueError(f"Unknown method {method!r}; choose 'youd2001' or 'bi2014'")
    if not 0 < amax_g <= 2.0:
        raise ValueError("a_max must be within 0-2 g")
    if not 4.0 <= mw <= 9.5:
        raise ValueError("Moment magnitude must be within 4.0-9.5")
    if target_fs < 1.0:
        raise ValueError("Target FS must be >= 1.0")


def _per_point(value, n: int, name: str) -> np.ndarray:
    arr = np.broadcast_to(np.asarray(value, dtype=float), (n,)).copy()
    if not np.isfinite(arr).all():
        raise ValueError(f"{name} must be finite at every point")
    if np.any(arr < 0):
        raise ValueError(f"{name} must be non-negative")
    return arr


def _demand_and_capacity(method, test_type, depth, sv, se, resistance, crr75, mw, amax_g,
                         youd_f, msf_variant):
    if method == "youd2001":
        rd = youd.stress_reduction(depth)
        msf = youd.magnitude_scaling(mw, resistance, variant=msf_variant)
        ks = youd.overburden_factor(se, f=youd_f)
        max_depth = youd.MAX_DEPTH
    else:
        rd = bi.stress_reduction(depth, mw)
        msf = bi.magnitude_scaling(mw, resistance, test_type)
        ks = bi.overburden_factor(se, resistance, test_type)
        max_depth = bi.MAX_DEPTH
    csr = cyclic_stress_ratio(amax_g, sv, se, rd)
    with np.errstate(divide="ignore", invalid="ignore"):
        crr = crr75 * msf * ks
        fs = crr / csr
    return rd, csr, msf, ks, crr, fs, max_depth


MSF_AS_HIGH_MW_WARNING = "liquefaction.warning.msf_andrus_stokoe_high_magnitude"


def _msf_warning(method: str, mw: float, msf_variant: str) -> list[str]:
    """Youd 2001 recommends Idriss MSF for M > 7.5; Andrus-Stokoe is lower there (more conservative)."""
    if method == "youd2001" and msf_variant == "andrus_stokoe" and mw > 7.5:
        return [format_warning(MSF_AS_HIGH_MW_WARNING)]
    return []


def _depth_warning(depth) -> list[str]:
    if np.any(depth > SIMPLIFIED_DEPTH_WARNING):
        return [format_warning("liquefaction.warning.simplified_depth", depth=SIMPLIFIED_DEPTH_WARNING)]
    return []


def analyze_spt(
    processed: SPTProcessed,
    profile: SoilProfile,
    *,
    method: Method = "bi2014",
    amax_g: float,
    mw: float,
    fc,
    pi=None,
    gwt_seismic: float | None = None,
    target_fs: float = 1.1,
    exclude=None,
    youd_f: float = 0.7,
    msf_variant: str = "idriss",
) -> LiquefactionResult:
    """SPT-based triggering.

    Parameters
    ----------
    fc : fines content [%] per record (or one value for all). Required: there is no
        reliable default, so the assumption must be explicit.
    pi : plasticity index [%] per record; PI >= 7 marks the point clay-like (NaN = unknown).
    gwt_seismic : GWT during the earthquake; defaults to the profile's seismic GWT.
    target_fs : user-defined required FS (typical 1.1-1.3); 1 <= FS < target is 'marginal'.
    exclude : boolean mask of points the engineer marks non-liquefiable.
    """
    _check_inputs(method, amax_g, mw, target_fs)
    depth = processed.depth
    n = depth.size
    fc = _per_point(fc, n, "FC")
    warnings = list(processed.warnings)

    if method == "youd2001":
        resistance, crr75, dense = youd.spt_resistance(
            processed.n60, processed.n1_60, fc, processed.sigma_v_eff
        )
    else:
        resistance, crr75, dense, converged = bi.spt_resistance(
            processed.n60, processed.n1_60, fc, processed.sigma_v_eff
        )
        if not converged.all():
            warnings.append(format_warning("liquefaction.warning.spt_iteration_not_converged",
                                            count=int((~converged).sum())))

    sv, _, se, gwt = seismic_stresses(depth, profile=profile, gwt_depth=gwt_seismic)
    rd, csr, msf, ks, crr, fs, max_depth = _demand_and_capacity(
        method, "SPT", depth, sv, se, resistance, crr75, mw, amax_g, youd_f, msf_variant
    )
    clay_like = None
    if pi is not None:
        pi_arr = np.broadcast_to(np.asarray(pi, dtype=float), (n,))
        clay_like = np.nan_to_num(pi_arr, nan=-1.0) >= CLAY_LIKE_PI
    status, fs = assign_status(
        depth=depth, gwt_depth=gwt, sigma_v_eff=se, fs=fs, target_fs=target_fs,
        max_depth=max_depth, clay_like=clay_like, dense=dense, exclude=exclude,
    )
    if processed.refusal.any():
        warnings.append(format_warning("liquefaction.warning.spt_refusal_lower_bound"))
    warnings += _depth_warning(depth)
    warnings += _msf_warning(method, mw, msf_variant)
    return LiquefactionResult(
        method=method, test_type="SPT", source_id=processed.borehole_id, amax_g=amax_g, mw=mw,
        gwt_depth=gwt, target_fs=target_fs, depth=depth, sigma_v=sv, sigma_v_eff=se, rd=rd,
        csr=csr, resistance=resistance, fc=fc, crr75=crr75, msf=msf, ksigma=ks, crr=crr,
        fs=fs, status=status, warnings=warnings,
    )


def analyze_cpt(
    processed: CPTProcessed,
    profile: SoilProfile | None = None,
    *,
    method: Method = "bi2014",
    amax_g: float,
    mw: float,
    gwt_seismic: float | None = None,
    fc=None,
    c_fc: float = 0.0,
    ic_cutoff: float = 2.6,
    target_fs: float = 1.1,
    exclude=None,
    youd_f: float = 0.7,
    msf_variant: str = "idriss",
) -> LiquefactionResult:
    """CPT-based triggering.

    Without a profile, the unit weights estimated during processing are reused and
    ``gwt_seismic`` is required. For 'bi2014', FC defaults to the I_c estimate with ``c_fc``;
    'youd2001' uses the K_c correction and ignores FC.
    """
    _check_inputs(method, amax_g, mw, target_fs)
    depth = processed.depth
    n = depth.size
    warnings = list(processed.warnings)
    # Points whose Q_tn / I_c iteration did not converge carry no trustworthy resistance: FS stays NaN -> 'invalid'.
    not_converged = ~np.asarray(processed.converged, dtype=bool)

    if method == "youd2001":
        r = youd.cpt_resistance(
            processed.qc, processed.fs, processed.sigma_v, processed.sigma_v_eff, ic_cutoff=ic_cutoff
        )
        fc_used = np.full(n, np.nan)
        undefined = int((~np.isfinite(r["ic"])).sum())
        if undefined:
            warnings.append(format_warning("liquefaction.warning.ic_undefined", count=undefined))
    else:
        if fc is None:
            fc_used = fines_content_from_ic(processed.Ic, c_fc)
            warnings.append(format_warning("liquefaction.warning.fc_from_ic", c_fc=float(c_fc)))
        else:
            fc_used = _per_point(fc, n, "FC")
        r = bi.cpt_resistance(
            processed.qt, processed.sigma_v_eff, fc_used, processed.Ic, ic_cutoff=ic_cutoff
        )
        not_converged |= ~np.asarray(r["converged"], dtype=bool)
        if not r["converged"].all():
            warnings.append(format_warning("liquefaction.warning.cpt_iteration_not_converged",
                                            count=int((~r["converged"]).sum())))

    if profile is None and gwt_seismic is None:
        raise ValueError("gwt_seismic is required when no soil profile is given")
    sv, _, se, gwt = seismic_stresses(
        depth, profile=profile, gamma=processed.gamma, gwt_depth=gwt_seismic
    )
    rd, csr, msf, ks, crr, fs, max_depth = _demand_and_capacity(
        method, "CPT", depth, sv, se, r["resistance"], r["crr75"], mw, amax_g, youd_f, msf_variant
    )
    # A user FC must not give an FS where the CPT itself is undefined (q_t <= sigma_v0, f_s <= 0).
    fs = np.where(np.isfinite(r["ic"]) & ~not_converged, fs, np.nan)
    status, fs = assign_status(
        depth=depth, gwt_depth=gwt, sigma_v_eff=se, fs=fs, target_fs=target_fs,
        max_depth=max_depth, clay_like=r["clay_like"], dense=r["dense"], exclude=exclude,
    )
    warnings += _depth_warning(depth)
    warnings += _msf_warning(method, mw, msf_variant)
    return LiquefactionResult(
        method=method, test_type="CPT", source_id=processed.sounding_id, amax_g=amax_g, mw=mw,
        gwt_depth=gwt, target_fs=target_fs, depth=depth, sigma_v=sv, sigma_v_eff=se, rd=rd,
        csr=csr, resistance=r["resistance"], fc=fc_used, crr75=r["crr75"], msf=msf, ksigma=ks,
        crr=crr, fs=fs, status=status, ic=r["ic"], warnings=warnings,
    )
