"""Offscreen smoke tests of the application shell and the Module 1 pages."""

import pytest


def test_opens_example(window):
    assert set(window.pages) == {"profile", "data", "liquefaction", "wall", "sheet_pile", "factors"}
    assert window.profile_page.table.rowCount() == 4
    assert window.data_page.list.count() == 2


def test_navigation_shows_level_only_for_module2(window):
    window.show_page("profile")
    assert window.level.isHidden()
    window.show_page("wall")
    assert not window.level.isHidden()


def test_select_cpt_and_spt(window):
    window.data_page.select("cpt", "CPT-1")
    assert window.data_page.table_model.rowCount() > 100
    assert len(window.data_page.plot_canvas.figure.axes) == 5
    window.data_page.select("spt", "SK-1")
    assert window.data_page.table_model.rowCount() == 9


def test_run_liquefaction(window):
    page = window.liq_page
    page.default_fc.set_value(10)
    page.run()
    assert set(window.state.results.liquefaction) == {"SK-1", "CPT-1"}
    assert "LPI" in page.summary.toPlainText()


def test_profile_edit_marks_dirty_and_keeps_design_params(window):
    page = window.profile_page
    page.gwt_seismic.setValue(3.0)
    phi_col = 8
    page.table.item(1, phi_col).setText("31")
    assert page.apply()
    assert window.state.dirty
    profile = window.state.project.soil_profiles[0]
    assert profile.gwt.depth_seismic == 3.0
    assert profile.layers[1].design.phi_eff == 31.0


def test_invalid_profile_is_rejected(window):
    page = window.profile_page
    page.table.item(1, 1).setText("2.0")  # gap: previous layer ends at 1.5
    with pytest.raises(ValueError):
        page.build_profile()
    assert not page.apply()
    assert page.error.text()


def test_language_switch_rebuilds(window):
    window.set_language("en")
    assert window.nav_buttons["profile"].text() == "Soil profile"
    assert window.profile_page.table.rowCount() == 4
    window.set_language("tr")
    assert window.nav_buttons["profile"].text() == "Zemin profili"


def test_theme_switch_redraws(window):
    window.show_page("profile")
    window.set_theme("dark")
    from geotek.plotting import style
    from geotek.ui import theme

    assert theme.current == "dark" and style.theme == "dark"
    assert window.profile_page.log_canvas.figure.get_facecolor()[0] < 0.3
    window.set_theme("light")
