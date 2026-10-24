"""Unified Soil Classification System group symbol (ASTM D2487).

Organic soils (OL/OH/Pt) need the oven-dried liquid limit and are not identified here.
Secondary descriptors ("with sand", "gravelly") are not produced.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from geotek.core.models.investigations import LabRecord


@dataclass
class USCSResult:
    symbol: str | None
    complete: bool
    """False when an assumption had to be made because data were missing."""
    notes: list[str] = field(default_factory=list)


def a_line(LL: float) -> float:
    """A-line: PI = 0.73 (LL - 20)."""
    return 0.73 * (LL - 20.0)


def u_line(LL: float) -> float:
    """U-line (upper bound of natural soils): PI = 0.9 (LL - 8)."""
    return 0.9 * (LL - 8.0)


def fines_type(LL: float, PI: float) -> str:
    """Plasticity class of fines: 'C', 'M' or 'CL-ML' (hatched zone)."""
    above_a = PI >= a_line(LL)
    if PI < 4 or not above_a:
        return "M"
    if PI > 7:
        return "C"
    return "CL-ML"


def classify(
    *,
    fines: float,
    gravel: float | None = None,
    LL: float | None = None,
    PI: float | None = None,
    D10: float | None = None,
    D30: float | None = None,
    D60: float | None = None,
) -> USCSResult:
    notes: list[str] = []
    complete = True
    plastic = None
    if LL is not None and PI is not None:
        plastic = fines_type(LL, PI)
        if PI > u_line(LL):
            notes.append("Atterberg limits plot above the U-line: check test data")

    # Fine-grained soils
    if fines >= 50:
        if plastic is None:
            return USCSResult(None, False, ["Fine-grained soil: LL and PI required"])
        notes.append("Organic soils (OL/OH) not checked")
        if LL < 50:
            symbol = {"C": "CL", "M": "ML", "CL-ML": "CL-ML"}[plastic]
        else:
            symbol = "CH" if PI >= a_line(LL) else "MH"
        return USCSResult(symbol, complete, notes)

    # Coarse-grained soils
    if gravel is None:
        prefix = "S"
        complete = False
        notes.append("Gravel content unknown: sand assumed as the dominant coarse fraction")
    else:
        sand = 100.0 - gravel - fines
        prefix = "G" if gravel > sand else "S"

    def grading() -> str:
        nonlocal complete
        if None in (D10, D30, D60):
            complete = False
            notes.append("D10/D30/D60 unknown: poorly graded assumed")
            return "P"
        cu = D60 / D10
        cc = D30**2 / (D10 * D60)
        cu_min = 4.0 if prefix == "G" else 6.0
        return "W" if cu >= cu_min and 1.0 <= cc <= 3.0 else "P"

    def fines_letter() -> str:
        nonlocal complete
        if plastic is None:
            complete = False
            notes.append("Atterberg limits of fines unknown: silty fines assumed")
            return "M"
        return plastic

    if fines < 5:
        return USCSResult(prefix + grading(), complete, notes)
    if fines <= 12:
        letter = fines_letter()
        letter = "C" if letter == "CL-ML" else letter
        g = prefix + grading()
        return USCSResult(f"{g}-{prefix}{letter}", complete, notes)
    letter = fines_letter()
    if letter == "CL-ML":
        return USCSResult(f"{prefix}C-{prefix}M", complete, notes)
    return USCSResult(prefix + letter, complete, notes)


def classify_lab_record(record: LabRecord) -> USCSResult:
    if record.FC is None:
        return USCSResult(None, False, ["Fines content (FC) required"])
    return classify(
        fines=record.FC, gravel=record.gravel, LL=record.LL, PI=record.PI,
        D10=record.D10, D30=record.D30, D60=record.D60,
    )


def dominant_symbol(records) -> str | None:
    """Most common classified USCS symbol of lab records; a tie goes to the shallowest symbol.

    Records are taken in depth order, so the symbol met first in depth order wins a tie.
    """
    symbols = [result.symbol for record in sorted(records, key=lambda r: r.depth)
               if (result := classify_lab_record(record)).symbol is not None]
    if not symbols:
        return None
    counts = {symbol: symbols.count(symbol) for symbol in symbols}
    best = max(counts.values())
    return next(symbol for symbol in symbols if counts[symbol] == best)
