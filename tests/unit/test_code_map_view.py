"""Exercise the actual loopback HTTP surface without scanning or running project code."""

from __future__ import annotations

from contextlib import contextmanager
import http.client
import json
import threading
from collections.abc import Callable, Iterator

import pytest

from tools import code_map_view


def snapshot() -> dict:
    return {
        "fingerprint": "one",
        "nodes": [
            {"id": "geotek/engine/calculate.py", "label": "calculate.py",
             "area": "geotek/engine", "kind": "python"},
            {"id": "web/src/client.ts", "label": "client.ts",
             "area": "web/src", "kind": "web"},
            {"id": "tests/test_calculate.py", "label": "test_calculate.py",
             "area": "tests", "kind": "test"},
        ],
        "edges": [
            {"source": "web/src/client.ts", "target": "geotek/engine/calculate.py", "kind": "api"},
            {"source": "tests/test_calculate.py", "target": "geotek/engine/calculate.py", "kind": "test"},
        ],
        "routes": [{"method": "POST", "path": "/api/calculate", "file": "geotek/engine/calculate.py",
                    "line": 12, "handler": "calculate", "callers": ["web/src/client.ts"]}],
        "limitations": ["Statik çözümleme çalışma zamanı kanıtı değildir."],
    }


@contextmanager
def serve(callback: Callable[[], dict] = snapshot) -> Iterator[code_map_view.CodeMapServer]:
    server = code_map_view.CodeMapServer(port=0, snapshot=callback)
    thread = threading.Thread(target=lambda: server.serve_forever(poll_interval=0.01), daemon=True)
    thread.start()
    try:
        yield server
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def request(
    server: code_map_view.CodeMapServer, path: str, *, method: str = "GET", host: str | None = None,
) -> tuple[int, dict[str, str], bytes]:
    connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=3)
    try:
        connection.request(method, path, headers={"Host": host} if host else {})
        response = connection.getresponse()
        return response.status, dict(response.getheaders()), response.read()
    finally:
        connection.close()


def test_loopback_viewer_and_health_are_offline_utf8() -> None:
    with serve() as server:
        assert server.server_address[0] == "127.0.0.1"
        status, headers, payload = request(server, "/")
        assert status == 200
        assert headers["Content-Type"] == "text/html; charset=utf-8"
        assert headers["Cache-Control"] == "no-store"
        assert headers["X-Content-Type-Options"] == "nosniff"
        assert "connect-src 'self'" in headers["Content-Security-Policy"]
        assert "Access-Control-Allow-Origin" not in headers
        text = payload.decode("utf-8")
        assert "Kod haritası" in text
        assert '<script src="http' not in text
        assert '<link href="http' not in text
        status, _, payload = request(server, "/health")
        assert status == 200
        assert json.loads(payload) == {"status": "ok"}


def test_map_reads_a_live_snapshot_on_every_request() -> None:
    calls: list[int] = []

    def live() -> dict:
        calls.append(1)
        value = snapshot()
        value["fingerprint"] = f"sürüm-{len(calls)}"
        return value

    with serve(live) as server:
        first_status, headers, first = request(server, "/api/map")
        second_status, _, second = request(server, "/api/map?refresh=1")
        assert first_status == second_status == 200
        assert headers["Content-Type"] == "application/json; charset=utf-8"
        assert headers["Cache-Control"] == "no-store"
        assert json.loads(first)["fingerprint"] == "sürüm-1"
        assert json.loads(second)["fingerprint"] == "sürüm-2"
        assert json.loads(second)["edges"] == snapshot()["edges"]
        assert "Statik çözümleme" in second.decode("utf-8")
        assert len(calls) == 2


def test_scan_failure_is_minimal_and_next_poll_can_recover() -> None:
    calls: list[int] = []

    def unreliable() -> dict:
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("private filesystem details must not reach the browser")
        return snapshot()

    with serve(unreliable) as server:
        status, _, payload = request(server, "/api/map")
        assert status == 503
        assert "error" in json.loads(payload)
        assert b"private filesystem" not in payload
        assert b"Traceback" not in payload
        status, _, payload = request(server, "/api/map")
        assert status == 200
        assert json.loads(payload)["fingerprint"] == "one"


@pytest.mark.parametrize("path", [
    "/../CLAUDE.md", "/%2e%2e/CLAUDE.md", "/tools/code_map_view.py",
    "/api/source?file=CLAUDE.md", "/api/map/../../README.md", "/favicon.ico",
])
def test_no_arbitrary_source_or_path_traversal_endpoint(path: str) -> None:
    with serve() as server:
        status, _, payload = request(server, path)
        assert status == 404
        assert set(json.loads(payload)) == {"error"}


@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
def test_mutation_and_unsupported_methods_are_rejected(method: str) -> None:
    def unexpected() -> dict:
        pytest.fail("Unsupported methods must never trigger a scan")

    with serve(unexpected) as server:
        status, headers, payload = request(server, "/api/map", method=method)
        assert status == 405
        assert headers["Allow"] == "GET"
        if method == "HEAD":
            assert payload == b""
        else:
            assert "error" in json.loads(payload)


@pytest.mark.parametrize("host", ["example.invalid", "localhost.example.invalid", "["])
def test_foreign_or_malformed_host_is_rejected_without_scanning(host: str) -> None:
    def unexpected() -> dict:
        pytest.fail("A foreign Host must never trigger a scan")

    with serve(unexpected) as server:
        status, headers, payload = request(server, "/api/map", host=host)
        assert status == 403
        assert "Access-Control-Allow-Origin" not in headers
        assert "error" in json.loads(payload)
