"""Report module: Word (docx) report from stored module results."""

from __future__ import annotations

from geotek.core.modules import ModuleManifest
from geotek.modules.report.api import router

MANIFEST = ModuleManifest(
    id="report",
    version="0.1.0",
    title_key="report.title",
    description_key="report.description",
    icon="file-text",
    order=50,
    router=router,
    consumes=("core.soil_profiles", "core.structures:retaining_wall",
              "core.structures:sheet_pile", "liquefaction.result"),
)
