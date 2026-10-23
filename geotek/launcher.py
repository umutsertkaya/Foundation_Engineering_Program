"""Local launcher: serve the built web UI and the API from one process, then open the browser.

Used by the packaged exe (``python -m geotek.launcher`` in development). The UI is the
Vite build in ``web/dist``; a frozen build carries it as ``web_dist`` next to the code.
"""

from __future__ import annotations

import os
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from collections.abc import Callable
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

HOST = "127.0.0.1"
DEFAULT_PORT = 8765


def web_dist_dir() -> Path:
    """Locate the built UI: GEOTEK_WEB_DIST, the frozen bundle, or ``web/dist`` in the repo."""
    override = os.environ.get("GEOTEK_WEB_DIST")
    if override:
        return Path(override)
    bundle = getattr(sys, "_MEIPASS", None)
    if bundle:
        return Path(bundle) / "web_dist"
    return Path(__file__).resolve().parents[1] / "web" / "dist"


def mount_web(app: FastAPI, dist: Path) -> None:
    """Serve ``dist`` at the root; unknown non-API paths fall back to index.html (SPA routes)."""
    index = dist / "index.html"
    if not index.is_file():
        raise FileNotFoundError(f"Web UI build not found: {index}")
    assets = dist / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404, "Not found")
        target = (dist / path).resolve()
        if path and target.is_file() and dist.resolve() in target.parents:
            return FileResponse(target)
        return FileResponse(index)


def choose_path(kind: str, initial: str = "") -> str | None:
    """Native dialog (tkinter): ``folder``, ``open`` (.gtk) or ``save`` (.gtk).

    Returns None when cancelled or when no display/tkinter is available.
    """
    try:
        import tkinter
        from tkinter import filedialog

        root = tkinter.Tk()
    except Exception:  # no tkinter or no display
        return None
    try:
        root.withdraw()
        root.attributes("-topmost", True)
        start = Path(initial) if initial else None
        directory = str(start if start and start.is_dir() else start.parent if start else "")
        types = [("GeoTek", "*.gtk"), ("*", "*.*")]
        if kind == "folder":
            chosen = filedialog.askdirectory(
                parent=root, initialdir=initial or None, mustexist=False)
        elif kind == "save":
            chosen = filedialog.asksaveasfilename(
                parent=root, initialdir=directory or None, defaultextension=".gtk",
                filetypes=types, initialfile=start.name if start and not start.is_dir() else "")
        else:
            chosen = filedialog.askopenfilename(
                parent=root, initialdir=directory or None, filetypes=types)
    finally:
        root.destroy()
    return chosen or None


def add_launcher_routes(app: FastAPI, shutdown: Callable[[], None]) -> None:
    """Routes that exist only when GeoTek runs as the local program (not in the plain API)."""

    @app.get("/api/launcher", include_in_schema=False)
    def launcher_info() -> dict[str, bool]:
        return {"shutdown": True}

    @app.post("/api/launcher/pick/{kind}", include_in_schema=False)
    def launcher_pick(kind: str, payload: dict[str, str] | None = None) -> dict[str, str | None]:
        if kind not in ("folder", "open", "save"):
            raise HTTPException(404, "Not found")
        return {"path": choose_path(kind, (payload or {}).get("initial", ""))}

    @app.post("/api/launcher/shutdown", include_in_schema=False)
    def launcher_shutdown() -> dict[str, bool]:
        shutdown()
        return {"stopping": True}


def build_app(dist: Path | None = None, shutdown: Callable[[], None] | None = None) -> FastAPI:
    """The API app with the web UI mounted behind it; ``shutdown`` enables the quit route."""
    from geotek.api.app import create_app

    app = create_app()
    if shutdown is not None:
        add_launcher_routes(app, shutdown)
    mount_web(app, dist if dist is not None else web_dist_dir())
    return app


def pick_port(preferred: int = DEFAULT_PORT) -> int:
    """The preferred port when free, otherwise any free local port."""
    for candidate in (preferred, 0):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            try:
                probe.bind((HOST, candidate))
            except OSError:
                continue
            return probe.getsockname()[1]
    raise OSError("No free local port.")


def already_running(port: int = DEFAULT_PORT) -> bool:
    """True when a GeoTek server already answers on ``port`` (a second start reuses it)."""
    try:
        with urllib.request.urlopen(f"http://{HOST}:{port}/api/launcher", timeout=1) as reply:
            return reply.status == 200
    except OSError:
        return False


def main() -> int:
    import uvicorn

    if already_running():
        webbrowser.open(f"http://{HOST}:{DEFAULT_PORT}")
        print(f"GeoTek zaten çalışıyor: http://{HOST}:{DEFAULT_PORT}")
        return 0
    port = pick_port()
    url = f"http://{HOST}:{port}"
    holder: dict[str, uvicorn.Server] = {}

    def stop() -> None:
        holder["server"].should_exit = True

    # The limit matters: without it uvicorn waits forever for connections an open browser tab
    # still holds, so the quit button stops serving but leaves the process running.
    server = uvicorn.Server(
        uvicorn.Config(build_app(shutdown=stop), host=HOST, port=port, log_level="warning",
                       timeout_graceful_shutdown=2))
    holder["server"] = server

    def open_when_ready() -> None:
        while not server.started and not server.should_exit:
            time.sleep(0.1)
        if server.started:
            webbrowser.open(url)

    threading.Thread(target=open_when_ready, daemon=True).start()
    print(f"GeoTek: {url}  (kapatmak için bu pencereyi kapatın / Ctrl+C)")
    server.run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
