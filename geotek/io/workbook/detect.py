"""Sheet role detection, header/column matching and unit inference."""

from __future__ import annotations

import io
import math
import re
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd

from geotek.core.errors import ImportDataError, UnitError
from geotek.core.units import dimension_of
from geotek.io.workbook.schema import (
    ColumnMap,
    ImportIssue,
    ImportOptions,
    ImportPlan,
    Role,
    SheetPlan,
)

MAX_SHEETS = 20
MAX_ROWS = 50_000
HEADER_SCAN_ROWS = 15
MIN_ROLE_COVERAGE = 0.99
"""Share of a role's required fields that must be matched for the role to be assigned."""

_UNIT = re.compile(r"[\(\[]\s*([^\)\]]+?)\s*[\)\]]")
_FOLD = str.maketrans({"ı": "i", "İ": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g",
                       "ü": "u", "Ü": "u", "ö": "o", "Ö": "o", "ç": "c", "Ç": "c", "γ": "gamma"})

# role -> (required fields, optional fields, sheet-name hint)
ROLES: dict[str, tuple[tuple[str, ...], tuple[str, ...], str]] = {
    "cpt": (("depth", "qc"), ("fs", "u2", "point_id"), r"cpt|cpt[uü]|cone|koni|sondalama"),
    "spt": (("depth_or_drive", "n_or_blows"),
            ("depth", "drive_start", "drive_end", "n", "blow1", "blow2", "blow3", "rod_length",
             "energy_ratio", "borehole_diameter", "sampler", "description", "point_id"),
            r"spt|sptn|standard"),
    "samples": (("sample_id", "depth"),
                ("gamma", "w", "Gs", "sieve_mass", "specimen", "point_id"), r"sample|numune|ornek|lab"),
    "sieve": (("sample_id", "opening", "retained"), ("pan",), r"sieve|elek|gradation|granulometri"),
    "limits": (("sample_id", "test", "w"), ("replicate", "blows"), r"limit|atterberg|plastik"),
    "cu_setup": (("test_id", "consolidation", "cell"),
                 ("sample_id", "back_pressure", "b_value"), r"setup|kurulum"),
    "cu_curves": (("test_id", "strain", "q", "u"), (), r"curve|egri|cu"),
}

# canonical field -> regexes tried (fullmatch) against the folded header text
PATTERNS: dict[str, tuple[str, ...]] = {
    "point_id": (r"(borehole|bore hole|bh|sounding|cpt|spt|sondaj|kuyu|nokta)( ?(id|no|name|adi))?",),
    "sample_id": (r"sample( ?(id|no|name))?|numune( ?(no|id|adi))?|ornek( ?(no|id))?",),
    "test_id": (r"test ?(id|no|name)|deney ?(id|no|adi)",),
    "depth": (r"((test|sample|numune|deney) )?(depth|derinlik)|z|d",),
    "drive_start": (r"(drive|test|sampling)? ?start.*|baslangic.*|from",),
    "drive_end": (r"(drive|test|sampling)? ?end.*|bitis.*|to",),
    "n": (r"n|spt|spt ?n|n ?value|n ?field|n ?spt|n30|spt n degeri|darbe ?sayisi",),
    "blow1": (r"(blows?|darbe).*(0 ?(15|150)|first|1st|seat).*",),
    "blow2": (r"(blows?|darbe).*(15 ?30|150 ?300|second|2nd).*",),
    "blow3": (r"(blows?|darbe).*(30 ?45|300 ?450|third|3rd).*",),
    "rod_length": (r"rod( length)?|cubuk( boyu)?|tij( boyu)?",),
    "energy_ratio": (r"energy( ratio)?|er|enerji( orani)?|hammer eff.*",),
    "borehole_diameter": (r"(borehole |bore hole |sondaj )?(dia|diameter|cap)\.?|borehole dia.*",),
    "sampler": (r"sampler( type)?|numune alici",),
    "description": (r"(field )?description|tanim|aciklama",),
    "qc": (r"qc|cone (tip )?resistance|tip resistance|uc direnci|koni direnci",),
    "fs": (r"fs|sleeve friction|friction|surtunme|cevre surtunmesi",),
    "u2": (r"u2|u|pore ?pressure|bosluk suyu basinci",),
    "gamma": (r"(bulk |total |natural )?unit (w(ei)?ght|wt)|gamma|birim hacim agirlik.*|unit wt",),
    "w": (r"(natural )?water( content)?|moisture( content)?|w|dogal su.*|su muhtevasi|water content",),
    "Gs": (r"gs|specific gravity|ozgul agirlik",),
    "sieve_mass": (r"sieve dry mass|(total )?dry mass|kuru kutle.*",),
    "specimen": (r".*(specimen|sample) prep.*|.*numune hazirlik.*|cu specimen.*",),
    "opening": (r"sieve (opening|size)|opening|elek ?(acikligi|boyutu)?|size",),
    "retained": (r"(dry )?mass retained|retained( mass)?|tutulan.*",),
    "pan": (r"pan|tava",),
    "test": (r"test|type|tip|deney",),
    "replicate": (r"replicate|rep|tekrar",),
    "blows": (r"blow( count)?s?|darbe( sayisi)?",),
    "consolidation": (r"consolidation.*|konsolidasyon.*",),
    "cell": (r"cell.*|hucre.*",),
    "back_pressure": (r"back ?pressure.*|geri basinc.*",),
    "b_value": (r"b|b (saturation|value).*|skempton b",),
    "strain": (r"(axial )?strain|sekil degistirme|birim sekil.*",),
    "q": (r"(deviator.*|deviatoric.*|deviatorik.*|q)",),
    "u": (r"(pore pressure.*|u|bosluk.*)",),
}
FIELD_ORDER = ("blow1", "blow2", "blow3", "drive_start", "drive_end", "n", "depth", "qc", "fs", "u2")

DEFAULT_UNITS = {
    "depth": "m", "drive_start": "m", "drive_end": "m", "rod_length": "m", "borehole_diameter": "mm",
    "qc": "MPa", "fs": None, "u2": "kPa", "gamma": "kN/m3", "consolidation": "kPa", "cell": "kPa",
    "back_pressure": "kPa", "q": "kPa", "u": "kPa", "opening": "mm",
}
TARGET_UNITS = {
    "depth": "m", "drive_start": "m", "drive_end": "m", "rod_length": "m", "qc": "kPa", "fs": "kPa",
    "u2": "kPa", "gamma": "kN/m3", "consolidation": "kPa", "cell": "kPa", "back_pressure": "kPa",
    "q": "kPa", "u": "kPa",
}
LENGTH_MM = {"mm": 1.0, "cm": 10.0, "m": 1000.0, "in": 25.4, "ft": 304.8}
"""Lengths for fields stored in mm (openings, borehole diameter)."""
RF_RANGE = (0.1, 10.0)
"""Friction ratio [%] bracket used only to tell fs in MPa from fs in kPa when no unit is written."""


def fold(text: str) -> str:
    text = _UNIT.sub(" ", str(text)).translate(_FOLD)
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", text.lower())).strip()


def header_unit(header: str) -> str | None:
    match = _UNIT.search(str(header))
    return match.group(1).strip() if match else None


def _match_field(folded: str, field: str) -> bool:
    return any(re.fullmatch(p, folded) for p in PATTERNS[field])


def read_sheets(data: bytes, filename: str) -> dict[str, pd.DataFrame]:
    """All sheets as raw cell frames (no header interpretation)."""
    suffix = Path(filename).suffix.lower()
    try:
        if suffix in (".xlsx", ".xlsm", ".xls"):
            frames = pd.read_excel(io.BytesIO(data), sheet_name=None, header=None, dtype=object)
        elif suffix in (".csv", ".txt"):
            text = data.decode("utf-8-sig")
            first = text.splitlines()[0] if text else ""
            if "\t" in first:
                sep, decimal = "\t", "."
            elif first.count(";") > first.count(","):
                sep, decimal = ";", ","
            else:
                sep, decimal = ",", "."
            frames = {Path(filename).stem: pd.read_csv(
                io.StringIO(text), sep=sep, decimal=decimal, header=None, dtype=object)}
        else:
            raise ImportDataError(f"Unsupported file type: {suffix or filename!r}")
    except ImportDataError:
        raise
    except (ValueError, OSError, UnicodeError) as exc:
        raise ImportDataError(f"Cannot read {filename}: {exc}") from exc
    if len(frames) > MAX_SHEETS:
        raise ImportDataError(f"Workbook has more than {MAX_SHEETS} sheets")
    for name, frame in frames.items():
        if len(frame) > MAX_ROWS:
            raise ImportDataError(f"Sheet {name!r} has more than {MAX_ROWS} rows")
    return {str(k): v for k, v in frames.items()}


def find_header(frame: pd.DataFrame) -> int | None:
    """Row (within the first rows) with the most recognised headers; needs at least two."""
    best, best_hits = None, 1
    for i in range(min(HEADER_SCAN_ROWS, len(frame))):
        hits = sum(
            1 for cell in frame.iloc[i]
            if isinstance(cell, str) and any(_match_field(fold(cell), f) for f in PATTERNS))
        if hits > best_hits:
            best, best_hits = i, hits
    return best


def match_columns(headers: list[str]) -> dict[str, str]:
    """Canonical field -> header; each column serves one field (specific fields first)."""
    folded = {h: fold(h) for h in headers if isinstance(h, str)}
    used: set[str] = set()
    found: dict[str, str] = {}
    for field in [*FIELD_ORDER, *[f for f in PATTERNS if f not in FIELD_ORDER]]:
        for header, text in folded.items():
            if header not in used and _match_field(text, field):
                found[field] = header
                used.add(header)
                break
    return found


def _role_fields(role: str, found: dict[str, str]) -> tuple[float, dict[str, str]]:
    required, optional, _ = ROLES[role]
    fields = dict(found)
    blows = [f for f in ("blow1", "blow2", "blow3") if f in fields]
    satisfied = 0
    for req in required:
        if req == "depth_or_drive":
            ok = "depth" in fields or ("drive_start" in fields and "drive_end" in fields)
        elif req == "n_or_blows":
            ok = "n" in fields or len(blows) == 3
        else:
            ok = req in fields
        satisfied += bool(ok)
    allowed = {f for r in required for f in (r,)} | set(optional)
    kept = {f: h for f, h in fields.items() if f in allowed or f in ("depth", "n")}
    return satisfied / len(required), kept


def classify_sheet(name: str, found: dict[str, str]) -> tuple[Role | None, float, dict[str, str]]:
    best: tuple[float, str, dict[str, str]] | None = None
    for role, (required, optional, hint) in ROLES.items():
        coverage, kept = _role_fields(role, found)
        if coverage < MIN_ROLE_COVERAGE:
            continue
        # CU curves and setup share test_id; the extra fields decide, the sheet name breaks ties.
        extra = len([f for f in optional if f in kept]) / max(len(optional), 1)
        score = 1.0 + 0.3 * extra + (0.3 if re.search(hint, fold(name)) else 0.0)
        if role == "samples" and "sample_id" in found and "opening" in found:
            score -= 0.5
        if best is None or score > best[0]:
            best = (score, role, kept)
    if best is None:
        return None, 0.0, {}
    return best[1], round(min(best[0] / 1.6, 1.0), 2), best[2]  # type: ignore[return-value]


def numeric(series: pd.Series) -> np.ndarray:
    def one(v):
        if v is None or (isinstance(v, float) and math.isnan(v)):
            return math.nan
        if isinstance(v, (int, float, np.integer, np.floating)):
            return float(v)
        try:
            return float(str(v).strip().replace(",", "."))
        except ValueError:
            return math.nan
    return np.array([one(v) for v in series], dtype=float)


def sheet_table(frame: pd.DataFrame, header_row: int) -> pd.DataFrame:
    body = frame.iloc[header_row + 1:].copy()
    body.columns = [str(c).strip() if isinstance(c, str) else str(c) for c in frame.iloc[header_row]]
    return body.dropna(how="all").reset_index(drop=True)


def _unit_known(unit: str) -> bool:
    try:
        dimension_of(unit)
        return True
    except UnitError:
        return False


def _fs_unit(table: pd.DataFrame, columns: dict[str, ColumnMap], issues: list[ImportIssue], sheet: str):
    fs = columns["fs"]
    if fs.unit is not None:
        return
    qc_col = columns["qc"]
    qc = numeric(table[qc_col.header])
    fs_vals = numeric(table[fs.header])
    ok = np.isfinite(qc) & np.isfinite(fs_vals) & (qc > 0)
    fits = []
    for unit in ("MPa", "kPa"):
        qc_k = qc[ok] * (1000.0 if (qc_col.unit or "MPa") == "MPa" else 1.0)
        rf = 100.0 * fs_vals[ok] * (1000.0 if unit == "MPa" else 1.0) / qc_k
        if rf.size and RF_RANGE[0] <= float(np.median(rf)) <= RF_RANGE[1]:
            fits.append(unit)
    if len(fits) == 1:
        fs.unit, fs.unit_source = fits[0], "inferred"
        issues.append(ImportIssue(code="import.issue.unit_inferred", severity="info", sheet=sheet,
                                  field="fs", params={"unit": fits[0]}))
    else:
        issues.append(ImportIssue(code="import.issue.unit_ambiguous", severity="blocker", sheet=sheet,
                                  field="fs", params={}))


def _assign_units(role: str, table: pd.DataFrame, columns: dict[str, ColumnMap],
                  issues: list[ImportIssue], sheet: str) -> None:
    for field, col in columns.items():
        unit = header_unit(col.header)
        if unit is not None:
            known = _unit_known(unit) or (field in ("borehole_diameter", "opening") and unit in LENGTH_MM)
            if known:
                col.unit, col.unit_source = unit, "header"
                continue
            if field in DEFAULT_UNITS:
                issues.append(ImportIssue(code="import.issue.unit_unknown", severity="blocker",
                                          sheet=sheet, field=field, params={"unit": unit}))
                continue
        default = DEFAULT_UNITS.get(field)
        if default:
            col.unit, col.unit_source = default, "default"
            if field in ("qc", "depth") and unit is None:
                issues.append(ImportIssue(code="import.issue.unit_assumed", severity="info", sheet=sheet,
                                          field=field, params={"unit": default}))
    if role == "cpt" and "fs" in columns and "qc" in columns:
        _fs_unit(table, columns, issues, sheet)


def analyze_workbook(data: bytes, filename: str) -> ImportPlan:
    """Detect roles, columns, units and open questions. Nothing is stored."""
    frames = read_sheets(data, filename)
    plan = ImportPlan(filename=filename)
    issues = plan.issues
    for name, frame in frames.items():
        header_row = find_header(frame)
        if header_row is None:
            plan.sheets.append(SheetPlan(name=name))
            issues.append(ImportIssue(code="import.issue.sheet_unrecognised", severity="info", sheet=name))
            continue
        table = sheet_table(frame, header_row)
        found = match_columns([c for c in table.columns])
        role, confidence, kept = classify_sheet(name, found)
        sheet = SheetPlan(name=name, role=role, confidence=confidence, header_row=header_row,
                          row_count=len(table))
        if role is None:
            issues.append(ImportIssue(code="import.issue.sheet_unrecognised", severity="info", sheet=name))
            plan.sheets.append(sheet)
            continue
        sheet.columns = {f: ColumnMap(header=h) for f, h in kept.items()}
        _assign_units(role, table, sheet.columns, issues, name)
        plan.sheets.append(sheet)
        _role_questions(role, table, sheet, plan.options, issues)
    _global_questions(plan)
    return plan


def _role_questions(role: str, table: pd.DataFrame, sheet: SheetPlan, options: ImportOptions,
                    issues: list[ImportIssue]) -> None:
    cols = sheet.columns
    if role == "spt":
        if "sampler" in cols:
            for text in sorted({str(v).strip() for v in table[cols["sampler"].header].dropna()}):
                if text not in options.sampler_map:
                    options.sampler_map[text] = None
                    lowered = fold(text)
                    if re.search(r"no liner|without liner|linersiz|astarsiz|liner yok", lowered):
                        options.sampler_suggestions[text] = "no_liner"
                    issues.append(ImportIssue(code="import.issue.sampler_unmapped", severity="blocker",
                                              sheet=sheet.name, field="sampler", params={"text": text}))
        if "energy_ratio" in cols:
            values = numeric(table[cols["energy_ratio"].header])
            values = values[np.isfinite(values)]
            if values.size and "%" not in str(cols["energy_ratio"].header):
                if float(values.max()) <= 1.0:
                    options.energy_ratio_scale = None
                    issues.append(ImportIssue(code="import.issue.energy_ratio_scale", severity="blocker",
                                              sheet=sheet.name, field="energy_ratio", params={}))
                else:
                    options.energy_ratio_scale = "percent"
            elif values.size:
                options.energy_ratio_scale = "percent"
    if role == "cpt" and "u2" in cols:
        values = numeric(table[cols["u2"].header])
        finite = values[np.isfinite(values)]
        if finite.size and not finite.any():
            issues.append(ImportIssue(code="import.issue.u2_all_zero", severity="info", sheet=sheet.name,
                                      field="u2", params={}))
    if role == "cpt" and "fs" not in cols:
        # Sleeve friction is still required by the CPT record and processing chain.
        issues.append(ImportIssue(code="import.issue.cpt_fs_missing", severity="blocker",
                                  sheet=sheet.name, field="fs", params={}))
    if role == "spt" and not any(f in cols for f in ("energy_ratio",)):
        issues.append(ImportIssue(code="import.issue.energy_ratio_missing", severity="info",
                                  sheet=sheet.name, field="energy_ratio", params={}))


def _global_questions(plan: ImportPlan) -> None:
    stem = re.sub(r"[^A-Za-z0-9_\-]+", "-", Path(plan.filename).stem).strip("-") or "import"
    roles = {s.role for s in plan.sheets if s.role}
    if roles & {"spt", "samples"}:
        plan.options.borehole_id = plan.options.borehole_id or f"{stem}-BH"
    if "cpt" in roles:
        plan.options.cpt_id = plan.options.cpt_id or f"{stem}-CPT"
