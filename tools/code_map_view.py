"""Serve the live code-map viewer on loopback using only the Python standard library."""

from __future__ import annotations

import argparse
from collections.abc import Callable
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
from urllib.parse import urlsplit

HOST = "127.0.0.1"
HTML = Path(__file__).with_suffix(".html")


def graph_snapshot() -> dict:
    """Import the static scanner without starting its stdio MCP loop."""
    if __package__:
        from . import codemap_mcp
    else:
        import codemap_mcp
    return codemap_mcp.graph_snapshot()


class CodeMapServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, port: int = 8766, snapshot: Callable[[], dict] = graph_snapshot):
        self.snapshot = snapshot
        self.snapshot_lock = threading.Lock()
        self.html = HTML.read_bytes()
        super().__init__((HOST, port), CodeMapHandler)


class CodeMapHandler(BaseHTTPRequestHandler):
    server: CodeMapServer

    def log_message(self, format: str, *args: object) -> None:
        # Polling is frequent; the console only needs the server's startup URL.
        pass

    def respond(self, status: int, payload: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", (
            "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
            "connect-src 'self'; img-src 'self' data:; base-uri 'none'; "
            "frame-ancestors 'none'; form-action 'none'"
        ))
        if status == 405:
            self.send_header("Allow", "GET")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    def json_response(self, status: int, payload: dict) -> None:
        self.respond(status, json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                     "application/json; charset=utf-8")

    def do_GET(self) -> None:
        try:
            host = urlsplit("//" + self.headers.get("Host", "")).hostname
        except ValueError:
            host = None
        if host not in ("127.0.0.1", "localhost"):
            self.json_response(403, {"error": "Yalnız yerel erişim desteklenir."})
            return
        path = urlsplit(self.path).path
        if path == "/":
            self.respond(200, self.server.html, "text/html; charset=utf-8")
        elif path == "/health":
            self.json_response(200, {"status": "ok"})
        elif path == "/api/map":
            try:
                with self.server.snapshot_lock:
                    snapshot = self.server.snapshot()
                payload = json.dumps(snapshot, ensure_ascii=False).encode("utf-8")
            except Exception:
                self.json_response(503, {
                    "error": "Kod haritası şu an oluşturulamadı. Yeniden denenecek.",
                })
                return
            self.respond(200, payload, "application/json; charset=utf-8")
        else:
            self.json_response(404, {"error": "Sayfa bulunamadı."})

    def method_not_allowed(self) -> None:
        self.json_response(405, {"error": "Yalnız GET desteklenir."})

    do_POST = method_not_allowed
    do_PUT = method_not_allowed
    do_PATCH = method_not_allowed
    do_DELETE = method_not_allowed
    do_HEAD = method_not_allowed
    do_OPTIONS = method_not_allowed
    do_TRACE = method_not_allowed
    do_CONNECT = method_not_allowed


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8766, help="Loopback port (default: 8766)")
    args = parser.parse_args(argv)
    if not 0 <= args.port <= 65535:
        parser.error("--port must be between 0 and 65535")
    try:
        with CodeMapServer(args.port) as server:
            print(f"GeoTek code map: http://{HOST}:{server.server_port}/", flush=True)
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                pass
    except OSError as error:
        print(f"Code-map viewer could not start: {error}")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
