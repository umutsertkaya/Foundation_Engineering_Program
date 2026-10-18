"""Top-level project container (saved as a .gtk JSON file)."""

from __future__ import annotations

import datetime as dt
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from geotek.config.codes import FactorOverride
from geotek.core.models.investigations import Investigations
from geotek.core.models.profile import SoilProfile
from geotek.core.models.structures import Structure

SCHEMA_VERSION = "1.3"


class ModuleSection(BaseModel):
    model_config = {"extra": "allow"}

    v: int = Field(1, ge=1)
    data: dict[str, Any] = Field(default_factory=dict)


class ProjectMeta(BaseModel):
    name: str
    number: str = ""
    engineer: str = ""
    date: dt.date = Field(default_factory=dt.date.today)
    schema_version: str = SCHEMA_VERSION
    language: Literal["tr", "en"] = "tr"
    design_code: str = "asd"
    """Id of the selected design code (see geotek.config.codes)."""
    analysis_level: Literal["basic", "advanced"] = "basic"


class SiteSeismic(BaseModel):
    pga_g: float | None = Field(None, ge=0, le=3, description="Peak ground acceleration [g]")
    mw: float | None = Field(None, ge=4, le=9.5, description="Moment magnitude")
    sds: float | None = Field(None, ge=0, description="TBDY 2018 short-period design coefficient")
    sd1: float | None = Field(None, ge=0)
    site_class: str | None = None
    source: Literal["user", "TBDY2018"] = "user"

    @model_validator(mode="after")
    def _pga_from_sds(self) -> SiteSeismic:
        # TBDY 2018 approximation: PGA = 0.4 * S_DS
        if self.source == "TBDY2018":
            if self.sds is None:
                raise ValueError("TBDY2018 source requires S_DS")
            self.pga_g = 0.4 * self.sds
        return self


class Project(BaseModel):
    meta: ProjectMeta
    site: SiteSeismic = Field(default_factory=SiteSeismic)
    investigations: Investigations = Field(default_factory=Investigations)
    soil_profiles: list[SoilProfile] = Field(default_factory=list)
    active_profile_id: str | None = None
    """Profile used by Module 1 processing (unit weights, liquefaction); None = the first one."""
    structures: list[Structure] = Field(default_factory=list)
    design_overrides: dict[str, dict[str, FactorOverride]] = Field(default_factory=dict)
    """User factor values per design code id, keyed by factor path."""
    modules: dict[str, ModuleSection] = Field(default_factory=dict)
    """Module-private state keyed by module id; sections of modules not present in this
    build are preserved unchanged on save.
    """
    module2_inputs: dict[str, dict] = Field(default_factory=dict)
    """Legacy (PySide6 UI): last form values of the Module 2 pages. Kept until that UI is removed."""

    @model_validator(mode="after")
    def _check_refs(self) -> Project:
        ids = [p.id for p in self.soil_profiles]
        if len(set(ids)) != len(ids):
            raise ValueError("Soil profile ids must be unique")
        known = {b.id for b in self.investigations.boreholes} | {
            c.id for c in self.investigations.cpts
        }
        for profile in self.soil_profiles:
            unknown = set(profile.source_ids) - known
            if unknown:
                raise ValueError(f"Profile {profile.id!r} references unknown sources {sorted(unknown)}")
        if self.active_profile_id is not None and self.active_profile_id not in ids:
            raise ValueError(f"Active profile {self.active_profile_id!r} does not exist")
        sids = [s.id for s in self.structures]
        if len(set(sids)) != len(sids):
            raise ValueError("Structure ids must be unique")
        # A structure whose source profile was deleted stays valid (it owns a copy); it is
        # reported as out of date through StructureSoilModel.is_stale.
        return self

    def active_profile(self) -> SoilProfile | None:
        if self.active_profile_id is not None:
            return self.profile(self.active_profile_id)
        return self.soil_profiles[0] if self.soil_profiles else None

    def structure(self, structure_id: str) -> Structure:
        for s in self.structures:
            if s.id == structure_id:
                return s
        raise KeyError(structure_id)

    def profile(self, profile_id: str) -> SoilProfile:
        for p in self.soil_profiles:
            if p.id == profile_id:
                return p
        raise KeyError(profile_id)
