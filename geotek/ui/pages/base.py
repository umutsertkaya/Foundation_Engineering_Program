"""Page scaffolding: title header, and the 'form on the left, results on the right' layout."""

from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QProgressBar,
    QScrollArea,
    QVBoxLayout,
    QWidget,
)

from geotek.ui.widgets import label


class Page(QWidget):
    """A sidebar destination with a title and an optional subtitle."""

    def __init__(self, title: str, subtitle: str = ""):
        super().__init__()
        self.setObjectName("Page")
        outer = QVBoxLayout(self)
        outer.setContentsMargins(24, 18, 24, 18)
        outer.setSpacing(14)
        head = QVBoxLayout()
        head.setSpacing(2)
        self.title_label = label(title, "PageTitle")
        head.addWidget(self.title_label)
        if subtitle:
            head.addWidget(label(subtitle, "PageSubtitle", wrap=True))
        outer.addLayout(head)
        self.body = QVBoxLayout()
        self.body.setSpacing(14)
        outer.addLayout(self.body, 1)

    def on_theme_changed(self) -> None:
        from geotek.ui.widgets import PlotCanvas

        for canvas in self.findChildren(PlotCanvas):
            canvas.redraw()


class FormColumn(QFrame):
    """Scrollable stack of cards with a fixed action bar (buttons + busy indicator) at the bottom."""

    def __init__(self, width: int = 410):
        super().__init__()
        self.setFixedWidth(width)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)
        self.scroll = QScrollArea()
        self.scroll.setObjectName("FormScroll")
        self.scroll.setWidgetResizable(True)
        self.scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        inner = QWidget()
        self.cards = QVBoxLayout(inner)
        self.cards.setContentsMargins(0, 0, 8, 12)
        self.cards.setSpacing(12)
        self.scroll.setWidget(inner)
        lay.addWidget(self.scroll, 1)

        self.action_bar = QFrame()
        self.action_bar.setObjectName("ActionBar")
        bar = QVBoxLayout(self.action_bar)
        bar.setContentsMargins(4, 10, 8, 4)
        bar.setSpacing(6)
        self.busy = QProgressBar()
        self.busy.setRange(0, 0)
        self.busy.setTextVisible(False)
        self.busy.setVisible(False)
        self.buttons = QHBoxLayout()
        self.buttons.setSpacing(8)
        self.reason = label("", "Hint", wrap=True)
        self.reason.setVisible(False)
        bar.addWidget(self.busy)
        bar.addLayout(self.buttons)
        bar.addWidget(self.reason)
        lay.addWidget(self.action_bar)

    def add(self, widget: QWidget) -> QWidget:
        self.cards.addWidget(widget)
        return widget

    def finish(self) -> None:
        self.cards.addStretch(1)

    def set_reason(self, text: str, error: bool = False) -> None:
        self.reason.setObjectName("Error" if error else "Hint")
        self.reason.setStyleSheet("")  # re-polish for the new object name
        self.reason.style().unpolish(self.reason)
        self.reason.style().polish(self.reason)
        self.reason.setText(text)
        self.reason.setVisible(bool(text))

    def set_busy(self, busy: bool) -> None:
        self.busy.setVisible(busy)


def split_layout(form: QWidget, results: QWidget) -> QHBoxLayout:
    row = QHBoxLayout()
    row.setSpacing(18)
    row.addWidget(form)
    row.addWidget(results, 1)
    return row
