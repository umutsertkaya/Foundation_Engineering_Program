"""CSV / Excel import of CPT and SPT field data.

Columns are matched by alias (Turkish or English, case-insensitive). A unit written in
the header, e.g. ``qc (MPa)``, is used unless the caller passes an explicit unit.
Turkish-style CSV (``;`` separator, ``,`` decimal) is detected automatically.
"""

from __future__ import annotations

import re
from pathlib import Path

import numpy as np
import pandas as pd

from geotek.core.errors import ImportDataError, UnitError
from geotek.core.models.investigations import Borehole, CPTSounding, SPTRecord
from geotek.core.units import convert, dimension_of

ALIASES: dict[str, tuple[str, ...]] = {
    "depth": ("depth", "derinlik", "z", "d"),
    "qc": ("qc", "conetip", "tipresistance", "uçdirenci", "ucdirenci", "konidirenci"),
    "fs": ("fs", "sleevefriction", "sürtünme", "surtunme", "çevresürtünmesi", "cevresurtunmesi"),
    "u2": ("u2", "u", "porepressure", "boşluksuyubasıncı", "bosluksuyubasinci"),
    "n": ("n", "spt", "sptn", "nfield", "n30", "darbesayısı", "darbesayisi"),
}

DEFAULT_UNITS = {"depth": "m", "qc": "MPa", "fs": "kPa", "u2": "kPa"}
SI_UNITS = {"depth": "m", "qc": "kPa", "fs": "kPa", "u2": "kPa"}

_UNIT_IN_HEADER = re.compile(r"[\(\[]\s*([^\)\]]+?)\s*[\)\]]")


def _normalise(header: str) -> str:
    text = _UNIT_IN_HEADER.sub("", str(header))
    return re.sub(r"[\s_\-\.]+", "", text).lower()


def _header_unit(header: str) -> str | None:
    match = _UNIT_IN_HEADER.search(str(header))
    if not match:
        return None
    unit = match.group(1)
    try:
        dimension_of(unit)
    except UnitError:
        return None
    return unit


def read_table(path: str | Path, sheet: str | int | None = None) -> pd.DataFrame:
    path = Path(path)
    suffix = path.suffix.lower()
    try:
        if suffix in (".xlsx", ".xlsm", ".xls"):
            return pd.read_excel(path, sheet_name=0 if sheet is None else sheet)
        if suffix in (".csv", ".txt"):
            with open(path, encoding="utf-8-sig") as fh:
                first = fh.readline()
            if "\t" in first:
                sep, decimal = "\t", "."
            elif first.count(";") > first.count(","):
                sep, decimal = ";", ","
            else:
                sep, decimal = ",", "."
            return pd.read_csv(path, sep=sep, decimal=decimal, encoding="utf-8-sig")
    except (OSError, ValueError) as exc:
        raise ImportDataError(f"Cannot read {path.name}: {exc}") from exc
    raise ImportDataError(f"Unsupported file type: {suffix}")


def map_columns(
    df: pd.DataFrame, required: tuple[str, ...], optional: tuple[str, ...] = ()
) -> dict[str, str]:
    """Return {canonical name: column header} for the required and found optional columns."""
    by_norm = {_normalise(col): col for col in df.columns}
    found: dict[str, str] = {}
    for name in required + optional:
        for alias in ALIASES[name]:
            if alias in by_norm:
                found[name] = by_norm[alias]
                break
    missing = [name for name in required if name not in found]
    if missing:
        raise ImportDataError(
            f"Required column(s) not found: {missing}; columns in file: {list(df.columns)}"
        )
    return found


def _column_si(df, header: str, name: str, unit: str | None) -> np.ndarray:
    unit = unit or _header_unit(header) or DEFAULT_UNITS[name]
    values = pd.to_numeric(df[header], errors="coerce").to_numpy(dtype=float)
    return np.asarray(convert(values, unit, SI_UNITS[name]), dtype=float)


def import_cpt(
    path: str | Path,
    sounding_id: str,
    *,
    sheet: str | int | None = None,
    depth_unit: str | None = None,
    qc_unit: str | None = None,
    fs_unit: str | None = None,
    u2_unit: str | None = None,
    **sounding_kwargs,
) -> CPTSounding:
    """Read a CPT(u) table; qc/fs/u2 are converted to kPa, depth to m.

    Rows with a missing depth, qc or fs value are dropped.
    """
    df = read_table(path, sheet)
    cols = map_columns(df, ("depth", "qc", "fs"), ("u2",))
    units = {"depth": depth_unit, "qc": qc_unit, "fs": fs_unit, "u2": u2_unit}
    data = {name: _column_si(df, header, name, units[name]) for name, header in cols.items()}

    keep = ~(np.isnan(data["depth"]) | np.isnan(data["qc"]) | np.isnan(data["fs"]))
    u2 = None
    if "u2" in data:
        u2_col = np.nan_to_num(data["u2"][keep], nan=0.0)
        u2 = u2_col.tolist()
    if not keep.any():
        raise ImportDataError(f"No valid CPT rows in {Path(path).name}")
    return CPTSounding(
        id=sounding_id,
        depth=data["depth"][keep].tolist(),
        qc=data["qc"][keep].tolist(),
        fs=data["fs"][keep].tolist(),
        u2=u2,
        **sounding_kwargs,
    )


_REFUSAL = re.compile(r"^\s*(\d+)\s*/\s*(\d+)\s*$")


def _parse_n(raw) -> tuple[int, bool]:
    """Parse a blow count; ``"50/12"`` (blows/penetration) is read as refusal."""
    if isinstance(raw, (int, float, np.integer, np.floating)) and not pd.isna(raw):
        return int(round(float(raw))), False
    match = _REFUSAL.match(str(raw))
    if match:
        return int(match.group(1)), True
    try:
        return int(round(float(str(raw).replace(",", ".")))), False
    except ValueError:
        raise ImportDataError(f"Cannot interpret SPT value {raw!r}") from None


def import_spt(
    path: str | Path,
    borehole_id: str,
    *,
    sheet: str | int | None = None,
    depth_unit: str | None = None,
    **borehole_kwargs,
) -> Borehole:
    df = read_table(path, sheet)
    cols = map_columns(df, ("depth", "n"))
    depth = _column_si(df, cols["depth"], "depth", depth_unit)
    records = []
    for z, raw in zip(depth, df[cols["n"]]):
        if np.isnan(z) or pd.isna(raw):
            continue
        n, refusal = _parse_n(raw)
        records.append(SPTRecord(depth=float(z), n_field=n, refusal=refusal))
    if not records:
        raise ImportDataError(f"No valid SPT rows in {Path(path).name}")
    return Borehole(id=borehole_id, spt=records, **borehole_kwargs)
