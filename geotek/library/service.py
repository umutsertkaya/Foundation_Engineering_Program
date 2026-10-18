"""Project-file library operations."""

from __future__ import annotations

import json
import os
import re
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path, PureWindowsPath

from pydantic import BaseModel

from geotek.core.errors import GeoTekError
from geotek.core.models.project import Project, ProjectMeta
from geotek.io.project_io import PROJECT_SUFFIX, load_project, save_project, write_atomic

_RESERVED = frozenset(
    {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)),
     *(f"LPT{i}" for i in range(1, 10))}
)
_FORBIDDEN_CHARS = frozenset('/\\:*?"<>|\0')


class LibraryFileExistsError(GeoTekError):
    """The destination already exists and overwriting was not requested."""


class InvalidDestinationError(GeoTekError):
    """The export destination cannot be used."""


class LibraryEntry(BaseModel):
    file: str
    name: str
    number: str
    engineer: str
    modified: datetime
    size: int
    schema_version: str | None = None
    error: str | None = None


def _is_reserved(stem: str) -> bool:
    return stem.split(".", 1)[0].rstrip(" ").upper() in _RESERVED


def _slug(name: str) -> str:
    name = name.translate(str.maketrans("çğıöşüÇĞİIÖŞÜ", "cgiosuCGIIOSU")).lower()
    stem = re.sub(r"[\W_]+", "-", name).strip("-") or "proje"
    return f"{stem}-proje" if _is_reserved(stem) else stem


def normalize(file: str) -> str:
    """Canonical key for comparing library file names (case-insensitive on Windows)."""
    return os.path.normcase(file)


def _create_exclusive(path: Path) -> None:
    """Create an empty file; raises FileExistsError when the name is taken."""
    os.close(os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o666))


class ProjectLibrary:
    def __init__(self, root: Path) -> None:
        self.root = Path(root).expanduser().resolve()

    @staticmethod
    def normalize(file: str) -> str:
        return normalize(file)

    @staticmethod
    def _check_name(file: str) -> None:
        stem = file[: -len(PROJECT_SUFFIX)]
        if (
            not file
            or file == ".."
            or any(char in file for char in _FORBIDDEN_CHARS)
            or PureWindowsPath(file).drive
            or not file.lower().endswith(PROJECT_SUFFIX)
            or not stem
            or stem[-1] in ". "
            or _is_reserved(stem)
        ):
            raise GeoTekError(f"Invalid library file name: {file!r}")

    def path_of(self, file: str, *, scan: bool = True) -> Path:
        """Path of a library file; ``.gtk`` is case-insensitive and the on-disk case wins."""
        self._check_name(file)
        name = file
        if scan:
            try:
                names = os.listdir(self.root)
            except OSError:
                names = []
            if file not in names:
                key = normalize(file)
                name = next((n for n in sorted(names) if normalize(n) == key), file)
        path = self.root / name
        try:
            if path.resolve().parent != self.root.resolve():
                raise GeoTekError(f"File is outside the library: {file!r}")
        except (OSError, ValueError, RuntimeError) as exc:
            raise GeoTekError(f"Invalid library file name: {file!r}") from exc
        return path

    def ensure_root(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _candidates(name: str) -> Iterator[str]:
        stem = _slug(name)
        yield f"{stem}{PROJECT_SUFFIX}"
        index = 2
        while True:
            yield f"{stem}-{index}{PROJECT_SUFFIX}"
            index += 1

    def _reserve(self, name: str) -> str:
        """Atomically claim a unique file name by creating it empty (O_CREAT | O_EXCL)."""
        self.ensure_root()
        for file in self._candidates(name):
            try:
                _create_exclusive(self.path_of(file, scan=False))
            except FileExistsError:
                continue
            return file
        raise AssertionError("unreachable")  # pragma: no cover

    def _release(self, file: str) -> None:
        self.path_of(file, scan=False).unlink(missing_ok=True)

    def list(self) -> list[LibraryEntry]:
        entries: list[LibraryEntry] = []
        try:
            names = os.listdir(self.root)
        except OSError:
            return []
        for name in names:
            if not name.lower().endswith(PROJECT_SUFFIX):
                continue
            try:
                path = self.path_of(name, scan=False)
                if not path.is_file():
                    continue
                entries.append(self._read_entry(path))
            except (GeoTekError, OSError):
                continue
        return sorted(entries, key=lambda entry: entry.modified, reverse=True)

    def entry(self, file: str) -> LibraryEntry:
        """Describe one library file; raises GeoTekError (name) or OSError (missing)."""
        return self._read_entry(self.path_of(file))

    @staticmethod
    def _read_entry(path: Path) -> LibraryEntry:
        stat = path.stat()
        values = {"name": path.stem, "number": "", "engineer": ""}
        schema_version = None
        error = None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(data, dict) or not isinstance(data.get("meta"), dict):
                raise ValueError("Project metadata must be an object")
            meta = data["meta"]
            if not isinstance(meta.get("name"), str):
                raise ValueError("Project metadata requires a name")
            for key in values:
                value = meta.get(key, values[key])
                if not isinstance(value, str):
                    raise ValueError(f"Invalid metadata field: {key}")
                values[key] = value
            raw_version = meta.get("schema_version")
            if raw_version is not None and not isinstance(raw_version, str):
                raise ValueError("Invalid metadata field: schema_version")
            schema_version = raw_version
        except (OSError, ValueError, RecursionError) as exc:
            error = str(exc)
        return LibraryEntry(
            file=path.name,
            name=values["name"],
            number=values["number"],
            engineer=values["engineer"],
            schema_version=schema_version,
            modified=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
            size=stat.st_size,
            error=error,
        )

    def create(self, meta: ProjectMeta) -> tuple[str, Project]:
        project = Project(meta=meta)
        file = self._reserve(meta.name)
        self._save_reserved(file, project)
        return file, project

    def _save_reserved(self, file: str, project: Project) -> None:
        """Write into a name claimed by ``_reserve``; free the claim on failure."""
        try:
            self.save(file, project)
        except BaseException:
            self._release(file)
            raise

    @staticmethod
    def _load(path: Path) -> Project:
        try:
            return load_project(path)
        except GeoTekError:
            raise
        except (OSError, ValueError, TypeError, KeyError, AttributeError, RecursionError) as exc:
            raise GeoTekError(f"Cannot load project {path.name!r}: {exc}") from exc

    def open(self, file: str) -> Project:
        return self._load(self.path_of(file))

    def save(self, file: str, project: Project) -> None:
        path = self.path_of(file)
        self.ensure_root()
        save_project(project, path)

    def duplicate(self, file: str) -> str:
        project = self.open(file)
        project.meta.name += " (kopya)"
        target = self._reserve(project.meta.name)
        self._save_reserved(target, project)
        return target

    def rename(self, file: str, new_name: str) -> str:
        source = self.path_of(file)
        project = self.open(file)
        project.meta.name = new_name
        self.ensure_root()
        target = None
        for candidate in self._candidates(new_name):
            if normalize(candidate) == normalize(source.name):
                self.save(source.name, project)
                return source.name
            try:
                _create_exclusive(self.path_of(candidate, scan=False))
            except FileExistsError:
                continue
            target = candidate
            break
        self._save_reserved(target, project)
        source.unlink()
        return target

    def delete(self, file: str) -> Path:
        source = self.path_of(file)
        trash = self.root / ".trash"
        trash.mkdir(parents=True, exist_ok=True)
        if trash.resolve().parent != self.root.resolve():
            raise GeoTekError("Trash directory is outside the library")
        stem = f"{source.stem}-{datetime.now():%Y%m%d-%H%M%S}"
        target = trash / f"{stem}{PROJECT_SUFFIX}"
        index = 2
        while target.exists() or target.is_symlink():
            target = trash / f"{stem}-{index}{PROJECT_SUFFIX}"
            index += 1
        source.rename(target)
        return target

    def import_file(self, src: Path) -> str:
        src = Path(src)
        self._load(src)
        data = src.read_bytes()
        file = self._reserve(src.stem)
        try:
            write_atomic(self.path_of(file, scan=False), data)
        except BaseException:
            self._release(file)
            raise
        return file

    def export(self, file: str, dest: Path, overwrite: bool = False) -> Path:
        """Copy a library file to ``dest``; an existing file is replaced only if ``overwrite``."""
        source = self.path_of(file)
        dest = Path(dest)
        if dest.is_dir():
            dest /= source.name
        elif not dest.name or dest.name[-1] in ". ":
            raise InvalidDestinationError(f"Invalid export destination: {str(dest)!r}")
        elif not dest.suffix:
            dest = dest.with_name(dest.name + PROJECT_SUFFIX)
        elif dest.suffix.lower() != PROJECT_SUFFIX:
            raise InvalidDestinationError(
                f"Export destination must be a directory or a {PROJECT_SUFFIX} file: {dest.name!r}"
            )
        if dest.exists() and not dest.is_file():
            raise InvalidDestinationError(f"Export destination is not a file: {dest.name!r}")
        dest.parent.mkdir(parents=True, exist_ok=True)
        data = source.read_bytes()
        if dest.exists():
            if not overwrite:
                raise LibraryFileExistsError(f"File already exists: {dest.name!r}")
            if not dest.samefile(source):
                write_atomic(dest, data)
            return dest
        try:
            _create_exclusive(dest)
        except FileExistsError as exc:
            raise LibraryFileExistsError(f"File already exists: {dest.name!r}") from exc
        try:
            write_atomic(dest, data)
        except BaseException:
            dest.unlink(missing_ok=True)
            raise
        return dest
