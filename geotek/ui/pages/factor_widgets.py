"""Design code selection and the 'missing factors' form shared by the Module 2 pages."""

from __future__ import annotations

from PySide6.QtCore import Signal
from PySide6.QtGui import QDoubleValidator
from PySide6.QtWidgets import QComboBox, QGridLayout, QHBoxLayout, QLineEdit, QWidget

from geotek.config.codes import FactorOverride, list_design_codes
from geotek.core.errors import GeoTekError
from geotek.i18n import get_language, t
from geotek.services.walls_advanced import MissingFactor, required_inputs
from geotek.ui.labels import STATUS_TONE, factor_symbol, status_text
from geotek.ui.widgets import Badge, Card, FormGrid, button, label, repolish


class CodeSelector(QWidget):
    """Design code + design approach combo boxes bound to ``AppState``."""

    changed = Signal()

    def __init__(self, state, *, allow_global_fs: bool = True):
        super().__init__()
        self.state = state
        self.codes = {k: c for k, c in list_design_codes().items() if allow_global_fs or c.approach != "global_fs"}
        grid = FormGrid()
        grid.setContentsMargins(0, 0, 0, 0)
        self.setLayout(grid)
        self.code = QComboBox()
        lang = get_language()
        for key, c in self.codes.items():
            self.code.addItem(c.label.get(lang), key)
        self.approach = QComboBox()
        for combo in (self.code, self.approach):  # long code names must not widen the form column
            combo.setSizeAdjustPolicy(QComboBox.SizeAdjustPolicy.AdjustToMinimumContentsLengthWithIcon)
            combo.setMinimumContentsLength(12)
        grid.add(t("ui.code.code"), self.code)
        self.approach_label = grid.add(t("ui.code.approach"), self.approach)
        self.status = label("", "Hint", wrap=True)
        grid.add_full(self.status)
        self._grid = grid
        current = state.project.meta.design_code
        if current not in self.codes:
            current = next(iter(self.codes))
        self.code.setCurrentIndex(list(self.codes).index(current))
        self._fill_approaches()
        self.code.currentIndexChanged.connect(self._code_changed)
        self.approach.currentIndexChanged.connect(lambda _: self.changed.emit())
        state.codeChanged.connect(self._external_change)

    def _external_change(self, code_id: str) -> None:
        if code_id in self.codes and code_id != self.code_id():
            self.code.setCurrentIndex(list(self.codes).index(code_id))

    def _fill_approaches(self) -> None:
        c = self.codes[self.code_id()]
        self.approach.blockSignals(True)
        self.approach.clear()
        for name in c.approaches:
            self.approach.addItem(name, name)
        self.approach.blockSignals(False)
        self._grid.set_row_visible(self.approach, bool(c.approaches))
        self.code.setToolTip(self.code.currentText())
        self.status.setText(t("ui.code.reference", ref=c.reference, status=t(f"ui.code.status.{c.status}")))

    def _code_changed(self) -> None:
        self._fill_approaches()
        self.state.set_code(self.code_id())
        self.changed.emit()

    def show_code(self, code_id: str) -> None:
        """Display a code without making it the project's choice (basic level shows ASD)."""
        if code_id in self.codes and code_id != self.code_id():
            self.code.blockSignals(True)
            self.code.setCurrentIndex(list(self.codes).index(code_id))
            self.code.blockSignals(False)
            self._fill_approaches()

    def code_id(self) -> str:
        return self.code.currentData()

    def approach_id(self) -> str | None:
        return self.approach.currentData() if self.approach.count() else None

    def is_global_fs(self) -> bool:
        return self.codes[self.code_id()].approach == "global_fs"


class MissingFactorsCard(Card):
    """Lists factors the chosen code needs but does not give; the user enters value and note.

    No value is ever pre-filled: the regulation-dependent numbers must come from the user.
    """

    saved = Signal()

    def __init__(self, state):
        super().__init__(t("ui.missing.title"), t("ui.missing.subtitle"))
        self.state = state
        self.code_id = "asd"
        self.missing: list[MissingFactor] = []
        self.inputs: dict[str, tuple[QLineEdit, QLineEdit]] = {}
        self.badge = Badge("", "warn")
        self.add_header_widget(self.badge)
        self.rows = QGridLayout()
        self.rows.setHorizontalSpacing(8)
        self.rows.setVerticalSpacing(6)
        self.body.addLayout(self.rows)
        foot = QHBoxLayout()
        self.error = label("", "Error", wrap=True)
        foot.addWidget(self.error, 1)
        self.save_button = button(t("ui.missing.save"), "primary", self.save)
        foot.addWidget(self.save_button)
        self.body.addLayout(foot)
        self.setVisible(False)

    def update_for(self, code_id: str, approach: str | None, cases: list[bool]) -> list[MissingFactor]:
        self.code_id = code_id
        overrides = self.state.overrides(code_id)
        found: dict[str, MissingFactor] = {}
        for seismic in cases:
            for m in required_inputs(code_id, approach=approach, seismic=seismic, overrides=overrides):
                found.setdefault(m.path, m)
        self.missing = list(found.values())
        self._rebuild()
        return self.missing

    def _rebuild(self) -> None:
        while self.rows.count():
            item = self.rows.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        self.inputs = {}
        self.error.setText("")
        last_hint = None
        for r, m in enumerate(self.missing):
            symbol = factor_symbol(self.code_id, m.path)
            name = label(f"<b>{symbol}</b>  <span style='font-size:8.5pt'>{m.path}</span>")
            name.setToolTip(f"{m.source}\n{m.hint}".strip())
            badge = Badge(status_text(m.status), STATUS_TONE.get(m.status, "neutral"))
            value = QLineEdit()
            value.setPlaceholderText(t("ui.missing.value"))
            value.setValidator(QDoubleValidator(0.0, 100.0, 4))
            value.setProperty("missing", True)
            value.setFixedWidth(80)
            value.textChanged.connect(lambda text, w=value: (w.setProperty("missing", not text), repolish(w)))
            note = QLineEdit()
            note.setPlaceholderText(t("ui.missing.note"))
            base = 3 * r
            self.rows.addWidget(name, base, 0, 1, 2)
            self.rows.addWidget(badge, base, 2)
            self.rows.addWidget(value, base + 1, 0)
            self.rows.addWidget(note, base + 1, 1, 1, 2)
            text = m.hint or m.source
            if text != last_hint:  # same hint for a whole group: show it once
                self.rows.addWidget(label(text, "Hint", wrap=True), base + 2, 0, 1, 3)
                last_hint = text
            self.inputs[m.path] = (value, note)
        self.rows.setColumnStretch(1, 1)
        self.badge.set_tone("warn", t("ui.missing.count", count=len(self.missing)))
        self.setVisible(bool(self.missing))

    def fill(self, values: dict[str, float], note: str = "") -> None:
        """Enter values programmatically (used by tests and 'copy from' helpers)."""
        for path, v in values.items():
            if path in self.inputs:
                self.inputs[path][0].setText(f"{v:g}")
                self.inputs[path][1].setText(note)

    def save(self) -> bool:
        values: dict[str, FactorOverride] = {}
        for path, (value, note) in self.inputs.items():
            text = value.text().strip().replace(",", ".")
            if text:
                values[path] = FactorOverride(value=float(text), note=note.text().strip())
        if not values:
            self.error.setText(t("ui.missing.none_entered"))
            return False
        try:
            self.state.set_overrides(self.code_id, values)
        except (GeoTekError, ValueError) as exc:
            self.error.setText(str(exc))
            return False
        self.saved.emit()
        return True
