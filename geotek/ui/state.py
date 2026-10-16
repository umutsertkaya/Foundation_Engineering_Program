"""Shared application state: the open project and change notifications between pages."""

from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import QObject, Signal

from geotek.config.codes import FactorOverride, resolve_code
from geotek.core.models.project import Project
from geotek.core.models.profile import SoilProfile
from geotek.services.module1 import Module1Results, active_profile, process_investigations


class AppState(QObject):
    dirtyChanged = Signal(bool)
    levelChanged = Signal(str)
    codeChanged = Signal(str)
    overridesChanged = Signal(str)
    profileChanged = Signal()
    investigationsChanged = Signal()

    def __init__(self, project: Project, path: Path | None = None):
        super().__init__()
        self.project = project
        self.path = path
        self.results: Module1Results = process_investigations(project)
        self.dirty = False

    # --- dirty flag ---------------------------------------------------------------------

    def mark_dirty(self, dirty: bool = True) -> None:
        if dirty != self.dirty:
            self.dirty = dirty
            self.dirtyChanged.emit(dirty)

    # --- Module 1 -----------------------------------------------------------------------

    def profile(self) -> SoilProfile | None:
        return active_profile(self.project)

    def reprocess(self) -> None:
        self.results = process_investigations(self.project)

    # --- analysis level and design code -------------------------------------------------

    @property
    def level(self) -> str:
        return self.project.meta.analysis_level

    def set_level(self, level: str) -> None:
        if level != self.project.meta.analysis_level:
            self.project.meta.analysis_level = level
            self.mark_dirty()
            self.levelChanged.emit(level)

    @property
    def code(self) -> str:
        """Design code in effect: ASD at the basic level, the project's choice at the advanced level."""
        return "asd" if self.level == "basic" else self.project.meta.design_code

    def set_code(self, code_id: str) -> None:
        if code_id != self.project.meta.design_code:
            self.project.meta.design_code = code_id
            self.mark_dirty()
            self.codeChanged.emit(code_id)

    # --- user factor values -------------------------------------------------------------

    def overrides(self, code_id: str) -> dict[str, FactorOverride]:
        return dict(self.project.design_overrides.get(code_id, {}))

    def set_overrides(self, code_id: str, values: dict[str, FactorOverride]) -> None:
        """Store several user values at once after validating them all (raises GeoTekError)."""
        merged = {**self.overrides(code_id), **values}
        resolve_code(code_id, merged)
        self.project.design_overrides[code_id] = merged
        self.mark_dirty()
        self.overridesChanged.emit(code_id)

    def remove_override(self, code_id: str, path: str) -> None:
        current = self.overrides(code_id)
        if current.pop(path, None) is not None:
            if current:
                self.project.design_overrides[code_id] = current
            else:
                self.project.design_overrides.pop(code_id, None)
            self.mark_dirty()
            self.overridesChanged.emit(code_id)

    # --- form memory --------------------------------------------------------------------

    def form(self, name: str) -> dict:
        return dict(self.project.module2_inputs.get(name, {}))

    def store_form(self, name: str, values: dict) -> None:
        if self.project.module2_inputs.get(name) != values:
            self.project.module2_inputs[name] = values
            self.mark_dirty()
