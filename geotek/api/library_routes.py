"""Core shell routes: modules, settings, project library and session state.

Contract: docs/contracts/CORE_SHELL_API.md. File names are validated by ProjectLibrary:
invalid -> 400 invalid_file_name, missing -> 404 not_found, unreadable -> 422
invalid_project_file. Every handler validates, touches the filesystem and updates the
session inside ``session.lock`` so a concurrent library switch cannot interleave.
"""

from __future__ import annotations

import logging
import tempfile
from collections.abc import Callable
from pathlib import Path
from typing import Annotated, TypeVar

from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse
from pydantic import ValidationError

from geotek.api import registry
from geotek.api import schemas as dto
from geotek.api.common import ERROR_RESPONSES
from geotek.api.session import Session, api_error, get_session
from geotek.core.errors import GeoTekError
from geotek.core.models.project import ProjectMeta
from geotek.library import (
    AppSettings,
    InvalidDestinationError,
    LibraryEntry,
    LibraryFileExistsError,
    ProjectLibrary,
    add_recent,
    load_settings,
    normalize,
    save_settings,
)

router = APIRouter(tags=["library"], responses=ERROR_RESPONSES)
SessionDep = Annotated[Session, Depends(get_session)]
T = TypeVar("T")
logger = logging.getLogger(__name__)


def _entry(entry: LibraryEntry) -> dto.LibraryEntryDTO:
    return dto.LibraryEntryDTO.model_validate(entry)


def _settings_dto(settings: AppSettings) -> dto.AppSettingsDTO:
    return dto.AppSettingsDTO(
        library_dir=str(settings.library_dir), language=settings.language,
        recent=list(settings.recent),
    )


def _path(session: Session, file: str) -> Path:
    """Validate the name (400) and require an existing file (404). Call under the lock."""
    try:
        path = session.library.path_of(file)
    except GeoTekError as exc:
        api_error(400, "invalid_file_name", str(exc))
    if not path.is_file():
        api_error(404, "not_found", f"Library file not found: {file}")
    return path


def _is_open(session: Session, file: str) -> bool:
    """True when ``file`` is the open project's library file (case-insensitive on Windows)."""
    return session.file is not None and normalize(session.file) == normalize(file)


def _guard(call: Callable[[], T]) -> T:
    """Map library failures: GeoTekError -> 422 invalid_project_file, OSError -> 400."""
    try:
        return call()
    except LibraryFileExistsError as exc:
        api_error(409, "file_exists", str(exc))
    except InvalidDestinationError as exc:
        api_error(400, "invalid_path", str(exc))
    except GeoTekError as exc:
        api_error(422, "invalid_project_file", str(exc))
    except OSError as exc:
        api_error(400, "invalid_path", str(exc))


def _remember(path: Path) -> None:
    """Push to the recent list; best effort, never fails the request."""
    try:
        save_settings(add_recent(load_settings(), path))
    except (OSError, ValueError, RuntimeError):
        logger.warning("Could not persist recent projects", exc_info=True)


@router.get("/modules", response_model=list[dto.ModuleInfo], operation_id="list_modules")
def list_modules() -> list[dto.ModuleInfo]:
    """List discovered modules sorted by menu order."""
    return [
        dto.ModuleInfo(
            id=m.id, version=m.version, title_key=m.title_key,
            description_key=m.description_key, icon=m.icon, order=m.order,
        )
        for m in registry.discover()
    ]


@router.get("/settings", response_model=dto.AppSettingsDTO, operation_id="get_settings")
def get_settings() -> dto.AppSettingsDTO:
    """Return persisted application preferences."""
    return _settings_dto(load_settings())


@router.put("/settings", response_model=dto.AppSettingsDTO, operation_id="put_settings")
def put_settings(payload: dto.AppSettingsDTO, session: SessionDep) -> dto.AppSettingsDTO:
    """Persist library_dir and language (recent is server-managed and ignored).

    The new library is resolved and created before anything is persisted; failure
    returns 400 invalid_path and leaves the old settings in place.
    """
    with session.lock:
        current = load_settings()
        try:
            updated = AppSettings(
                library_dir=Path(payload.library_dir), language=payload.language,
                recent=current.recent,
            )
            library = ProjectLibrary(updated.library_dir)
            library.ensure_root()
        except (OSError, RuntimeError, ValueError) as exc:
            api_error(400, "invalid_path", str(exc))
        _guard(lambda: save_settings(updated))
        if library.root != session.library.root:
            session.set_library(library)
        return _settings_dto(updated)


@router.get("/library", response_model=list[dto.LibraryEntryDTO], operation_id="list_library")
def list_library(session: SessionDep) -> list[dto.LibraryEntryDTO]:
    """List project files, newest first; unreadable files carry an error."""
    with session.lock:
        return [_entry(entry) for entry in session.library.list()]


@router.post("/library", response_model=dto.LibraryEntryDTO,
             operation_id="create_library_project")
def create_library_project(
    payload: dto.NewProjectRequest, session: SessionDep,
) -> dto.LibraryEntryDTO:
    """Create a project file in the library and open it as the current project."""
    with session.lock:
        settings = load_settings()
        data = {"name": payload.name, "number": payload.number, "engineer": payload.engineer,
                "language": payload.language or settings.language}
        if payload.design_code is not None:
            data["design_code"] = payload.design_code
        try:
            meta = ProjectMeta(**data)
        except ValidationError as exc:
            api_error(422, "validation", "Invalid project metadata.", errors=[
                {"loc": [str(part) for part in item["loc"]], "msg": item["msg"]}
                for item in exc.errors()])
        if payload.directory and payload.directory.strip():
            # Project stored outside the library: opened by path, like "open from location".
            where = ProjectLibrary(Path(payload.directory.strip()))
            file, project = _guard(lambda: where.create(meta))
            session.open_project(project, path=where.path_of(file, scan=False))
            _remember(where.path_of(file))
            return _entry(_guard(lambda: where.entry(file)))
        file, project = _guard(lambda: session.library.create(meta))
        session.open_project(project, file=file)
        _remember(session.library.path_of(file))
        return _entry(_guard(lambda: session.library.entry(file)))


@router.post("/library/import", response_model=dto.LibraryEntryDTO,
             operation_id="import_library_project")
def import_library_project(
    payload: dto.ImportRequest, session: SessionDep,
) -> dto.LibraryEntryDTO:
    """Copy an existing project file into the library."""
    source = Path(payload.path).expanduser()
    if not source.is_file():
        api_error(404, "not_found", f"File not found: {source.name}")
    with session.lock:
        file = _guard(lambda: session.library.import_file(source))
        return _entry(_guard(lambda: session.library.entry(file)))


MAX_PROJECT_UPLOAD_BYTES = 50 * 1024 * 1024


@router.post("/library/upload", response_model=dto.LibraryEntryDTO,
             operation_id="upload_library_project")
async def upload_library_project(
    request: Request, session: SessionDep, name: str = "project.gtk",
) -> dto.LibraryEntryDTO:
    """Import a project file sent as the raw request body (browser file picker).

    ``name`` only seeds the library file name; it is never used as a server path.
    """
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_PROJECT_UPLOAD_BYTES:
            api_error(422, "validation", "Project file is too large.")
        body.extend(chunk)
    if not body:
        api_error(422, "validation", "A non-empty project file is required.")
    stem = Path(name.replace("\\", "/")).stem.strip() or "project"
    with tempfile.TemporaryDirectory(prefix="geotek-upload-") as tmp:
        source = Path(tmp) / f"{stem}.gtk"
        source.write_bytes(bytes(body))
        with session.lock:
            file = _guard(lambda: session.library.import_file(source))
            return _entry(_guard(lambda: session.library.entry(file)))


@router.get("/library/{file}/download", operation_id="download_library_project")
def download_library_project(file: str, session: SessionDep) -> FileResponse:
    """Send the stored project file to the browser as a download."""
    with session.lock:
        path = _path(session, file)
    return FileResponse(path, media_type="application/octet-stream", filename=path.name)


@router.post("/library/{file}/open", response_model=dto.SessionInfo,
             operation_id="open_library_project")
def open_library_project(file: str, session: SessionDep) -> dto.SessionInfo:
    """Open a library project as the current project (the old one stays on failure)."""
    with session.lock:
        path = _path(session, file)
        project = _guard(lambda: session.library.open(path.name))
        session.open_project(project, file=path.name)
        _remember(path)
        return session.info()


@router.post("/library/{file}/duplicate", response_model=dto.LibraryEntryDTO,
             operation_id="duplicate_library_project")
def duplicate_library_project(file: str, session: SessionDep) -> dto.LibraryEntryDTO:
    """Copy a library project under a new unique file name."""
    with session.lock:
        _path(session, file)
        target = _guard(lambda: session.library.duplicate(file))
        return _entry(_guard(lambda: session.library.entry(target)))


@router.post("/library/{file}/rename", response_model=dto.LibraryEntryDTO,
             operation_id="rename_library_project")
def rename_library_project(
    file: str, payload: dto.RenameRequest, session: SessionDep,
) -> dto.LibraryEntryDTO:
    """Rename the project (and its file); the open project follows the new file."""
    with session.lock:
        _path(session, file)
        target = _guard(lambda: session.library.rename(file, payload.name))
        if _is_open(session, file) and session.project is not None:
            session.project.meta.name = payload.name
            session.file = target
        return _entry(_guard(lambda: session.library.entry(target)))


@router.post("/library/{file}/export", response_model=dto.ExportResponse,
             operation_id="export_library_project")
def export_library_project(
    file: str, payload: dto.ExportRequest, session: SessionDep,
) -> dto.ExportResponse:
    """Copy the stored project file outside the library; 409 file_exists unless overwrite."""
    with session.lock:
        _path(session, file)
        dest = _guard(lambda: session.library.export(
            file, Path(payload.dest).expanduser(), overwrite=payload.overwrite))
    return dto.ExportResponse(path=str(dest))


@router.delete("/library/{file}", response_model=dto.TrashResponse,
               operation_id="delete_library_project")
def delete_library_project(file: str, session: SessionDep) -> dto.TrashResponse:
    """Move a project file to the library's .trash; refused while it is open."""
    with session.lock:
        _path(session, file)
        if _is_open(session, file):
            api_error(409, "project_open", "The project is open; close it before deleting.")
        trash = _guard(lambda: session.library.delete(file))
    return dto.TrashResponse(trash_path=str(trash))


@router.get("/session", response_model=dto.SessionInfo, operation_id="get_session")
def get_session_info(session: SessionDep) -> dto.SessionInfo:
    """Report whether a project is open, its library file and unsaved changes."""
    return session.info()
