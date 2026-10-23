"""Persistent application preferences."""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, field_validator


def settings_path() -> Path:
    override = os.environ.get("GEOTEK_SETTINGS")
    if override:
        return Path(override).expanduser()
    appdata = os.environ.get("APPDATA")
    if appdata:
        return Path(appdata) / "GeoTek" / "settings.json"
    return Path.home() / ".geotek" / "settings.json"


def _documents_dir() -> Path:
    """The user's Documents folder; Windows may redirect it (OneDrive, network share)."""
    if sys.platform == "win32":
        try:
            import ctypes
            from ctypes import wintypes

            guid = (ctypes.c_byte * 16).from_buffer_copy(
                bytes.fromhex("d0 9a d3 fd 8f 23 af 46 ad b4 6c 85 48 03 69 c7".replace(" ", "")))
            out = ctypes.c_wchar_p()
            shell32 = ctypes.windll.shell32  # type: ignore[attr-defined]
            shell32.SHGetKnownFolderPath.argtypes = [
                ctypes.c_void_p, wintypes.DWORD, wintypes.HANDLE, ctypes.POINTER(ctypes.c_wchar_p)]
            if shell32.SHGetKnownFolderPath(ctypes.byref(guid), 0, None, ctypes.byref(out)) == 0 \
                    and out.value:
                return Path(out.value)
        except (OSError, AttributeError, ValueError):
            pass
    return Path.home() / "Documents"


def is_writable_dir(path: Path) -> bool:
    """True when ``path`` can be created and written (Defender folder protection, read-only)."""
    try:
        path.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=path, prefix=".geotek-probe-", delete=True):
            pass
    except OSError:
        return False
    return True


def default_library_dir() -> Path:
    """First writable of: Documents, the home folder, the per-user app data folder."""
    candidates = [_documents_dir() / "GeoTek Projeleri", Path.home() / "GeoTek Projeleri"]
    for env in ("LOCALAPPDATA", "APPDATA"):
        if os.environ.get(env):
            candidates.append(Path(os.environ[env]) / "GeoTek" / "Projeler")
    for candidate in candidates:
        if is_writable_dir(candidate):
            return candidate
    return candidates[0]


class AppSettings(BaseModel):
    library_dir: Path = Field(default_factory=default_library_dir)
    language: Literal["tr", "en"] = "tr"
    recent: list[str] = Field(default_factory=list)

    @field_validator("recent")
    @classmethod
    def _normalize_recent(cls, paths: list[str]) -> list[str]:
        recent: list[str] = []
        seen: set[str] = set()
        for value in paths:
            path = str(Path(value).expanduser().resolve())
            key = os.path.normcase(path)
            if key not in seen:
                recent.append(path)
                seen.add(key)
            if len(recent) == 10:
                break
        return recent


def load_settings() -> AppSettings:
    try:
        loaded = AppSettings.model_validate_json(settings_path().read_text(encoding="utf-8"))
    except (OSError, ValueError, RuntimeError):
        return AppSettings()
    if not is_writable_dir(loaded.library_dir):
        # Saved folder is gone or read-only on this machine (e.g. settings copied from another PC).
        loaded.library_dir = default_library_dir()
    return loaded


def save_settings(s: AppSettings) -> None:
    path = settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent, prefix=".settings-", delete=False
        ) as stream:
            temporary = Path(stream.name)
            stream.write(s.model_dump_json(indent=2))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def add_recent(s: AppSettings, path: str | Path) -> AppSettings:
    data = s.model_dump()
    data["recent"] = [str(path), *s.recent]
    return AppSettings.model_validate(data)
