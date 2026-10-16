"""Discover module manifests and mount their optional HTTP routers."""

from __future__ import annotations

from functools import lru_cache
from importlib import import_module
from pathlib import Path
from pkgutil import iter_modules
from typing import TYPE_CHECKING

import geotek.modules
from geotek.core.errors import GeoTekError
from geotek.core.modules import ModuleManifest

if TYPE_CHECKING:
    from fastapi import FastAPI


def module_ids() -> tuple[str, ...]:
    """List public module packages, using the generated index in frozen builds."""
    names = tuple(sorted(
        info.name for info in iter_modules(geotek.modules.__path__)
        if info.ispkg and not info.name.startswith("_")
    ))
    if names:
        return names
    from geotek.modules._index import MODULE_IDS

    return tuple(sorted(MODULE_IDS))


@lru_cache(maxsize=1)
def discover() -> list[ModuleManifest]:
    """Load validated manifests in menu order; reuse them until clear_cache()."""
    manifests: dict[str, ModuleManifest] = {}
    for id in module_ids():
        package = import_module(f"geotek.modules.{id}")
        manifest = getattr(package, "MANIFEST", None)
        if not isinstance(manifest, ModuleManifest):
            raise GeoTekError(f"Module {id!r}: MANIFEST must be a ModuleManifest")
        if manifest.id != id:
            raise GeoTekError(f"Module {id!r}: manifest id {manifest.id!r} does not match package")
        if manifest.id in manifests:
            raise GeoTekError(f"Duplicate module id: {manifest.id!r}")
        manifests[manifest.id] = manifest
    return sorted(manifests.values(), key=lambda manifest: (manifest.order, manifest.id))


def clear_cache() -> None:
    """Discard cached discovery results."""
    discover.cache_clear()


def get_module(id: str) -> ModuleManifest:
    """Return one discovered manifest or raise a domain error."""
    manifests = {manifest.id: manifest for manifest in discover()}
    try:
        return manifests[id]
    except KeyError:
        raise GeoTekError(f"Unknown module: {id!r}") from None


def mount_modules(app: FastAPI, prefix: str = "/api") -> None:
    """Mount each router below the module's dedicated API prefix."""
    for manifest in discover():
        if manifest.router is not None:
            app.include_router(
                manifest.router(), prefix=f"{prefix}/m/{manifest.id}", tags=[manifest.id],
            )


def design_code_dirs() -> tuple[Path, ...]:
    """Concatenate module design-code directories in discovery order."""
    return tuple(path for manifest in discover() for path in manifest.design_code_dirs)
