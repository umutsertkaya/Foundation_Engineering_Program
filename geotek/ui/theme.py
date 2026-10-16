"""Light and dark application themes: color tokens, Qt palette and style sheet.

The chart palette in ``geotek.plotting.style`` is switched together with the UI so plots and
widgets always share one theme.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

from PySide6.QtGui import QColor, QFont, QPalette
from PySide6.QtWidgets import QApplication

from geotek.plotting import style

TOKENS = {
    "light": dict(
        bg="#f3f4f6", surface="#ffffff", surface_alt="#f7f8fa", hover="#eef0f3", border="#e3e5e9",
        border_strong="#cdd1d7", text="#15181c", muted="#5b626d", faint="#8b929c",
        accent="#2a78d6", accent_hover="#256abf", accent_soft="#e7f0fb", on_accent="#ffffff",
        good="#16803a", good_soft="#e6f4ea", bad="#c22f2f", bad_soft="#fbe9e9",
        warn="#94660a", warn_soft="#fdf3d8", info="#2a6fc4", info_soft="#e7f0fb",
        user="#5a48c9", user_soft="#eeebfb",
    ),
    "dark": dict(
        bg="#111214", surface="#1a1c1f", surface_alt="#202226", hover="#25282c", border="#2a2d32",
        border_strong="#3a3e45", text="#eceef1", muted="#a3aab4", faint="#747b86",
        accent="#3d8be6", accent_hover="#5598e7", accent_soft="#1b2a3d", on_accent="#ffffff",
        good="#55c274", good_soft="#15291c", bad="#f07070", bad_soft="#361b1b",
        warn="#e2aa45", warn_soft="#33290f", info="#6aa8ef", info_soft="#1b2a3d",
        user="#a196f0", user_soft="#24213a",
    ),
}
current = "light"


def tokens() -> dict[str, str]:
    return TOKENS[current]


def _arrow_icon(color: str) -> str:
    folder = Path(tempfile.gettempdir()) / "geotek_theme"
    folder.mkdir(exist_ok=True)
    path = folder / f"arrow_{color.lstrip('#')}.svg"
    if not path.exists():
        path.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="6" viewBox="0 0 10 6">'
                        f'<path d="M1 1l4 4 4-4" fill="none" stroke="{color}" stroke-width="1.6" '
                        f'stroke-linecap="round" stroke-linejoin="round"/></svg>', encoding="utf-8")
    return path.as_posix()


def _badge_rules(k: dict[str, str]) -> str:
    # Repeated under the card/banner selectors, which would otherwise win and make labels transparent.
    tones = {"good": ("good_soft", "good"), "bad": ("bad_soft", "bad"), "warn": ("warn_soft", "warn"),
             "info": ("info_soft", "info"), "user": ("user_soft", "user"), "neutral": ("surface_alt", "muted")}
    out = []
    for tone, (bg, fg) in tones.items():
        sel = ", ".join(f'{scope}QLabel[tone="{tone}"]' for scope in ("", "QFrame#Card ", "QFrame#Banner "))
        out.append(f"{sel} {{ background: {k[bg]}; color: {k[fg]}; }}")
    return "\n".join(out)


def style_sheet(k: dict[str, str]) -> str:
    arrow = _arrow_icon(k["muted"])
    return f"""
QWidget {{ color: {k['text']}; font-size: 10pt; }}
QMainWindow, QWidget#Page, QWidget#PageBody, QScrollArea#FormScroll > QWidget > QWidget {{ background: {k['bg']}; }}
QToolTip {{ background: {k['surface']}; color: {k['text']}; border: 1px solid {k['border_strong']}; padding: 6px; }}

QFrame#Sidebar {{ background: {k['surface']}; border: none; border-right: 1px solid {k['border']}; }}
QLabel#Brand {{ font-size: 15pt; font-weight: 700; color: {k['text']}; }}
QLabel#BrandSub {{ color: {k['faint']}; font-size: 8.5pt; }}
QLabel#NavSection {{ color: {k['faint']}; font-size: 8pt; font-weight: 700; padding: 14px 12px 4px 12px; }}
QPushButton#NavButton {{ text-align: left; padding: 9px 12px; border: none; border-radius: 8px;
    background: transparent; color: {k['muted']}; font-weight: 500; }}
QPushButton#NavButton:hover {{ background: {k['hover']}; color: {k['text']}; }}
QPushButton#NavButton:checked {{ background: {k['accent_soft']}; color: {k['accent']}; font-weight: 600; }}

QFrame#Header {{ background: {k['surface']}; border: none; border-bottom: 1px solid {k['border']}; }}
QLabel#PageTitle {{ font-size: 14pt; font-weight: 700; }}
QLabel#PageSubtitle, QLabel#Muted {{ color: {k['muted']}; }}
QLabel#Faint {{ color: {k['faint']}; font-size: 9pt; }}

QFrame#Card {{ background: {k['surface']}; border: 1px solid {k['border']}; border-radius: 12px; }}
QFrame#Card QLabel {{ background: transparent; }}
QLabel#CardTitle {{ font-size: 10.5pt; font-weight: 600; }}
QLabel#FieldLabel {{ color: {k['muted']}; }}
QLabel#Unit {{ color: {k['faint']}; }}
QLabel#Error {{ color: {k['bad']}; }}
QLabel#Hint {{ color: {k['faint']}; font-size: 9pt; }}

QPushButton {{ background: {k['surface']}; color: {k['text']}; border: 1px solid {k['border_strong']};
    border-radius: 8px; padding: 7px 14px; }}
QPushButton:hover {{ background: {k['hover']}; }}
QPushButton:pressed {{ background: {k['border']}; }}
QPushButton:disabled {{ color: {k['faint']}; border-color: {k['border']}; background: {k['surface_alt']}; }}
QPushButton[kind="primary"] {{ background: {k['accent']}; color: {k['on_accent']}; border: 1px solid {k['accent']};
    font-weight: 600; }}
QPushButton[kind="primary"]:hover {{ background: {k['accent_hover']}; border-color: {k['accent_hover']}; }}
QPushButton[kind="primary"]:disabled {{ background: {k['border']}; border-color: {k['border']}; color: {k['faint']}; }}
QPushButton[kind="ghost"] {{ background: transparent; border: 1px solid transparent; color: {k['muted']}; }}
QPushButton[kind="ghost"]:hover {{ background: {k['hover']}; color: {k['text']}; }}
QPushButton::menu-indicator {{ image: none; width: 0; }}

QFrame#Segmented {{ background: {k['surface_alt']}; border: 1px solid {k['border']}; border-radius: 8px; }}
QPushButton[segment="true"] {{ background: transparent; border: none; border-radius: 6px; padding: 5px 12px;
    color: {k['muted']}; }}
QPushButton[segment="true"]:hover {{ color: {k['text']}; }}
QPushButton[segment="true"]:checked {{ background: {k['surface']}; color: {k['text']}; font-weight: 600;
    border: 1px solid {k['border_strong']}; }}

QLineEdit, QAbstractSpinBox, QComboBox {{ background: {k['surface']}; border: 1px solid {k['border_strong']};
    border-radius: 6px; padding: 5px 8px; selection-background-color: {k['accent']}; selection-color: {k['on_accent']}; }}
QLineEdit:focus, QAbstractSpinBox:focus, QComboBox:focus {{ border: 1px solid {k['accent']}; }}
QLineEdit:disabled, QAbstractSpinBox:disabled, QComboBox:disabled {{ color: {k['faint']}; background: {k['surface_alt']};
    border-color: {k['border']}; }}
QAbstractSpinBox::up-button, QAbstractSpinBox::down-button {{ width: 0px; border: none; }}
QLineEdit[missing="true"] {{ border: 1px solid {k['warn']}; background: {k['warn_soft']}; }}
QComboBox::drop-down {{ border: none; width: 24px; }}
QComboBox::down-arrow {{ image: url("{arrow}"); width: 10px; height: 6px; }}
QComboBox QAbstractItemView {{ background: {k['surface']}; border: 1px solid {k['border_strong']};
    selection-background-color: {k['accent_soft']}; selection-color: {k['text']}; outline: none; padding: 4px; }}

QCheckBox {{ spacing: 8px; background: transparent; }}

QTableView, QTableWidget, QListWidget, QPlainTextEdit {{ background: {k['surface']}; border: 1px solid {k['border']};
    border-radius: 8px; gridline-color: {k['border']}; alternate-background-color: {k['surface_alt']};
    selection-background-color: {k['accent_soft']}; selection-color: {k['text']}; }}
QListWidget::item {{ padding: 7px 8px; border-radius: 6px; }}
QListWidget::item:selected {{ background: {k['accent_soft']}; color: {k['accent']}; }}
QHeaderView::section {{ background: {k['surface_alt']}; color: {k['muted']}; border: none;
    border-bottom: 1px solid {k['border']}; padding: 6px 8px; font-weight: 600; }}
QTableCornerButton::section {{ background: {k['surface_alt']}; border: none; }}

QTabWidget::pane {{ border: none; background: transparent; }}
QTabBar {{ background: transparent; }}
QTabBar::tab {{ background: transparent; color: {k['muted']}; padding: 8px 14px; border: none;
    border-bottom: 2px solid transparent; margin-right: 2px; }}
QTabBar::tab:hover {{ color: {k['text']}; }}
QTabBar::tab:selected {{ color: {k['accent']}; border-bottom: 2px solid {k['accent']}; font-weight: 600; }}

QScrollArea {{ border: none; background: transparent; }}
QScrollBar:vertical {{ background: transparent; width: 10px; margin: 2px; }}
QScrollBar::handle:vertical {{ background: {k['border_strong']}; border-radius: 3px; min-height: 30px; }}
QScrollBar:horizontal {{ background: transparent; height: 10px; margin: 2px; }}
QScrollBar::handle:horizontal {{ background: {k['border_strong']}; border-radius: 3px; min-width: 30px; }}
QScrollBar::add-line, QScrollBar::sub-line {{ width: 0; height: 0; }}
QScrollBar::add-page, QScrollBar::sub-page {{ background: transparent; }}

QProgressBar {{ background: {k['border']}; border: none; border-radius: 2px; max-height: 4px; }}
QProgressBar::chunk {{ background: {k['accent']}; border-radius: 2px; }}

QFrame#Banner {{ border-radius: 12px; border: 1px solid {k['border']}; background: {k['surface']}; }}
QFrame#Banner[tone="good"] {{ background: {k['good_soft']}; border-color: {k['good']}; }}
QFrame#Banner[tone="bad"] {{ background: {k['bad_soft']}; border-color: {k['bad']}; }}
QFrame#Banner QLabel {{ background: transparent; }}
QLabel#BannerTitle {{ font-size: 16pt; font-weight: 700; }}
QFrame#Banner[tone="good"] QLabel#BannerTitle {{ color: {k['good']}; }}
QFrame#Banner[tone="bad"] QLabel#BannerTitle {{ color: {k['bad']}; }}
QFrame#Tile {{ background: {k['surface']}; border: 1px solid {k['border']}; border-radius: 10px; }}
QLabel#TileValue {{ font-size: 13pt; font-weight: 700; }}
QLabel#TileLabel {{ color: {k['muted']}; font-size: 8.5pt; }}

QLabel[tone] {{ border-radius: 9px; padding: 2px 8px; font-size: 8.5pt; font-weight: 600; }}
{_badge_rules(k)}
QFrame#Notice {{ background: {k['warn_soft']}; border: 1px solid {k['warn']}; border-radius: 10px; }}
QFrame#Notice QLabel {{ background: transparent; }}
QFrame#ActionBar {{ background: {k['surface']}; border: none; border-top: 1px solid {k['border']}; }}
QMenu {{ background: {k['surface']}; border: 1px solid {k['border_strong']}; padding: 4px; }}
QMenu::item {{ padding: 6px 22px 6px 12px; border-radius: 6px; }}
QMenu::item:selected {{ background: {k['accent_soft']}; color: {k['text']}; }}
QMenu::separator {{ height: 1px; background: {k['border']}; margin: 4px 6px; }}
"""


def _palette(k: dict[str, str]) -> QPalette:
    p = QPalette()
    roles = {
        QPalette.ColorRole.Window: k["bg"], QPalette.ColorRole.WindowText: k["text"],
        QPalette.ColorRole.Base: k["surface"], QPalette.ColorRole.AlternateBase: k["surface_alt"],
        QPalette.ColorRole.Text: k["text"], QPalette.ColorRole.Button: k["surface"],
        QPalette.ColorRole.ButtonText: k["text"], QPalette.ColorRole.Highlight: k["accent"],
        QPalette.ColorRole.HighlightedText: k["on_accent"], QPalette.ColorRole.ToolTipBase: k["surface"],
        QPalette.ColorRole.ToolTipText: k["text"], QPalette.ColorRole.PlaceholderText: k["faint"],
        QPalette.ColorRole.Mid: k["border_strong"], QPalette.ColorRole.Dark: k["border_strong"],
        QPalette.ColorRole.Light: k["surface"], QPalette.ColorRole.Midlight: k["border"],
    }
    for role, color in roles.items():
        p.setColor(role, QColor(color))
    for role in (QPalette.ColorRole.Text, QPalette.ColorRole.WindowText, QPalette.ColorRole.ButtonText):
        p.setColor(QPalette.ColorGroup.Disabled, role, QColor(k["faint"]))
    return p


def apply_theme(app: QApplication, name: str) -> None:
    """Switch widgets and charts to the ``light`` or ``dark`` theme."""
    global current
    if name not in TOKENS:
        raise ValueError(f"Unknown theme {name!r}")
    current = name
    style.set_theme(name)
    app.setStyle("Fusion")
    font = QFont("Segoe UI")
    font.setPointSizeF(10)
    app.setFont(font)
    app.setPalette(_palette(TOKENS[name]))
    app.setStyleSheet(style_sheet(TOKENS[name]))


def system_theme(app: QApplication) -> str:
    try:
        from PySide6.QtCore import Qt

        return "dark" if app.styleHints().colorScheme() == Qt.ColorScheme.Dark else "light"
    except AttributeError:  # Qt < 6.5
        return "light"
