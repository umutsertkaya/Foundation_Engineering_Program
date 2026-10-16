"""Run a calculation off the GUI thread so the window stays responsive."""

from __future__ import annotations

from pydantic import ValidationError
from PySide6.QtCore import QThread, Signal

from geotek.core.errors import GeoTekError


def error_text(exc: Exception) -> str:
    """Readable one-paragraph message for input and engine errors (never a traceback)."""
    if isinstance(exc, ValidationError):
        parts = []
        for err in exc.errors():
            loc = ".".join(str(p) for p in err.get("loc", ()) if p != "__root__")
            msg = err.get("msg", "").removeprefix("Value error, ")
            parts.append(f"{loc}: {msg}" if loc else msg)
        return "; ".join(parts)
    if isinstance(exc, (GeoTekError, ValueError)):
        return str(exc)
    return f"{type(exc).__name__}: {exc}"


class Task(QThread):
    """Calls ``fn()`` in a worker thread; only computes, never touches widgets.

    ``succeeded(result)`` / ``failed(message)`` are delivered to the GUI thread.
    """

    succeeded = Signal(object)
    failed = Signal(str)

    def __init__(self, fn, parent=None):
        super().__init__(parent)
        self.fn = fn

    def run(self) -> None:
        try:
            result = self.fn()
        except Exception as exc:  # noqa: BLE001 - every error is shown to the user
            self.failed.emit(error_text(exc))
        else:
            self.succeeded.emit(result)
