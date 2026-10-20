"""Design code factor sets loaded from YAML.

Built-in sets live in ``geotek/config/design_codes``. Users can add their own
(e.g. a National Annex variant) by passing extra directories to ``list_design_codes``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field, model_validator

from geotek.core.errors import GeoTekError

BUILTIN_DIR = Path(__file__).parent / "design_codes"


class LocalizedText(BaseModel):
    tr: str
    en: str

    def get(self, lang: str) -> str:
        return self.tr if lang == "tr" else self.en


class FactorCombination(BaseModel):
    id: str
    label: LocalizedText
    applies_to: list[Literal["static", "seismic"]] = Field(default_factory=lambda: ["static"])
    load_factors: dict[str, float | None] = Field(default_factory=dict)
    material_factors: dict[str, float | None] = Field(default_factory=dict)
    resistance_factors: dict[str, float | None] = Field(default_factory=dict)
    passive_participation: float = Field(1.0, gt=0, le=1)
    """Fraction of the design passive resistance usable against sliding (TBDY: 0.3)."""


class VerificationEntry(BaseModel):
    """Traceability of one factor (or group) to the document it was checked against."""

    item: str
    value: str
    status: Literal["verified", "secondary", "unverified", "not_in_source"]
    """verified: primary/official text; secondary: reproduced by an official third party;
    unverified: not yet checked; not_in_source: the standard defines the factor without a value."""
    source: str = ""
    note: str = ""


FactorStatus = Literal["verified", "secondary", "unverified", "not_in_source", "user"]


class FactorSource(BaseModel):
    """Label shown next to a factor value: which document it comes from and how sure we are."""

    source: str
    status: FactorStatus


class FactorOverride(BaseModel):
    """A user-entered factor value. ``note`` should say why (e.g. project specification)."""

    value: float
    note: str = ""


class UsedFactor(BaseModel):
    """A factor actually used in a calculation, with its label (for the report)."""

    path: str
    value: float
    source: str
    status: FactorStatus


class DesignCode(BaseModel):
    id: str
    label: LocalizedText
    approach: Literal["global_fs", "partial_factors", "lrfd"]
    reference: str
    status: Literal["draft", "partially_verified", "verified", "incomplete"]
    factor_sources: dict[str, FactorSource] = Field(default_factory=dict)
    """Source label per factor path or path prefix (longest prefix wins)."""
    user_overrides: dict[str, FactorOverride] = Field(default_factory=dict)
    """Values replaced by the user (set through ``with_overrides``)."""
    safety_factors: dict[str, dict[str, float]] = Field(default_factory=dict)
    eccentricity_limits: dict[str, dict[str, float]] = Field(default_factory=dict)
    combinations: list[FactorCombination] = Field(default_factory=list)
    approaches: dict[str, list[str]] = Field(default_factory=dict)
    """Named design approaches -> combination ids (EC7: DA1, DA2, DA3)."""
    load_factors: dict[str, dict[str, float]] = Field(default_factory=dict)
    resistance_factors: dict[str, dict[str, float | None]] = Field(default_factory=dict)
    verification: list[VerificationEntry] = Field(default_factory=list)

    @model_validator(mode="after")
    def _check_blocks(self) -> DesignCode:
        required = {
            "global_fs": ("safety_factors",),
            "partial_factors": ("combinations",),
            "lrfd": ("load_factors", "resistance_factors"),
        }[self.approach]
        missing = [name for name in required if not getattr(self, name)]
        if missing:
            raise ValueError(f"Design code {self.id!r} ({self.approach}) is missing: {missing}")
        return self

    @property
    def is_usable(self) -> bool:
        return self.status != "incomplete"

    def combination(self, combo_id: str) -> FactorCombination:
        for combo in self.combinations:
            if combo.id == combo_id:
                return combo
        raise GeoTekError(f"Design code {self.id!r} has no combination {combo_id!r}")

    # --- factor paths ----------------------------------------------------------------------
    # global_fs     : safety.<check>.<case>, eccentricity.<soil|rock>.<case>
    # partial       : <combo>.load.<key>, <combo>.material.<key>, <combo>.resistance.<key>
    # lrfd          : load.<kind>.<key>, resistance.<group>.<key>, eccentricity.<soil|rock>.<case>

    def _table(self, path: str) -> tuple[dict, str]:
        parts = path.split(".")
        try:
            if self.approach == "partial_factors" and len(parts) == 3:
                combo = self.combination(parts[0])
                table = {"load": combo.load_factors, "material": combo.material_factors,
                         "resistance": combo.resistance_factors}[parts[1]]
                return table, parts[2]
            if len(parts) == 3:
                root = {"safety": self.safety_factors, "eccentricity": self.eccentricity_limits,
                        "load": self.load_factors, "resistance": self.resistance_factors}[parts[0]]
                return root[parts[1]], parts[2]
        except (KeyError, GeoTekError):
            pass
        raise GeoTekError(f"Design code {self.id!r} has no factor {path!r}")

    def get(self, path: str) -> float | None:
        table, key = self._table(path)
        if key not in table:
            raise GeoTekError(f"Design code {self.id!r} has no factor {path!r}")
        return table[key]

    def source_of(self, path: str) -> FactorSource:
        if path in self.user_overrides:
            note = self.user_overrides[path].note
            return FactorSource(source="Kullanıcı girdisi" + (f": {note}" if note else ""), status="user")
        best = ""
        for prefix in self.factor_sources:
            if (path == prefix or path.startswith(prefix + ".")) and len(prefix) > len(best):
                best = prefix
        if best:
            return self.factor_sources[best]
        status = "verified" if self.status == "verified" else "unverified"
        return FactorSource(source=self.reference, status=status)

    def with_overrides(self, overrides: dict[str, FactorOverride] | None) -> DesignCode:
        """Copy of the code with user values applied (the built-in file is not changed)."""
        if not overrides:
            return self
        code = self.model_copy(deep=True)
        for path, ov in overrides.items():
            ov = FactorOverride.model_validate(ov)
            _validate_override(code, path, ov.value)
            table, key = code._table(path)
            if key not in table:
                raise GeoTekError(f"Design code {self.id!r} has no factor {path!r}")
            table[key] = ov.value
            code.user_overrides[path] = ov
        return code


def _validate_override(code: DesignCode, path: str, value: float) -> None:
    parts = path.split(".")
    if code.approach == "partial_factors" and len(parts) < 3:
        raise GeoTekError(f"Design code {code.id!r} has no factor {path!r}")
    kind = parts[1] if code.approach == "partial_factors" else parts[0]
    if code.approach == "lrfd" and kind == "resistance":
        ok, rule = 0 < value <= 1.0, "0 < phi <= 1"
    elif kind in ("material", "resistance", "safety"):
        ok, rule = value >= 1.0, ">= 1.0"
    elif kind == "eccentricity":
        ok, rule = 0 < value <= 0.5, "0 < e/B <= 0.5"
    else:  # load factors (favourable ones may be below 1, Q_fav may be 0)
        ok, rule = value >= 0, ">= 0"
    if not ok:
        raise GeoTekError(f"Value {value} for {path!r} is not allowed (must be {rule})")


class FactorLog:
    """Reads factors from a design code and records every value used, with its label."""

    def __init__(self, code: DesignCode):
        self.code = code
        self.used: dict[str, UsedFactor] = {}

    def value(self, path: str, default: float | None = None) -> float:
        try:
            v = self.code.get(path)
        except GeoTekError:
            if default is None:
                raise
            return default
        src = self.code.source_of(path)
        if v is None:
            raise GeoTekError(
                f"Factor {path!r} has no value in {self.code.id!r} ({src.status}: {src.source}); "
                "enter it as a user value"
            )
        self.used[path] = UsedFactor(path=path, value=v, source=src.source, status=src.status)
        return v

    def as_list(self) -> list[UsedFactor]:
        return list(self.used.values())


def resolve_code(code_id: str, overrides: dict[str, FactorOverride] | None = None, *,
                 extra_dirs: list[str | Path] | None = None) -> DesignCode:
    return get_design_code(code_id, extra_dirs).with_overrides(overrides)


def require_factor(value: float | None, name: str) -> float:
    """Return a factor, refusing values that have not been entered yet."""
    if value is None:
        raise GeoTekError(f"Factor {name!r} has no value in this design code (not yet entered)")
    return value


def load_design_code(path: str | Path) -> DesignCode:
    with open(path, encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    return DesignCode.model_validate(data)


def list_design_codes(extra_dirs: list[str | Path] | None = None) -> dict[str, DesignCode]:
    """Load built-in codes, then codes from ``extra_dirs`` (which override by id)."""
    codes: dict[str, DesignCode] = {}
    for directory in [BUILTIN_DIR, *(extra_dirs or [])]:
        for path in sorted(Path(directory).glob("*.yaml")):
            code = load_design_code(path)
            codes[code.id] = code
    return codes


def get_design_code(code_id: str, extra_dirs: list[str | Path] | None = None) -> DesignCode:
    codes = list_design_codes(extra_dirs)
    try:
        return codes[code_id]
    except KeyError:
        raise GeoTekError(f"Unknown design code {code_id!r}; available: {sorted(codes)}") from None
