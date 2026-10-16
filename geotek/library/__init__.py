"""Application settings and project library."""

from __future__ import annotations

from geotek.library.service import LibraryEntry, ProjectLibrary
from geotek.library.settings import AppSettings, add_recent, load_settings, save_settings

__all__ = [
    "AppSettings",
    "load_settings",
    "save_settings",
    "add_recent",
    "ProjectLibrary",
    "LibraryEntry",
]
