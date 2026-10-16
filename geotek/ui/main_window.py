"""Main window: sidebar navigation, header (project, analysis level, theme, language) and pages."""

from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import QSettings, Qt
from PySide6.QtGui import QAction, QKeySequence
from PySide6.QtWidgets import (
    QApplication,
    QButtonGroup,
    QFileDialog,
    QFrame,
    QHBoxLayout,
    QMainWindow,
    QMenu,
    QMessageBox,
    QPushButton,
    QStackedWidget,
    QVBoxLayout,
    QWidget,
)

from geotek import __version__, i18n
from geotek.core.models.project import Project, ProjectMeta
from geotek.i18n import t
from geotek.io.project_io import PROJECT_SUFFIX, load_project, save_project
from geotek.ui import theme
from geotek.ui.state import AppState
from geotek.ui.widgets import Segmented, button, label

PROJECT_FILTER = f"GeoTek (*{PROJECT_SUFFIX})"

NAV = [
    ("ui.nav.section.soil", [("profile", "ui.nav.profile"), ("data", "ui.nav.data"),
                             ("liquefaction", "ui.nav.liquefaction")]),
    ("ui.nav.section.retaining", [("wall", "ui.nav.wall"), ("sheet_pile", "ui.nav.sheet_pile"),
                                  ("factors", "ui.nav.factors")]),
]
MODULE2_PAGES = {"wall", "sheet_pile", "factors"}


class MainWindow(QMainWindow):
    def __init__(self, project: Project | None = None, path: Path | None = None):
        super().__init__()
        self.settings_store = QSettings("GeoTek", "GeoTek")
        self.state = AppState(project or self._new_project(), path)
        self.current_page = "profile"
        self.resize(1366, 820)
        self.setMinimumSize(1180, 700)
        self._build_ui()
        self._build_shortcuts()

    @staticmethod
    def _new_project() -> Project:
        return Project(meta=ProjectMeta(name=t("ui.untitled"), language=i18n.get_language()))

    # --- construction ------------------------------------------------------------------

    def _build_ui(self) -> None:
        from geotek.ui.pages.data import DataPage
        from geotek.ui.pages.factors import FactorsPage
        from geotek.ui.pages.liquefaction import LiquefactionPage
        from geotek.ui.pages.profile import ProfilePage
        from geotek.ui.pages.sheet_pile import SheetPilePage
        from geotek.ui.pages.wall import WallPage

        s = self.state
        self.pages = {
            "profile": ProfilePage(s), "data": DataPage(s), "liquefaction": LiquefactionPage(s),
            "wall": WallPage(s), "sheet_pile": SheetPilePage(s), "factors": FactorsPage(s),
        }
        self.profile_page = self.pages["profile"]
        self.data_page = self.pages["data"]
        self.liq_page = self.pages["liquefaction"]
        self.wall_page = self.pages["wall"]
        self.sheet_page = self.pages["sheet_pile"]
        self.factors_page = self.pages["factors"]

        self.stack = QStackedWidget()
        for page in self.pages.values():
            self.stack.addWidget(page)

        root = QWidget()
        row = QHBoxLayout(root)
        row.setContentsMargins(0, 0, 0, 0)
        row.setSpacing(0)
        row.addWidget(self._sidebar())
        col = QVBoxLayout()
        col.setContentsMargins(0, 0, 0, 0)
        col.setSpacing(0)
        col.addWidget(self._header())
        col.addWidget(self.stack, 1)
        row.addLayout(col, 1)
        self.setCentralWidget(root)

        s.dirtyChanged.connect(lambda _: self._update_title())
        self.show_page(self.current_page)
        self._update_title()

    def _sidebar(self) -> QFrame:
        bar = QFrame()
        bar.setObjectName("Sidebar")
        bar.setFixedWidth(214)
        lay = QVBoxLayout(bar)
        lay.setContentsMargins(12, 16, 12, 12)
        lay.setSpacing(2)
        lay.addWidget(label("GeoTek", "Brand"))
        lay.addWidget(label(t("ui.brand_sub"), "BrandSub", wrap=True))
        lay.addSpacing(8)
        self.nav_group = QButtonGroup(self)
        self.nav_buttons: dict[str, QPushButton] = {}
        for section, items in NAV:
            lay.addWidget(label(t(section).upper(), "NavSection"))
            for key, text_key in items:
                b = QPushButton(t(text_key))
                b.setObjectName("NavButton")
                b.setCheckable(True)
                b.setCursor(Qt.CursorShape.PointingHandCursor)
                b.clicked.connect(lambda _=False, k=key: self.show_page(k))
                self.nav_group.addButton(b)
                self.nav_buttons[key] = b
                lay.addWidget(b)
        lay.addStretch(1)
        lay.addWidget(label(f"v{__version__}", "Faint"))
        return bar

    def _header(self) -> QFrame:
        head = QFrame()
        head.setObjectName("Header")
        lay = QHBoxLayout(head)
        lay.setContentsMargins(24, 10, 16, 10)
        lay.setSpacing(10)
        self.project_label = label("", "CardTitle")
        lay.addWidget(self.project_label)
        lay.addStretch(1)

        self.level_label = label(t("ui.level"), "Muted")
        self.level = Segmented([("basic", t("ui.level.basic")), ("advanced", t("ui.level.advanced"))],
                               self.state.level)
        self.level.setToolTip(t("ui.level.tip"))
        self.level.changed.connect(self.state.set_level)
        lay.addWidget(self.level_label)
        lay.addWidget(self.level)
        lay.addSpacing(12)

        file_btn = button(t("ui.menu.file"), "ghost")
        menu = QMenu(file_btn)
        for key, slot in (("ui.menu.new", self.new_project), ("ui.menu.open", self.open_project),
                          ("ui.menu.save", self.save), ("ui.menu.save_as", self.save_as)):
            menu.addAction(t(key), slot)
        menu.addSeparator()
        menu.addAction(t("ui.menu.import_cpt"), self.data_page.import_cpt)
        menu.addAction(t("ui.menu.import_spt"), self.data_page.import_spt)
        menu.addSeparator()
        menu.addAction(t("ui.menu.about"), self.about)
        menu.addAction(t("ui.menu.exit"), self.close)
        file_btn.setMenu(menu)
        lay.addWidget(file_btn)
        lay.addWidget(button(t("ui.menu.save"), None, self.save))

        dark = theme.current == "dark"
        self.theme_btn = button(t("ui.theme.light") if dark else t("ui.theme.dark"), "ghost", self.toggle_theme)
        lay.addWidget(self.theme_btn)
        other = "en" if i18n.get_language() == "tr" else "tr"
        self.lang_btn = button(other.upper(), "ghost", lambda: self.set_language(other))
        self.lang_btn.setToolTip(t("ui.menu.language"))
        lay.addWidget(self.lang_btn)
        return head

    def _build_shortcuts(self) -> None:
        for seq, slot in ((QKeySequence.StandardKey.New, self.new_project),
                          (QKeySequence.StandardKey.Open, self.open_project),
                          (QKeySequence.StandardKey.Save, self.save),
                          (QKeySequence.StandardKey.SaveAs, self.save_as)):
            act = QAction(self)
            act.setShortcut(seq)
            act.triggered.connect(slot)
            self.addAction(act)

    # --- navigation and title ----------------------------------------------------------

    def show_page(self, key: str) -> None:
        self.current_page = key
        self.nav_buttons[key].setChecked(True)
        self.stack.setCurrentWidget(self.pages[key])
        is_m2 = key in MODULE2_PAGES
        self.level.setVisible(is_m2)
        self.level_label.setVisible(is_m2)

    def _update_title(self) -> None:
        s = self.state
        name = s.path.name if s.path else s.project.meta.name
        self.project_label.setText(name + ("  •" if s.dirty else ""))
        self.setWindowTitle(f"{name}{' *' if s.dirty else ''} — {t('app.title')}")

    def isWindowModified(self) -> bool:  # noqa: N802 - Qt API name
        return self.state.dirty

    def setWindowModified(self, modified: bool) -> None:  # noqa: N802
        self.state.mark_dirty(modified)

    # --- files --------------------------------------------------------------------------

    def _collect_forms(self) -> None:
        for page in (self.wall_page, self.sheet_page):
            page.store_form()

    def _confirm_discard(self) -> bool:
        self._collect_forms()
        if not self.state.dirty:
            return True
        answer = QMessageBox.question(
            self, t("app.title"), t("ui.msg.unsaved"),
            QMessageBox.StandardButton.Save | QMessageBox.StandardButton.Discard | QMessageBox.StandardButton.Cancel,
        )
        if answer == QMessageBox.StandardButton.Save:
            return self.save()
        return answer == QMessageBox.StandardButton.Discard

    def _load(self, project: Project, path: Path | None) -> None:
        self.state = AppState(project, path)
        self.current_page = "profile"
        self._build_ui()

    def new_project(self) -> None:
        if self._confirm_discard():
            self._load(self._new_project(), None)

    def open_project(self) -> None:
        if not self._confirm_discard():
            return
        path, _ = QFileDialog.getOpenFileName(self, t("ui.menu.open"), "", PROJECT_FILTER)
        if not path:
            return
        try:
            self._load(load_project(path), Path(path))
        except Exception as exc:  # noqa: BLE001 - shown to the user
            QMessageBox.critical(self, t("ui.menu.open"), str(exc))

    def save(self) -> bool:
        if self.state.path is None:
            return self.save_as()
        self._collect_forms()
        self.state.path = save_project(self.state.project, self.state.path)
        self.state.mark_dirty(False)
        self._update_title()
        self.statusBar().showMessage(t("ui.msg.saved", path=str(self.state.path)), 4000)
        return True

    def save_as(self) -> bool:
        path, _ = QFileDialog.getSaveFileName(self, t("ui.menu.save_as"), self.state.project.meta.name,
                                              PROJECT_FILTER)
        if not path:
            return False
        self.state.path = Path(path)
        return self.save()

    # --- appearance ---------------------------------------------------------------------

    def set_language(self, lang: str) -> None:
        self._collect_forms()
        i18n.set_language(lang)
        self.settings_store.setValue("language", lang)
        self.state.project.meta.language = lang
        page = self.current_page
        self._build_ui()
        self.show_page(page)

    def toggle_theme(self) -> None:
        self.set_theme("light" if theme.current == "dark" else "dark")

    def set_theme(self, name: str) -> None:
        theme.apply_theme(QApplication.instance(), name)
        self.settings_store.setValue("theme", name)
        self.theme_btn.setText(t("ui.theme.light") if name == "dark" else t("ui.theme.dark"))
        for page in self.pages.values():
            page.on_theme_changed()

    def about(self) -> None:
        QMessageBox.about(self, t("ui.menu.about"), t("ui.about_text", version=__version__))

    def closeEvent(self, event) -> None:  # noqa: N802
        if self._confirm_discard():
            event.accept()
        else:
            event.ignore()
