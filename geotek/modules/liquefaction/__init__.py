"""Liquefaction module: seismic triggering analysis of project investigations."""

from __future__ import annotations

from geotek.core.modules import ModuleManifest
from geotek.modules.liquefaction.api import router

MANIFEST = ModuleManifest(
    id="liquefaction",
    version="0.1.0",
    title_key="liquefaction.title",
    description_key="liquefaction.description",
    icon="waves",
    order=20,
    router=router,
    consumes=("core.soil_profiles", "core.investigations"),
)
