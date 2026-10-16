"""Display labels for engine identifiers (checks, cases, factor paths, factor status)."""

from __future__ import annotations

from geotek.i18n import t

CHECKS = ("overturning", "sliding", "eccentricity", "bearing", "global_stability")
CASES = ("static", "seismic")
FACTOR_STATUSES = ("verified", "secondary", "unverified", "not_in_source", "user")
STATUS_TONE = {"verified": "good", "secondary": "info", "unverified": "warn", "not_in_source": "bad", "user": "user"}

_TBDY_MATERIAL = {"tan_phi": "γRφ", "c_eff": "γRc", "su": "γRcu"}
_EC7_MATERIAL = {"tan_phi": "γφ'", "c_eff": "γc'", "su": "γcu", "gamma": "γγ"}
_LOAD = {"G_unfav": "γG", "G_fav": "γG,fav", "Q_unfav": "γQ", "Q_fav": "γQ,fav", "G_dst": "γG,dst",
         "G_stb": "γG,stb", "Q_dst": "γQ,dst", "Q_stb": "γQ,stb", "EQ": "γEQ"}
_RESIST = {"bearing": "γR;v", "sliding": "γR;h", "earth_resistance": "γR;e", "overturning": "γR;ot",
           "global_stability": "γR;e (global)"}


def check_label(name: str) -> str:
    return t(f"check.{name}") if name in CHECKS else name


def case_label(case: str) -> str:
    return t(f"case.{case}") if case in CASES else case


def governing_label(governing: str) -> str:
    """'seismic:bearing' -> 'Deprem — Taşıma gücü (seismic:bearing)'; lists are joined."""
    if not governing:
        return ""
    if governing == "minimum width":
        return t("ui.wall.min_width")
    out = []
    for item in governing.split(", "):
        case, _, check = item.partition(":")
        if not check:
            out.append(check_label(case))
        else:
            out.append(f"{case_label(case)} — {check_label(check)} ({item})")
    return "; ".join(out)


def status_text(status: str) -> str:
    return t(f"fstatus.{status}") if status in FACTOR_STATUSES else status


def factor_symbol(code_id: str, path: str) -> str:
    """Conventional symbol of a factor (falls back to the last path element)."""
    parts = path.split(".")
    key = parts[-1]
    if code_id == "asd":
        return "e/B" if parts[0] == "eccentricity" else "GS"
    if code_id == "aashto_lrfd":
        if parts[0] == "load":
            return f"γ {parts[1]} {key}"
        if parts[0] == "resistance":
            return "φ"
        return "e/B"
    if len(parts) == 3:
        table = parts[1]
        if table == "material":
            return (_TBDY_MATERIAL if code_id == "tbdy2018" else _EC7_MATERIAL).get(key, f"γ {key}")
        if table == "load":
            return _LOAD.get(key, f"γ {key}")
        if table == "resistance":
            return _RESIST.get(key, f"γR {key}")
    return key
