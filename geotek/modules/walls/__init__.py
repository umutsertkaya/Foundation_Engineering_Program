"""Walls module: cantilever and gravity retaining wall sizing and checking."""

from __future__ import annotations

from geotek.core.modules import ModuleManifest
from geotek.modules.walls.api import router

MANIFEST = ModuleManifest(
    id="walls",
    version="0.1.0",
    title_key="walls.title",
    description_key="walls.description",
    icon="wall",
    order=30,
    router=router,
    consumes=("core.soil_profiles", "core.structures:retaining_wall"),
    structure_kinds=("retaining_wall",),
)
