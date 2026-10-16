"""Sheet pile module: cantilever and anchored sheet pile design."""

from __future__ import annotations

from geotek.core.modules import ModuleManifest
from geotek.modules.sheet_pile.api import router

MANIFEST = ModuleManifest(
    id="sheet_pile",
    version="0.1.0",
    title_key="sheet_pile.title",
    description_key="sheet_pile.description",
    icon="columns",
    order=40,
    router=router,
    consumes=("core.soil_profiles", "core.structures:sheet_pile"),
    structure_kinds=("sheet_pile",),
)
