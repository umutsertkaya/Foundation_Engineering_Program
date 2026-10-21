"""Source-labelled reference tables for ground anchor design.

Every row is copied from FHWA GEC-4 (FHWA-IF-99-015, 1999); ``source`` names the table
and the printed page. Presumptive values are for preliminary design only and are never
applied silently: the caller selects one (or enters its own value).
"""

from __future__ import annotations

from dataclasses import dataclass

GEC4 = "FHWA GEC-4 (FHWA-IF-99-015)"


@dataclass(frozen=True)
class TendonSection:
    id: str
    type: str  # "strand" | "bar"
    label: str
    smts_kn: float
    """Specified minimum tensile strength of one strand or bar [kN]."""
    area_mm2: float
    source: str


STRAND_15MM_ID = "strand_15mm_gr270"

TENDONS: tuple[TendonSection, ...] = (
    TendonSection(STRAND_15MM_ID, "strand", "15 mm strand, ASTM A416 Gr 270 (metric 1860)",
                  260.7, 140.0, f"{GEC4} Table 10, p. 78 (1 strand)"),
    TendonSection("bar_150_26", "bar", "26 mm bar, Grade 150 (1035 N/mm²), ASTM A722",
                  568.0, 548.0, f"{GEC4} Table 9, p. 77"),
    TendonSection("bar_150_32", "bar", "32 mm bar, Grade 150 (1035 N/mm²), ASTM A722",
                  835.0, 806.0, f"{GEC4} Table 9, p. 77"),
    TendonSection("bar_150_36", "bar", "36 mm bar, Grade 150 (1035 N/mm²), ASTM A722",
                  1055.0, 1019.0, f"{GEC4} Table 9, p. 77"),
    TendonSection("bar_150_45", "bar", "45 mm bar, Grade 150 (1035 N/mm²), ASTM A722",
                  1779.0, 1716.0, f"{GEC4} Table 9, p. 77"),
    TendonSection("bar_150_64", "bar", "64 mm bar, Grade 150 (1035 N/mm²), ASTM A722",
                  3461.0, 3348.0, f"{GEC4} Table 9, p. 77"),
    TendonSection("bar_160_26", "bar", "26 mm bar, Grade 160 (1104 N/mm²), ASTM A722",
                  605.0, 548.0, f"{GEC4} Table 9, p. 77"),
    TendonSection("bar_160_32", "bar", "32 mm bar, Grade 160 (1104 N/mm²), ASTM A722",
                  890.0, 806.0, f"{GEC4} Table 9, p. 77"),
    TendonSection("bar_160_36", "bar", "36 mm bar, Grade 160 (1104 N/mm²), ASTM A722",
                  1125.0, 1019.0, f"{GEC4} Table 9, p. 77"),
)

TENDON_BY_ID = {t.id: t for t in TENDONS}

MIN_FREE_LENGTH = {"strand": 4.5, "bar": 3.0}
"""Minimum unbonded length [m], GEC-4 section 5.3.4, p. 67."""
MIN_FREE_LENGTH_SOURCE = f"{GEC4} section 5.3.4, p. 67"

MIN_BOND_LENGTH = {("soil", "strand"): 4.5, ("soil", "bar"): 4.5, ("rock", "strand"): 4.5, ("rock", "bar"): 3.0}
"""Minimum bond length [m], GEC-4 appendix E part 3B (p. E-15); rock also section 5.3.6, p. 74."""
MIN_BOND_LENGTH_SOURCE = f"{GEC4} appendix E part 3B, p. E-15"

MIN_HORIZONTAL_SPACING = 1.2
"""Minimum horizontal anchor spacing [m], GEC-4 figure 37b, p. 76 (group effects, drill deviation)."""

TYPICAL_BOND_LENGTH_MAX = {"soil": 12.0, "rock": 10.0}
"""GEC-4 section 5.3.6: soil, capacity gain beyond about 12 m is not reliable (p. 71); rock,
typical bond lengths 3-10 m (p. 74)."""
INCLINATION_RANGE = (10.0, 45.0)
"""GEC-4 section 5.3.6, p. 70: 10°-45° is within most contractors' capability."""


@dataclass(frozen=True)
class TransferLoad:
    id: str
    ground: str
    condition: str
    q_u_kn_per_m: float
    source: str


_T6 = f"{GEC4} Table 6, p. 71 (small-diameter straight-shaft gravity-grouted, soil)"
_T8 = f"{GEC4} Table 8, p. 74 (ground anchors in competent rock)"

TRANSFER_LOADS: tuple[TransferLoad, ...] = (
    TransferLoad("sand_gravel_loose", "Sand and gravel", "Loose (SPT 4-10)", 145, _T6),
    TransferLoad("sand_gravel_medium", "Sand and gravel", "Medium dense (SPT 11-30)", 220, _T6),
    TransferLoad("sand_gravel_dense", "Sand and gravel", "Dense (SPT 31-50)", 290, _T6),
    TransferLoad("sand_loose", "Sand", "Loose (SPT 4-10)", 100, _T6),
    TransferLoad("sand_medium", "Sand", "Medium dense (SPT 11-30)", 145, _T6),
    TransferLoad("sand_dense", "Sand", "Dense (SPT 31-50)", 190, _T6),
    TransferLoad("sand_silt_loose", "Sand and silt", "Loose (SPT 4-10)", 70, _T6),
    TransferLoad("sand_silt_medium", "Sand and silt", "Medium dense (SPT 11-30)", 100, _T6),
    TransferLoad("sand_silt_dense", "Sand and silt", "Dense (SPT 31-50)", 130, _T6),
    TransferLoad("silt_clay_stiff", "Silt-clay mixture, low plasticity / micaceous fine sand-silt",
                 "Stiff (SPT 10-20)", 30, _T6),
    TransferLoad("silt_clay_hard", "Silt-clay mixture, low plasticity / micaceous fine sand-silt",
                 "Hard (SPT 21-40)", 60, _T6),
    TransferLoad("rock_granite_basalt", "Rock", "Granite or basalt", 730, _T8),
    TransferLoad("rock_dolomitic_limestone", "Rock", "Dolomitic limestone", 580, _T8),
    TransferLoad("rock_soft_limestone", "Rock", "Soft limestone", 440, _T8),
    TransferLoad("rock_sandstone", "Rock", "Sandstone", 440, _T8),
    TransferLoad("rock_slate_hard_shale", "Rock", "Slates and hard shales", 360, _T8),
    TransferLoad("rock_soft_shale", "Rock", "Soft shales", 150, _T8),
)

SAFETY_FACTOR_GUIDANCE: tuple[tuple[str, float, str], ...] = (
    ("soil", 2.0, f"{GEC4} section 5.3.6, p. 71"),
    ("rock", 3.0, f"{GEC4} section 5.3.6, p. 74"),
    ("intermediate_geomaterial", 2.0, f"{GEC4} section 5.3.6, p. 74"),
)
"""Recommended FS on the ultimate load transfer; shown to the user, never applied by default."""
