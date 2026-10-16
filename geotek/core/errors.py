"""Domain exceptions."""


class GeoTekError(Exception):
    """Base class for all GeoTek errors."""


class ProfileError(GeoTekError):
    """Invalid soil profile geometry or query outside the profile."""


class UnitError(GeoTekError):
    """Unknown unit or incompatible unit conversion."""


class ImportDataError(GeoTekError):
    """Field data file could not be read or mapped."""


class SchemaVersionError(GeoTekError):
    """Project file schema version is not supported."""
