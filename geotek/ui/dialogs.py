"""CSV / Excel import dialogs for CPT and SPT data."""

from __future__ import annotations

from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QDoubleSpinBox,
    QFileDialog,
    QFormLayout,
    QHBoxLayout,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QWidget,
)

from geotek.core.errors import GeoTekError
from geotek.i18n import t
from geotek.io.tabular import import_cpt, import_spt

FILE_FILTER = "CSV / Excel (*.csv *.txt *.xlsx *.xlsm *.xls)"
AUTO = "auto"


def _unit_combo(options):
    combo = QComboBox()
    combo.addItem(t("ui.import.unit_auto"), AUTO)
    for unit in options:
        combo.addItem(unit, unit)
    return combo


def _spin(lo, hi, value, decimals=2, suffix=""):
    box = QDoubleSpinBox()
    box.setRange(lo, hi)
    box.setDecimals(decimals)
    box.setValue(value)
    if suffix:
        box.setSuffix(suffix)
    return box


class _ImportDialog(QDialog):
    def __init__(self, title: str, parent=None):
        super().__init__(parent)
        self.setWindowTitle(title)
        self.setMinimumWidth(480)
        self.form = QFormLayout(self)
        self.path = QLineEdit()
        browse = QPushButton(t("ui.browse"))
        browse.clicked.connect(self._browse)
        row = QHBoxLayout()
        row.addWidget(self.path, 1)
        row.addWidget(browse)
        holder = QWidget()
        holder.setLayout(row)
        self.form.addRow(t("ui.import.file"), holder)
        self.ident = QLineEdit()
        self.form.addRow(t("ui.import.id"), self.ident)
        self.result_obj = None

    def _browse(self):
        path, _ = QFileDialog.getOpenFileName(self, t("ui.import.file"), "", FILE_FILTER)
        if path:
            self.path.setText(path)
            if not self.ident.text():
                from pathlib import Path

                self.ident.setText(Path(path).stem)

    def _add_buttons(self):
        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        buttons.accepted.connect(self._accept)
        buttons.rejected.connect(self.reject)
        self.form.addRow(buttons)

    def _gwt_row(self):
        self.has_gwt = QCheckBox(t("ui.import.gwt_known"))
        self.gwt = _spin(0, 200, 2.0, suffix=" m")
        self.gwt.setEnabled(False)
        self.has_gwt.toggled.connect(self.gwt.setEnabled)
        row = QHBoxLayout()
        row.addWidget(self.has_gwt)
        row.addWidget(self.gwt)
        holder = QWidget()
        holder.setLayout(row)
        self.form.addRow(t("term.gwt"), holder)

    def _accept(self):
        if not self.path.text() or not self.ident.text().strip():
            QMessageBox.warning(self, self.windowTitle(), t("ui.import.need_file_id"))
            return
        try:
            self.result_obj = self._load()
        except (GeoTekError, ValueError) as exc:
            QMessageBox.warning(self, self.windowTitle(), str(exc))
            return
        self.accept()


class CptImportDialog(_ImportDialog):
    def __init__(self, parent=None):
        super().__init__(t("ui.import.cpt_title"), parent)
        self.qc_unit = _unit_combo(["MPa", "kPa", "kgf/cm2", "tsf"])
        self.fs_unit = _unit_combo(["kPa", "MPa", "kgf/cm2", "tsf"])
        self.u2_unit = _unit_combo(["kPa", "MPa"])
        self.area_ratio = _spin(0.5, 1.0, 0.80)
        self.form.addRow(t("ui.import.qc_unit"), self.qc_unit)
        self.form.addRow(t("ui.import.fs_unit"), self.fs_unit)
        self.form.addRow(t("ui.import.u2_unit"), self.u2_unit)
        self.form.addRow(t("ui.import.area_ratio"), self.area_ratio)
        self._gwt_row()
        self._add_buttons()

    def _load(self):
        def unit(combo):
            value = combo.currentData()
            return None if value == AUTO else value

        return import_cpt(
            self.path.text(), self.ident.text().strip(),
            qc_unit=unit(self.qc_unit), fs_unit=unit(self.fs_unit), u2_unit=unit(self.u2_unit),
            area_ratio=self.area_ratio.value(),
            gwt_depth=self.gwt.value() if self.has_gwt.isChecked() else None,
        )


class SptImportDialog(_ImportDialog):
    def __init__(self, parent=None):
        super().__init__(t("ui.import.spt_title"), parent)
        self.energy = _spin(30, 100, 60, decimals=0, suffix=" %")
        self.diameter = _spin(50, 250, 100, decimals=0, suffix=" mm")
        self.sampler = QComboBox()
        self.sampler.addItem(t("ui.import.sampler_standard"), "standard")
        self.sampler.addItem(t("ui.import.sampler_no_liner"), "no_liner")
        self.form.addRow(t("ui.import.energy"), self.energy)
        self.form.addRow(t("ui.import.diameter"), self.diameter)
        self.form.addRow(t("ui.import.sampler"), self.sampler)
        self._gwt_row()
        self._add_buttons()

    def _load(self):
        return import_spt(
            self.path.text(), self.ident.text().strip(),
            energy_ratio=self.energy.value(), borehole_diameter_mm=self.diameter.value(),
            sampler=self.sampler.currentData(),
            gwt_depth=self.gwt.value() if self.has_gwt.isChecked() else None,
        )
