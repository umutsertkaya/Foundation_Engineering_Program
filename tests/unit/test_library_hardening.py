"""Library hardening: atomic writes, export safety, name identity, atomic name reservation."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from geotek.core.errors import GeoTekError
from geotek.core.models.project import Project, ProjectMeta
from geotek.io import project_io
from geotek.io.project_io import load_project, save_project
from geotek.library import (
    InvalidDestinationError,
    LibraryFileExistsError,
    ProjectLibrary,
    normalize,
    service,
)


@pytest.fixture
def library(tmp_path: Path) -> ProjectLibrary:
    return ProjectLibrary(tmp_path / "library")


def _project(name: str) -> Project:
    return Project(meta=ProjectMeta(name=name))


# --- atomic save ---------------------------------------------------------------------------


def test_save_project_failed_replace_keeps_original(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = save_project(_project("Original"), tmp_path / "p.gtk")
    original = path.read_bytes()

    def fail_replace(src: str | Path, dest: str | Path) -> None:
        raise OSError("replace failed")

    monkeypatch.setattr(project_io.os, "replace", fail_replace)
    with pytest.raises(OSError, match="replace failed"):
        save_project(_project("Changed"), path)
    assert path.read_bytes() == original
    assert [p.name for p in tmp_path.iterdir()] == ["p.gtk"]


def test_save_project_failure_mid_write_keeps_original(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = save_project(_project("Original"), tmp_path / "p.gtk")
    original = path.read_bytes()

    def fail_fsync(fd: int) -> None:
        raise OSError("fsync failed")

    monkeypatch.setattr(project_io.os, "fsync", fail_fsync)
    with pytest.raises(OSError, match="fsync failed"):
        save_project(_project("Changed"), path)
    assert path.read_bytes() == original
    assert [p.name for p in tmp_path.iterdir()] == ["p.gtk"]
    assert load_project(path).meta.name == "Original"


def test_save_project_writes_through_temp_in_same_directory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: list[Path] = []
    real = os.replace

    def spy(src: str | Path, dest: str | Path) -> None:
        seen.append(Path(src))
        assert Path(src).parent == tmp_path and Path(src) != Path(dest)
        real(src, dest)

    monkeypatch.setattr(project_io.os, "replace", spy)
    save_project(_project("A"), tmp_path / "p.gtk")
    assert len(seen) == 1 and not seen[0].exists()


# --- export ---------------------------------------------------------------------------------


def test_export_never_overwrites_silently(library: ProjectLibrary, tmp_path: Path) -> None:
    file, _ = library.create(ProjectMeta(name="Project"))
    other, _ = library.create(ProjectMeta(name="Other"))
    dest = tmp_path / "out.gtk"
    dest.write_text("precious", encoding="utf-8")
    with pytest.raises(LibraryFileExistsError):
        library.export(file, dest)
    assert dest.read_text(encoding="utf-8") == "precious"
    (tmp_path / "dir").mkdir()
    (tmp_path / "dir" / file).write_text("precious", encoding="utf-8")
    with pytest.raises(LibraryFileExistsError):
        library.export(file, tmp_path / "dir")
    with pytest.raises(LibraryFileExistsError):
        library.export(file, library.path_of(file))
    library.export(other, dest, overwrite=True)
    assert dest.read_bytes() == library.path_of(other).read_bytes()
    assert not list(tmp_path.glob(".*.tmp"))


def test_export_suffix_is_never_replaced(library: ProjectLibrary, tmp_path: Path) -> None:
    file, _ = library.create(ProjectMeta(name="Project"))
    for bad in ("report.txt", "data.json", "x.gtk.bak"):
        with pytest.raises(InvalidDestinationError):
            library.export(file, tmp_path / bad)
    assert list(tmp_path.glob("*.gtk")) == []
    assert library.export(file, tmp_path / "plain") == tmp_path / "plain.gtk"
    assert library.export(file, tmp_path / "UP.GTK") == tmp_path / "UP.GTK"


def test_export_to_directory_that_is_not_a_file(library: ProjectLibrary, tmp_path: Path) -> None:
    file, _ = library.create(ProjectMeta(name="Project"))
    (tmp_path / "x.gtk").mkdir()
    # An existing directory is a directory destination, never a file to replace.
    assert library.export(file, tmp_path / "x.gtk") == tmp_path / "x.gtk" / file


def test_export_failure_leaves_no_partial_file(
    library: ProjectLibrary, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    file, _ = library.create(ProjectMeta(name="Project"))

    def fail(*args: object, **kwargs: object) -> None:
        raise OSError("disk full")

    monkeypatch.setattr(service, "write_atomic", fail)
    with pytest.raises(OSError, match="disk full"):
        library.export(file, tmp_path / "out.gtk")
    assert not (tmp_path / "out.gtk").exists()


# --- names and identity ---------------------------------------------------------------------


def test_uppercase_suffix_accepted_and_resolved(library: ProjectLibrary) -> None:
    library.root.mkdir()
    (library.root / "Alfa.GTK").write_text(
        _project("Alfa").model_dump_json(), encoding="utf-8")
    assert [entry.file for entry in library.list()] == ["Alfa.GTK"]
    assert library.path_of("Alfa.GTK").name == "Alfa.GTK"
    assert library.open("Alfa.GTK").meta.name == "Alfa"
    assert library.entry("Alfa.GTK").name == "Alfa"


@pytest.mark.skipif(os.name != "nt", reason="case-insensitive file system")
def test_on_disk_case_is_resolved_on_windows(library: ProjectLibrary) -> None:
    library.root.mkdir()
    (library.root / "Mixed.GTK").write_text(
        _project("Mixed").model_dump_json(), encoding="utf-8")
    assert library.path_of("mixed.gtk").name == "Mixed.GTK"
    assert library.path_of("MIXED.gtk").name == "Mixed.GTK"
    assert normalize("Mixed.GTK") == normalize("mixed.gtk") == library.normalize("MIXED.GTK")
    assert library.rename("mixed.gtk", "Mixed") == "Mixed.GTK"
    assert library.duplicate("MIXED.GTK") == "mixed-kopya.gtk"


@pytest.mark.parametrize("file", [
    "CON.gtk", "con.gtk", "Prn.gtk", "AUX.gtk", "NUL.gtk", "COM1.gtk", "com9.gtk",
    "LPT1.gtk", "lpt9.gtk", "con.txt.gtk", "name .gtk", "name..gtk", "name*.gtk", "a?.gtk",
    ".gtk",
])
def test_reserved_and_malformed_names_rejected(library: ProjectLibrary, file: str) -> None:
    with pytest.raises(GeoTekError):
        library.path_of(file)


@pytest.mark.parametrize("name", ["CON", "nul", "com1", "Lpt3"])
def test_generated_names_avoid_reserved(library: ProjectLibrary, name: str) -> None:
    file, _ = library.create(ProjectMeta(name=name))
    assert file == f"{name.lower()}-proje.gtk"
    assert library.path_of(file).is_file()


# --- atomic name reservation ----------------------------------------------------------------


def test_reservation_is_exclusive(library: ProjectLibrary) -> None:
    first = library._reserve("Project")
    second = library._reserve("Project")
    assert (first, second) == ("project.gtk", "project-2.gtk")
    assert library.path_of(first).stat().st_size == 0


def test_create_retries_when_candidate_taken_concurrently(
    library: ProjectLibrary, monkeypatch: pytest.MonkeyPatch
) -> None:
    library.root.mkdir()
    real_create = service._create_exclusive
    raced: list[Path] = []

    def racing(path: Path) -> None:
        if not raced:  # another writer claims the name between our check and create
            raced.append(path)
            path.write_text("someone else", encoding="utf-8")
        real_create(path)

    monkeypatch.setattr(service, "_create_exclusive", racing)
    file, _ = library.create(ProjectMeta(name="Project"))
    assert file == "project-2.gtk"
    assert raced[0].read_text(encoding="utf-8") == "someone else"


def test_failed_write_releases_reserved_name(
    library: ProjectLibrary, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail(*args: object, **kwargs: object) -> None:
        raise OSError("boom")

    monkeypatch.setattr(service, "save_project", fail)
    with pytest.raises(OSError):
        library.create(ProjectMeta(name="Project"))
    assert list(library.root.iterdir()) == []
    monkeypatch.undo()
    assert library.create(ProjectMeta(name="Project"))[0] == "project.gtk"


def test_import_duplicate_rename_skip_occupied_names(
    library: ProjectLibrary, tmp_path: Path
) -> None:
    src = save_project(_project("Imported"), tmp_path / "external.gtk")
    library.root.mkdir()
    (library.root / "external.gtk").write_text("occupied", encoding="utf-8")
    assert library.import_file(src) == "external-2.gtk"
    assert (library.root / "external.gtk").read_text(encoding="utf-8") == "occupied"

    file, _ = library.create(ProjectMeta(name="P"))
    (library.root / "p-kopya.gtk").write_text("occupied", encoding="utf-8")
    assert library.duplicate(file) == "p-kopya-2.gtk"

    (library.root / "beta.gtk").write_text("occupied", encoding="utf-8")
    assert library.rename(file, "Beta") == "beta-2.gtk"
    assert (library.root / "beta.gtk").read_text(encoding="utf-8") == "occupied"
    assert not (library.root / file).exists()
    assert load_project(library.root / "beta-2.gtk").meta.name == "Beta"
