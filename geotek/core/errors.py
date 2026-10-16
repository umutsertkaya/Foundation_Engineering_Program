"""Domain exceptions."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from geotek.services.walls_advanced import MissingFactor


class GeoTekError(Exception):
    """Base class for all GeoTek errors."""


class MissingFactorsError(GeoTekError):
    """A calculation needs project-supplied design factors before it can run."""

    missing: list[MissingFactor]

    def __init__(self, missing: list[MissingFactor]):
        self.missing = list(missing)
        detail = "; ".join(f"{m.path} ({m.status}: {m.source})" for m in missing)
        super().__init__(f"Bu analiz için girilmesi gereken katsayılar eksik: {detail}")


class Cancelled(GeoTekError):
    """Raised by a progress callback to cancel an analysis without changing inputs."""


class ProfileError(GeoTekError):
    """Invalid soil profile geometry or query outside the profile."""


class UnitError(GeoTekError):
    """Unknown unit or incompatible unit conversion."""


class ImportDataError(GeoTekError):
    """Field data file could not be read or mapped."""


class SchemaVersionError(GeoTekError):
    """Project file schema version is not supported."""
