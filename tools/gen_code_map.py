"""Generate docs/CODE_MAP.md: import graph of the backend (geotek/) and web (web/src/).

Static scan only (ast + regex); imports nothing from the project, installs nothing.
Usage: python tools/gen_code_map.py [--check] [--out PATH]
"""

from __future__ import annotations

import argparse
import ast
from collections import defaultdict
import glob
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
        and p.resolve().is_relative_to(ROOT.resolve())
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


def scan_routes() -> list[tuple[str, str, str, str]]:
    """Read literal FastAPI decorators without importing the application.

    Mount prefixes follow this repository's core /api and module /api/m/<id>
    convention. APIRouter's own literal prefix is added separately.
    Locations point at the handler definition, including multiline decorators.
    """
    rows = []
    for path in _files(ROOT / "geotek" / "api", (".py",)) + _files(ROOT / "geotek" / "modules", (".py",)):
        rel = _rel(path, ROOT)
        mod = re.match(r"geotek/modules/(\w+)/", rel)
        prefix = f"/api/m/{mod.group(1)}" if mod else "/api"
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        routers = {}
        for node in ast.walk(tree):
            if not isinstance(node, ast.Assign) or not isinstance(node.value, ast.Call):
                continue
            constructor = node.value.func
            name = constructor.id if isinstance(constructor, ast.Name) else getattr(constructor, "attr", "")
            if name not in {"APIRouter", "FastAPI"}:
                continue
            own_prefix = next((kw.value.value for kw in node.value.keywords
                               if kw.arg == "prefix" and isinstance(kw.value, ast.Constant)
                               and isinstance(kw.value.value, str)), "")
            for target in node.targets:
                if isinstance(target, ast.Name):
                    routers[target.id] = own_prefix
        for node in ast.walk(tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for dec in node.decorator_list:
                if not (isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute)
                        and isinstance(dec.func.value, ast.Name)
                        and dec.func.value.id in routers and dec.func.attr in HTTP_VERBS):
                    continue
                value = dec.args[0] if dec.args else next(
                    (kw.value for kw in dec.keywords if kw.arg == "path"), None)
                if isinstance(value, ast.Constant) and isinstance(value.value, str):
                    full = prefix + routers[dec.func.value.id] + value.value
                    rows.append((dec.func.attr.upper(), full, f"{rel}:{node.lineno}", node.name))
    return sorted(rows, key=lambda r: (r[1], r[0]))


# ---------------------------------------------------------------- web

IMPORT_RE = re.compile(
    r"""(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']"""
    r"""|import\(\s*["']([^"']+)["']\s*\)"""
    r"""|vi\.mock\(\s*["']([^"']+)["']"""
)
REQ_RE = re.compile(r"""\brequest\s*(?:<[^()]*?>)?\s*\(\s*["'](\w+)["']\s*,\s*[`"']([^`"']+)[`"']""")
GLOB_RE = re.compile(r"""import\.meta\.glob(?:\s*<[\s\S]*?>)?\s*\(\s*["']([^"']+)["']""")


def web_source(text: str) -> str:
    """Remove comments while keeping quoted strings and template literals intact."""
    pattern = r'''("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(/\*[\s\S]*?\*/|//[^\r\n]*)'''
    return re.sub(pattern, lambda m: m.group(1) or "\n" * m.group(0).count("\n"), text)


def scan_symbols(path: Path) -> list[dict]:
    """Source-backed declaration ranges; Python AST and bounded TS declarations."""
    text = path.read_text(encoding="utf-8")
    symbols = []
    if path.suffix == ".py":
        def visit(node: ast.AST, parents: tuple[str, ...] = ()) -> None:
            for child in ast.iter_child_nodes(node):
                nested = isinstance(child, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef))
                if nested:
                    symbols.append({"name": child.name, "qualified": ".".join((*parents, child.name)),
                                    "start": child.lineno, "end": child.end_lineno})
                visit(child, (*parents, child.name) if nested else parents)
        visit(ast.parse(text, filename=str(path)))
    else:
        # Preserve offsets while masking comments/strings, so fixtures cannot
        # introduce fictional declarations and braces inside literals are ignored.
        literals = r'''"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|/\*[\s\S]*?\*/|//[^\r\n]*'''
        masked = re.sub(literals, lambda m: re.sub(r"[^\n]", " ", m.group()), text)
        declarations = re.compile(
            r"(?m)^[ \t]*(?:(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+(?P<fn>[\w$]+)"
            r"|export\s+(?:const|let|class|interface|type)\s+(?P<export>[\w$]+)"
            r"|(?:const|let)\s+(?P<arrow>[\w$]+)[^\n=]*=\s*(?:async\s*)?"
            r"(?:\([^;\n]*\)\s*=>|useCallback(?:<[^>]+>)?\s*\())")

        def closing(start: int, left: str, right: str) -> int:
            depth = 0
            for offset in range(start, len(masked)):
                depth += (masked[offset] == left) - (masked[offset] == right)
                if depth == 0:
                    return offset
            return start

        for match in declarations.finditer(masked):
            name = match.group("fn") or match.group("export") or match.group("arrow")
            search = match.end()
            if match.group("fn"):
                opening = masked.find("(", search)
                if opening >= 0:
                    search = closing(opening, "(", ")") + 1
            elif match.group("arrow") or match.group("export"):
                equals = masked.find("=", match.end() if match.group("export") else match.start())
                initial = masked[equals + 1:].lstrip() if equals >= 0 else ""
                if match.group("arrow") or initial.startswith(("(", "async ", "useCallback")):
                    arrow = masked.find("=>", equals + 1)
                    search = arrow + 2 if arrow >= 0 else search
            body = -1
            position, angle = search, 0
            while position < len(masked):
                char = masked[position]
                angle += (char == "<") - (char == ">" and angle > 0)
                if char == "{" and (angle > 0 or (match.group("fn") and
                        (masked[search:position].strip() == ":" or masked[search:position].rstrip().endswith(("&", "|"))))):
                    position = closing(position, "{", "}") + 1
                    continue
                if char == "{" and angle == 0:
                    body = position
                    break
                if char == ";" and angle == 0:
                    break
                position += 1
            end = closing(body, "{", "}") if body >= 0 else (
                position if position < len(masked) and masked[position] == ";" else -1)
            if end < 0:
                end = masked.find("\n", search)
            symbols.append({"name": name, "qualified": name,
                            "start": text.count("\n", 0, match.start()) + 1,
                            "end": text.count("\n", 0, max(match.end(), end)) + 1})
    return sorted(symbols, key=lambda s: (s["start"], s["end"], s["name"]))


def normalize_call_path(value: str, text: str = "") -> str | None:
    """Resolve only literal path templates and simple literal-return helpers.

    We never evaluate JavaScript. Unknown URL builders and embedded path fragments
    stay unmatched rather than guessing which server operation they represent.
    """
    helper_re = r"const\s+(\w+)\s*=\s*\([^;{}]*\)\s*(?::\s*\w+\s*)?=>\s*`([^`]+)`\s*;"
    helpers = {m.group(1): re.sub(r"\$\{[^}]*\}", "{}", m.group(2))
               for m in re.finditer(helper_re, text)}
    # Recognize a locally declared optional query suffix, not arbitrary suffixes.
    query_re = r'''const\s+(\w+)\s*=\s*[^;\n]*\?\s*`\?[^`]*`\s*:\s*["']{2}\s*;'''
    queries = {m.group(1) for m in re.finditer(query_re, text)}

    def substitute(match: re.Match) -> str:
        expression = match.group(1).strip()
        if expression in queries:
            return ""
        helper = re.fullmatch(r"(\w+)\([^{}]*\)", expression)
        return helpers[helper.group(1)] if helper and helper.group(1) in helpers else "{}"

    value = re.sub(r"\$\{([^}]*)\}", substitute, value).split("?", 1)[0].split("#", 1)[0]
    if not value.startswith("/") or "//" in value:
        return None
    if any(("{" in segment or "}" in segment) and segment != "{}" for segment in value.split("/")):
        return None
    return value


def route_shape(path: str) -> str:
    """Normalize a full API path; only complete path-parameter segments vary."""
    return re.sub(r"(?<=/)\{[^/{}]+\}(?=/|$)", "{}", path)


def route_callers(routes: list, web: dict) -> dict[tuple, list[str]]:
    by_operation: dict[tuple[str, str], set[str]] = defaultdict(set)
    for file, calls in web["calls"].items():
        if is_test(file) or "/mock/" in file or file.endswith("mock.ts"):
            continue
        for method, path in calls:
            full = path if path.startswith("/api/") else "/api" + path
            by_operation[(method, route_shape(full))].add("web/src/" + file)
    return {route: sorted(by_operation.get((route[0], route_shape(route[1])), ()))
            for route in routes}


def scan_discovery(py: dict, web: dict) -> set[tuple[str, str]]:
    """Expand the repository's known manifest discovery and literal Vite globs."""
    edges = set()
    registry = ROOT / "geotek/api/registry.py"
    if registry.is_file():
        registry_tree = ast.parse(registry.read_text(encoding="utf-8"))
        calls = [n for n in ast.walk(registry_tree) if isinstance(n, ast.Call)]
        dynamic_import = any(isinstance(n.func, ast.Name) and n.func.id == "import_module"
                             and n.args and isinstance(n.args[0], ast.JoinedStr)
                             and isinstance(n.args[0].values[0], ast.Constant)
                             and n.args[0].values[0].value == "geotek.modules."
                             for n in calls)
        package_scan = any(isinstance(n.func, ast.Name) and n.func.id == "iter_modules" for n in calls)
        if dynamic_import and package_scan:
            for module, path in py["files"].items():
                if re.fullmatch(r"geotek\.modules\.[a-z][a-z0-9_]*", module) and path.name == "__init__.py":
                    tree = ast.parse(path.read_text(encoding="utf-8"))
                    if any(isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "MANIFEST"
                           for t in n.targets) for n in tree.body):
                        edges.add((_rel(registry, ROOT), _rel(path, ROOT)))
    known = {(web["base"] / f).resolve() for f in web["files"]}
    for file in web["files"]:
        if is_test(file):  # test fixtures can contain illustrative glob source strings
            continue
        path = web["base"] / file
        for pattern in GLOB_RE.findall(web_source(path.read_text(encoding="utf-8"))):
            for matched in glob.glob(str(path.parent / pattern)):
                target = Path(matched).resolve()
                if target in known and target.is_relative_to(ROOT.resolve()):
                    edges.add(("web/src/" + file, _rel(target, ROOT.resolve())))
    return edges


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
        text = web_source(p.read_text(encoding="utf-8"))
        found: set[str] = set()
        for m in IMPORT_RE.finditer(text):
            spec = m.group(1) or m.group(2) or m.group(3)
            tgt = web_resolve(p, spec, known)
            if tgt is not None and tgt != p.resolve():
                found.add(_rel(tgt, base))
        deps[rel] = found
        c = [(m.group(1).upper(), normalized) for m in REQ_RE.finditer(text)
             if m.group(1).lower() in HTTP_VERBS
             and (normalized := normalize_call_path(m.group(2), text)) is not None]
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
    routes = scan_routes()
    callers = route_callers(routes, web)
    discovery = scan_discovery(py, web)
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
        "`--check` günceli değilse 1 döner. Uygulama kodu çalıştırılmadan Python AST ve sınırlı "
        "TypeScript taraması yapılır. Bilinen modül keşfi ve literal Vite glob bağları ayrıca gösterilir.",
        "",
        "Hata ararken: önce ilgili paketi şemada bul, sonra dosya tablosunda **Bağımlı olduğu** (aşağı yön) "
        "ve **Kullanan** (yukarı yön) sütunlarına bak. Hesap hatası genelde `engine/` → `services/` → "
        "`modules/<id>/api.py` → `api/` zincirinin birindedir; arayüz hatası `web/src/modules/<id>/pages` → "
        "`api.ts` → `shared/api/http.ts` zincirindedir.",
        "",
        "Okuma: `a → b` = a, b'yi import eder. Sayılar paketler arası import kenarı adedidir.",
        "",
        "Sınırlar: import grafiği tip/koşullu importları da içerir; çalışma zamanı çağrı grafiği veya "
        "mühendislik doğruluk kanıtı değildir. Test bağlantıları doğrudan importlara dayanır, kapsam ölçümü değildir. "
        "API eşleştirmesi sabit yollar, tam segment parametreleri ve basit literal URL yardımcılarıyla sınırlıdır; "
        "keyfi URL üreticileri, dış paketler, JSON katalogları ve yansıma çalıştırılmaz.",
        "",
        "## 0. Modül keşfi", "",
        "Bunlar import değil, `discovery` bağlarıdır. Paket diyagramlarındaki import sayısına eklenmez.", "",
        "| Keşfeden | Keşfedilen |", "|---|---|",
        *[f"| `{source}` | `{target}` |" for source, target in sorted(discovery)],
        "",
        "## 1. Backend (`geotek/`)",
        "",
    ]
    pgroup = py_group
    groups = sorted({pgroup(m) for m in pdeps})
    agg = edges_between(pdeps, pgroup)
    L += ["### Paket diyagramı", ""]
    L += mermaid(groups, agg)
    L += [""]

    L += ["### Paket bağımlılık tablosu", "", "| Paket | Dosya | Bağımlı olduğu paketler |", "|---|---:|---|"]
    for g in groups:
        n = sum(1 for m in pdeps if pgroup(m) == g)
        outs = sorted({b for (a, b) in agg if a == g})
        L.append(f"| `{g}` | {n} | {', '.join(f'`{o}`' for o in outs) or '—'} |")

    L += ["", "### Backend API rotaları", "",
          "Modül rotaları `/api/m/<id>` altında bağlanır (`geotek/api/registry.py`); diğerleri `/api` altında.", "",
          "Yer sütunu işleyicinin `def` satırıdır; çok satırlı dekoratörler AST ile okunur. "
          "Web sütunu eşleşen HTTP istemcisidir; sayfa çağıranları import grafiğinden izlenir.", "",
          "| Metot | Yol | Yer | İşleyici | Web |", "|---|---|---|---|---|"]
    for meth, path, where, handler in routes:
        clients = ", ".join(f"`{f}`" for f in callers[(meth, path, where, handler)]) or "—"
        L.append(f"| {meth} | `{path}` | `{where}` | `{handler}` | {clients} |")

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
