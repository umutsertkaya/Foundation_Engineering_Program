"""Code-map contracts: real API completeness, bounded links and live cache changes."""

from __future__ import annotations

import json
import os
from pathlib import Path
import re

import pytest

from tools import codemap_mcp as c
from tools import gen_code_map as g


REPOSITORY = Path(__file__).resolve().parents[2]


@pytest.fixture
def isolated_graph(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setattr(g, "ROOT", tmp_path)
    monkeypatch.setattr(c, "ROOT", tmp_path)
    monkeypatch.setattr(c, "_cache", {"stamp": None, "data": None})
    return tmp_path


def write(root: Path, name: str, source: str) -> Path:
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(source, encoding="utf-8", newline="\n")
    return path


def test_real_routes_equal_the_committed_openapi_and_point_to_handlers() -> None:
    contract = json.loads((REPOSITORY / "docs/contracts/openapi.json").read_text(encoding="utf-8"))
    expected = {(method.upper(), path) for path, operations in contract["paths"].items()
                for method in operations if method in g.HTTP_VERBS}
    routes = g.scan_routes()
    assert len(expected) == 65
    assert {(method, path) for method, path, _, _ in routes} == expected
    assert len(routes) == len(expected)
    for _, _, where, handler in routes:
        file, line = where.rsplit(":", 1)
        source = (REPOSITORY / file).read_text(encoding="utf-8").splitlines()
        assert source[int(line) - 1].lstrip().startswith((f"def {handler}(", f"async def {handler}("))


def test_ast_routes_support_multiline_keyword_path_and_router_prefix(isolated_graph: Path) -> None:
    write(isolated_graph, "geotek/api/sample.py", '''
from fastapi import APIRouter
router = APIRouter(prefix="/local")
@router.post(
    path="/item/{id}",
    response_model=dict,
)
async def create_item(id):
    return {}
@unrelated.get("/false-positive")
def ignored():
    pass
''')
    assert g.scan_routes() == [("POST", "/api/local/item/{id}", "geotek/api/sample.py:8", "create_item")]


def test_current_snapshot_contains_api_and_dynamic_discovery_edges() -> None:
    snapshot = c.graph_snapshot()
    edges = {(edge["source"], edge["target"], edge["kind"]) for edge in snapshot["edges"]}
    assert ("web/src/modules/sheet_pile/api.ts", "geotek/modules/sheet_pile/api.py", "api") in edges
    assert ("web/src/modules/soil/api.ts", "geotek/modules/soil/api.py", "api") in edges
    for module in ("soil", "walls", "sheet_pile", "liquefaction"):
        assert ("geotek/api/registry.py", f"geotek/modules/{module}/__init__.py", "discovery") in edges
        assert ("web/src/app/moduleRegistry.ts", f"web/src/modules/{module}/manifest.ts", "discovery") in edges
        assert ("web/src/shared/api/mock/index.ts", f"web/src/modules/{module}/mock.ts", "discovery") in edges
    parameter = next(row for row in snapshot["routes"]
                     if row["path"].endswith("/layers/{layer_id}/parameters") and row["method"] == "GET")
    assert parameter["callers"] == ["web/src/modules/soil/api.ts"]
    required = next(row for row in snapshot["routes"] if row["path"] == "/api/codes/{code_id}/required")
    assert "web/src/shared/api/client.ts" in required["callers"]
    node_ids = {node["id"] for node in snapshot["nodes"]}
    assert all(source in node_ids and target in node_ids for source, target, _ in edges)
    assert all(not c._is_test(source) for source, _, kind in edges if kind == "discovery")
    assert any(node["kind"] == "test" and node["id"] == "tests/api/test_sheet_pile_api.py"
               for node in snapshot["nodes"])
    assert all(set(edge) == {"source", "target", "kind"} for edge in snapshot["edges"])
    assert c.t_route({"query": "design_sheet_pile"}).startswith("POST /api/m/sheet_pile/")


def test_snapshot_is_deterministic_json_safe_and_does_not_expose_cache_mutation() -> None:
    first = c.graph_snapshot()
    second = c.graph_snapshot()
    assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)
    assert first["nodes"] == sorted(first["nodes"], key=lambda node: node["id"])
    first["nodes"].clear()
    first["limitations"].clear()
    assert c.graph_snapshot() == second


def test_cache_detects_added_deleted_and_same_stat_content_changes(isolated_graph: Path) -> None:
    source = write(isolated_graph, "geotek/source.py", "VALUE = 1\n")
    future = write(isolated_graph, "geotek/future.py", "VALUE = 9\n")
    os.utime(future, ns=(9_000_000_000_000_000_000, 9_000_000_000_000_000_000))
    original = c.graph_snapshot()
    old_file = write(isolated_graph, "geotek/old.py", "from geotek import source\n")
    os.utime(old_file, ns=(1_000_000_000, 1_000_000_000))
    added = c.graph_snapshot()
    assert added["fingerprint"] != original["fingerprint"]
    assert any(edge["source"] == "geotek/old.py" and edge["target"] == "geotek/source.py"
               for edge in added["edges"])
    old_file.unlink()
    deleted = c.graph_snapshot()
    assert deleted["fingerprint"] != added["fingerprint"]
    assert not any(node["id"] == "geotek/old.py" for node in deleted["nodes"])
    before = source.stat()
    source.write_text("VALUE = 2\n", encoding="utf-8", newline="\n")
    os.utime(source, ns=(before.st_atime_ns, before.st_mtime_ns))
    changed = c.graph_snapshot()
    assert source.stat().st_size == before.st_size
    assert changed["fingerprint"] != deleted["fingerprint"]


def test_impact_collects_tests_of_transitive_users_and_api_callers(isolated_graph: Path) -> None:
    write(isolated_graph, "geotek/core.py", "VALUE = 1\n")
    write(isolated_graph, "geotek/api/service.py", '''from fastapi import APIRouter
from geotek.core import VALUE
router = APIRouter()
@router.get("/value")
def read_value():
    return VALUE
''')
    write(isolated_graph, "tests/test_service.py", "from geotek.api.service import read_value\n")
    write(isolated_graph, "web/src/api.ts", 'export const read = () => request("GET", "/value");\n')
    write(isolated_graph, "web/src/test/api.test.ts", 'import { read } from "../api";\n')
    impact = c.t_impact({"file": "geotek/core.py", "max_depth": 2})
    assert "geotek/api/service.py" in impact
    assert "web/src/api.ts" in impact
    assert "tests/test_service.py" in impact
    assert "web/src/test/api.test.ts" in impact
    snapshot = c.graph_snapshot()
    assert {"source": "tests/test_service.py", "target": "geotek/api/service.py", "kind": "test"} in snapshot["edges"]


def test_web_paths_are_bounded_and_comments_do_not_create_edges(isolated_graph: Path) -> None:
    write(isolated_graph, "web/src/api.ts", '''
// request("GET", "/not-real");
/* import value from "./fake"; */
const layer_path = (id: string): string => `/profiles/${encodeURIComponent(id)}/layers`;
const qs = params.toString() ? `?${params.toString()}` : "";
request("GET", `${layer_path(id)}/parameters${qs}`);
request("GET", `${unknown_builder()}/parameters`);
request("GET", "/prefix-not-a-match");
''')
    calls = g.scan_web()["calls"]["api.ts"]
    assert calls == [("GET", "/profiles/{}/layers/parameters"), ("GET", "/prefix-not-a-match")]
    assert c._tail_match("/api/profiles/{profile_id}/layers", "/profiles/{}/layers")
    assert not c._tail_match("/api/profiles/{profile_id}/layers", "/profiles/{}/layers/extra")
    assert not c._tail_match("/api/prefix", "/prefix-not-a-match")
    assert not c._tail_match("/api/prefix/{id}", "/prefix/partial{}")


@pytest.mark.parametrize("goal, expected", [
    ("Palplanş oluşturma ekranını değiştir", ["web/src/modules/sheet_pile/pages/SheetPileCreatePage.tsx"]),
    ("Zemin parametrelerini onaylama servisi", ["geotek/services/parameters.py", "geotek/modules/soil/api.py"]),
    ("Duvar boyut önerisi hesap akışı", ["geotek/services/structures.py", "geotek/modules/walls/api.py"]),
    ("Sıvılaşma sonucu ve iş iptali", ["web/src/modules/liquefaction/pages/ResultsPage.tsx", "geotek/api/jobs.py"]),
    ("sheet pile create page", ["web/src/modules/sheet_pile/pages/SheetPileCreatePage.tsx"]),
])
def test_goal_navigation_has_real_ranges_reasons_and_no_source_dump(goal: str, expected: list[str]) -> None:
    output = c.t_target({"goal": goal})
    assert len(output) <= 1800
    assert any(path in output for path in expected)
    assert "terms=" in output and "code_map_read(" in output
    assert "confidence" in output and "not runtime" in output
    matches = re.findall(r"(?m)^\d\. ([^\n]+):(\d+)-(\d+)$", output)
    assert 1 <= len(matches) <= 3
    for file, start, end in matches:
        assert any(symbol["start"] == int(start) and symbol["end"] == int(end)
                   for symbol in c.data()["symbols"][file])
    assert not re.search(r"(?m)^\d+: ", output)
    if "onaylama" in goal:
        assert "   approve;" in output
        assert "_invalidate_delta_approval" not in output


@pytest.mark.parametrize("source", [
    'export const createThing = (input: {id: string}) => {\n  return input.id;\n};\n',
    'export async function load(): Promise<{ok: boolean}> {\n  return {ok:true};\n}\n',
    'export function load(): {ok: boolean} {\n  return {ok:true};\n}\n',
])
def test_typescript_ranges_skip_parameter_and_return_type_braces(isolated_graph: Path, source: str) -> None:
    file = write(isolated_graph, "web/src/inline.ts", source)
    symbol = g.scan_symbols(file)[0]
    assert symbol["start"] == 1 and symbol["end"] == 3
    output = c.t_read({"file": "web/src/inline.ts", "symbol": symbol["name"], "max_lines": 2})
    assert "2:   return" in output
    assert "Remaining: 3-3" in output


def test_read_is_numbered_bounded_and_rejects_traversal_and_unscanned_files() -> None:
    file = "web/src/modules/sheet_pile/pages/SheetPileCreatePage.tsx"
    output = c.t_read({"file": file, "symbol": "SheetPileCreatePage", "max_lines": 3})
    actual = (REPOSITORY / file).read_text(encoding="utf-8").splitlines()
    for number in (13, 14, 15):
        assert f"{number}: {actual[number - 1]}" in output
    assert "Remaining: 16-66" in output and "start_line=16" in output
    assert "TRUNCATED" in output
    for invalid in ("../CLAUDE.md", r"..\CLAUDE.md", str(REPOSITORY / file), "C:/private.py"):
        assert c.t_read({"file": invalid}).startswith("Denied:")
    assert "No file matches" in c.t_read({"file": "CLAUDE.md"})
    assert "Symbol missing" in c.t_read({"file": file, "symbol": "imaginary_symbol"})
    assert "Choose symbol OR" in c.t_read({"file": file, "symbol": "SheetPileCreatePage", "start_line": 1})
    window = c.t_read({"file": "geotek/api/schemas.py", "start_line": 1, "max_lines": 999, "max_chars": 99999})
    assert len(window) <= 5000
    assert len(re.findall(r"(?m)^\d+: ", window)) <= 80


@pytest.mark.parametrize("tool, arguments", [
    (c.t_target, {"goal": "duvar boyut önerisi hesap akışı"}),
    (c.t_file, {"file": "geotek/core/errors.py"}),
    (c.t_find, {"text": "", "include_tests": True}),
    (c.t_route, {"query": ""}),
    (c.t_impact, {"file": "geotek/core/errors.py", "max_depth": 999}),
    (c.t_read, {"file": "geotek/api/schemas.py", "start_line": 1, "max_lines": 999}),
])
def test_total_response_budgets_include_metadata_and_truncation(tool, arguments: dict) -> None:
    for requested in (1, 120, 99999):
        maximum = 5000 if tool is c.t_read else 3500
        output = tool({**arguments, "max_chars": requested, "limit": 999})
        assert len(output) <= min(requested, maximum)
    if tool is not c.t_read:
        assert len(tool(arguments)) <= (1800 if tool is c.t_target else 2500)


def test_goal_index_is_cached_and_refreshes_names_on_file_changes(isolated_graph: Path) -> None:
    source = write(isolated_graph, "web/src/modules/sheet_pile/Create.tsx",
                   "export function SheetPileCreatePage() {\n  return null;\n}\n")
    first = c.data()
    output = c.t_target({"goal": "palplanş oluştur"})
    assert "SheetPileCreatePage" in output
    assert c.data() is first
    source.write_text("export function SheetPileResultPage() {\n  return null;\n}\n", encoding="utf-8", newline="\n")
    assert "SheetPileResultPage" in c.t_target({"goal": "palplanş sonuç"})
    assert c.data() is not first
    source.unlink()
    assert "No filename, symbol" in c.t_target({"goal": "palplanş sonuç"})


def test_test_evidence_labels_do_not_invent_an_import_chain_across_api(isolated_graph: Path) -> None:
    write(isolated_graph, "geotek/api/value.py", '''from fastapi import APIRouter
router = APIRouter()
@router.get("/liquefaction/result")
def liquefaction_result():
    return {}
''')
    write(isolated_graph, "web/src/api.ts", 'export const read = () => request("GET", "/liquefaction/result");\n')
    write(isolated_graph, "web/src/test/api.test.ts", 'import { read } from "../api";\n')
    output = c.t_target({"goal": "sıvılaşma sonuç"})
    assert "Test[indirect static link +1 via api.ts]" in output
    assert "indirect import" not in output
