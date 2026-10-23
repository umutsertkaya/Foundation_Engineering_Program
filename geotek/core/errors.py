"""Domain exceptions."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from geotek.services.walls_advanced import MissingFactor


class GeoTekError(Exception):
    """Base class for all GeoTek errors."""

    message_code: str | None = None
    """Stable code of a translatable message; ``str(exc)`` stays the English fallback."""
    message_params: dict[str, float | int | str] | None = None


class BearingFailureError(GeoTekError):
    """The foundation cannot carry the load at all (no effective width or base adhesion exceeded).

    It is a property of the trial geometry, so width sizing treats it as a failed trial.
    """


class MissingFactorsError(GeoTekError):
    """A calculation needs project-supplied design factors before it can run."""

    missing: list[MissingFactor]

    def __init__(self, missing: list[MissingFactor]):
        self.missing = list(missing)
        detail = "; ".join(f"{m.path} ({m.status}: {m.source})" for m in missing)
        super().__init__(f"Bu analiz için girilmesi gereken katsayılar eksik: {detail}")


class LayerDesignError(GeoTekError):
    """A soil layer lacks the approved design value a calculation needs.

    ``issue`` is one of ``su_missing``, ``su_not_positive``, ``phi_missing``,
    ``seismic_undrained_unsupported``, ``gamma_sat_missing``. The layer is named by its depth range, not its internal id.
    """

    _TEXT = {
        "su_missing": "design s_u not set",
        "su_not_positive": "foundation needs positive design s_u",
        "phi_missing": "design phi' not set",
        "seismic_undrained_unsupported": "seismic undrained earth pressure is not implemented",
        "gamma_sat_missing": "saturated unit weight gamma_sat not set (layer lies below the groundwater table)",
    }

    def __init__(self, layer, issue: str):
        self.message_code = f"layer_{issue}"
        self.message_params = {"top": round(float(layer.top), 3), "bottom": round(float(layer.bottom), 3)}
        super().__init__(f"Layer {layer.top:g}–{layer.bottom:g} m: {self._TEXT[issue]}")


class SlopeError(GeoTekError):
    """Sloping backfill is outside what a closed-form earth pressure solution supports.

    ``issue`` is one of ``slope_exceeds_phi`` (beta > phi'), ``mo_no_solution`` (Mononobe-Okabe
    has no solution because beta > phi' - psi) or ``slope_undrained_unsupported``. The message
    parameters are rounded angles in degrees (``slope``, ``phi``, ``psi``) or a layer's depth
    range (``top``, ``bottom``).
    """

    def __init__(self, issue: str, text: str, **params: float):
        self.message_code = issue
        self.message_params = {k: round(float(v), 3) for k, v in params.items()}
        super().__init__(text)


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
