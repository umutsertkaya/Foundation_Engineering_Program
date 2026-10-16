"""Soil profile page: groundwater levels, layer table (with design parameters) and borehole log."""

from __future__ import annotations

from pydantic import ValidationError
from PySide6.QtWidgets import (
    QAbstractItemView,
    QComboBox,
    QHBoxLayout,
    QHeaderView,
    QLineEdit,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from geotek.core.models.profile import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.i18n import t
from geotek.plotting.figures import plot_borehole_log
from geotek.ui.pages.base import Page
from geotek.ui.widgets import Card, FormGrid, NumberField, PlotCanvas, button, label
from geotek.ui.worker import error_text

COLUMNS = ("id", "top", "bottom", "description", "uscs", "behaviour", "gamma", "gamma_sat", "phi_eff", "c_eff", "su")
NUMERIC = {"top", "bottom", "gamma", "gamma_sat", "phi_eff", "c_eff", "su"}
OPTIONAL = {"gamma_sat", "phi_eff", "c_eff", "su"}
DESIGN = {"phi_eff", "c_eff", "su"}
BEHAVIOURS = ("drained", "undrained")


class ProfilePage(Page):
    def __init__(self, state):
        super().__init__(t("ui.nav.profile"), t("ui.profile.subtitle"))
        self.state = state
        self._original: dict[str, SoilLayer] = {}

        row = QHBoxLayout()
        row.setSpacing(18)
        col = Card(t("ui.profile.general"))
        grid = FormGrid()
        self.name = QLineEdit()
        self.gwt_insitu = NumberField(0, 200, 2.0, unit="m")
        self.gwt_design = NumberField(0, 200, 2.0, unit="m")
        self.gwt_seismic = NumberField(0, 200, 2.0, unit="m")
        grid.add(t("ui.profile.name"), self.name)
        grid.add(t("ui.profile.gwt_insitu"), self.gwt_insitu)
        grid.add(t("ui.profile.gwt_design"), self.gwt_design)
        grid.add(t("ui.profile.gwt_seismic"), self.gwt_seismic)
        col.body.addLayout(grid)

        layers = Card(t("ui.profile.layers"), t("ui.profile.layers_hint"))
        self.table = QTableWidget(0, len(COLUMNS))
        self.table.setHorizontalHeaderLabels([t(f"ui.layer.{c}") for c in COLUMNS])
        self.table.verticalHeader().setVisible(False)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setAlternatingRowColors(True)
        head = self.table.horizontalHeader()
        head.setSectionResizeMode(QHeaderView.ResizeMode.ResizeToContents)
        head.setStretchLastSection(True)
        layers.body.addWidget(self.table, 1)
        buttons = QHBoxLayout()
        buttons.addWidget(button(t("ui.add_layer"), None, self.add_layer))
        buttons.addWidget(button(t("ui.remove_layer"), "ghost", self.remove_selected))
        buttons.addStretch(1)
        self.error = label("", "Error", wrap=True)
        buttons.addWidget(self.error, 2)
        buttons.addWidget(button(t("ui.apply"), "primary", self.apply))
        layers.body.addLayout(buttons)

        left_widget = QWidget()
        lv = QVBoxLayout(left_widget)
        lv.setContentsMargins(0, 0, 0, 0)
        lv.setSpacing(14)
        lv.addWidget(col)
        lv.addWidget(layers, 1)
        row.addWidget(left_widget, 3)

        log_card = Card(t("plot.log"))
        self.log_canvas = PlotCanvas()
        self.log_canvas.setMinimumWidth(300)
        log_card.body.addWidget(self.log_canvas, 1)
        log_card.setMaximumWidth(420)
        row.addWidget(log_card, 1)
        self.body.addLayout(row, 1)

        self.set_profile(state.profile())
        self.refresh_log()

    # --- table --------------------------------------------------------------------------

    def set_profile(self, profile: SoilProfile | None) -> None:
        self.table.setRowCount(0)
        self._original = {}
        if profile is None:
            return
        self.name.setText(profile.name)
        self.gwt_insitu.setValue(profile.gwt.depth_insitu)
        self.gwt_design.setValue(profile.gwt.depth_design)
        self.gwt_seismic.setValue(profile.gwt.depth_seismic)
        for layer in profile.layers:
            self._original[layer.id] = layer
            d = layer.design
            self._append(dict(id=layer.id, top=layer.top, bottom=layer.bottom, description=layer.description,
                              uscs=layer.uscs or "", behaviour=layer.behaviour, gamma=layer.gamma,
                              gamma_sat=layer.gamma_sat, phi_eff=d.phi_eff,
                              c_eff=d.c_eff if d.c_eff else None, su=d.su))

    def _append(self, values: dict) -> None:
        row = self.table.rowCount()
        self.table.insertRow(row)
        for col, name in enumerate(COLUMNS):
            value = values.get(name)
            if name == "behaviour":
                combo = QComboBox()
                for b in BEHAVIOURS:
                    combo.addItem(t(f"ui.behaviour.{b}"), b)
                combo.setCurrentIndex(BEHAVIOURS.index(value or "drained"))
                self.table.setCellWidget(row, col, combo)
                continue
            text = "" if value is None else (f"{value:g}" if isinstance(value, float) else str(value))
            self.table.setItem(row, col, QTableWidgetItem(text))

    def add_layer(self) -> None:
        row = self.table.rowCount()
        top = 0.0
        if row:
            item = self.table.item(row - 1, COLUMNS.index("bottom"))
            top = float(item.text()) if item and item.text() else 0.0
        self._append(dict(id=f"L{row + 1}", top=top, bottom=top + 2.0, gamma=18.0, gamma_sat=19.0))

    def remove_selected(self) -> None:
        for index in sorted({i.row() for i in self.table.selectedIndexes()}, reverse=True):
            self.table.removeRow(index)

    def build_profile(self) -> SoilProfile:
        layers = []
        for row in range(self.table.rowCount()):
            values, design = {}, {}
            for col, name in enumerate(COLUMNS):
                if name == "behaviour":
                    values[name] = self.table.cellWidget(row, col).currentData()
                    continue
                item = self.table.item(row, col)
                text = item.text().strip().replace(",", ".") if item else ""
                if name in NUMERIC:
                    if not text:
                        if name in OPTIONAL:
                            continue
                        raise ValueError(t("ui.err.empty_cell", row=row + 1, column=t(f"ui.layer.{name}")))
                    (design if name in DESIGN else values)[name] = float(text)
                elif text:
                    values[name] = text
            values.setdefault("id", f"L{row + 1}")
            original = self._original.get(values["id"])
            if original is not None:
                base = original.design.model_dump()
                base.update({"phi_eff": None, "su": None, "c_eff": 0.0, **design})
                layer = original.model_copy(update={**values, "design": DesignParameters(**base)})
                layers.append(SoilLayer.model_validate(layer.model_dump()))
            else:
                layers.append(SoilLayer(**values, design=DesignParameters(**design)))
        return SoilProfile(
            id="P1", name=self.name.text().strip(), layers=layers,
            gwt=GroundwaterCondition(depth_insitu=self.gwt_insitu.value(), depth_design=self.gwt_design.value(),
                                     depth_seismic=self.gwt_seismic.value()),
        )

    def apply(self) -> bool:
        try:
            profile = self.build_profile()
        except (ValueError, ValidationError) as exc:
            self.error.setText(error_text(exc))
            return False
        self.error.setText("")
        profile.source_ids = []
        self.state.project.soil_profiles = [profile]
        self._original = {layer.id: layer for layer in profile.layers}
        self.state.reprocess()
        self.state.mark_dirty()
        self.state.profileChanged.emit()
        self.refresh_log()
        return True

    def refresh_log(self) -> None:
        profile = self.state.profile()
        if profile is None:
            self.log_canvas.show_message(t("ui.msg.no_profile"))
            return
        spt = next(iter(self.state.results.spt.values()), None)
        self.log_canvas.draw(plot_borehole_log, profile, spt)
