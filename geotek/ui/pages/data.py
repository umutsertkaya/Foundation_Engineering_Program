"""Field data page: CPT / SPT list with import, depth plots, data table and SBTn chart."""

from __future__ import annotations

import pandas as pd
from PySide6.QtCore import Qt
from PySide6.QtWidgets import QHBoxLayout, QListWidget, QListWidgetItem, QTableView, QTabWidget

from geotek.i18n import t
from geotek.plotting.figures import plot_cpt, plot_sbtn_chart, plot_spt
from geotek.ui.dialogs import CptImportDialog, SptImportDialog
from geotek.ui.pages.base import Page
from geotek.ui.widgets import Card, DataFrameModel, PlotCanvas, button, label

ROLE = Qt.ItemDataRole.UserRole


class DataPage(Page):
    def __init__(self, state):
        super().__init__(t("ui.nav.data"), t("ui.data.subtitle"))
        self.state = state
        self.selected: tuple[str, str] | None = None

        row = QHBoxLayout()
        row.setSpacing(18)
        side = Card(t("ui.data.investigations"))
        side.setFixedWidth(260)
        self.list = QListWidget()
        self.list.itemSelectionChanged.connect(self._on_select)
        side.body.addWidget(self.list, 1)
        side.body.addWidget(button(t("ui.data.import_cpt"), "primary", self.import_cpt))
        side.body.addWidget(button(t("ui.data.import_spt"), None, self.import_spt))
        side.body.addWidget(button(t("ui.delete"), "ghost", self.delete_selected))
        self.error = label("", "Error", wrap=True)
        side.body.addWidget(self.error)
        row.addWidget(side)

        main = Card()
        self.tabs = QTabWidget()
        self.plot_canvas = PlotCanvas()
        self.table_model = DataFrameModel()
        self.table = QTableView()
        self.table.setModel(self.table_model)
        self.table.setAlternatingRowColors(True)
        self.sbtn_canvas = PlotCanvas()
        self.tabs.addTab(self.plot_canvas, t("ui.tab.plots"))
        self.tabs.addTab(self.table, t("ui.tab.data"))
        self.tabs.addTab(self.sbtn_canvas, t("ui.tab.sbtn"))
        main.body.addWidget(self.tabs, 1)
        row.addWidget(main, 1)
        self.body.addLayout(row, 1)

        state.profileChanged.connect(self.refresh)
        self.refresh()

    def refresh(self) -> None:
        r = self.state.results
        inv = self.state.project.investigations
        self.list.blockSignals(True)
        self.list.clear()
        current = None
        for kind, ids in (("cpt", [c.id for c in inv.cpts]), ("spt", [b.id for b in inv.boreholes])):
            for ident in ids:
                text = f"{'CPT' if kind == 'cpt' else 'SPT'}   {ident}" + ("   ⚠" if ident in r.errors else "")
                item = QListWidgetItem(text)
                item.setData(ROLE, (kind, ident))
                if ident in r.errors:
                    item.setToolTip(r.errors[ident])
                self.list.addItem(item)
                if (kind, ident) == self.selected:
                    current = item
        self.list.blockSignals(False)
        if current is None and self.list.count():
            current = self.list.item(0)
        if current is not None:
            self.list.setCurrentItem(current)
            self._on_select()
        else:
            self.selected = None
            self._show()

    def select(self, kind: str, ident: str) -> None:
        for i in range(self.list.count()):
            if self.list.item(i).data(ROLE) == (kind, ident):
                self.list.setCurrentRow(i)
                return
        raise KeyError(ident)

    def _on_select(self) -> None:
        items = self.list.selectedItems()
        if items:
            self.selected = tuple(items[0].data(ROLE))
        self._show()

    def _show(self) -> None:
        r = self.state.results
        kind, ident = self.selected or (None, None)
        self.error.setText(r.errors.get(ident, "") if ident else "")
        if kind == "cpt" and ident in r.cpt:
            p = r.cpt[ident]
            self.table_model.set_frame(p.to_dataframe())
            self.plot_canvas.draw(plot_cpt, p)
            self.sbtn_canvas.draw(plot_sbtn_chart, p)
        elif kind == "spt" and ident in r.spt:
            p = r.spt[ident]
            self.table_model.set_frame(p.to_dataframe())
            self.plot_canvas.draw(plot_spt, p)
            self.sbtn_canvas.show_message(t("ui.msg.sbtn_cpt_only"))
        else:
            self.table_model.set_frame(pd.DataFrame())
            msg = r.errors.get(ident) if ident else t("ui.msg.select_investigation")
            self.plot_canvas.show_message(msg)
            self.sbtn_canvas.show_message(msg)

    # --- actions ------------------------------------------------------------------------

    def _add(self, obj, kind: str) -> None:
        inv = self.state.project.investigations
        if obj.id in {b.id for b in inv.boreholes} | {c.id for c in inv.cpts}:
            self.error.setText(t("ui.msg.duplicate_id", ident=obj.id))
            return
        (inv.cpts if kind == "cpt" else inv.boreholes).append(obj)
        self.selected = (kind, obj.id)
        self.state.reprocess()
        self.state.mark_dirty()
        self.state.investigationsChanged.emit()
        self.refresh()

    def import_cpt(self) -> None:
        dialog = CptImportDialog(self)
        if dialog.exec():
            self._add(dialog.result_obj, "cpt")

    def import_spt(self) -> None:
        dialog = SptImportDialog(self)
        if dialog.exec():
            self._add(dialog.result_obj, "spt")

    def delete_selected(self) -> None:
        if not self.selected:
            return
        kind, ident = self.selected
        inv = self.state.project.investigations
        if kind == "cpt":
            inv.cpts = [c for c in inv.cpts if c.id != ident]
        else:
            inv.boreholes = [b for b in inv.boreholes if b.id != ident]
        self.selected = None
        self.state.reprocess()
        self.state.mark_dirty()
        self.state.investigationsChanged.emit()
        self.refresh()
