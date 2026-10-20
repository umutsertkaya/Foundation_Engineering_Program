"""Dependency-free stdio MCP server that answers code-map queries without reading source files.

The graph is rebuilt lazily whenever a scanned file's mtime changes, so answers are never stale.
Reuses tools/gen_code_map.py scanners (static ast/regex only; no project code is imported or run).
Run: python tools/codemap_mcp.py   (JSON-RPC over stdio, newline-delimited)
"""

from __future__ import annotations

import ast
from collections import defaultdict, deque
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_code_map as g  # noqa: E402

ROOT = g.ROOT
_cache: dict = {"stamp": None, "data": None}


def _stamp() -> float:
    best = 0.0
    for base, suf in ((ROOT / "geotek", (".py",)), (ROOT / "tests", (".py",)), (ROOT / "web" / "src", g.WEB_EXT)):
        for p in g._files(base, suf):
            best = max(best, p.stat().st_mtime)
    return best


def _build() -> dict:
    py = g.scan_python()
    web = g.scan_web()
    tests_of: dict[str, set[str]] = defaultdict(set)
    for tp in g._files(ROOT / "tests", (".py",)):
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
    # unified node ids: python -> repo path; web -> "web/src/<rel>"
    deps: dict[str, set[str]] = {}
    for m, ds in py["deps"].items():
        deps[g._rel(py["files"][m], ROOT)] = {g._rel(py["files"][d], ROOT) for d in ds}
    for f, ds in web["deps"].items():
        deps["web/src/" + f] = {"web/src/" + d for d in ds}
    users: dict[str, set[str]] = defaultdict(set)
    for f, ds in deps.items():
        for d in ds:
            users[d].add(f)
    tests = {g._rel(py["files"][m], ROOT): sorted(t) for m, t in tests_of.items()}
    return {"deps": deps, "users": users, "tests": tests, "routes": g.scan_routes(), "web": web, "py": py}


def data() -> dict:
    s = _stamp()
    if _cache["stamp"] != s:
        _cache.update(stamp=s, data=_build())
    return _cache["data"]


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


def t_file(a: dict) -> str:
    f, err = resolve(a["file"])
    if not f:
        return err
    d = data()
    prod_users = [u for u in d["users"].get(f, ()) if not _is_test(u)]
    test_users = [u for u in d["users"].get(f, ()) if _is_test(u)] + d["tests"].get(f, [])
    return (f"{f}\n\nDepends on ({len(d['deps'][f])}):\n{_lst(d['deps'][f])}\n\n"
            f"Used by ({len(prod_users)}):\n{_lst(prod_users)}\n\nTests ({len(set(test_users))}):\n{_lst(set(test_users))}")


def t_impact(a: dict) -> str:
    f, err = resolve(a["file"])
    if not f:
        return err
    d = data()
    depth = int(a.get("max_depth", 4))
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
    seen.pop(f)
    tests = {u for u in seen if _is_test(u)} | set(d["tests"].get(f, []))
    prod = {u: n for u, n in seen.items() if not _is_test(u)}
    lines = [f"Impact of changing {f} (transitive users up to depth {depth}):"]
    for n in range(1, depth + 1):
        lvl = sorted(u for u, k in prod.items() if k == n)
        if lvl:
            lines.append(f"depth {n}:\n{_lst(lvl)}")
    lines.append(f"Tests to run ({len(tests)}):\n{_lst(tests)}")
    return "\n\n".join(lines)


def t_route(a: dict) -> str:
    q = a["query"].lower()
    rows = [r for r in data()["routes"] if q in r[1].lower() or q in r[3].lower() or q in r[2].lower()]
    if not rows:
        return "No route matches."
    web = data()["web"]["calls"]
    out = []
    for meth, path, where, handler in rows[:40]:
        callers = [f for f, cs in web.items() for m, u in cs if m == meth and _tail_match(path, u)]
        out.append(f"{meth} {path}  ->  {where} ({handler})" + (f"  <- web: {', '.join('web/src/' + c for c in sorted(set(callers)))}" if callers else ""))
    return "\n".join(out)


def _tail_match(route: str, call: str) -> bool:
    import re
    r = re.sub(r"\{[^}]*\}", "{}", route.replace("/api", "", 1))
    return r == call


def t_find(a: dict) -> str:
    q = a["text"].lower()
    hits = sorted(f for f in data()["deps"] if q in f.lower() and (a.get("include_tests") or not _is_test(f)))
    return _lst(hits[:60]) + (f"\n(+{len(hits) - 60} more)" if len(hits) > 60 else "")


def t_overview(a: dict) -> str:
    d = data()
    groups: dict[str, int] = defaultdict(int)
    for f in d["deps"]:
        if _is_test(f):
            continue
        parts = f.split("/")
        key = "/".join(parts[:3]) if parts[0] == "web" and parts[2] == "modules" else "/".join(parts[:2])
        groups[key] += 1
    return ("Production files per area (use code_map_file / code_map_impact / code_map_route / code_map_find for detail):\n"
            + "\n".join(f"- {k}: {v}" for k, v in sorted(groups.items())))


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
    return ("Package pairs importing each other: " + (", ".join(f"{a_}<->{b}" for a_, b in cyc) or "none")
            + "\nModule-to-module imports (forbidden by CLAUDE.md): " + (", ".join(f"{a_}->{b}" for a_, b in cross) or "none"))


TOOLS = {
    "code_map_file": (t_file, "Direct dependencies, users and tests of one file (repo path, dotted module, or unique substring).",
                      {"file": {"type": "string"}}, ["file"]),
    "code_map_impact": (t_impact, "Transitive users of a file by depth plus tests to run: what may break if it changes.",
                        {"file": {"type": "string"}, "max_depth": {"type": "integer"}}, ["file"]),
    "code_map_route": (t_route, "Find API routes by path/handler/file substring: handler location and web callers.",
                       {"query": {"type": "string"}}, ["query"]),
    "code_map_find": (t_find, "Find files by name substring.",
                      {"text": {"type": "string"}, "include_tests": {"type": "boolean"}}, ["text"]),
    "code_map_overview": (t_overview, "File counts per area; start here when unsure.", {}, []),
    "code_map_check": (t_check, "Structural smells: package import cycles and module-to-module imports.", {}, []),
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
