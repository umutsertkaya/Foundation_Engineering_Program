"""Contract for pluggable tools.

Each ``geotek/modules/<id>/__init__.py`` exposes ``MANIFEST``. Its id matches
the package directory name; its router is mounted at ``/api/m/<id>``.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel

from geotek.core.errors import GeoTekError

if TYPE_CHECKING:
    from fastapi import APIRouter


@dataclass(frozen=True)
class ReportEntry:
    """One report section contributed by a module.

    ``id`` must start with ``"<module id>:"``; ``name`` is shown as the section label;
    ``status`` is ``ready``, ``stale`` or ``no_result``.
    """

    id: str
    name: str
    status: str


@dataclass(frozen=True)
class ModuleManifest:
    """Metadata, optional routes and versioned state owned by one module."""

    id: str
    version: str
    title_key: str
    description_key: str
    icon: str
    order: int
    router: Callable[[], "APIRouter"] | None = None
    state_model: type[BaseModel] | None = None
    state_version: int = 1
    state_migrations: Mapping[int, Callable[[dict], dict]] = field(default_factory=dict)
    consumes: tuple[str, ...] = ()
    structure_kinds: tuple[str, ...] = ()
    design_code_dirs: tuple[Path, ...] = ()
    #: ``(project) -> [ReportEntry]``: sections this module offers to the report.
    report_entries: Callable[[Any], list[ReportEntry]] | None = None
    #: ``(writer, project, entry_id) -> None``: renders one of the module's entries.
    report_writer: Callable[[Any, Any, str], None] | None = None

    def __post_init__(self) -> None:
        if not isinstance(self.id, str) or re.fullmatch(r"[a-z][a-z0-9_]*", self.id) is None:
            raise GeoTekError(f"Invalid module id: {self.id!r}")
        if not isinstance(self.version, str) or not self.version.strip():
            raise GeoTekError(f"Module {self.id!r}: version must be non-empty")
        if type(self.order) is not int:
            raise GeoTekError(f"Module {self.id!r}: order must be an int")
        for name in ("title_key", "description_key"):
            value = getattr(self, name)
            if not isinstance(value, str) or not value.startswith(f"{self.id}."):
                raise GeoTekError(f"Module {self.id!r}: {name} must start with {self.id + '.'!r}")
        if type(self.state_version) is not int or self.state_version < 1:
            raise GeoTekError(f"Module {self.id!r}: state_version must be an int >= 1")
        for version in self.state_migrations:
            if type(version) is not int or not 1 <= version < self.state_version:
                raise GeoTekError(f"Module {self.id!r}: invalid migration key {version!r}")
        if (self.report_entries is None) != (self.report_writer is None):
            raise GeoTekError(
                f"Module {self.id!r}: report_entries and report_writer must be set together")
