"""Convert a confirmed ``ImportPlan`` and its file into investigation records."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from pydantic import ValidationError

from geotek.core.errors import ImportDataError
from geotek.core.models.investigations import Borehole, CPTSounding, LabRecord, SPTRecord
from geotek.core.units import convert
from geotek.core.warning_codes import format_warning, parse_warning
from geotek.engine.insitu.spt import REFUSAL_BLOWS
from geotek.engine.lab.atterberg import (
    liquid_limit_multipoint,
    liquid_limit_one_point,
    plasticity,
)
from geotek.engine.lab.sieve import sieve_analysis
from geotek.engine.lab.triaxial import CUTest, reduce_cu
from geotek.io.tabular import _parse_n
from geotek.io.workbook.detect import (
    LENGTH_MM,
    TARGET_UNITS,
    fold,
    numeric,
    read_sheets,
    sheet_table,
)
from geotek.io.workbook.schema import ImportPlan, SheetPlan

DRIVE_SEATING_M = 0.15
"""The first 150 mm of the drive is seating and is not counted in N."""


@dataclass
class ImportResult:
    boreholes: list[Borehole] = field(default_factory=list)
    cpts: list[CPTSounding] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


class _Sheet:
    """A plan sheet bound to its table, with unit-converted column access."""

    def __init__(self, plan: SheetPlan, table: pd.DataFrame):
        self.plan, self.table = plan, table
        for field_name, col in plan.columns.items():
            if col.header not in table.columns:
                raise ImportDataError(f"Sheet {plan.name!r}: column {col.header!r} not found")

    def has(self, name: str) -> bool:
        return name in self.plan.columns

    def raw(self, name: str) -> pd.Series:
        return self.table[self.plan.columns[name].header]

    def num(self, name: str) -> np.ndarray:
        values = numeric(self.raw(name))
        col = self.plan.columns[name]
        unit, target = col.unit, TARGET_UNITS.get(name)
        if name in ("borehole_diameter", "opening"):
            return values * LENGTH_MM.get(unit or "mm", 1.0)
        if unit and target and unit != target:
            return np.asarray(convert(values, unit, target), dtype=float)
        return values

    def text(self, name: str) -> list[str | None]:
        if not self.has(name):
            return [None] * len(self.table)
        return [None if pd.isna(v) or str(v).strip() == "" else str(v).strip() for v in self.raw(name)]


def _ids(sheet: _Sheet, default: str) -> list[str]:
    if sheet.has("point_id"):
        return [v or default for v in sheet.text("point_id")]
    return [default] * len(sheet.table)


def _prefixed(warning: str, **context) -> str:
    code, params = parse_warning(warning)
    return format_warning(code, **{**params, **context})


def build_import(data: bytes, filename: str, plan: ImportPlan) -> ImportResult:
    """Build records from the confirmed plan; raises ``ImportDataError`` while questions are open."""
    if open_questions := plan.blockers():
        codes = ", ".join(sorted({i.code for i in open_questions}))
        raise ImportDataError(f"The import plan still has open questions: {codes}")
    frames = read_sheets(data, filename)
    sheets: dict[str, _Sheet] = {}
    for sp in plan.sheets:
        if sp.role is None:
            continue
        if sp.name not in frames:
            raise ImportDataError(f"Sheet {sp.name!r} not found in the file")
        sheets[sp.role] = _Sheet(sp, sheet_table(frames[sp.name], sp.header_row))
    result = ImportResult()
    boreholes: dict[str, Borehole] = {}
    if "spt" in sheets:
        _build_spt(sheets["spt"], plan, boreholes, result)
    if "cpt" in sheets:
        _build_cpt(sheets["cpt"], plan, result)
    if "samples" in sheets:
        _build_lab(sheets, plan, boreholes, result)
    result.boreholes = list(boreholes.values())
    taken = [b.id for b in result.boreholes] + [c.id for c in result.cpts]
    if len(set(taken)) != len(taken):
        raise ImportDataError("Borehole and CPT ids in the import must be distinct")
    if not result.boreholes and not result.cpts:
        raise ImportDataError("The workbook holds no importable CPT, SPT or laboratory data")
    return result


# --- CPT -----------------------------------------------------------------------------------

def _build_cpt(sheet: _Sheet, plan: ImportPlan, result: ImportResult) -> None:
    ids = _ids(sheet, plan.options.cpt_id or "CPT-1")
    depth, qc, fs = sheet.num("depth"), sheet.num("qc"), sheet.num("fs")
    u2 = sheet.num("u2") if sheet.has("u2") else None
    for sid in dict.fromkeys(ids):
        rows = [i for i, v in enumerate(ids) if v == sid]
        keep = [i for i in rows if np.isfinite(depth[i]) and np.isfinite(qc[i]) and np.isfinite(fs[i])]
        dropped = len(rows) - len(keep)
        if dropped:
            result.warnings.append(format_warning(
                "import.warning.rows_dropped", sheet=sheet.plan.name, count=dropped))
        if not keep:
            raise ImportDataError(f"No valid CPT rows for {sid!r}")
        keep.sort(key=lambda i: depth[i])
        u2_list = None
        if u2 is not None:
            vals = u2[keep]
            if np.isfinite(vals).any() and not (plan.options.u2_zero_is_missing and not vals[np.isfinite(vals)].any()):
                u2_list = [None if not math.isfinite(v) else float(v) for v in vals]
            else:
                result.warnings.append(format_warning("import.warning.u2_not_measured", sheet=sheet.plan.name))
        try:
            result.cpts.append(CPTSounding(
                id=sid, depth=[float(depth[i]) for i in keep], qc=[float(qc[i]) for i in keep],
                fs=[float(fs[i]) for i in keep], u2=u2_list))
        except ValidationError as exc:
            raise ImportDataError(f"CPT {sid!r}: {exc.errors()[0]['msg']}") from exc


# --- SPT -----------------------------------------------------------------------------------

def _build_spt(sheet: _Sheet, plan: ImportPlan, boreholes: dict[str, Borehole], result: ImportResult) -> None:
    ids = _ids(sheet, plan.options.borehole_id or "BH-1")
    count = len(sheet.table)
    start = sheet.num("drive_start") if sheet.has("drive_start") else np.full(count, math.nan)
    end = sheet.num("drive_end") if sheet.has("drive_end") else np.full(count, math.nan)
    depth = sheet.num("depth") if sheet.has("depth") else np.full(count, math.nan)
    from_drive = ~np.isfinite(depth) & np.isfinite(start) & np.isfinite(end)
    # Representative depth = middle of the counted drive (after the 150 mm seating drive).
    depth = np.where(from_drive, np.round((start + DRIVE_SEATING_M + end) / 2.0, 6), depth)
    if from_drive.any():
        result.warnings.append(format_warning(
            "import.warning.spt_depth_from_drive", sheet=sheet.plan.name, count=int(from_drive.sum())))
    blows = [sheet.num(f) if sheet.has(f) else None for f in ("blow1", "blow2", "blow3")]
    n_raw = sheet.raw("n") if sheet.has("n") else None
    rod = sheet.num("rod_length") if sheet.has("rod_length") else None
    dia = sheet.num("borehole_diameter") if sheet.has("borehole_diameter") else None
    er = sheet.num("energy_ratio") if sheet.has("energy_ratio") else None
    if er is not None and plan.options.energy_ratio_scale == "fraction":
        er = er * 100.0
    samplers, notes = sheet.text("sampler"), sheet.text("description")
    records: dict[str, list[SPTRecord]] = {}
    dropped = 0
    for i, sid in enumerate(ids):
        if not math.isfinite(depth[i]) or depth[i] <= 0:
            dropped += 1
            continue
        triple = [b[i] if b is not None else math.nan for b in blows]
        have_blows = all(math.isfinite(v) for v in triple)
        refusal = False
        if n_raw is not None and not pd.isna(n_raw.iloc[i]):
            n, refusal = _parse_n(n_raw.iloc[i])
        elif have_blows:
            n = int(round(triple[1] + triple[2]))
        else:
            dropped += 1
            continue
        if have_blows and max(triple) >= REFUSAL_BLOWS:
            refusal = True
        sampler = None
        if samplers[i] is not None:
            sampler = plan.options.sampler_map.get(samplers[i])
        try:
            record = SPTRecord(
                depth=float(depth[i]), n_field=n, refusal=refusal,
                blows=[int(round(v)) for v in triple] if have_blows else None,
                drive_start=float(start[i]) if math.isfinite(start[i]) else None,
                drive_end=float(end[i]) if math.isfinite(end[i]) else None,
                rod_length=float(rod[i]) if rod is not None and math.isfinite(rod[i]) else None,
                energy_ratio=float(er[i]) if er is not None and math.isfinite(er[i]) else None,
                borehole_diameter_mm=float(dia[i]) if dia is not None and math.isfinite(dia[i]) else None,
                sampler=sampler, notes=(notes[i] or "")[:200])
        except ValidationError as exc:
            raise ImportDataError(f"SPT row {i + 1} in {sheet.plan.name!r}: {exc.errors()[0]['msg']}") from exc
        records.setdefault(sid, []).append(record)
    if dropped:
        result.warnings.append(format_warning(
            "import.warning.rows_dropped", sheet=sheet.plan.name, count=dropped))
    for sid, recs in records.items():
        try:
            boreholes[sid] = Borehole(id=sid, spt=recs)
        except ValidationError as exc:
            raise ImportDataError(f"Borehole {sid!r}: {exc.errors()[0]['msg']}") from exc
    if not records:
        raise ImportDataError(f"No valid SPT rows in {sheet.plan.name!r}")


# --- Laboratory ------------------------------------------------------------------------------

_RECON = re.compile(r"reconstitut|remold|remould|re-?compact|yeniden|bozulmus|karistirilmis")
_UNDIST = re.compile(r"undisturbed|intact|orselenmemis|shelby|block")


def _specimen(text: str | None):
    if not text:
        return None
    folded = fold(text)
    if _RECON.search(folded):
        return "reconstituted"
    if _UNDIST.search(folded):
        return "undisturbed"
    return None


def _build_lab(sheets: dict[str, _Sheet], plan: ImportPlan, boreholes: dict[str, Borehole],
               result: ImportResult) -> None:
    samples = sheets["samples"]
    default_bh = plan.options.borehole_id or "BH-1"
    sample_ids = samples.text("sample_id")
    holes = _ids(samples, default_bh)
    depth = samples.num("depth")
    gamma = samples.num("gamma") if samples.has("gamma") else None
    w = numeric(samples.raw("w")) if samples.has("w") else None
    gs = numeric(samples.raw("Gs")) if samples.has("Gs") else None
    mass = numeric(samples.raw("sieve_mass")) if samples.has("sieve_mass") else None
    prep = samples.text("specimen")
    info: dict[str, dict] = {}
    for i, sid in enumerate(sample_ids):
        if sid is None or not math.isfinite(depth[i]):
            continue
        if sid in info:
            raise ImportDataError(f"Duplicate sample id {sid!r} in {samples.plan.name!r}")
        info[sid] = {"hole": holes[i], "depth": float(depth[i]), "notes": [], "specimen": _specimen(prep[i]),
                     "gamma": _pos(gamma, i), "w": _nonneg(w, i), "Gs": _pos(gs, i), "mass": _pos(mass, i)}
    if "sieve" in sheets:
        _lab_sieve(sheets["sieve"], info, result)
    if "limits" in sheets:
        _lab_limits(sheets["limits"], info, result)
    if "cu_setup" in sheets and "cu_curves" in sheets:
        _lab_cu(sheets["cu_setup"], sheets["cu_curves"], info, plan, result)
    for sid, d in info.items():
        values = {k: d[k] for k in ("gamma", "w", "Gs", "gravel", "FC", "D10", "D30", "D60", "LL", "PL",
                                      "PI", "c_eff", "phi_eff") if d.get(k) is not None}
        try:
            record = LabRecord(depth=d["depth"], sample_id=sid, specimen=d["specimen"],
                               notes="; ".join(d["notes"]), **values)
        except ValidationError as exc:
            raise ImportDataError(f"Sample {sid!r}: {exc.errors()[0]['msg']}") from exc
        hole = boreholes.setdefault(d["hole"], Borehole(id=d["hole"]))
        boreholes[d["hole"]] = hole.model_copy(update={"lab": [*hole.lab, record]})


def _pos(array, i):
    return float(array[i]) if array is not None and math.isfinite(array[i]) and array[i] > 0 else None


def _nonneg(array, i):
    return float(array[i]) if array is not None and math.isfinite(array[i]) and array[i] >= 0 else None


def _sample_rows(sheet: _Sheet, info: dict, result: ImportResult):
    """Group sheet rows by sample id; unknown samples are reported and skipped."""
    groups: dict[str, list[int]] = {}
    for i, sid in enumerate(sheet.text("sample_id")):
        if sid is None:
            continue
        if sid not in info:
            result.warnings.append(format_warning(
                "import.warning.sample_unknown", sheet=sheet.plan.name, sample_id=sid))
            continue
        groups.setdefault(sid, []).append(i)
    return groups


def _lab_sieve(sheet: _Sheet, info: dict, result: ImportResult) -> None:
    sizes = sheet.num("opening")
    mass = numeric(sheet.raw("retained"))
    labels = sheet.text("opening")
    pans = sheet.text("pan") if sheet.has("pan") else [None] * len(sizes)
    for sid, rows in _sample_rows(sheet, info, result).items():
        pan = None
        openings, retained = [], []
        for i in rows:
            if not math.isfinite(sizes[i]) and labels[i] and fold(labels[i]) in ("pan", "tava"):
                pan = float(mass[i]) if math.isfinite(mass[i]) else None
            elif math.isfinite(sizes[i]) and math.isfinite(mass[i]):
                openings.append(float(sizes[i]))
                retained.append(float(mass[i]))
            if pans[i] is not None:
                pan = float(numeric(pd.Series([pans[i]]))[0])
        total = info[sid]["mass"]
        if total is None and pan is None:
            result.warnings.append(format_warning("import.warning.sieve_no_total", sample_id=sid))
            continue
        try:
            sv = sieve_analysis(openings, retained, total_dry_mass_g=total, pan_g=pan)
        except ValueError as exc:
            result.warnings.append(format_warning(
                "import.warning.reduction_failed", sample_id=sid, test="sieve", reason=str(exc)))
            continue
        info[sid].update(gravel=sv.gravel, FC=sv.fines, D10=sv.D10, D30=sv.D30, D60=sv.D60)
        info[sid]["notes"].append("gravel, fines, D-values: sieve analysis")
        result.warnings.extend(_prefixed(w, sample_id=sid) for w in sv.warnings)


_LL = re.compile(r"^(ll|liquid.*|likit.*)$")
_PL = re.compile(r"^(pl|plastic.*|plastik.*)$")
_NP = re.compile(r"^(np|non ?plastic.*|plastik degil.*)$")


def _lab_limits(sheet: _Sheet, info: dict, result: ImportResult) -> None:
    tests = [fold(t) if t else "" for t in sheet.text("test")]
    w = numeric(sheet.raw("w"))
    blows = numeric(sheet.raw("blows")) if sheet.has("blows") else np.full(len(w), math.nan)
    for sid, rows in _sample_rows(sheet, info, result).items():
        ll_rows = [i for i in rows if _LL.match(tests[i]) and math.isfinite(w[i])]
        pl_rows = [i for i in rows if _PL.match(tests[i]) and math.isfinite(w[i])]
        not_rollable = any(_NP.match(tests[i]) for i in rows)
        ll = None
        pairs = [i for i in ll_rows if math.isfinite(blows[i])]
        try:
            if len(pairs) >= 2:
                fit = liquid_limit_multipoint([blows[i] for i in pairs], [w[i] for i in pairs])
                ll = fit.ll
                info[sid]["notes"].append(f"LL: flow curve ({fit.n_points} points, R2={fit.r2:.3f})"
                                          if fit.r2 is not None else f"LL: flow curve ({fit.n_points} points)")
                result.warnings.extend(_prefixed(x, sample_id=sid) for x in fit.warnings)
            elif len(pairs) == 1:
                ll, warns = liquid_limit_one_point(float(blows[pairs[0]]), float(w[pairs[0]]))
                info[sid]["notes"].append("LL: one-point method")
                result.warnings.extend(_prefixed(x, sample_id=sid) for x in warns)
            elif ll_rows:
                ll = float(np.mean([w[i] for i in ll_rows]))
                info[sid]["notes"].append("LL: entered value")
            pl = plasticity(ll, [float(w[i]) for i in pl_rows], not_rollable=not_rollable)
        except ValueError as exc:
            result.warnings.append(format_warning(
                "import.warning.reduction_failed", sample_id=sid, test="limits", reason=str(exc)))
            continue
        result.warnings.extend(_prefixed(x, sample_id=sid) for x in pl.warnings)
        info[sid]["LL"] = ll
        if pl.non_plastic:
            info[sid].update(PI=0.0, PL=None)
        else:
            info[sid].update(PL=pl.pl, PI=pl.pi)


def _lab_cu(setup: _Sheet, curves: _Sheet, info: dict, plan: ImportPlan, result: ImportResult) -> None:
    test_ids = setup.text("test_id")
    consolidation, cell = setup.num("consolidation"), setup.num("cell")
    back = setup.num("back_pressure") if setup.has("back_pressure") else None
    b_val = numeric(setup.raw("b_value")) if setup.has("b_value") else None
    sample_of = setup.text("sample_id")
    if not setup.has("sample_id"):
        if len(info) != 1:
            raise ImportDataError("CU setup has no sample id column and several samples exist")
        sample_of = [next(iter(info))] * len(test_ids)
    cid = curves.text("test_id")
    strain, q, u = numeric(curves.raw("strain")), curves.num("q"), curves.num("u")
    by_sample: dict[str, list[CUTest]] = {}
    for i, tid in enumerate(test_ids):
        sid = sample_of[i]
        if tid is None or sid is None or sid not in info:
            continue
        rows = [j for j, c in enumerate(cid) if c == tid
                and math.isfinite(strain[j]) and math.isfinite(q[j]) and math.isfinite(u[j])]
        rows.sort(key=lambda j: strain[j])
        if len(rows) < 2:
            result.warnings.append(format_warning(
                "import.warning.reduction_failed", sample_id=sid, test=tid, reason="CU curve has < 2 points"))
            continue
        by_sample.setdefault(sid, []).append(CUTest(
            test_id=tid, consolidation_eff=float(consolidation[i]), cell_total=float(cell[i]),
            strain_percent=[float(strain[j]) for j in rows], q=[float(q[j]) for j in rows],
            u=[float(u[j]) for j in rows],
            B=float(b_val[i]) if b_val is not None and math.isfinite(b_val[i]) else None,
            back_pressure=float(back[i]) if back is not None and math.isfinite(back[i]) else None))
    for sid, tests in by_sample.items():
        try:
            cu = reduce_cu(tests, criterion=plan.options.cu_failure,
                           strain_limit=plan.options.cu_strain_limit, specimen=info[sid]["specimen"])
        except ValueError as exc:
            result.warnings.append(format_warning(
                "import.warning.reduction_failed", sample_id=sid, test="cu", reason=str(exc)))
            continue
        info[sid].update(c_eff=max(cu.effective.c, 0.0), phi_eff=cu.effective.phi_deg)
        info[sid]["notes"].append(
            f"c', phi': CU triaxial, {len(tests)} tests, failure = {cu.criterion}")
        result.warnings.extend(_prefixed(x, sample_id=sid) for x in cu.warnings)
