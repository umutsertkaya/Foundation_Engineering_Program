"""Reusable Qt widgets: cards, form fields, segmented control, badges, result banner, plot canvas,
tables and a read-only DataFrame model."""

from __future__ import annotations

import numpy as np
import pandas as pd
from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg
from matplotlib.figure import Figure
from PySide6.QtCore import QAbstractTableModel, QModelIndex, Qt, Signal
from PySide6.QtGui import QColor, QFont, QFontMetrics
from PySide6.QtWidgets import (
    QAbstractItemView,
    QButtonGroup,
    QCheckBox,
    QDoubleSpinBox,
    QFileDialog,
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QMenu,
    QPushButton,
    QSizePolicy,
    QStackedLayout,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from geotek.i18n import t
from geotek.plotting import style
from geotek.ui import theme


def repolish(widget: QWidget) -> None:
    """Re-apply the style sheet after a dynamic property change."""
    widget.style().unpolish(widget)
    widget.style().polish(widget)


def label(text: str = "", name: str | None = None, wrap: bool = False) -> QLabel:
    lab = QLabel(text)
    if name:
        lab.setObjectName(name)
    lab.setWordWrap(wrap)
    return lab


def button(text: str, kind: str | None = None, slot=None) -> QPushButton:
    b = QPushButton(text)
    if kind:
        b.setProperty("kind", kind)
    b.setCursor(Qt.CursorShape.PointingHandCursor)
    if slot is not None:
        b.clicked.connect(slot)
    return b


class Badge(QLabel):
    """Small rounded status chip; tone is one of good, bad, warn, info, user, neutral."""

    def __init__(self, text: str = "", tone: str = "neutral", parent=None):
        super().__init__(text, parent)
        self.setSizePolicy(QSizePolicy.Policy.Maximum, QSizePolicy.Policy.Fixed)
        self.set_tone(tone)

    def set_tone(self, tone: str, text: str | None = None) -> None:
        if text is not None:
            self.setText(text)
        self.setProperty("tone", tone)
        repolish(self)


class Card(QFrame):
    """Rounded surface with a title row and a body layout."""

    def __init__(self, title: str = "", subtitle: str = "", parent=None):
        super().__init__(parent)
        self.setObjectName("Card")
        outer = QVBoxLayout(self)
        outer.setContentsMargins(16, 14, 16, 16)
        outer.setSpacing(10)
        self.header = QHBoxLayout()
        self.header.setSpacing(8)
        self.title = label(title, "CardTitle")
        self.header.addWidget(self.title)
        self.header.addStretch(1)
        if title:
            outer.addLayout(self.header)
        self.subtitle = label(subtitle, "Hint", wrap=True)
        self.subtitle.setVisible(bool(subtitle))
        outer.addWidget(self.subtitle)
        self.body = QVBoxLayout()
        self.body.setSpacing(8)
        outer.addLayout(self.body)

    def add_header_widget(self, widget: QWidget) -> None:
        self.header.addWidget(widget)


class FormGrid(QGridLayout):
    """Two-column form: muted label on the left, field (with optional unit) on the right."""

    def __init__(self):
        super().__init__()
        self.setHorizontalSpacing(12)
        self.setVerticalSpacing(8)
        self.setColumnStretch(1, 1)
        self._rows: dict[QWidget, tuple[QLabel, QWidget]] = {}

    def add(self, text: str, field: QWidget, tooltip: str = "") -> QLabel:
        row = self.rowCount()
        lab = label(text, "FieldLabel")
        lab.setMinimumWidth(110)
        if tooltip:
            lab.setToolTip(tooltip)
            field.setToolTip(tooltip)
        self.addWidget(lab, row, 0)
        self.addWidget(field, row, 1)
        self._rows[field] = (lab, field)
        return lab

    def add_full(self, widget: QWidget) -> None:
        self.addWidget(widget, self.rowCount(), 0, 1, 2)

    def set_row_visible(self, field: QWidget, visible: bool) -> None:
        lab, f = self._rows[field]
        lab.setVisible(visible)
        f.setVisible(visible)


class NumberField(QDoubleSpinBox):
    """Plain numeric input (no spin arrows); ignores the mouse wheel unless focused."""

    def __init__(self, lo: float, hi: float, value: float, decimals: int = 2, step: float = 0.1, unit: str = ""):
        super().__init__()
        self.setRange(lo, hi)
        self.setDecimals(decimals)
        self.setSingleStep(step)
        self.setValue(value)
        self.setButtonSymbols(QDoubleSpinBox.ButtonSymbols.NoButtons)
        self.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        self.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        self.setKeyboardTracking(False)
        self.setMinimumWidth(90)
        if unit:
            self.setSuffix(f"  {unit}")

    def resizeEvent(self, event):  # noqa: N802
        # Fusion + a styled QAbstractSpinBox without buttons collapses the inner editor; size it here.
        super().resizeEvent(event)
        self.lineEdit().setGeometry(self.rect().adjusted(8, 1, -8, -1))

    def showEvent(self, event):  # noqa: N802
        super().showEvent(event)
        self.lineEdit().setGeometry(self.rect().adjusted(8, 1, -8, -1))

    def wheelEvent(self, event):
        if self.hasFocus():
            super().wheelEvent(event)
        else:
            event.ignore()


class OptionalNumber(QWidget):
    """Number field with a check box. ``value()`` is None while the box is in its 'off' state.

    ``auto_text`` is shown next to the box; with ``checked_is_auto`` the checked state means
    'automatic' (field disabled), otherwise checked means 'use this value'.
    """

    changed = Signal()

    def __init__(self, field: NumberField, auto_text: str, *, checked_is_auto: bool = True, checked: bool = True):
        super().__init__()
        self.field = field
        self.checked_is_auto = checked_is_auto
        self.check = QCheckBox(auto_text)
        lay = QHBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(10)
        lay.addWidget(self.field, 1)
        lay.addWidget(self.check)
        self.check.toggled.connect(self._sync)
        self.field.valueChanged.connect(self.changed)
        self.check.setChecked(checked)
        self._sync()

    def _sync(self) -> None:
        self.field.setEnabled(self.check.isChecked() != self.checked_is_auto)
        self.changed.emit()

    def value(self) -> float | None:
        return self.field.value() if self.field.isEnabled() else None

    def set_value(self, value: float | None) -> None:
        if value is None:
            self.check.setChecked(self.checked_is_auto)
        else:
            self.check.setChecked(not self.checked_is_auto)
            self.field.setValue(value)


class Segmented(QFrame):
    """Exclusive choice shown as joined buttons (modern replacement for small combo boxes)."""

    changed = Signal(str)

    def __init__(self, options: list[tuple[str, str]], value: str | None = None):
        super().__init__()
        self.setObjectName("Segmented")
        self.setSizePolicy(QSizePolicy.Policy.Maximum, QSizePolicy.Policy.Fixed)
        lay = QHBoxLayout(self)
        lay.setContentsMargins(3, 3, 3, 3)
        lay.setSpacing(2)
        self.group = QButtonGroup(self)
        self.group.setExclusive(True)
        self.buttons: dict[str, QPushButton] = {}
        for key, text in options:
            b = QPushButton(text)
            bold = QFont(b.font())
            bold.setBold(True)
            b.setMinimumWidth(QFontMetrics(bold).horizontalAdvance(text) + 30)
            b.setCheckable(True)
            b.setProperty("segment", True)
            b.setCursor(Qt.CursorShape.PointingHandCursor)
            self.group.addButton(b)
            self.buttons[key] = b
            lay.addWidget(b)
            b.toggled.connect(lambda on, k=key: on and self.changed.emit(k))
        self.set_value(value or options[0][0])

    def value(self) -> str:
        for key, b in self.buttons.items():
            if b.isChecked():
                return key
        return next(iter(self.buttons))

    def set_value(self, key: str) -> None:
        if key in self.buttons:
            self.buttons[key].setChecked(True)


class Tile(QFrame):
    """Key figure: large value with a small caption."""

    def __init__(self, caption: str, value: str = "–"):
        super().__init__()
        self.setObjectName("Tile")
        lay = QVBoxLayout(self)
        lay.setContentsMargins(12, 8, 12, 8)
        lay.setSpacing(0)
        self.value = label(value, "TileValue")
        self.caption = label(caption, "TileLabel")
        lay.addWidget(self.value)
        lay.addWidget(self.caption)


class Banner(QFrame):
    """Pass/fail summary: big title, explanation lines and a row of key-figure tiles."""

    def __init__(self):
        super().__init__()
        self.setObjectName("Banner")
        lay = QVBoxLayout(self)
        lay.setContentsMargins(18, 14, 18, 14)
        lay.setSpacing(4)
        top = QHBoxLayout()
        self.title = label("", "BannerTitle")
        self.mode = Badge("", "neutral")
        top.addWidget(self.title)
        top.addSpacing(8)
        top.addWidget(self.mode)
        top.addStretch(1)
        lay.addLayout(top)
        self.line1 = label("", wrap=True)
        self.line2 = label("", "Muted", wrap=True)
        lay.addWidget(self.line1)
        lay.addWidget(self.line2)
        self.tiles = QGridLayout()
        self.tiles.setHorizontalSpacing(8)
        self.tiles.setVerticalSpacing(8)
        lay.addSpacing(6)
        lay.addLayout(self.tiles)

    def set_result(self, tone: str, title: str, mode: str, line1: str, line2: str,
                   tiles: list[tuple[str, str]]) -> None:
        self.setProperty("tone", tone)
        repolish(self)
        for w in self.findChildren(QLabel):
            repolish(w)
        self.title.setText(title)
        self.mode.set_tone("info", mode)
        self.mode.setVisible(bool(mode))
        self.line1.setText(line1)
        self.line1.setVisible(bool(line1))
        self.line2.setText(line2)
        self.line2.setVisible(bool(line2))
        while self.tiles.count():
            item = self.tiles.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        per_row = 4
        for i, (caption, value) in enumerate(tiles):
            self.tiles.addWidget(Tile(caption, value), i // per_row, i % per_row)
        for c in range(per_row):
            self.tiles.setColumnStretch(c, 1)


class Notice(QFrame):
    """Highlighted explanation box (e.g. why a button is disabled)."""

    def __init__(self, text: str = ""):
        super().__init__()
        self.setObjectName("Notice")
        lay = QVBoxLayout(self)
        lay.setContentsMargins(12, 10, 12, 10)
        self.text = label(text, wrap=True)
        lay.addWidget(self.text)

    def set_text(self, text: str) -> None:
        self.text.setText(text)
        self.setVisible(bool(text))


class EmptyState(QWidget):
    """Centred title, explanation and numbered steps shown before the first result."""

    def __init__(self, title: str, text: str, steps: list[str] | None = None):
        super().__init__()
        lay = QVBoxLayout(self)
        lay.addStretch(1)
        head = label(title, "PageTitle")
        head.setAlignment(Qt.AlignmentFlag.AlignCenter)
        body = label(text, "Muted", wrap=True)
        body.setAlignment(Qt.AlignmentFlag.AlignCenter)
        lay.addWidget(head)
        lay.addWidget(body)
        for i, step in enumerate(steps or [], 1):
            s = label(f"{i}.  {step}", wrap=True)
            s.setAlignment(Qt.AlignmentFlag.AlignCenter)
            lay.addWidget(s)
        lay.addStretch(2)


class PlotCanvas(QWidget):
    """Matplotlib figure, or a centred message when there is nothing to plot.

    The last plot call is remembered so that ``redraw`` can repaint it after a theme change.
    Right-click offers saving the figure as an image.
    """

    def __init__(self, parent=None):
        super().__init__(parent)
        style.apply()
        self.figure = Figure(figsize=(8, 6), layout=None)
        self.canvas = FigureCanvasQTAgg(self.figure)
        self.canvas.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.canvas.customContextMenuRequested.connect(self._menu)
        self.message = QLabel()
        self.message.setObjectName("Muted")
        self.message.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.message.setWordWrap(True)
        self._stack = QStackedLayout(self)
        self._stack.addWidget(self.canvas)
        self._stack.addWidget(self.message)
        self._last = None

    def draw(self, plot_fn, *args, **kwargs) -> None:
        import warnings

        self._last = (plot_fn, args, kwargs)
        self.figure.set_facecolor(style.SURFACE)
        with warnings.catch_warnings():  # hidden tabs have no size yet; layout is redone on show
            warnings.filterwarnings("ignore", message="constrained_layout not applied")
            plot_fn(self.figure, *args, **kwargs)
        self.canvas.draw_idle()
        self._stack.setCurrentIndex(0)

    def redraw(self) -> None:
        if self._last is not None and self._stack.currentIndex() == 0:
            fn, args, kwargs = self._last
            self.draw(fn, *args, **kwargs)

    def show_message(self, text: str) -> None:
        self._last = None
        self.message.setText(text)
        self._stack.setCurrentIndex(1)

    def _menu(self, pos) -> None:
        menu = QMenu(self)
        save = menu.addAction(t("ui.plot.save"))
        if menu.exec(self.canvas.mapToGlobal(pos)) == save:
            path, _ = QFileDialog.getSaveFileName(self, t("ui.plot.save"), "figure.png", "PNG (*.png);;SVG (*.svg)")
            if path:
                self.figure.savefig(path, dpi=200)


def make_table(headers: list[str], stretch_last: bool = True) -> QTableWidget:
    table = QTableWidget(0, len(headers))
    table.setHorizontalHeaderLabels(headers)
    table.verticalHeader().setVisible(False)
    table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
    table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
    table.setAlternatingRowColors(True)
    table.setShowGrid(False)
    table.setWordWrap(False)
    table.verticalHeader().setDefaultSectionSize(32)
    table.setHorizontalScrollMode(QAbstractItemView.ScrollMode.ScrollPerPixel)
    head = table.horizontalHeader()
    head.setSectionResizeMode(QHeaderView.ResizeMode.ResizeToContents)
    head.setStretchLastSection(stretch_last)
    head.setDefaultAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter)
    return table


def table_item(text: str, *, tone: str | None = None, align_right: bool = False, bold: bool = False,
               tooltip: str = "") -> QTableWidgetItem:
    item = QTableWidgetItem(text)
    if align_right:
        item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
    if tone:
        item.setForeground(QColor(theme.tokens()[tone]))
    if bold or tone:
        f = item.font()
        f.setBold(True)
        item.setFont(f)
    if tooltip:
        item.setToolTip(tooltip)
    return item


def fill_table(table: QTableWidget, rows: list[list[QTableWidgetItem]]) -> None:
    table.setRowCount(0)
    for r, cells in enumerate(rows):
        table.insertRow(r)
        for c, item in enumerate(cells):
            table.setItem(r, c, item)


class DataFrameModel(QAbstractTableModel):
    def __init__(self, df: pd.DataFrame | None = None, parent=None):
        super().__init__(parent)
        self._df = df if df is not None else pd.DataFrame()

    def set_frame(self, df: pd.DataFrame) -> None:
        self.beginResetModel()
        self._df = df
        self.endResetModel()

    def rowCount(self, parent=QModelIndex()):
        return 0 if parent.isValid() else len(self._df)

    def columnCount(self, parent=QModelIndex()):
        return 0 if parent.isValid() else len(self._df.columns)

    def data(self, index, role=Qt.ItemDataRole.DisplayRole):
        if not index.isValid():
            return None
        value = self._df.iat[index.row(), index.column()]
        if role == Qt.ItemDataRole.DisplayRole:
            if isinstance(value, (float, np.floating)):
                return "" if np.isnan(value) else f"{value:.4g}"
            return str(value)
        if role == Qt.ItemDataRole.TextAlignmentRole:
            if isinstance(value, (int, float, np.number)):
                return int(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        return None

    def headerData(self, section, orientation, role=Qt.ItemDataRole.DisplayRole):
        if role != Qt.ItemDataRole.DisplayRole:
            return None
        if orientation == Qt.Orientation.Horizontal:
            return str(self._df.columns[section])
        return str(section + 1)
