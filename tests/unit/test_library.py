from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path

import pytest

from geotek.core.errors import GeoTekError
from geotek.core.models.project import Project, ProjectMeta
from geotek.io.project_io import load_project, save_project
from geotek.library import AppSettings, ProjectLibrary, add_recent, load_settings, save_settings
from geotek.library import service, settings


@pytest.fixture
def settings_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    path = tmp_path / "preferences" / "settings.json"
    monkeypatch.setenv("GEOTEK_SETTINGS", str(path))
    return path


@pytest.fixture
def library(tmp_path: Path) -> ProjectLibrary:
    return ProjectLibrary(tmp_path / "library")


def test_settings_path_precedence(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APPDATA", str(tmp_path / "appdata"))
    override = tmp_path / "override.json"
    monkeypatch.setenv("GEOTEK_SETTINGS", str(override))
    assert settings.settings_path() == override
    monkeypatch.delenv("GEOTEK_SETTINGS")
    assert settings.settings_path() == tmp_path / "appdata" / "GeoTek" / "settings.json"
    monkeypatch.delenv("APPDATA")
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    assert settings.settings_path() == tmp_path / ".geotek" / "settings.json"
    assert settings.default_library_dir() == tmp_path / "Documents" / "GeoTek Projeleri"


def test_settings_defaults(settings_file: Path) -> None:
    result = load_settings()
    assert result.library_dir == settings.default_library_dir()
    assert result.language == "tr"
    assert result.recent == []
    assert not settings_file.exists()


@pytest.mark.parametrize("content", [
    b"{broken", b"\xff", b"null", b"[]", b'{"language": "de"}', b'{"recent": [42]}'
])
def test_corrupt_settings_use_defaults(settings_file: Path, content: bytes) -> None:
    settings_file.parent.mkdir(parents=True)
    settings_file.write_bytes(content)
    assert load_settings() == AppSettings()


def test_settings_round_trip(settings_file: Path, tmp_path: Path) -> None:
    original = AppSettings(library_dir=tmp_path / "Çağlayan", language="en")
    original = add_recent(original, tmp_path / "proje.gtk")
    save_settings(original)
    assert load_settings() == original
    assert json.loads(settings_file.read_text(encoding="utf-8"))["language"] == "en"
    assert list(settings_file.parent.iterdir()) == [settings_file]


def test_recent_cap_deduplication_and_order(tmp_path: Path) -> None:
    original = AppSettings()
    result = original
    for index in range(12):
        result = add_recent(result, tmp_path / f"{index}.gtk")
    assert original.recent == []
    assert result.recent == [str((tmp_path / f"{i}.gtk").resolve()) for i in range(11, 1, -1)]
    result = add_recent(result, tmp_path / "folder" / ".." / "5.gtk")
    assert result.recent[0] == str((tmp_path / "5.gtk").resolve())
    assert len(result.recent) == len(set(result.recent)) == 10
    assert all(Path(path).is_absolute() for path in result.recent)


def test_recent_normalized_on_model_construction(tmp_path: Path) -> None:
    paths = [str(tmp_path / f"{i}.gtk") for i in range(12)]
    result = AppSettings(recent=[paths[0], *paths])
    assert result.recent == paths[:10]
    assert Path(AppSettings(recent=["relative.gtk"]).recent[0]).is_absolute()


def test_settings_atomic_replace(settings_file: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    save_settings(AppSettings())
    replace = os.replace
    calls: list[Path] = []

    def checked_replace(src: str | Path, dest: str | Path) -> None:
        source = Path(src)
        assert Path(dest) == settings_file
        assert source.parent == settings_file.parent
        assert json.loads(source.read_text(encoding="utf-8"))["language"] == "en"
        assert load_settings().language == "tr"
        calls.append(source)
        replace(src, dest)

    monkeypatch.setattr(settings.os, "replace", checked_replace)
    save_settings(AppSettings(language="en"))
    assert len(calls) == 1
    assert not calls[0].exists()
    assert load_settings().language == "en"


def test_settings_failed_replace_preserves_original(
    settings_file: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    save_settings(AppSettings())
    original = settings_file.read_bytes()

    def fail_replace(src: str | Path, dest: str | Path) -> None:
        raise OSError("replace failed")

    monkeypatch.setattr(settings.os, "replace", fail_replace)
    with pytest.raises(OSError, match="replace failed"):
        save_settings(AppSettings(language="en"))
    assert settings_file.read_bytes() == original
    assert list(settings_file.parent.iterdir()) == [settings_file]


def test_library_created_on_demand(library: ProjectLibrary) -> None:
    assert not library.root.exists()
    assert library.list() == []
    library.create(ProjectMeta(name="First"))
    assert library.root.is_dir()


@pytest.mark.parametrize(("name", "file"), [
    ("Çağlayan Şev Projesi", "caglayan-sev-projesi.gtk"),
    ("ÇĞİIÖŞÜ çğıöşü", "cgiiosu-cgiosu.gtk"),
    ("  / ---  ", "proje.gtk"),
    ("A_b & C", "a-b-c.gtk"),
])
def test_create_slug(library: ProjectLibrary, name: str, file: str) -> None:
    actual, project = library.create(ProjectMeta(name=name, number="42", engineer="Engineer"))
    assert actual == file
    assert project.meta.name == name
    assert load_project(library.path_of(file)) == project


def test_create_unique_suffix(library: ProjectLibrary) -> None:
    names = [library.create(ProjectMeta(name="Project"))[0] for _ in range(3)]
    assert names == ["project.gtk", "project-2.gtk", "project-3.gtk"]


def test_list_metadata_corruption_and_order(library: ProjectLibrary) -> None:
    file, project = library.create(ProjectMeta(name="Valid", number="N1", engineer="Ada"))
    metadata_only = library.root / "metadata.gtk"
    metadata_only.write_text(json.dumps({
        "meta": {"name": "Future", "schema_version": "999"},
        "site": "not a valid project site",
    }), encoding="utf-8")
    broken = library.root / "broken.gtk"
    broken.write_text("{broken", encoding="utf-8")
    (library.root / "ignored.txt").write_text("ignored", encoding="utf-8")
    (library.root / "directory.gtk").mkdir()
    for timestamp, path in enumerate([library.path_of(file), metadata_only, broken], 1):
        os.utime(path, (timestamp * 1000, timestamp * 1000))
    entries = library.list()
    assert [entry.file for entry in entries] == ["broken.gtk", "metadata.gtk", file]
    assert entries[0].error
    assert entries[0].size == broken.stat().st_size
    assert entries[1].error is None
    assert entries[1].schema_version == "999"
    assert entries[1].name == "Future"
    valid = entries[2]
    assert (valid.name, valid.number, valid.engineer) == ("Valid", "N1", "Ada")
    assert valid.schema_version == project.meta.schema_version
    assert valid.modified.timestamp() == 1000
    assert valid.error is None


@pytest.mark.parametrize("content", [
    b"\xff", b"[]", b"null", b"{}", b'{"meta": []}', b'{"meta": {"name": 5}}',
    b'{"meta": {"name": "Invalid", "schema_version": 42}}',
])
def test_list_invalid_metadata(library: ProjectLibrary, content: bytes) -> None:
    library.root.mkdir()
    (library.root / "bad.gtk").write_bytes(content)
    entry, = library.list()
    assert entry.file == "bad.gtk"
    assert entry.error


def test_open_and_save(library: ProjectLibrary) -> None:
    file, original = library.create(ProjectMeta(name="Original"))
    project = library.open(file)
    assert project == original
    project.meta.engineer = "Updated"
    project.meta.language = "en"
    library.save(file, project)
    assert library.open(file).meta.engineer == "Updated"
    assert library.open(file).meta.language == "en"


def test_duplicate(library: ProjectLibrary) -> None:
    file, original = library.create(ProjectMeta(name="Project", number="N1"))
    duplicate = library.duplicate(file)
    second = library.duplicate(file)
    assert duplicate == "project-kopya.gtk"
    assert second == "project-kopya-2.gtk"
    copied = library.open(duplicate)
    assert copied.meta.name == "Project (kopya)"
    assert copied.meta.number == original.meta.number
    assert library.open(file) == original


def test_rename_and_collision(library: ProjectLibrary) -> None:
    file, _ = library.create(ProjectMeta(name="Original"))
    occupied, occupant = library.create(ProjectMeta(name="Çağlayan"))
    renamed = library.rename(file, "Çağlayan")
    assert renamed == "caglayan-2.gtk"
    assert not library.path_of(file).exists()
    assert library.open(renamed).meta.name == "Çağlayan"
    assert library.open(occupied) == occupant
    assert library.rename(renamed, "Çağlayan 2") == renamed
    assert library.open(renamed).meta.name == "Çağlayan 2"


def test_delete_to_trash(library: ProjectLibrary) -> None:
    file, project = library.create(ProjectMeta(name="Project"))
    trash = library.delete(file)
    assert trash.parent == library.root / ".trash"
    assert trash.name.startswith("project-")
    assert trash.suffix == ".gtk"
    assert load_project(trash) == project
    assert not library.path_of(file).exists()
    assert library.list() == []


def test_delete_collision_preserves_both(
    library: ProjectLibrary, monkeypatch: pytest.MonkeyPatch
) -> None:
    class FixedDatetime(datetime):
        @classmethod
        def now(cls) -> FixedDatetime:
            return cls(2026, 10, 17, 1, 2, 3)

    monkeypatch.setattr(service, "datetime", FixedDatetime)
    file, first = library.create(ProjectMeta(name="Project", number="1"))
    first_trash = library.delete(file)
    file, second = library.create(ProjectMeta(name="Project", number="2"))
    second_trash = library.delete(file)
    assert first_trash.name == "project-20261017-010203.gtk"
    assert second_trash != first_trash
    assert load_project(first_trash) == first
    assert load_project(second_trash) == second


def test_import_valid_and_collision(library: ProjectLibrary, tmp_path: Path) -> None:
    src = save_project(Project(meta=ProjectMeta(name="Imported")), tmp_path / "external.gtk")
    original = src.read_bytes()
    file = library.import_file(src)
    assert file == "external.gtk"
    assert library.import_file(src) == "external-2.gtk"
    assert library.open(file).meta.name == "Imported"
    assert library.path_of(file).read_bytes() == original == src.read_bytes()


@pytest.mark.parametrize("content", ["not json", "[]", '{"meta": {"name": "Invalid"}, "site": 5}'])
def test_import_invalid(library: ProjectLibrary, tmp_path: Path, content: str) -> None:
    src = tmp_path / "invalid.gtk"
    src.write_text(content, encoding="utf-8")
    with pytest.raises(GeoTekError):
        library.import_file(src)
    assert library.list() == []


def test_import_missing(library: ProjectLibrary, tmp_path: Path) -> None:
    with pytest.raises(GeoTekError):
        library.import_file(tmp_path / "missing.gtk")


def test_export_directory_and_file(library: ProjectLibrary, tmp_path: Path) -> None:
    file, project = library.create(ProjectMeta(name="Project"))
    directory = tmp_path / "exports"
    directory.mkdir()
    assert library.export(file, directory) == directory / file
    dest = library.export(file, tmp_path / "nested" / "renamed")
    assert dest == tmp_path / "nested" / "renamed.gtk"
    assert load_project(dest) == project
    assert dest.read_bytes() == library.path_of(file).read_bytes()
    assert library.export(file, library.path_of(file), overwrite=True) == library.path_of(file)


@pytest.mark.parametrize("file", [
    "../x.gtk", "a/b.gtk", "a\\b.gtk", "x.txt", "..", "", "/tmp/x.gtk",
    "C:\\outside\\x.gtk", "C:x.gtk", "x:stream.gtk", "bad\0.gtk",
])
def test_path_traversal_rejected(library: ProjectLibrary, file: str) -> None:
    with pytest.raises(GeoTekError):
        library.path_of(file)


def test_absolute_path_rejected(library: ProjectLibrary, tmp_path: Path) -> None:
    with pytest.raises(GeoTekError):
        library.path_of(str(tmp_path / "absolute.gtk"))


def test_symlink_escape_rejected(library: ProjectLibrary, tmp_path: Path) -> None:
    library.root.mkdir()
    outside = tmp_path / "outside.gtk"
    outside.write_text("{}", encoding="utf-8")
    link = library.root / "link.gtk"
    try:
        link.symlink_to(outside)
    except (OSError, NotImplementedError):
        pytest.skip("Symlinks unavailable")
    with pytest.raises(GeoTekError):
        library.path_of(link.name)


def test_default_library_dir_falls_back_when_documents_unwritable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    home = tmp_path / "home"
    home.mkdir()
    blocked = home / "Documents"
    blocked.write_text("a file, so the folder cannot be created")
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: home))
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "local"))
    assert settings.default_library_dir() == home / "GeoTek Projeleri"


def test_unwritable_saved_library_dir_is_replaced(
    settings_file: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    blocker = tmp_path / "blocker"
    blocker.write_text("x")
    save_settings(AppSettings(library_dir=blocker / "sub"))
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path / "h"))
    assert load_settings().library_dir == tmp_path / "h" / "Documents" / "GeoTek Projeleri"
