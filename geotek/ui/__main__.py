"""Entry point: ``python -m geotek.ui [project.gtk]``."""

from __future__ import annotations

import sys
from pathlib import Path

from PySide6.QtCore import QSettings
from PySide6.QtWidgets import QApplication

from geotek import i18n
from geotek.io.project_io import load_project


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv if argv is None else argv
    app = QApplication(argv)
    app.setApplicationName("GeoTek")
    store = QSettings("GeoTek", "GeoTek")
    lang = store.value("language", "tr")
    i18n.set_language(lang if lang in i18n.SUPPORTED else "tr")

    from geotek.ui import theme
    from geotek.ui.main_window import MainWindow

    name = store.value("theme", "") or theme.system_theme(app)
    theme.apply_theme(app, name if name in theme.TOKENS else "light")

    project, path = None, None
    if len(argv) > 1:
        path = Path(argv[1])
        project = load_project(path)
    window = MainWindow(project, path)
    window.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
