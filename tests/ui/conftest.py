import os

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from pathlib import Path  # noqa: E402

import pytest  # noqa: E402

pytest.importorskip("PySide6")

from PySide6.QtWidgets import QApplication  # noqa: E402

from geotek import i18n  # noqa: E402
from geotek.io.project_io import load_project  # noqa: E402

EXAMPLE = Path(__file__).parents[2] / "examples" / "ornek_proje.gtk"


@pytest.fixture(scope="session")
def app():
    from geotek.ui import theme

    app = QApplication.instance() or QApplication([])
    theme.apply_theme(app, "light")
    return app


@pytest.fixture
def window(app):
    from geotek.ui.main_window import MainWindow

    i18n.set_language("tr")
    w = MainWindow(load_project(EXAMPLE), EXAMPLE)
    w.settings_store.setValue = lambda *a, **k: None  # keep the user's settings untouched
    w._confirm_discard = lambda: True  # never open a modal dialog in tests
    yield w
    w.close()
    i18n.set_language("tr")
