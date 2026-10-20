"""Shallow foundation bearing capacity: Meyerhof (1963), Hansen (1970), Vesic (1973, 1975).

q_ult = c N_c s_c d_c i_c + q N_q s_q d_q i_q + 1/2 gamma B' N_gamma s_gamma d_gamma i_gamma

- Eccentric loads use the effective dimensions B' = B - 2 e_B, L' = L - 2 e_L (Meyerhof);
  shape factors use B'/L', depth factors use D/B.
- The horizontal load H acts parallel to B (the case for retaining wall footings).
- Base-tilt and ground-slope factors are not included (taken as 1).
- ``gamma`` is the effective unit weight below the base; ``q`` the effective overburden at
  base level; the caller accounts for the water table.

Factor expressions follow the summary tables in Bowles, Foundation Analysis and Design
(5th ed., Tables 4-1, 4-5). Hansen's inclination exponents (2-5) are user options.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Literal

from geotek.core.errors import GeoTekError

Method = Literal["meyerhof", "hansen", "vesic"]


def bearing_factors(phi: float, method: Method) -> tuple[float, float, float]:
    """(N_c, N_q, N_gamma) for phi in degrees."""
    if not 0 <= phi < 50:
        raise GeoTekError("phi must be within 0-50 deg")
    p = math.radians(phi)
    if phi == 0:
        return 5.14, 1.0, 0.0
    nq = math.exp(math.pi * math.tan(p)) * math.tan(math.pi / 4 + p / 2) ** 2
    nc = (nq - 1) / math.tan(p)
    if method == "meyerhof":
        ng = (nq - 1) * math.tan(1.4 * p)
    elif method == "hansen":
        ng = 1.5 * (nq - 1) * math.tan(p)
    elif method == "vesic":
        ng = 2.0 * (nq + 1) * math.tan(p)
    else:
        raise GeoTekError(f"Unknown method {method!r}")
    return nc, nq, ng


@dataclass
class BearingResult:
    method: str
    q_ult: float
    """Ultimate bearing pressure on the effective area [kPa]."""
    Q_ult: float
    """Ultimate vertical load [kN] (per metre for a strip footing)."""
    B_eff: float
    L_eff: float | None
    factors: dict[str, float]
    warnings: list[str] = field(default_factory=list)


def _depth_k(D: float, B: float) -> float:
    r = D / B
    return r if r <= 1 else math.atan(r)


def bearing_capacity(
    *,
    method: Method,
    B: float,
    D: float,
    phi: float,
    gamma: float,
    q: float,
    c: float = 0.0,
    L: float | None = None,
    V: float | None = None,
    H: float = 0.0,
    e_B: float = 0.0,
    e_L: float = 0.0,
    hansen_alpha1: float = 5.0,
    hansen_alpha2: float = 5.0,
) -> BearingResult:
    """Ultimate bearing capacity. L = None means a strip footing (loads per metre).

    V, H: vertical and horizontal loads [kN or kN/m]; V is required when H > 0.
    """
    if B <= 0 or D < 0:
        raise GeoTekError("B must be positive and D non-negative")
    strip = L is None
    if not strip and L < B:
        raise GeoTekError("L must be >= B")
    b_eff = B - 2 * abs(e_B)
    l_eff = None if strip else L - 2 * abs(e_L)
    if b_eff <= 0 or (l_eff is not None and l_eff <= 0):
        raise GeoTekError("Eccentricity too large: effective width <= 0")
    if not strip and l_eff < b_eff:
        b_eff, l_eff = l_eff, b_eff
    ratio = 0.0 if strip else b_eff / l_eff
    area = b_eff * (1.0 if strip else l_eff)
    if H > 0 and (V is None or V <= 0):
        raise GeoTekError("V is required for an inclined load")

    warnings: list[str] = []
    nc, nq, ng = bearing_factors(phi, method)
    p = math.radians(phi)
    k = _depth_k(D, B)
    f: dict[str, float] = {"Nc": nc, "Nq": nq, "Ngamma": ng}

    if method == "meyerhof":
        kp = math.tan(math.pi / 4 + p / 2) ** 2
        f["sc"] = 1 + 0.2 * kp * ratio
        f["dc"] = 1 + 0.2 * math.sqrt(kp) * D / B
        if phi > 10:
            f["sq"] = f["sg"] = 1 + 0.1 * kp * ratio
            f["dq"] = f["dg"] = 1 + 0.1 * math.sqrt(kp) * D / B
        else:
            f["sq"] = f["sg"] = f["dq"] = f["dg"] = 1.0
        theta = math.degrees(math.atan2(H, V)) if H > 0 else 0.0
        f["ic"] = f["iq"] = (1 - theta / 90.0) ** 2
        f["ig"] = (max(0.0, 1 - theta / phi)) ** 2 if phi > 0 else 1.0
        q_ult = c * nc * f["sc"] * f["dc"] * f["ic"] + q * nq * f["sq"] * f["dq"] * f["iq"] \
            + 0.5 * gamma * b_eff * ng * f["sg"] * f["dg"] * f["ig"]

    elif method in ("hansen", "vesic") and phi == 0:
        # Undrained: q_ult = 5.14 s_u (1 + s'c + d'c - i'c) + q (Hansen); Vesic in product form
        f["dc_prime"] = 0.4 * k
        if method == "hansen":
            f["sc_prime"] = 0.2 * ratio
            if H > 0:
                if H > area * c:
                    raise GeoTekError("Horizontal load exceeds base adhesion (H > A' s_u)")
                f["ic_prime"] = 0.5 - 0.5 * math.sqrt(1 - H / (area * c))
            else:
                f["ic_prime"] = 0.0
            q_ult = 5.14 * c * (1 + f["sc_prime"] + f["dc_prime"] - f["ic_prime"]) + q
        else:
            m = (2 + ratio) / (1 + ratio)
            f["sc"] = 1 + ratio / 5.14
            f["dc"] = 1 + f["dc_prime"]
            if H > 0 and m * H >= area * c * 5.14:
                # i_c <= 0 (or s_u = 0 under H) has no physical capacity; refuse like Hansen above.
                raise GeoTekError("Horizontal load exceeds base adhesion (m H >= A' s_u N_c)")
            f["ic"] = 1 - m * H / (area * c * 5.14) if H > 0 else 1.0
            q_ult = 5.14 * c * f["sc"] * f["dc"] * f["ic"] + q

    elif method in ("hansen", "vesic"):
        f["sc"] = 1 + (nq / nc) * ratio
        f["sq"] = 1 + ratio * (math.sin(p) if method == "hansen" else math.tan(p))
        f["sg"] = max(0.6, 1 - 0.4 * ratio)
        f["dq"] = 1 + 2 * math.tan(p) * (1 - math.sin(p)) ** 2 * k
        f["dg"] = 1.0
        f["dc"] = 1 + 0.4 * k if method == "hansen" else f["dq"] - (1 - f["dq"]) / (nc * math.tan(p))
        base = (V or 0.0) + area * c / math.tan(p)
        if H > 0:
            if method == "hansen":
                f["iq"] = max(0.0, 1 - 0.5 * H / base) ** hansen_alpha1
                f["ig"] = max(0.0, 1 - 0.7 * H / base) ** hansen_alpha2
                f["ic"] = f["iq"] - (1 - f["iq"]) / (nq - 1)
            else:
                m = (2 + ratio) / (1 + ratio)
                f["iq"] = max(0.0, 1 - H / base) ** m
                f["ig"] = max(0.0, 1 - H / base) ** (m + 1)
                f["ic"] = f["iq"] - (1 - f["iq"]) / (nc * math.tan(p))
        else:
            f["iq"] = f["ig"] = f["ic"] = 1.0
        q_ult = c * nc * f["sc"] * f["dc"] * f["ic"] + q * nq * f["sq"] * f["dq"] * f["iq"] \
            + 0.5 * gamma * b_eff * ng * f["sg"] * f["dg"] * f["ig"]
    else:
        raise GeoTekError(f"Unknown method {method!r}")

    if D / B > 1 and method == "meyerhof":
        warnings.append("D/B > 1: Meyerhof depth factors extrapolated")
    return BearingResult(method=method, q_ult=q_ult, Q_ult=q_ult * area, B_eff=b_eff,
                         L_eff=l_eff, factors=f, warnings=warnings)
