"""Dependency-free stdio MCP server for a cached, statically scanned source graph.

Queries rescan source identity/content and rebuild when files change, appear or disappear.
Reuses tools/gen_code_map.py scanners; no application code is imported or executed.
Run: python tools/codemap_mcp.py   (JSON-RPC over stdio, newline-delimited)
"""

from __future__ import annotations

import ast
from collections import defaultdict, deque
import hashlib
import json
from pathlib import Path
import re
import sys
import threading
import unicodedata

try:
    from . import gen_code_map as g
except ImportError:  # direct stdio script invocation
    import gen_code_map as g

ROOT = g.ROOT
_cache: dict = {"stamp": None, "data": None}
_cache_lock = threading.RLock()
LIMITATIONS = [
    "Static source graph; relationships do not prove runtime execution or engineering correctness.",
    "Python imports include type-only and conditional imports; tests are linked by direct imports, not coverage or fixture inference.",
    "Web imports and request calls use a bounded lexical scan; arbitrary URL builders and runtime reflection are not evaluated.",
    "API mounts follow this repository's /api and /api/m/<id> convention and literal APIRouter prefixes.",
    "Discovery expands known Python module manifests and literal Vite globs; JSON catalogs/assets and external packages are outside this graph.",
]
ALIASES = {
    "sheetpile": ("palplans", "sheetpile"), "create": ("olustur", "create", "ekle"),
    "wall": ("duvar", "wall", "istinat"), "size": ("boyut", "siz"),
    "suggest": ("oneri", "oner", "suggest", "propos"), "soil": ("zemin", "soil"),
    "layer": ("katman", "layer"), "parameter": ("parametr", "parameter"),
    "approve": ("onay", "approv"), "liquefaction": ("sivilas", "liquef"),
    "seismic": ("deprem", "seismic", "earthquake"), "factor": ("katsayi", "factor"),
    "cancel": ("iptal", "cancel"), "result": ("sonuc", "result"),
    "profile": ("profil",), "page": ("ekran", "sayfa", "page"),
    "analysis": ("hesap", "analiz", "analys"), "track": ("takip", "takib", "izle", "track", "poll"),
    "service": ("servis", "service"), "save": ("kaydet", "save"),
}
STOP_WORDS = {"ve", "bir", "icin", "ile", "olan", "bu", "the", "and", "of", "to", "in", "is",
              "hangi", "nerede", "dosya", "bul", "degistir", "want", "change"}
DOMAINS = {"sheetpile", "wall", "soil", "liquefaction", "parameter", "layer", "seismic", "factor"}


def _terms(text: str) -> set[str]:
    text = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", text)
    text = "".join(ch for ch in unicodedata.normalize("NFKD", text.lower().replace("ı", "i"))
                   if not unicodedata.combining(ch))
    text = re.sub(r"sheet[\s_-]+pile", "sheetpile", text)
    words = re.findall(r"[a-z0-9]+", text)
    return {next((canonical for canonical, prefixes in ALIASES.items()
                  if any(word.startswith(prefix) for prefix in prefixes)), word)
            for word in words if len(word) > 1 and word not in STOP_WORDS}


def _number(a: dict, key: str, default: int, maximum: int) -> int:
    return max(1, min(maximum, int(a.get(key, default))))


def _compact(text: str, a: dict, default: int = 2500, maximum: int = 3500) -> str:
    budget = _number(a, "max_chars", default, maximum)
    if len(text) <= budget:
        return text
    suffix = "\n[TRUNCATED; narrow the query/limit or increase max_chars.]"
    return (text[:max(0, budget - len(suffix))].rstrip() + suffix)[:budget]


def _stamp() -> str:
    digest = hashlib.sha256(str(ROOT.resolve()).encode())
    for base, suf in ((ROOT / "geotek", (".py",)), (ROOT / "tests", (".py",)), (ROOT / "web" / "src", g.WEB_EXT)):
        for p in g._files(base, suf):
            try:
                stat = p.stat()
                content = p.read_bytes()
            except FileNotFoundError:  # a save/delete can race the directory scan
                continue
            identity = (g._rel(p, ROOT), stat.st_mtime_ns, stat.st_size)
            digest.update(json.dumps(identity, ensure_ascii=True).encode())
            digest.update(hashlib.sha256(content).digest())
    return digest.hexdigest()


def _area(file: str) -> str:
    parts = file.split("/")
    if _is_test(file):
        return "web/src/" + g.web_group("/".join(parts[2:])) if parts[0] == "web" else "tests"
    if parts[:2] == ["web", "src"]:
        return "web/src/" + g.web_group("/".join(parts[2:])) if len(parts) > 3 else "web/src"
    if len(parts) > 3 and parts[1] in {"modules", "engine", "core"}:
        return "/".join(parts[:3])
    return "/".join(parts[:-1])


def _build(fingerprint: str) -> dict:
    py = g.scan_python()
    web = g.scan_web()
    tests_of: dict[str, set[str]] = defaultdict(set)
    python_tests = []
    for tp in g._files(ROOT / "tests", (".py",)):
        python_tests.append(g._rel(tp, ROOT))
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
                while parts and ".".join(parts) not in py["deps"]:
                    parts.pop()
                if parts and parts[0] == "geotek":
                    tests_of[".".join(parts)].add(g._rel(tp, ROOT))
    # Keep imports separate from API/discovery so boundary checks remain meaningful.
    deps: dict[str, set[str]] = {}
    for m, ds in py["deps"].items():
        deps[g._rel(py["files"][m], ROOT)] = {g._rel(py["files"][d], ROOT) for d in ds}
    for f, ds in web["deps"].items():
        deps["web/src/" + f] = {"web/src/" + d for d in ds}
    for file in python_tests:
        deps[file] = set()
    tests = {g._rel(py["files"][m], ROOT): sorted(t) for m, t in tests_of.items()}
    for target, files in tests.items():
        for test in files:
            deps[test].add(target)
    edges = {(source, target, "test" if _is_test(source) else "import")
             for source, targets in deps.items() for target in targets}
    edges.update((source, target, "discovery") for source, target in g.scan_discovery(py, web))
    routes = g.scan_routes()
    callers = g.route_callers(routes, web)
    route_rows = []
    for method, path, where, handler in routes:
        file, line = where.rsplit(":", 1)
        files = callers[(method, path, where, handler)]
        edges.update((caller, file, "api") for caller in files)
        route_rows.append({"method": method, "path": path, "file": file,
                           "line": int(line), "handler": handler, "callers": files})
    users: dict[str, set[str]] = defaultdict(set)
    for source, target, _ in edges:
        users[target].add(source)
    snapshot = {
        "fingerprint": fingerprint,
        "nodes": [{"id": file, "label": Path(file).name, "area": _area(file),
                   "kind": "test" if _is_test(file) else "web" if file.startswith("web/") else "python"}
                  for file in sorted(deps)],
        "edges": [{"source": source, "target": target, "kind": kind}
                  for source, target, kind in sorted(edges)],
        "routes": route_rows,
        "limitations": list(LIMITATIONS),
    }
    symbols = {file: g.scan_symbols(ROOT / file) for file in deps}
    index = {file: {"path": _terms(file), "name": _terms(Path(file).stem),
                    "symbols": [(symbol, _terms(symbol["qualified"])) for symbol in symbols[file]],
                    "route_links": []}
             for file in deps if not _is_test(file)}
    for route in route_rows:
        words = _terms(route["path"] + " " + route["handler"])
        queue = deque((file, 0) for file in [route["file"], *route["callers"]])
        seen = set()
        while queue:
            file, distance = queue.popleft()
            if file in seen or file not in index:
                continue
            seen.add(file)
            index[file]["route_links"].append((distance, words))
            if distance < 2:
                queue.extend((target, distance + 1) for target in sorted(deps[file]))
    return {"deps": deps, "users": users, "tests": tests, "routes": routes,
            "web": web, "py": py, "snapshot": snapshot, "symbols": symbols, "index": index}


def data() -> dict:
    with _cache_lock:
        stamp = _stamp()
        if _cache["stamp"] != stamp:
            _cache.update(stamp=stamp, data=_build(stamp))
        return _cache["data"]


def graph_snapshot() -> dict:
    """Return a deterministic JSON-safe graph; callers may mutate their copy."""
    return json.loads(json.dumps(data()["snapshot"]))


def resolve(q: str) -> tuple[str | None, str]:
    d = data()["deps"]
    q = q.strip().replace("\\", "/")
    if q in d:
        return q, ""
    dotted = q.replace(".", "/")
    cands = [f for f in d if f.endswith(q) or f.endswith(dotted + ".py") or f.endswith(dotted + "/__init__.py")]
    if not cands:
        cands = [f for f in d if q.lower() in f.lower()]
    if len(cands) == 1:
        return cands[0], ""
    if not cands:
        return None, f"No file matches {q!r}."
    return None, "Ambiguous, candidates:\n" + "\n".join(sorted(cands)[:20])


def _is_test(f: str) -> bool:
    return f.startswith("tests/") or "__tests__" in f or ".test." in f or f.startswith("web/src/test/")


def _lst(items) -> str:
    items = sorted(items)
    return "\n".join(f"- {i}" for i in items) if items else "- (none)"


def _test_evidence(file: str, d: dict, depth: int = 2) -> dict[str, tuple[int, str]]:
    """Actual import edges, including tests of nearby production users."""
    evidence = {}
    seen = {file}
    queue = deque([(file, 0)])
    while queue:
        current, distance = queue.popleft()
        for user in sorted(d["users"].get(current, ())):
            if _is_test(user):
                if Path(user).name.startswith("test_") or ".test." in user:
                    evidence.setdefault(user, (distance, current))
            elif distance < depth and user not in seen:
                seen.add(user)
                queue.append((user, distance + 1))
    return evidence


def t_target(a: dict) -> str:
    """Rank file/symbol/route names only; never read or dump source here."""
    goal = str(a["goal"])[:5000]
    terms = _terms(goal)
    if not terms:
        return _compact("No searchable terms. Add a module and an action (e.g. palplanş oluşturma).", a, 1800)
    d = data()
    ranked = []
    for file, record in d["index"].items():
        best = sorted(record["symbols"], key=lambda pair: (
            -len(terms & pair[1]), pair[0]["name"].startswith("_"), pair[0]["qualified"].count("."),
            len(pair[0]["name"]), pair[0]["start"]))
        symbol, symbol_terms = best[0] if best else (None, set())
        declared_terms = set().union(*(words for _, words in record["symbols"]))
        matching = terms & (record["path"] | declared_terms)
        if not matching:
            continue
        score = 3 * len(terms & record["path"]) + 5 * len(terms & record["name"]) + 5 * len(terms & symbol_terms)
        score += 8 * len(matching & DOMAINS)
        score += 6 * len((terms & declared_terms) - symbol_terms)
        route_bonus = max((len(terms & words) * (12 if distance == 0 else 10 if distance == 1 else 2)
                           for distance, words in record["route_links"]), default=0)
        score += route_bonus
        if terms & DOMAINS and not matching & DOMAINS:
            score *= 0.25
        if "service" in terms and file.startswith("geotek/services/"):
            score += 12
        if "analysis" in terms and file.startswith(("geotek/services/", "geotek/engine/")):
            score += 10
        if "page" in terms and file.startswith("web/"):
            score += 8
        if "/mock/" in file or file.endswith("mock.ts") or file.endswith("schema.d.ts"):
            score *= 0.25
        ranked.append((-score, file, symbol, matching))
    ranked.sort(key=lambda row: (row[0], row[1]))
    selected = ranked[:_number(a, "limit", 3, 3)]
    if not selected:
        return _compact("No filename, symbol or route-name match. Try a module ID or exact symbol; no confidence inferred.", a, 1800)
    lines = ["Goal: " + goal[:140], "Lexical name matches; not runtime confidence."]
    for number, (_, file, symbol, matching) in enumerate(selected, 1):
        location = f":{symbol['start']}-{symbol['end']}" if symbol else " (no indexed declaration)"
        lines.append(f"{number}. {file}{location}")
        if symbol:
            lines.append(f"   {symbol['qualified']}; terms={','.join(sorted(matching))}")
        else:
            lines.append(f"   filename terms={','.join(sorted(matching))}")
    first = selected[0]
    advice = f'Next: code_map_read(file="{first[1]}"'
    advice += f', symbol="{first[2]["qualified"]}"' if first[2] else ", start_line=1"
    lines.append(advice + ", max_lines=40).")

    # Nearest route means a file-level import/call link, not a proven function call.
    relations = defaultdict(set)
    for edge in d["snapshot"]["edges"]:
        if edge["kind"] != "test":
            relations[edge["source"]].add(edge["target"])
    reached = {}
    queue = deque((file, 0) for _, file, _, _ in selected)
    while queue:
        file, distance = queue.popleft()
        if file in reached:
            continue
        reached[file] = distance
        if distance < 2:
            queue.extend((target, distance + 1) for target in sorted(relations[file] | d["users"].get(file, set()))
                         if not _is_test(target))
    route_hits = []
    for route in d["snapshot"]["routes"]:
        linked = [reached[file] for file in [route["file"], *route["callers"]] if file in reached]
        if not linked:
            continue
        words = _terms(route["path"] + " " + route["handler"])
        match = len(terms & words)
        if not match:
            continue
        structure_bonus = 3 if terms & {"sheetpile", "wall"} and "/structures" in route["path"] else 0
        route_hits.append((-(match + structure_bonus), min(linked), route["path"], route["method"], route))
    for _, distance, _, _, route in sorted(route_hits, key=lambda row: row[:4])[:2]:
        lines.append(f"Route[file link {distance}]: {route['method']} {route['path']} -> {route['file']}:{route['line']} {route['handler']}")
    if not route_hits:
        lines.append("Route: no nearby literal-route match; not evidence of absence.")
    evidence = {}
    for _, file, _, _ in selected:
        for test, item in _test_evidence(file, d).items():
            if test not in evidence or item[0] < evidence[test][0]:
                evidence[test] = item
    for test, (distance, via) in sorted(evidence.items(), key=lambda item: (
            item[1][0], -len(terms & _terms(item[0])), item[0]))[:3]:
        label = "direct import" if distance == 0 else f"indirect static link +{distance} via {Path(via).name}"
        lines.append(f"Test[{label}]: {test}")
    if not evidence:
        lines.append("Tests: no import link found; not an 'untested' verdict.")
    return _compact("\n".join(lines), a, 1800)


def t_read(a: dict) -> str:
    query = str(a["file"]).replace("\\", "/")
    if ".." in query.split("/") or Path(query).is_absolute() or ":" in query:
        return _compact("Denied: use a scanned repository-relative source path without traversal.", a, 3000, 5000)
    file, error = resolve(query)
    if not file:
        return _compact(error, a, 3000, 5000)
    path = ROOT / file
    if not path.resolve().is_relative_to(ROOT.resolve()) or path.suffix not in {".py", ".ts", ".tsx"}:
        return _compact("Denied: source resolves outside the scanned repository.", a, 3000, 5000)
    d = data()
    symbol = None
    if a.get("symbol"):
        if "start_line" in a:
            return _compact("Choose symbol OR start_line, not both.", a, 3000, 5000)
        candidates = [s for s in d["symbols"][file] if a["symbol"] in {s["name"], s["qualified"]}]
        if len(candidates) != 1:
            return _compact("Symbol missing or ambiguous; use an exact indexed symbol or start_line.", a, 3000, 5000)
        symbol = candidates[0]
    source = path.read_text(encoding="utf-8").splitlines()
    start = symbol["start"] if symbol else int(a.get("start_line", 1))
    if not 1 <= start <= len(source):
        return _compact(f"Invalid start_line; source has {len(source)} lines.", a, 3000, 5000)
    ceiling = symbol["end"] if symbol else len(source)
    end = min(ceiling, start + _number(a, "max_lines", 40, 80) - 1)
    budget = _number(a, "max_chars", 3000, 5000)
    header = f"{file} | requested {start}-{end}; file lines={len(source)}\n"
    output = []
    last = start - 1

    def footer(after: int) -> str:
        remaining = f"{after + 1}-{ceiling}" if after < ceiling else "none in selection"
        continuation = f' Next: code_map_read(file="{file}", start_line={after + 1}).' if after < ceiling else ""
        marker = " [TRUNCATED]" if after < ceiling else ""
        return f"\nRemaining: {remaining}.{marker}{continuation}"

    for number in range(start, end + 1):
        line = f"{number}: {source[number - 1]}\n"
        if len(header) + sum(map(len, output)) + len(line) + len(footer(number)) > budget:
            break
        output.append(line)
        last = number
    return _compact(header + "".join(output) + footer(last), a, 3000, 5000)


def t_file(a: dict) -> str:
    f, err = resolve(a["file"])
    if not f:
        return _compact(err, a)
    d = data()
    prod_users = [u for u in d["users"].get(f, ()) if not _is_test(u)]
    test_users = [u for u in d["users"].get(f, ()) if _is_test(u)] + d["tests"].get(f, [])
    limit = _number(a, "limit", 8, 20)
    return _compact(f"{f}\n\nDepends on ({len(d['deps'][f])}):\n{_lst(sorted(d['deps'][f])[:limit])}\n\n"
                    f"Used by ({len(prod_users)}):\n{_lst(sorted(prod_users)[:limit])}\n\nTests ({len(set(test_users))}):\n{_lst(sorted(set(test_users))[:limit])}"
                    + ("\n[TRUNCATED lists; raise limit or narrow file.]" if any(
                        len(items) > limit for items in (d['deps'][f], prod_users, set(test_users))) else ""), a)


def t_impact(a: dict) -> str:
    f, err = resolve(a["file"])
    if not f:
        return _compact(err, a)
    d = data()
    depth = _number(a, "max_depth", 2, 6)
    seen = {f: 0}
    q = deque([f])
    while q:
        cur = q.popleft()
        if seen[cur] >= depth:
            continue
        for u in d["users"].get(cur, ()):
            if u not in seen:
                seen[u] = seen[cur] + 1
                q.append(u)
    tests = {u for u in seen if _is_test(u)}
    for reached in seen:
        tests.update(d["tests"].get(reached, []))
        tests.update(u for u in d["users"].get(reached, ()) if _is_test(u))
    seen.pop(f)
    prod = {u: n for u, n in seen.items() if not _is_test(u)}
    lines = [f"Impact of changing {f} (transitive users up to depth {depth}):"]
    limit = _number(a, "limit", 12, 30)
    shown = 0
    for n in range(1, depth + 1):
        lvl = sorted(u for u, k in prod.items() if k == n)[:max(0, limit - shown)]
        shown += len(lvl)
        if lvl:
            lines.append(f"depth {n}:\n{_lst(lvl)}")
    lines.append(f"Tests to run ({len(tests)}, import evidence):\n{_lst(sorted(tests)[:limit])}")
    if len(prod) > shown or len(tests) > limit:
        lines.append("[TRUNCATED lists; raise bounded depth/limit or narrow file.]")
    return _compact("\n\n".join(lines), a)


def t_route(a: dict) -> str:
    q = a["query"].lower()
    rows = [r for r in data()["snapshot"]["routes"]
            if q in r["path"].lower() or q in r["handler"].lower() or q in r["file"].lower()]
    if not rows:
        return _compact("No route matches.", a)
    out = []
    limit = _number(a, "limit", 5, 15)
    for row in rows[:limit]:
        callers = row["callers"]
        out.append(f"{row['method']} {row['path']}  ->  {row['file']}:{row['line']} ({row['handler']})"
                   + (f"  <- web: {', '.join(callers)}" if callers else ""))
    if len(rows) > limit:
        out.append(f"[TRUNCATED: {len(rows) - limit} more routes; narrow query or raise limit.]")
    return _compact("\n".join(out), a)


def _tail_match(route: str, call: str) -> bool:
    normalized = g.normalize_call_path(call)
    return normalized is not None and g.route_shape(route) == g.route_shape(
        normalized if normalized.startswith("/api/") else "/api" + normalized)


def t_find(a: dict) -> str:
    q = a["text"].lower()
    hits = sorted(f for f in data()["deps"] if q in f.lower() and (a.get("include_tests") or not _is_test(f)))
    limit = _number(a, "limit", 10, 30)
    return _compact(_lst(hits[:limit]) + (f"\n[TRUNCATED: +{len(hits) - limit} more; narrow text or raise limit.]"
                                       if len(hits) > limit else ""), a)


def t_overview(a: dict) -> str:
    d = data()
    groups: dict[str, int] = defaultdict(int)
    for f in d["deps"]:
        if _is_test(f):
            continue
        groups[_area(f)] += 1
    return _compact("Production files per area (start with code_map_target for a goal):\n"
                    + "\n".join(f"- {k}: {v}" for k, v in sorted(groups.items())), a)


def t_check(a: dict) -> str:
    """Cycles between top-level python packages are a cheap structural-bug signal."""
    d = data()["deps"]
    def pkg(f: str) -> str:
        p = f.split("/")
        return "/".join(p[:3]) if p[0] == "geotek" and p[1] in ("modules", "engine") else "/".join(p[:2])
    edges = defaultdict(set)
    for f, ds in d.items():
        if f.startswith("geotek/"):
            for x in ds:
                if pkg(f) != pkg(x):
                    edges[pkg(f)].add(pkg(x))
    cyc = sorted((a_, b) for a_ in edges for b in edges[a_] if a_ in edges.get(b, ()) and a_ < b)
    cross = sorted((a_, b) for a_ in edges for b in edges[a_]
                   if a_.startswith("geotek/modules/") and b.startswith("geotek/modules/") and a_ != b)
    return _compact("Package pairs importing each other: " + (", ".join(f"{a_}<->{b}" for a_, b in cyc) or "none")
                    + "\nModule-to-module imports (forbidden by CLAUDE.md): " + (", ".join(f"{a_}->{b}" for a_, b in cross) or "none"), a)


COMPACT_PARAMS = {
    "max_chars": {"type": "integer", "minimum": 1, "maximum": 3500, "default": 2500},
    "limit": {"type": "integer", "minimum": 1, "maximum": 30},
}
TOOLS = {
    "code_map_target": (t_target, "Start here: a Turkish/English goal -> up to 3 source-backed paths/symbol ranges, nearby routes and import-linked tests. No source dump. Default 1800 chars; hard 3500.",
                        {"goal": {"type": "string", "maxLength": 5000},
                         "limit": {"type": "integer", "minimum": 1, "maximum": 3, "default": 3},
                         "max_chars": {"type": "integer", "minimum": 1, "maximum": 3500, "default": 1800}}, ["goal"]),
    "code_map_read": (t_read, "Read source only when explicitly needed: exact numbered window from one scanned repository file, by symbol OR start_line. Default 40 lines/3000 chars; hard 80/5000; continuation is explicit.",
                      {"file": {"type": "string"}, "symbol": {"type": "string"},
                       "start_line": {"type": "integer", "minimum": 1},
                       "max_lines": {"type": "integer", "minimum": 1, "maximum": 80, "default": 40},
                       "max_chars": {"type": "integer", "minimum": 1, "maximum": 5000, "default": 3000}}, ["file"]),
    "code_map_file": (t_file, "Direct dependencies, users and tests of one file (repo path, dotted module, or unique substring).",
                      {"file": {"type": "string"}, **COMPACT_PARAMS}, ["file"]),
    "code_map_impact": (t_impact, "Transitive users of a file by depth plus tests to run: what may break if it changes.",
                        {"file": {"type": "string"}, "max_depth": {"type": "integer", "minimum": 1, "maximum": 6, "default": 2}, **COMPACT_PARAMS}, ["file"]),
    "code_map_route": (t_route, "Find API routes by path/handler/file substring: handler location and web callers.",
                       {"query": {"type": "string"}, **COMPACT_PARAMS}, ["query"]),
    "code_map_find": (t_find, "Find files by name substring.",
                      {"text": {"type": "string"}, "include_tests": {"type": "boolean"}, **COMPACT_PARAMS}, ["text"]),
    "code_map_overview": (t_overview, "Compact file counts per area; prefer code_map_target for a goal.", {"max_chars": COMPACT_PARAMS["max_chars"]}, []),
    "code_map_check": (t_check, "Structural smells: package import cycles and module-to-module imports.", {"max_chars": COMPACT_PARAMS["max_chars"]}, []),
}


def handle(msg: dict) -> dict | None:
    method, mid = msg.get("method"), msg.get("id")
    if mid is None:
        return None  # notification
    if method == "initialize":
        res = {"protocolVersion": msg.get("params", {}).get("protocolVersion", "2024-11-05"),
               "capabilities": {"tools": {}}, "serverInfo": {"name": "geotek-codemap", "version": "1.0"}}
    elif method == "tools/list":
        res = {"tools": [{"name": n, "description": desc,
                          "inputSchema": {"type": "object", "properties": props, "required": req}}
                         for n, (_, desc, props, req) in TOOLS.items()]}
    elif method == "tools/call":
        p = msg.get("params", {})
        try:
            text, err = TOOLS[p["name"]][0](p.get("arguments") or {}), False
        except Exception as e:  # report tool failures in-band
            text, err = f"{type(e).__name__}: {e}", True
        res = {"content": [{"type": "text", "text": text}], "isError": err}
    elif method == "ping":
        res = {}
    else:
        return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": f"Unknown method {method}"}}
    return {"jsonrpc": "2.0", "id": mid, "result": res}


def main() -> int:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        out = handle(json.loads(line))
        if out is not None:
            sys.stdout.write(json.dumps(out) + "\n")
            sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
