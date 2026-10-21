"""Education module: static learning content; web-only, no API routes."""

from __future__ import annotations

from geotek.core.modules import ModuleManifest

MANIFEST = ModuleManifest(
    id="education",
    version="0.1.0",
    title_key="education.title",
    description_key="education.description",
    icon="school",
    order=90,
    router=None,
)
