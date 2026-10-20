"""Server-side session: the single open project, its origin file and the library.

One local user, one open project. The session lives on ``app.state.session`` so tests
and embedders can replace it. Module routers read/modify the project through
``require_project`` and call ``mark_dirty`` after a mutation.
"""

from __future__ import annotations

import threading
from pathlib import Path
from typing import NoReturn

from fastapi import HTTPException, Request

from geotek.api import schemas as dto
from geotek.core.models.project import Project
from geotek.library import ProjectLibrary, load_settings


def api_error(status: int, code: str, message: str, **details: object) -> NoReturn:
    """Raise an HTTP error carried in the shared ApiError envelope."""
    error = dto.ApiError(code=code, message=message, details=dict(details))
    raise HTTPException(status_code=status, detail=error.model_dump(mode="json"))


class Session:
    """Open project state. Mutations of the fields below happen under ``lock``."""

    def __init__(self, library: ProjectLibrary | None = None) -> None:
        self.lock = threading.RLock()
        self.library = library if library is not None else ProjectLibrary(
            load_settings().library_dir)
        self.project: Project | None = None
        self.file: str | None = None
        """Library file name of the open project; None for unsaved or path-based projects."""
        self.path: Path | None = None
        """Absolute file of a project opened outside the library (legacy /project/open)."""
        self.dirty = False
        self.generation = 0
        """Changes only when a project is opened, created or closed. Soil edits replace the
        ``project`` object, so jobs and uploads compare this, not object identity."""

    def info(self) -> dto.SessionInfo:
        with self.lock:
            return dto.SessionInfo(open=self.project is not None, file=self.file,
                                   dirty=self.dirty)

    def open_project(
        self, project: Project, *, file: str | None = None, path: Path | None = None,
        dirty: bool = False,
    ) -> None:
        with self.lock:
            self.project, self.file, self.path, self.dirty = project, file, path, dirty
            self.generation += 1

    def close(self) -> None:
        with self.lock:
            self.project, self.file, self.path, self.dirty = None, None, None, False
            self.generation += 1

    def mark_dirty(self) -> None:
        with self.lock:
            if self.project is not None:
                self.dirty = True

    def require_project(self) -> Project:
        """Return the open project or raise 409 ``no_project_open``."""
        with self.lock:
            if self.project is None:
                api_error(409, "no_project_open", "No project is open.")
            return self.project

    def set_library(self, library: ProjectLibrary) -> None:
        """Switch library; a project opened from the old one keeps saving to its old path."""
        with self.lock:
            if self.file is not None:
                self.path = self.library.path_of(self.file)
                self.file = None
            self.library = library


def get_session(request: Request) -> Session:
    """FastAPI dependency returning the application's session."""
    return request.app.state.session


def load_external(path: Path) -> Project:
    """Load a project from an arbitrary file: 404 when missing, 422 when unreadable."""
    from geotek.io.project_io import load_project

    if not path.is_file():
        api_error(404, "not_found", f"File not found: {path.name}")
    try:
        return load_project(path)
    except Exception as exc:  # any parse or validation failure means a bad file
        api_error(422, "invalid_project_file", f"Cannot load project {path.name!r}: {exc}")
