"""Generate docs/CODE_MAP.md: import graph of the backend (geotek/) and web (web/src/).

Static scan only (ast + regex); imports nothing from the project, installs nothing.
Usage: python tools/gen_code_map.py [--check] [--out PATH]
"""

from __future__ import annotations

import argparse
import ast
from collections import defaultdict
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "docs" / "CODE_MAP.md"
SKIP_DIRS = {"__pycache__", "node_modules", "dist", ".venv"}
WEB_EXT = (".ts", ".tsx")
HTTP_VERBS = {"get", "post", "put", "delete", "patch"}


# ---------------------------------------------------------------- helpers

def _files(base: Path, suffixes: tuple[str, ...]) -> list[Path]:
    out = [
        p for p in base.rglob("*")
        if p.is_file() and p.suffix in suffixes and not (SKIP_DIRS & set(p.parts))
    ]
    return sorted(out)


def _rel(p: Path, base: Path) -> str:
    return p.relative_to(base).as_posix()


def _mid(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_]", "_", name)


def _loc(p: Path) -> int:
    return sum(1 for _ in p.open(encoding="utf-8", errors="replace"))


# ---------------------------------------------------------------- backend

def py_module_name(path: Path) -> str:
    parts = list(path.relative_to(ROOT).with_suffix("").parts)
    if parts[-1] == "__init__":
        parts.pop()
    return ".".join(parts)


def py_group(module: str) -> str:
    """Package granularity for the diagram: geotek.<pkg>[.<sub>] (modules/engine split one deeper)."""
    parts = module.split(".")
    if len(parts) <= 1:
        return "geotek"
    if parts[1] in ("modules", "engine", "core") and len(parts) > 2:
        sub = parts[2]
        if parts[1] == "core" and not (ROOT / "geotek" / "core" / sub).is_dir():
            return "geotek.core"
        if parts[1] == "modules" and sub.startswith("_"):
            return "geotek.modules"
        return ".".join(parts[:3])
    return ".".join(parts[:2])


def scan_python() -> dict:
    files = _files(ROOT / "geotek", (".py",))
    known = {py_module_name(p): p for p in files}
    deps: dict[str, set[str]] = {}
    for mod, path in known.items():
        is_pkg = path.name == "__init__.py"
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        found: set[str] = set()
        for node in ast.walk(tree):
            targets: list[str] = []
            if isinstance(node, ast.Import):
                targets = [a.name for a in node.names]
            elif isinstance(node, ast.ImportFrom):
                if node.level:
                    pkg = mod.split(".") if is_pkg else mod.split(".")[:-1]
                    pkg = pkg[: len(pkg) - (node.level - 1)]
                    base = ".".join(pkg + ([node.module] if node.module else []))
                else:
                    base = node.module or ""
                targets = [base] + [f"{base}.{a.name}" for a in node.names]
            for t in targets:
                if t.split(".")[0] != "geotek":
                    continue
                # resolve to the longest known module prefix
                parts = t.split(".")
                while parts and ".".join(parts) not in known:
                    parts.pop()
                if parts and ".".join(parts) != mod:
                    found.add(".".join(parts))
        deps[mod] = found
    return {"files": known, "deps": deps}


ROUTE_RE = re.compile(r"@(\w+)\.(get|post|put|delete|patch)\(\s*[\"']([^\"']*)[\"']")
ROUTER_RE = re.compile(r"^(\w+)\s*=\s*APIRouter\(", re.M)


def scan_routes() -> list[tuple[str, str, str, str]]:
    """(METHOD, full path, file:line, handler) for FastAPI decorators."""
    rows = []
    for path in _files(ROOT / "geotek" / "api", (".py",)) + _files(ROOT / "geotek" / "modules", (".py",)):
        rel = _rel(path, ROOT)
        mod = re.match(r"geotek/modules/(\w+)/", rel)
        prefix = f"/api/m/{mod.group(1)}" if mod else "/api"
        lines = path.read_text(encoding="utf-8").splitlines()
        for i, line in enumerate(lines):
            m = ROUTE_RE.search(line)
            if not m or m.group(2) not in HTTP_VERBS:
                continue
            handler = ""
            for j in range(i, min(i + 8, len(lines))):
                d = re.match(r"\s*(?:async\s+)?def\s+(\w+)", lines[j])
                if d:
                    handler = d.group(1)
                    break
            rows.append((m.group(2).upper(), prefix + m.group(3), f"{rel}:{i + 1}", handler))
    return sorted(rows, key=lambda r: (r[1], r[0]))


# ---------------------------------------------------------------- web

IMPORT_RE = re.compile(
    r"""(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']"""
    r"""|import\(\s*["']([^"']+)["']\s*\)"""
    r"""|vi\.mock\(\s*["']([^"']+)["']"""
)
REQ_RE = re.compile(r"""request(?:<[^()]*?>)?\(\s*["'](\w+)["']\s*,\s*[`"']([^`"']+)[`"']""")


def web_resolve(src: Path, spec: str, known: set[Path]) -> Path | None:
    if not spec.startswith("."):
        return None
    base = (src.parent / spec).resolve()
    cands = [base] + [Path(str(base) + e) for e in WEB_EXT] + [base / ("index" + e) for e in WEB_EXT]
    for c in cands:
        if c in known:
            return c
    return None


def web_group(rel: str) -> str:
    parts = rel.split("/")
    if parts[0] == "modules" and len(parts) > 1:
        return f"modules/{parts[1]}"
    return parts[0] if len(parts) > 1 else "(root)"


def scan_web() -> dict:
    base = ROOT / "web" / "src"
    files = _files(base, WEB_EXT)
    known = {p.resolve() for p in files}
    deps: dict[str, set[str]] = {}
    calls: dict[str, list[tuple[str, str]]] = {}
    for p in files:
        rel = _rel(p, base)
        text = p.read_text(encoding="utf-8")
        found: set[str] = set()
        for m in IMPORT_RE.finditer(text):
            spec = m.group(1) or m.group(2) or m.group(3)
            tgt = web_resolve(p, spec, known)
            if tgt is not None and tgt != p.resolve():
                found.add(_rel(tgt, base))
        deps[rel] = found
        c = [(m.group(1).upper(), re.sub(r"\$\{[^}]*\}", "{}", m.group(2))) for m in REQ_RE.finditer(text)]
        if c:
            calls[rel] = c
    return {"files": [_rel(p, base) for p in files], "deps": deps, "calls": calls, "base": base}


# ---------------------------------------------------------------- render

def is_test(rel: str) -> bool:
    return "__tests__" in rel or rel.startswith("test/") or ".test." in rel


def edges_between(deps: dict[str, set[str]], group) -> dict[tuple[str, str], int]:
    agg: dict[tuple[str, str], int] = defaultdict(int)
    for src, ts in deps.items():
        for t in ts:
            a, b = group(src), group(t)
            if a != b:
                agg[(a, b)] += 1
    return agg


def mermaid(groups: list[str], agg: dict[tuple[str, str], int]) -> list[str]:
    out = ["```mermaid", "graph LR"]
    for g in groups:
        out.append(f'  {_mid(g)}["{g}"]')
    for (a, b), n in sorted(agg.items()):
        out.append(f"  {_mid(a)} -->|{n}| {_mid(b)}")
    out.append("```")
    return out


def render() -> str:
    py = scan_python()
    pdeps = py["deps"]
    short = lambda m: m[len("geotek."):] if m.startswith("geotek.") else m
    py_prod = {m: d for m, d in pdeps.items()}
    py_users: dict[str, set[str]] = defaultdict(set)
    for m, ds in py_prod.items():
        for d in ds:
            py_users[d].add(m)

    # tests -> modules
    tests_of: dict[str, set[str]] = defaultdict(set)
    for tp in _files(ROOT / "tests", (".py",)):
        try:
            tree = ast.parse(tp.read_text(encoding="utf-8"))
        except SyntaxError:
            continue
        for node in ast.walk(tree):
            names = []
            if isinstance(node, ast.Import):
                names = [a.name for a in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
                names = [node.module] + [f"{node.module}.{a.name}" for a in node.names]
            for n in names:
                parts = n.split(".")
                while parts and ".".join(parts) not in pdeps:
                    parts.pop()
                if parts and parts[0] == "geotek":
                    tests_of[".".join(parts)].add(_rel(tp, ROOT)[len("tests/"):])

    web = scan_web()
    wdeps = web["deps"]
    w_users: dict[str, set[str]] = defaultdict(set)
    for f, ds in wdeps.items():
        for d in ds:
            w_users[d].add(f)

    L: list[str] = []
    L += [
        "# Kod haritası (bağımlılık şeması)",
        "",
        "> **Üretilmiş dosya — elle düzenlemeyin.** `python tools/gen_code_map.py` ile yeniden üretin; "
        "`--check` günceli değilse 1 döner. Yalnız statik import taraması yapar (ast + regex); "
        "dinamik/yansıma ile yüklenen bağlar (ör. `geotek/api/registry.py` modül keşfi) görünmez.",
        "",
        "Hata ararken: önce ilgili paketi şemada bul, sonra dosya tablosunda **Bağımlı olduğu** (aşağı yön) "
        "ve **Kullanan** (yukarı yön) sütunlarına bak. Hesap hatası genelde `engine/` → `services/` → "
        "`modules/<id>/api.py` → `api/` zincirinin birindedir; arayüz hatası `web/src/modules/<id>/pages` → "
        "`api.ts` → `shared/api/http.ts` zincirindedir.",
        "",
        "Okuma: `a → b` = a, b'yi import eder. Sayılar paketler arası import kenarı adedidir.",
        "",
        "## 1. Backend (`geotek/`)",
        "",
    ]
    pgroup = py_group
    groups = sorted({pgroup(m) for m in pdeps})
    agg = edges_between(pdeps, pgroup)
    # hide the legacy PySide6 UI from the main diagram to keep it readable
    main_groups = [g for g in groups if g not in ("geotek.ui", "geotek.plotting")]
    main_agg = {k: v for k, v in agg.items() if k[0] in main_groups and k[1] in main_groups}
    L += ["### Paket diyagramı (web-yolu; eski `ui`/`plotting` ayrı listelenir)", ""]
    L += mermaid(main_groups, main_agg)
    legacy = sorted((a, b, n) for (a, b), n in agg.items() if a in ("geotek.ui", "geotek.plotting"))
    L += ["", "Eski PySide6 yolu (`geotek.ui`, `geotek.plotting`) bağları: " +
          (", ".join(f"{a}→{b} ({n})" for a, b, n in legacy) or "yok") + ".", ""]

    L += ["### Paket bağımlılık tablosu", "", "| Paket | Dosya | Bağımlı olduğu paketler |", "|---|---:|---|"]
    for g in groups:
        n = sum(1 for m in pdeps if pgroup(m) == g)
        outs = sorted({b for (a, b) in agg if a == g})
        L.append(f"| `{g}` | {n} | {', '.join(f'`{o}`' for o in outs) or '—'} |")

    L += ["", "### Backend API rotaları", "",
          "Modül rotaları `/api/m/<id>` altında bağlanır (`geotek/api/registry.py`); diğerleri `/api` altında.", "",
          "| Metot | Yol | Yer | İşleyici |", "|---|---|---|---|"]
    for meth, path, where, handler in scan_routes():
        L.append(f"| {meth} | `{path}` | `{where}` | `{handler}` |")

    L += ["", "### Backend dosya tablosu", "",
          "Test sütunu: o dosyayı doğrudan import eden `tests/` dosyaları (yoksa `—`).", ""]
    by_group: dict[str, list[str]] = defaultdict(list)
    for m in sorted(pdeps):
        by_group[pgroup(m)].append(m)
    for g in groups:
        L += [f"#### `{g}`", "", "| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |", "|---|---:|---|---|---|"]
        for m in by_group[g]:
            p = py["files"][m]
            deps = ", ".join(f"`{short(d)}`" for d in sorted(pdeps[m])) or "—"
            users = sorted(py_users.get(m, ()))
            ustr = ", ".join(f"`{short(u)}`" for u in users[:6]) or "—"
            if len(users) > 6:
                ustr += f" +{len(users) - 6}"
            ts = sorted(tests_of.get(m, ()))
            tstr = ", ".join(f"`{t}`" for t in ts[:3]) or "—"
            if len(ts) > 3:
                tstr += f" +{len(ts) - 3}"
            L.append(f"| `{_rel(p, ROOT)[len('geotek/'):]}` | {_loc(p)} | {deps} | {ustr} | {tstr} |")
        L.append("")

    # ---- web
    L += ["## 2. Web (`web/src/`)", ""]
    wfiles = web["files"]
    prod = [f for f in wfiles if not is_test(f)]
    wgroups = sorted({web_group(f) for f in prod})
    wagg = edges_between({f: {d for d in wdeps[f] if not is_test(d)} for f in prod}, web_group)
    L += ["### Klasör diyagramı (testler hariç)", ""]
    L += mermaid(wgroups, wagg)
    L += ["", "| Klasör | Dosya | Bağımlı olduğu klasörler |", "|---|---:|---|"]
    for g in wgroups:
        n = sum(1 for f in prod if web_group(f) == g)
        outs = sorted({b for (a, b) in wagg if a == g})
        L.append(f"| `{g}` | {n} | {', '.join(f'`{o}`' for o in outs) or '—'} |")

    L += ["", "### Web → backend çağrıları", "",
          "`request(\"METHOD\", \"/yol\")` çağrıları; yol `/api` önekiyle backend rotalarına denk gelir. "
          "`${…}` değişkenleri `{}` ile gösterilir.", "",
          "| Dosya | Çağrılar |", "|---|---|"]
    for f in sorted(web["calls"]):
        if is_test(f) or "/mock" in f or f.endswith("mock.ts"):
            continue
        cs = web["calls"][f]
        L.append(f"| `{f}` | " + "<br>".join(f"{m} `{u}`" for m, u in cs) + " |")

    L += ["", "### Web dosya tablosu", "",
          "Testler yalnız **Kullanan** sütununda görünür; “Test” sütunu o dosyayı import eden test dosyalarıdır.", ""]
    by_w: dict[str, list[str]] = defaultdict(list)
    for f in prod:
        by_w[web_group(f)].append(f)
    for g in wgroups:
        L += [f"#### `{g}`", "", "| Dosya | Satır | Bağımlı olduğu | Kullanan | Test |", "|---|---:|---|---|---|"]
        for f in sorted(by_w[g]):
            deps = sorted(d for d in wdeps[f] if not is_test(d))
            dstr = ", ".join(f"`{d}`" for d in deps) or "—"
            users = sorted(u for u in w_users.get(f, ()) if not is_test(u))
            ustr = ", ".join(f"`{u}`" for u in users[:5]) or "—"
            if len(users) > 5:
                ustr += f" +{len(users) - 5}"
            ts = sorted(u for u in w_users.get(f, ()) if is_test(u))
            tstr = ", ".join(f"`{t}`" for t in ts[:3]) or "—"
            if len(ts) > 3:
                tstr += f" +{len(ts) - 3}"
            L.append(f"| `{f}` | {_loc(web['base'] / f)} | {dstr} | {ustr} | {tstr} |")
        L.append("")
    return "\n".join(L).rstrip() + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="exit 1 if the output file is stale")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()
    text = render()
    if args.check:
        cur = args.out.read_text(encoding="utf-8") if args.out.exists() else ""
        if cur.replace("\r\n", "\n") != text:
            print(f"{args.out} is stale; run: python tools/gen_code_map.py", file=sys.stderr)
            return 1
        return 0
    args.out.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {args.out} ({len(text.splitlines())} lines)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
