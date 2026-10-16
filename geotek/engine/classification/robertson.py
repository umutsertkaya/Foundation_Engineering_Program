"""Robertson normalised soil behaviour type (SBTn).

References
----------
Robertson, P.K. (1990). Soil classification using the cone penetration test.
Can. Geotech. J., 27(1).
Robertson, P.K. (2009). Interpretation of cone penetration tests - a unified approach.
Can. Geotech. J., 46(11).
Robertson, P.K. (2010). Soil behaviour type from the CPT: an update. 2nd Int. Symp. on
Cone Penetration Testing, Huntington Beach.
"""

from __future__ import annotations

import numpy as np

ZONE_NAMES = {
    1: {"en": "Sensitive, fine grained", "tr": "Hassas, ince daneli"},
    2: {"en": "Organic soils - clay", "tr": "Organik zemin - kil"},
    3: {"en": "Clays - silty clay to clay", "tr": "Kil - siltli kil ile kil"},
    4: {"en": "Silt mixtures - clayey silt to silty clay", "tr": "Silt karışımı - killi silt ile siltli kil"},
    5: {"en": "Sand mixtures - silty sand to sandy silt", "tr": "Kum karışımı - siltli kum ile kumlu silt"},
    6: {"en": "Sands - clean sand to silty sand", "tr": "Kum - temiz kum ile siltli kum"},
    7: {"en": "Gravelly sand to dense sand", "tr": "Çakıllı kum ile sıkı kum"},
    8: {"en": "Very stiff sand to clayey sand", "tr": "Çok sıkı kum ile killi kum"},
    9: {"en": "Very stiff, fine grained", "tr": "Çok katı, ince daneli"},
}

# Upper Ic bound of zones 7, 6, 5, 4, 3 (zone 2 above 3.60)
IC_BOUNDS = (1.31, 2.05, 2.60, 2.95, 3.60)


def soil_behaviour_index(Qtn, Fr):
    """I_c = sqrt((3.47 - log Qtn)^2 + (log Fr + 1.22)^2)."""
    Qtn = np.asarray(Qtn, dtype=float)
    Fr = np.asarray(Fr, dtype=float)
    with np.errstate(divide="ignore", invalid="ignore"):
        return np.sqrt((3.47 - np.log10(Qtn)) ** 2 + (np.log10(Fr) + 1.22) ** 2)


def zone_from_ic(Ic):
    """Zones 2-7 from I_c (Robertson 2009/2010). NaN I_c gives zone 0 (undefined)."""
    Ic = np.asarray(Ic, dtype=float)
    zone = np.select(
        [Ic < IC_BOUNDS[0], Ic < IC_BOUNDS[1], Ic < IC_BOUNDS[2], Ic < IC_BOUNDS[3], Ic < IC_BOUNDS[4]],
        [7, 6, 5, 4, 3],
        default=2,
    )
    return np.where(np.isnan(Ic), 0, zone).astype(int)


def sbtn_zone(Qtn, Fr, Ic=None, *, include_zones_8_9: bool = False):
    """SBTn zone 1-9 (0 where undefined).

    Zone 1 is assigned where Qtn < 12 exp(-1.4 Fr) (Robertson 2010).

    Zones 8 and 9 use the Robertson (2010) boundary
    Qtn > 1 / (0.005 (Fr - 1) - 0.0003 (Fr - 1)^2 - 0.002), with 1.5 < Fr <= 4.5 for zone 8
    and Fr > 4.5 for zone 9. These boundary equations are pending verification against the
    source (Phase 0), so they are disabled by default.
    """
    Qtn = np.asarray(Qtn, dtype=float)
    Fr = np.asarray(Fr, dtype=float)
    if Ic is None:
        Ic = soil_behaviour_index(Qtn, Fr)
    zone = zone_from_ic(Ic)

    with np.errstate(invalid="ignore", over="ignore"):
        zone = np.where(Qtn < 12.0 * np.exp(-1.4 * Fr), 1, zone)
        if include_zones_8_9:
            x = Fr - 1.0
            denom = 0.005 * x - 0.0003 * x**2 - 0.002
            above = (denom > 0) & (Qtn > 1.0 / np.where(denom > 0, denom, np.nan))
            zone = np.where(above & (Fr > 1.5) & (Fr <= 4.5), 8, zone)
            zone = np.where(above & (Fr > 4.5), 9, zone)
    return np.where(np.isnan(Ic), 0, zone).astype(int)


def is_sand_like(Ic, threshold: float = 2.6):
    """Sand-like (drained, potentially liquefiable) behaviour for I_c < 2.6."""
    return np.asarray(Ic) < threshold
