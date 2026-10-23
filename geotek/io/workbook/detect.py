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
from geotek.core.units import convert, dimension_of
from geotek.io.workbook.schema import (
    ColumnMap,
    ImportIssue,
    ImportOptions,
    ImportPlan,
    Role,
    SheetPlan,
)

MAX_SHEETS = 20
MAX_UNPACKED_BYTES = 200 * 1024 * 1024
MAX_PLAUSIBLE_DEPTH_M = 200.0
QC_KPA_RANGE = (50.0, 150_000.0)
"""Median cone resistance bracket [kPa] used to catch a wrong qc unit; outside it the unit is asked."""
GAMMA_RANGE = (5.0, 30.0)
"""Median unit weight bracket [kN/m3] used to catch values entered in g/cm3 or tf/m3."""
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
    "depth": (r"((test|sample|numune|deney) )?(depth|derinlik)",),
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
    "u2": (r"u2|pore ?pressure|bosluk suyu basinci",),
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


_THOUSANDS_COMMA = re.compile(r"^\d{1,3}(,\d{3})+(\.\d+)?$")
_THOUSANDS_DOT = re.compile(r"^\d{1,3}(\.\d{3})+(,\d+)?$")
_AMBIGUOUS = re.compile(r"^\d{1,3}[.,]\d{3}$")


def _cell_ambiguous(v) -> bool:
    return isinstance(v, str) and bool(_AMBIGUOUS.match(v.strip()))


def numeric(series: pd.Series) -> np.ndarray:
    """Cell values as floats; text uses the decimal comma, thousands separators are removed.
    Ambiguous text such as ``5,000`` is read as a decimal and reported by ``blocking_questions``."""
    def one(v):
        if v is None or (isinstance(v, float) and math.isnan(v)):
            return math.nan
        if isinstance(v, (int, float, np.integer, np.floating)):
            return float(v)
        text = str(v).strip()
        if _THOUSANDS_COMMA.match(text) and not _AMBIGUOUS.match(text):
            text = text.replace(",", "")
        elif _THOUSANDS_DOT.match(text) and not _AMBIGUOUS.match(text):
            text = text.replace(".", "")
        try:
            return float(text.replace(",", "."))
        except ValueError:
            return math.nan
    return np.array([one(v) for v in series], dtype=float)


def _unit_known(unit: str) -> bool:
    try:
        dimension_of(unit)
        return True
    except UnitError:
        return False


STRESS_FIELDS = ("qc", "fs", "u2", "consolidation", "cell", "back_pressure", "q", "u")
LENGTH_FIELDS = ("depth", "drive_start", "drive_end", "rod_length")
MM_FIELDS = ("borehole_diameter", "opening")
UNIT_FIELDS = (*STRESS_FIELDS, *LENGTH_FIELDS, "gamma", *MM_FIELDS)


def unit_allowed(field: str, unit: str) -> bool:
    if field in MM_FIELDS:
        return unit in LENGTH_MM
    if field == "gamma":
        return _unit_known(unit) and dimension_of(unit) == "unit_weight"
    wanted = "stress" if field in STRESS_FIELDS else "length"
    return _unit_known(unit) and dimension_of(unit) == wanted


_US_SIEVE_MM = {3: 6.7, 4: 4.75, 8: 2.36, 10: 2.0, 16: 1.18, 20: 0.85, 30: 0.6, 40: 0.425,
                50: 0.3, 60: 0.25, 100: 0.15, 140: 0.106, 200: 0.075}
_SIEVE_NO = re.compile(r"^(?:#|no\.?\s*|nr\.?\s*)(\d{1,3})$", re.IGNORECASE)


def sieve_opening_mm(label) -> float | None:
    """Opening of a designation such as ``#200`` or ``No. 4``; None when it is not one."""
    match = _SIEVE_NO.match(str(label).strip())
    return _US_SIEVE_MM.get(int(match.group(1))) if match else None


_UNIT_WORD = re.compile(r"^[A-Za-z%/²³0-9\.\- ]{1,12}$")


def prepare_sheet(frame: pd.DataFrame, header_row: int) -> tuple[pd.DataFrame, dict[str, str]]:
    """Data rows under the header, plus units from an optional unit row directly below it."""
    body = frame.iloc[header_row + 1:].copy()
    body.columns = [str(c).strip() if isinstance(c, str) else str(c) for c in frame.iloc[header_row]]
    body = body.dropna(how="all").reset_index(drop=True)
    units: dict[str, str] = {}
    if len(body):
        first = body.iloc[0]
        cells = {c: v for c, v in first.items() if isinstance(v, str) and v.strip()}
        numeric_cells = [v for v in first if not isinstance(v, str) and not pd.isna(v)]
        if cells and not numeric_cells and all(
                _UNIT_WORD.match(v.strip()) and (_unit_known(v.strip()) or v.strip() in LENGTH_MM
                                                 or v.strip() in ("%", "-", "g", "deg"))
                for v in cells.values()):
            units = {c: v.strip() for c, v in cells.items()}
            body = body.iloc[1:].reset_index(drop=True)
    return body, units


def sheet_table(frame: pd.DataFrame, header_row: int) -> pd.DataFrame:
    return prepare_sheet(frame, header_row)[0]


def check_zip_size(data: bytes, filename: str) -> None:
    """Reject xlsx archives that would expand beyond the limit (zip bombs)."""
    if Path(filename).suffix.lower() not in (".xlsx", ".xlsm"):
        return
    import zipfile
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            if sum(i.file_size for i in archive.infolist()) > MAX_UNPACKED_BYTES:
                raise ImportDataError("The workbook expands beyond the allowed size")
    except zipfile.BadZipFile as exc:
        raise ImportDataError(f"Cannot read {filename}: not a valid workbook") from exc


def _implausible_qc(unit: str, qc: np.ndarray) -> bool:
    values = qc[np.isfinite(qc) & (qc > 0)]
    if not values.size:
        return False
    median_kpa = float(np.median(values)) * (1000.0 if unit == "MPa" else float(convert(1.0, unit, "kPa")))
    return not QC_KPA_RANGE[0] <= median_kpa <= QC_KPA_RANGE[1]


def _assign_units(role: str, table: pd.DataFrame, columns: dict[str, ColumnMap],
                  unit_row: dict[str, str], issues: list[ImportIssue], sheet: str) -> None:
    for field, col in columns.items():
        if field not in UNIT_FIELDS:
            continue
        unit = header_unit(col.header) or unit_row.get(col.header)
        if unit is not None:
            col.unit = unit
            col.unit_source = "header"
            continue
        default = DEFAULT_UNITS.get(field)
        if field == "qc":
            values = numeric(table[col.header])
            values = values[np.isfinite(values) & (values > 0)]
            median = float(np.median(values)) if values.size else math.nan
            if median <= 100.0:
                col.unit, col.unit_source = "MPa", "inferred"
            elif median >= 1000.0:
                col.unit, col.unit_source = "kPa", "inferred"
            if col.unit:
                issues.append(ImportIssue(code="import.issue.unit_inferred", severity="info", sheet=sheet,
                                          field="qc", params={"unit": col.unit}))
        elif default:
            col.unit, col.unit_source = default, "default"
            if field == "depth":
                issues.append(ImportIssue(code="import.issue.unit_assumed", severity="info", sheet=sheet,
                                          field=field, params={"unit": default}))
    if role == "cpt" and "fs" in columns and "qc" in columns and columns["fs"].unit is None:
        _infer_fs_unit(table, columns, issues, sheet)


def _infer_fs_unit(table: pd.DataFrame, columns: dict[str, ColumnMap], issues: list[ImportIssue],
                   sheet: str) -> None:
    fs, qc_col = columns["fs"], columns["qc"]
    if qc_col.unit is None or not _unit_known(qc_col.unit):
        return
    qc = np.asarray(convert(numeric(table[qc_col.header]), qc_col.unit, "kPa"), dtype=float)
    fs_vals = numeric(table[fs.header])
    ok = np.isfinite(qc) & np.isfinite(fs_vals) & (qc > 0)
    fits = []
    for unit in ("MPa", "kPa"):
        rf = 100.0 * fs_vals[ok] * (1000.0 if unit == "MPa" else 1.0) / qc[ok]
        if rf.size and RF_RANGE[0] <= float(np.median(rf)) <= RF_RANGE[1]:
            fits.append(unit)
    if len(fits) == 1:
        fs.unit, fs.unit_source = fits[0], "inferred"
        issues.append(ImportIssue(code="import.issue.unit_inferred", severity="info", sheet=sheet,
                                  field="fs", params={"unit": fits[0]}))


def analyze_workbook(data: bytes, filename: str) -> ImportPlan:
    """Detect roles, columns, units and open questions. Nothing is stored."""
    check_zip_size(data, filename)
    frames = read_sheets(data, filename)
    plan = ImportPlan(filename=filename)
    tables: dict[str, pd.DataFrame] = {}
    for name, frame in frames.items():
        header_row = find_header(frame)
        if header_row is None:
            plan.sheets.append(SheetPlan(name=name))
            plan.issues.append(ImportIssue(code="import.issue.sheet_unrecognised", severity="info", sheet=name))
            continue
        table, unit_row = prepare_sheet(frame, header_row)
        found = match_columns(list(table.columns))
        role, confidence, kept = classify_sheet(name, found)
        sheet = SheetPlan(name=name, role=role, confidence=confidence, header_row=header_row,
                          row_count=len(table))
        plan.sheets.append(sheet)
        if role is None:
            plan.issues.append(ImportIssue(code="import.issue.sheet_unrecognised", severity="info", sheet=name))
            continue
        sheet.columns = {f: ColumnMap(header=h) for f, h in kept.items()}
        tables[name] = table
        _assign_units(role, table, sheet.columns, unit_row, plan.issues, name)
        _role_infos(role, table, sheet, plan)
    _global_defaults(plan)
    plan.issues.extend(blocking_questions(plan, tables))
    return plan


def _role_infos(role: str, table: pd.DataFrame, sheet: SheetPlan, plan: ImportPlan) -> None:
    cols, options = sheet.columns, plan.options
    if role == "spt":
        if "sampler" in cols:
            for text in sorted({str(v).strip() for v in table[cols["sampler"].header].dropna()}):
                if text not in options.sampler_map:
                    options.sampler_map[text] = None
                    if re.search(r"no liner|without liner|linersiz|astarsiz|liner yok", fold(text)):
                        options.sampler_suggestions[text] = "no_liner"
        if "energy_ratio" not in cols:
            plan.issues.append(ImportIssue(code="import.issue.energy_ratio_missing", severity="info",
                                           sheet=sheet.name, field="energy_ratio"))
    if role == "cpt" and "fs" not in cols:
        plan.issues.append(ImportIssue(code="import.issue.cpt_fs_missing", severity="confirm",
                                       sheet=sheet.name, field="fs"))
    if role == "cpt" and "u2" in cols:
        values = numeric(table[cols["u2"].header])
        finite = values[np.isfinite(values)]
        if finite.size and not finite.any():
            plan.issues.append(ImportIssue(code="import.issue.u2_all_zero", severity="info",
                                           sheet=sheet.name, field="u2"))
    for field, col in cols.items():
        if len(fold(col.header)) <= 1 or fold(col.header) == "spt":
            plan.issues.append(ImportIssue(
                code="import.issue.column_confirm", severity="confirm", sheet=sheet.name, field=field,
                params={"header": col.header}))


def _global_defaults(plan: ImportPlan) -> None:
    stem = re.sub(r"[^A-Za-z0-9_\-]+", "-", Path(plan.filename).stem).strip("-") or "import"
    roles = {s.role for s in plan.sheets if s.role}
    if roles & {"spt", "samples"}:
        plan.options.borehole_id = plan.options.borehole_id or f"{stem}-BH"
    if "cpt" in roles:
        plan.options.cpt_id = plan.options.cpt_id or f"{stem}-CPT"


def blocking_questions(plan: ImportPlan, tables: dict[str, pd.DataFrame]) -> list[ImportIssue]:
    """Open questions derived from the plan and the data. Used by both analysis and import, so a
    plan sent back by a client cannot skip a question by editing its issue list."""
    out: list[ImportIssue] = []

    def block(code, sheet, field=None, **params):
        out.append(ImportIssue(code=code, severity="blocker", sheet=sheet.name, field=field, params=params))

    seen: dict[str, str] = {}
    for sheet in plan.sheets:
        if sheet.role is None:
            continue
        if sheet.role in seen:
            block("import.issue.role_duplicate", sheet, role=sheet.role, other=seen[sheet.role])
        seen.setdefault(sheet.role, sheet.name)
        table = tables.get(sheet.name)
        if table is None:
            continue
        cols = sheet.columns
        for field, col in cols.items():
            if col.header not in table.columns:
                continue
            if field in UNIT_FIELDS:
                if col.unit is None:
                    block("import.issue.unit_ambiguous", sheet, field)
                elif not unit_allowed(field, col.unit):
                    block("import.issue.unit_unknown", sheet, field, unit=col.unit)
            if any(_cell_ambiguous(v) for v in table[col.header]) and field not in (
                    "point_id", "sample_id", "test_id", "description", "sampler", "specimen", "test"):
                block("import.issue.number_format_ambiguous", sheet, field)
        if "qc" in cols and cols["qc"].unit and unit_allowed("qc", cols["qc"].unit) \
                and cols["qc"].unit_source != "user" and _implausible_qc(cols["qc"].unit, numeric(table[cols["qc"].header])):
            block("import.issue.unit_implausible", sheet, "qc", unit=cols["qc"].unit)
        if "fs" in cols and "qc" in cols and cols["fs"].unit and cols["qc"].unit \
                and unit_allowed("fs", cols["fs"].unit) and unit_allowed("qc", cols["qc"].unit) \
                and cols["fs"].unit_source != "user":
            qc = np.asarray(convert(numeric(table[cols["qc"].header]), cols["qc"].unit, "kPa"), dtype=float)
            fs = np.asarray(convert(numeric(table[cols["fs"].header]), cols["fs"].unit, "kPa"), dtype=float)
            ok = np.isfinite(qc) & np.isfinite(fs) & (qc > 0)
            if ok.any() and not RF_RANGE[0] <= float(np.median(100.0 * fs[ok] / qc[ok])) <= RF_RANGE[1]:
                block("import.issue.unit_implausible", sheet, "fs", unit=cols["fs"].unit)
        if "depth" in cols and cols["depth"].unit_source == "default":
            depth = numeric(table[cols["depth"].header])
            if np.isfinite(depth).any() and float(np.nanmax(depth)) > MAX_PLAUSIBLE_DEPTH_M:
                block("import.issue.unit_implausible", sheet, "depth", unit=cols["depth"].unit)
        if sheet.role == "spt":
            _spt_blockers(plan, sheet, table, block)
        if sheet.role in ("samples", "limits"):
            _samples_blockers(plan, sheet, table, block)
        if sheet.role == "sieve" and "opening" in cols:
            opening = table[cols["opening"].header]
            numeric_open = numeric(opening)
            for raw, value in zip(opening, numeric_open):
                if not math.isfinite(value) and not pd.isna(raw):
                    label = str(raw).strip()
                    if fold(label) in ("pan", "tava"):
                        continue
                    if sieve_opening_mm(label) is None:
                        block("import.issue.sieve_opening_unresolved", sheet, "opening", text=label)
                        break
    return out


def _spt_blockers(plan: ImportPlan, sheet: SheetPlan, table: pd.DataFrame, block) -> None:
    cols = sheet.columns
    if "sampler" in cols:
        for text in sorted({str(v).strip() for v in table[cols["sampler"].header].dropna()}):
            if plan.options.sampler_map.get(text) is None:
                block("import.issue.sampler_unmapped", sheet, "sampler", text=text)
    if "energy_ratio" in cols:
        values = numeric(table[cols["energy_ratio"].header])
        values = values[np.isfinite(values)]
        scale = plan.options.energy_ratio_scale
        if values.size:
            low = bool((values <= 1.0).any())
            if scale == "fraction" and bool((values > 1.0).any()):
                block("import.issue.energy_ratio_scale", sheet, "energy_ratio")
            elif scale != "fraction" and low:
                block("import.issue.energy_ratio_scale", sheet, "energy_ratio")


def _samples_blockers(plan: ImportPlan, sheet: SheetPlan, table: pd.DataFrame, block) -> None:
    cols = sheet.columns
    if "gamma" in cols and sheet.role == "samples":
        gamma = numeric(table[cols["gamma"].header])
        gamma = gamma[np.isfinite(gamma)]
        if gamma.size and not (GAMMA_RANGE[0] <= float(np.median(gamma)) <= GAMMA_RANGE[1]):
            block("import.issue.unit_implausible", sheet, "gamma", unit=cols["gamma"].unit)
    if "w" in cols:
        w = numeric(table[cols["w"].header])
        w = w[np.isfinite(w)]
        scale = plan.options.water_content_scale
        if w.size and scale is None and float(w.max()) <= 1.0:
            block("import.issue.water_content_scale", sheet, "w")
        if w.size and scale == "fraction" and float(w.max()) > 1.0:
            block("import.issue.water_content_scale", sheet, "w")
