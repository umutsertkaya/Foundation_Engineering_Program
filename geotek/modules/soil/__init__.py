"""Soil module: investigations, layering, profiles and design parameters."""

from __future__ import annotations

from geotek.core.modules import ModuleManifest
from geotek.modules.soil.api import router

MANIFEST = ModuleManifest(
    id="soil",
    version="0.1.0",
    title_key="soil.title",
    description_key="soil.description",
    icon="layers",
    order=10,
    router=router,
)
