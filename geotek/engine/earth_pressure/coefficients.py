"""Closed-form lateral earth pressure coefficients. Angles in degrees.

Sign conventions (checked against the numerical trial wedge in ``wedge.py``):

- ``beta``: backfill slope angle, positive rising away from the wall.
- ``theta``: inclination of the wall back face from vertical, positive when the face
  leans *away from* the retained soil at the top (soil overhangs the face).
- ``delta``: wall-soil interface friction angle; the resultant is inclined at ``delta``
  to the normal of the back face.
- Seismic: ``kh`` horizontal, ``kv`` vertical (positive upward, reducing weight);
  psi = atan(kh / (1 - kv)).

References
----------
Rankine (1857); Coulomb (1776); Das, B.M. Principles of Foundation Engineering (Ch. 7);
Mononobe & Matsuo (1929), Okabe (1926); Seed & Whitman (1970);
FHWA GEC-3 (FHWA-NHI-11-032) Ch. 11 for seismic earth pressure.
"""

from __future__ import annotations

import math

from geotek.core.errors import GeoTekError


def _rad(*angles):
    return [math.radians(a) for a in angles]


def rankine_ka(phi: float, beta: float = 0.0) -> float:
    """Rankine active coefficient on a vertical plane, backfill slope beta <= phi.

    For beta > 0 the resultant acts parallel to the ground surface.
    """
    if beta > phi:
        raise GeoTekError(f"Rankine requires beta ({beta}) <= phi ({phi})")
    p, b = _rad(phi, beta)
    if beta == 0:
        return math.tan(math.pi / 4 - p / 2) ** 2
    root = math.sqrt(math.cos(b) ** 2 - math.cos(p) ** 2)
    return math.cos(b) * (math.cos(b) - root) / (math.cos(b) + root)


def rankine_kp(phi: float, beta: float = 0.0) -> float:
    """Rankine passive coefficient on a vertical plane (resultant parallel to the surface)."""
    if beta > phi:
        raise GeoTekError(f"Rankine requires beta ({beta}) <= phi ({phi})")
    p, b = _rad(phi, beta)
    if beta == 0:
        return math.tan(math.pi / 4 + p / 2) ** 2
    root = math.sqrt(math.cos(b) ** 2 - math.cos(p) ** 2)
    return math.cos(b) * (math.cos(b) + root) / (math.cos(b) - root)


def coulomb_ka(phi: float, delta: float = 0.0, theta: float = 0.0, beta: float = 0.0) -> float:
    """Coulomb active coefficient: P_a = 1/2 gamma H^2 K_a, inclined at delta to the face normal."""
    if beta > phi:
        raise GeoTekError(f"Coulomb active requires beta ({beta}) <= phi ({phi})")
    p, d, t, b = _rad(phi, delta, theta, beta)
    root = math.sqrt(math.sin(p + d) * math.sin(p - b) / (math.cos(d + t) * math.cos(t - b)))
    return math.cos(p - t) ** 2 / (math.cos(t) ** 2 * math.cos(d + t) * (1 + root) ** 2)


def coulomb_kp(phi: float, delta: float = 0.0, theta: float = 0.0, beta: float = 0.0) -> float:
    """Coulomb passive coefficient (planar surface).

    Unconservative (too high) for delta > phi/2; use the log-spiral solution instead.
    """
    p, d, t, b = _rad(phi, delta, theta, beta)
    arg = math.sin(p + d) * math.sin(p + b) / (math.cos(d - t) * math.cos(b - t))
    root = math.sqrt(arg)
    if root >= 1.0:
        raise GeoTekError("Coulomb passive coefficient is undefined for this geometry")
    return math.cos(p + t) ** 2 / (math.cos(t) ** 2 * math.cos(d - t) * (1 - root) ** 2)


def seismic_angle(kh: float, kv: float = 0.0) -> float:
    """psi = atan(kh / (1 - kv)) [deg]."""
    if kv >= 1:
        raise GeoTekError("kv must be < 1")
    return math.degrees(math.atan(kh / (1.0 - kv)))


def mononobe_okabe_kae(phi: float, delta: float = 0.0, theta: float = 0.0, beta: float = 0.0,
                       kh: float = 0.0, kv: float = 0.0) -> float:
    """Mononobe-Okabe active coefficient: P_AE = 1/2 gamma H^2 (1 - kv) K_AE.

    Requires phi - beta - psi >= 0; otherwise no solution exists and a generalised
    limit-equilibrium (trial wedge) analysis is needed (FHWA GEC-3).
    """
    psi_deg = seismic_angle(kh, kv)
    if phi - beta - psi_deg < 0:
        raise GeoTekError(
            f"M-O has no solution: phi - beta - psi = {phi - beta - psi_deg:.2f} deg < 0; "
            "use the trial wedge (generalised limit equilibrium)"
        )
    p, d, t, b, s = _rad(phi, delta, theta, beta, psi_deg)
    root = math.sqrt(math.sin(p + d) * math.sin(p - b - s) / (math.cos(d + t + s) * math.cos(b - t)))
    return math.cos(p - t - s) ** 2 / (
        math.cos(s) * math.cos(t) ** 2 * math.cos(d + t + s) * (1 + root) ** 2
    )


def mononobe_okabe_kpe(phi: float, delta: float = 0.0, theta: float = 0.0, beta: float = 0.0,
                       kh: float = 0.0, kv: float = 0.0) -> float:
    """Mononobe-Okabe passive coefficient: P_PE = 1/2 gamma H^2 (1 - kv) K_PE.

    Planar-surface solution; like Coulomb it overestimates passive resistance for large delta.
    """
    psi_deg = seismic_angle(kh, kv)
    p, d, t, b, s = _rad(phi, delta, theta, beta, psi_deg)
    arg = math.sin(p + d) * math.sin(p + b - s) / (math.cos(d - t + s) * math.cos(b - t))
    if arg < 0:
        raise GeoTekError("M-O passive has no solution for this geometry")
    root = math.sqrt(arg)
    if root >= 1.0:
        raise GeoTekError("M-O passive coefficient is undefined for this geometry")
    return math.cos(p + t - s) ** 2 / (
        math.cos(s) * math.cos(t) ** 2 * math.cos(d - t + s) * (1 - root) ** 2
    )


def seed_whitman_dkae(kh: float) -> float:
    """Seismic increment Delta K_AE ~ 3/4 kh (Seed & Whitman 1970), acting at ~0.6 H."""
    return 0.75 * kh


TBDY_R = {"gravity_120sds_mm": 2.0, "gravity_80sds_mm": 1.5, "anchored_or_rigid": 1.0}
"""TBDY 2018 Table 16.7: r for walls allowed to move 120 S_DS mm, 80 S_DS mm, or not at all."""


def tbdy_seismic_coefficients(sds: float, r: float) -> tuple[float, float]:
    """(kh, kv) = (0.4 S_DS / r, 0.5 kh) - TBDY 2018 Eq. 16.22.

    TBDY applies the dynamic thrust increment at mid-height (16.12.2.8): use
    WallLoads(seismic_increment_height=0.5). r must not exceed 1 where high excess pore
    pressures can develop (16.12.2.2).
    """
    if sds <= 0 or r <= 0:
        raise GeoTekError("S_DS and r must be positive")
    kh = 0.4 * sds / r
    return kh, 0.5 * kh


def seismic_coefficient(pga_g: float, f_pga: float = 1.0, displacement_factor: float = 0.5) -> float:
    """kh = factor * k_max with k_max = F_pga * PGA (FHWA GEC-3 / NCHRP 611 approach).

    ``displacement_factor`` = 0.5 for walls that can move about 25-50 mm; 1.0 for rigid,
    non-yielding walls. The wall-height reduction factor of GEC-3 is not applied here.
    """
    if not 0 < displacement_factor <= 1.0:
        raise GeoTekError("displacement_factor must be within (0, 1]")
    return displacement_factor * f_pga * pga_g
