"""Design code factors: every value with its source label; any value can be replaced by the user."""

from __future__ import annotations

from PySide6.QtGui import QDoubleValidator
from PySide6.QtWidgets import QHBoxLayout, QLineEdit

from geotek.config.codes import FactorOverride
from geotek.core.errors import GeoTekError
from geotek.i18n import t
from geotek.services.walls_advanced import list_factors
from geotek.ui.labels import STATUS_TONE, factor_symbol, status_text
from geotek.ui.pages.base import Page
from geotek.ui.pages.factor_widgets import CodeSelector
from geotek.ui.widgets import Badge, Card, button, fill_table, label, make_table, table_item


class FactorsPage(Page):
    def __init__(self, state):
        super().__init__(t("ui.nav.factors"), t("ui.factors.subtitle"))
        self.state = state
        self.rows = []

        top = QHBoxLayout()
        top.setSpacing(18)
        code_card = Card(t("ui.code.title"))
        code_card.setFixedWidth(430)
        self.code_selector = CodeSelector(state)
        self.code_selector.changed.connect(self.refresh)
        code_card.body.addWidget(self.code_selector)
        self.basic_note = label(t("ui.factors.basic_note"), "Hint", wrap=True)
        code_card.body.addWidget(self.basic_note)
        top.addWidget(code_card)

        legend = Card(t("ui.factors.legend"))
        lay = QHBoxLayout()
        lay.setSpacing(6)
        for status, tone in STATUS_TONE.items():
            b = Badge(status_text(status), tone)
            b.setToolTip(t(f"fstatus.{status}_tip"))
            lay.addWidget(b)
        lay.addStretch(1)
        legend.body.addLayout(lay)
        legend.body.addWidget(label(t("ui.factors.legend_text"), "Hint", wrap=True))
        top.addWidget(legend, 1)
        self.body.addLayout(top)

        table_card = Card(t("ui.factors.all"))
        self.search = QLineEdit()
        self.search.setPlaceholderText(t("ui.factors.search"))
        self.search.setFixedWidth(240)
        self.search.textChanged.connect(lambda _: self._fill())
        table_card.add_header_widget(self.search)
        self.table = make_table([t("ui.col.symbol"), t("ui.col.path"), t("ui.col.value"), t("ui.col.status"),
                                 t("ui.col.source")])
        self.table.itemSelectionChanged.connect(self._selected)
        table_card.body.addWidget(self.table, 1)

        edit = QHBoxLayout()
        edit.setSpacing(8)
        self.edit_label = label(t("ui.factors.pick"), "Muted")
        self.value = QLineEdit()
        self.value.setValidator(QDoubleValidator(0.0, 100.0, 4))
        self.value.setPlaceholderText(t("ui.missing.value"))
        self.value.setFixedWidth(90)
        self.note = QLineEdit()
        self.note.setPlaceholderText(t("ui.missing.note"))
        self.save_button = button(t("ui.factors.save"), "primary", self.save)
        self.remove_button = button(t("ui.factors.remove"), "ghost", self.remove)
        edit.addWidget(self.edit_label, 2)
        edit.addWidget(self.value)
        edit.addWidget(self.note, 2)
        edit.addWidget(self.save_button)
        edit.addWidget(self.remove_button)
        table_card.body.addLayout(edit)
        self.error = label("", "Error", wrap=True)
        table_card.body.addWidget(self.error)
        self.body.addWidget(table_card, 1)

        state.levelChanged.connect(lambda _: self.refresh())
        state.overridesChanged.connect(lambda _: self.refresh())
        self.refresh()

    def code_id(self) -> str:
        return "asd" if self.state.level == "basic" else self.code_selector.code_id()

    def refresh(self) -> None:
        basic = self.state.level == "basic"
        self.code_selector.setEnabled(not basic)
        self.code_selector.show_code("asd" if basic else self.state.project.meta.design_code)
        self.basic_note.setVisible(basic)
        code = self.code_id()
        self.rows = list_factors(code, self.state.overrides(code))
        self._fill()

    def _fill(self) -> None:
        code = self.code_id()
        needle = self.search.text().strip().lower()
        overrides = self.state.overrides(code)
        out, self._shown = [], []
        for r in self.rows:
            symbol = factor_symbol(code, r.path)
            if needle and needle not in r.path.lower() and needle not in symbol.lower():
                continue
            self._shown.append(r)
            note = overrides[r.path].note if r.path in overrides else ""
            source = r.source if r.value is not None or r.status == "user" else f"{r.source} — {t('ui.factors.empty')}"
            out.append([table_item(symbol, bold=True), table_item(r.path),
                        table_item("—" if r.value is None else f"{r.value:g}", align_right=True,
                                   tone=None if r.value is not None else "warn"),
                        table_item(status_text(r.status), tone=STATUS_TONE.get(r.status)),
                        table_item(source + (f" ({note})" if note and r.status != "user" else ""), tooltip=source)])
        fill_table(self.table, out)
        self._selected()

    def _current(self):
        rows = {i.row() for i in self.table.selectedIndexes()}
        return self._shown[min(rows)] if rows else None

    def _selected(self) -> None:
        r = self._current()
        self.error.setText("")
        for w in (self.value, self.note, self.save_button):
            w.setEnabled(r is not None)
        self.remove_button.setEnabled(r is not None and r.status == "user")
        if r is None:
            self.edit_label.setText(t("ui.factors.pick"))
            return
        self.edit_label.setText(f"{factor_symbol(self.code_id(), r.path)}  ·  {r.path}")
        self.value.setText("" if r.value is None else f"{r.value:g}")
        ov = self.state.overrides(self.code_id()).get(r.path)
        self.note.setText(ov.note if ov else "")

    def save(self) -> None:
        r = self._current()
        text = self.value.text().strip().replace(",", ".")
        if r is None or not text:
            self.error.setText(t("ui.missing.none_entered"))
            return
        try:
            self.state.set_overrides(self.code_id(), {r.path: FactorOverride(value=float(text),
                                                                             note=self.note.text().strip())})
        except (GeoTekError, ValueError) as exc:
            self.error.setText(str(exc))

    def remove(self) -> None:
        r = self._current()
        if r is not None:
            self.state.remove_override(self.code_id(), r.path)
