"""Anchored wall module: ground anchor design and anchored excavation support analysis."""

from __future__ import annotations

from geotek.core.models.anchors import ANCHOR_STATE_VERSION, AnchoredWallState
from geotek.core.modules import ModuleManifest
from geotek.modules.anchored_wall.api import router
from geotek.modules.anchored_wall.report import report_entries, report_writer

MANIFEST = ModuleManifest(
    id="anchored_wall",
    version="0.2.0",
    title_key="anchored_wall.title",
    description_key="anchored_wall.description",
    icon="anchor",
    order=45,
    router=router,
    state_model=AnchoredWallState,
    state_version=ANCHOR_STATE_VERSION,
    consumes=("core.soil_profiles",),
    report_entries=report_entries,
    report_writer=report_writer,
)
