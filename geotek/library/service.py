"""Project-file library operations."""

from __future__ import annotations

import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path, PureWindowsPath

from pydantic import BaseModel

from geotek.core.errors import GeoTekError
from geotek.core.models.project import Project, ProjectMeta
from geotek.io.project_io import PROJECT_SUFFIX, load_project, save_project


class LibraryEntry(BaseModel):
    file: str
    name: str
    number: str
    engineer: str
    modified: datetime
    size: int
    schema_version: str | None = None
    error: str | None = None


def _slug(name: str) -> str:
    name = name.translate(str.maketrans("çğıöşüÇĞİIÖŞÜ", "cgiosuCGIIOSU")).lower()
    return re.sub(r"[\W_]+", "-", name).strip("-") or "proje"


class ProjectLibrary:
    def __init__(self, root: Path) -> None:
        self.root = Path(root).expanduser().resolve()

    def path_of(self, file: str) -> Path:
        if (
            not file
            or file == ".."
            or any(char in file for char in ("/", "\\", ":", "\0"))
            or PureWindowsPath(file).drive
            or not file.endswith(PROJECT_SUFFIX)
        ):
            raise GeoTekError(f"Invalid library file name: {file!r}")
        path = self.root / file
        try:
            if path.resolve().parent != self.root.resolve():
                raise GeoTekError(f"File is outside the library: {file!r}")
        except (OSError, ValueError, RuntimeError) as exc:
            raise GeoTekError(f"Invalid library file name: {file!r}") from exc
        return path

    def _unique_file(self, name: str, *, exclude: str | None = None) -> str:
        stem = _slug(name)
        file = f"{stem}{PROJECT_SUFFIX}"
        index = 2
        while file != exclude:
            path = self.path_of(file)
            if not path.exists() and not path.is_symlink():
                break
            file = f"{stem}-{index}{PROJECT_SUFFIX}"
            index += 1
        return file

    def list(self) -> list[LibraryEntry]:
        entries: list[LibraryEntry] = []
        for path in self.root.glob(f"*{PROJECT_SUFFIX}"):
            try:
                path = self.path_of(path.name)
                if not path.is_file():
                    continue
                stat = path.stat()
            except (GeoTekError, OSError):
                continue
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
            entries.append(
                LibraryEntry(
                    file=path.name,
                    name=values["name"],
                    number=values["number"],
                    engineer=values["engineer"],
                    schema_version=schema_version,
                    modified=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
                    size=stat.st_size,
                    error=error,
                )
            )
        return sorted(entries, key=lambda entry: entry.modified, reverse=True)

    def create(self, meta: ProjectMeta) -> tuple[str, Project]:
        project = Project(meta=meta)
        file = self._unique_file(meta.name)
        self.save(file, project)
        return file, project

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
        self.root.mkdir(parents=True, exist_ok=True)
        save_project(project, path)

    def duplicate(self, file: str) -> str:
        project = self.open(file)
        project.meta.name += " (kopya)"
        target = self._unique_file(project.meta.name)
        self.save(target, project)
        return target

    def rename(self, file: str, new_name: str) -> str:
        source = self.path_of(file)
        project = self.open(file)
        project.meta.name = new_name
        target = self._unique_file(new_name, exclude=file)
        self.save(target, project)
        if target != file:
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
        file = self._unique_file(src.stem)
        self.root.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, self.path_of(file))
        return file

    def export(self, file: str, dest: Path) -> Path:
        source = self.path_of(file)
        dest = Path(dest)
        if dest.is_dir():
            dest /= file
        if dest.suffix != PROJECT_SUFFIX:
            dest = dest.with_suffix(PROJECT_SUFFIX)
        dest.parent.mkdir(parents=True, exist_ok=True)
        if source.resolve() != dest.resolve():
            shutil.copy2(source, dest)
        return dest
