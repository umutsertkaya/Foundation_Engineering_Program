"""Read and write module-private project state.

Modules call these helpers with their manifest's state_model, state_version and
state_migrations.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from copy import deepcopy
from typing import TypeVar

from pydantic import BaseModel

from geotek.core.errors import GeoTekError
from geotek.core.models.project import ModuleSection, Project

M = TypeVar("M", bound=BaseModel)


def get_state(
    project: Project,
    module_id: str,
    model: type[M],
    version: int = 1,
    migrations: Mapping[int, Callable[[dict], dict]] | None = None,
) -> M:
    """Validate a migrated copy of a section without changing the project."""
    section = project.modules.get(module_id)
    if section is None:
        return model()
    if section.v > version:
        raise GeoTekError(
            f"Module {module_id!r} has newer module data "
            f"(stored: {section.v}, supported: {version})"
        )

    data = deepcopy(section.data)
    for from_version in range(section.v, version):
        step = migrations.get(from_version) if migrations is not None else None
        if step is None:
            raise GeoTekError(
                f"Missing migration for module {module_id!r}: "
                f"{from_version} -> {from_version + 1}"
            )
        data = step(data)
    return model.model_validate(data)


def set_state(
    project: Project, module_id: str, state: BaseModel, version: int = 1
) -> None:
    """Store validated state using its JSON representation and module version."""
    project.modules[module_id] = ModuleSection(v=version, data=state.model_dump(mode="json"))
