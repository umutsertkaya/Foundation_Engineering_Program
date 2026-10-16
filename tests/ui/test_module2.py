"""Offscreen tests of the Module 2 pages: suggest / check flow, missing factors, sheet piles."""

import pytest

from geotek.io.project_io import load_project, save_project


def _basic_example(page):
    """Inputs of examples/on_boyutlandirma.py (they are also the page defaults)."""
    page.wall_type.set_value("cantilever")
    page.height.setValue(5.0)
    page.embedment.set_value(None)
    page.bf_gamma.setValue(18.0)
    page.bf_phi.setValue(32.0)
    page.bf_slope.setValue(0.0)
    page.drainage.set_value("drained")
    page.f_phi.setValue(30.0)
    page.f_c.setValue(0.0)
    page.f_gamma.setValue(19.0)
    page.surcharge.setValue(10.0)
    page.seismic.setChecked(True)
    page.sds.setValue(0.5)
    page.r.set_value(None)
    page.global_check.setChecked(True)


def test_level_is_written_to_project(window):
    window.level.set_value("advanced")
    assert window.state.project.meta.analysis_level == "advanced"
    window.level.set_value("basic")
    assert window.state.project.meta.analysis_level == "basic"


def test_basic_suggestion_acceptance(window):
    page = window.wall_page
    _basic_example(page)
    page.suggest()
    page.wait()
    o = page.outcome
    assert o.passed and o.geometry.width == pytest.approx(4.60)
    assert o.governing == "seismic:bearing"
    assert "Deprem — Taşıma gücü (seismic:bearing)" in page.banner.line1.text()
    assert page.checks_table.rowCount() == 10
    assert page.factors_table.rowCount() == len(o.factors_used) >= 8
    assert page.assumptions_table.rowCount() > 5
    assert page.geometry_source == "suggested"
    assert page.geo["heel"].value() == pytest.approx(o.geometry.heel)
    assert page.section_canvas.figure.axes and page.slip_canvas.figure.axes


def test_user_dimensions_are_checked(window):
    page = window.wall_page
    _basic_example(page)
    page.suggest()
    page.wait()
    page.geo["heel"].setValue(page.geo["heel"].value() - 0.3)
    assert page.geometry_source == "user"
    page.check()
    page.wait()
    o = page.outcome
    assert o.mode == "check" and not o.passed
    assert "bearing" in o.governing
    assert page.banner.title.text() == "Uygun değil"


def test_invalid_input_is_reported_not_raised(window):
    page = window.wall_page
    page.bf_slope.setValue(34.0)
    page.bf_phi.setValue(30.0)
    page.suggest()
    assert page.task is None
    assert page.form.reason.text()


def test_tbdy_seismic_missing_factors_and_override(window):
    window.level.set_value("advanced")
    page = window.wall_page
    _basic_example(page)
    sel = page.code_selector
    sel.code.setCurrentIndex(list(sel.codes).index("tbdy2018"))
    card = page.missing_card
    paths = {m.path for m in card.missing}
    assert {"TBDY-seismic.material.tan_phi", "TBDY-seismic.material.c_eff", "TBDY-seismic.material.su"} <= paths
    shown = " ".join(lab.text() for lab in card.findChildren(type(card.title)))
    for symbol in ("γRφ", "γRc", "γRcu"):
        assert symbol in shown
    assert not page.suggest_button.isEnabled() and not page.check_button.isEnabled()
    assert "γRφ" in page.form.reason.text()

    values = {p: 1.0 for p in paths}
    values.update({"TBDY-static.load.G_unfav": 1.4, "TBDY-static.load.G_fav": 1.0,
                   "TBDY-static.load.Q_unfav": 1.6})
    card.fill(values, note="test")
    assert card.save()
    assert not card.missing
    assert page.check_button.isEnabled()
    stored = window.state.project.design_overrides["tbdy2018"]
    assert stored["TBDY-seismic.material.tan_phi"].value == 1.0

    page.check()
    page.wait()
    assert page.outcome is not None and page.outcome.level == "advanced"
    assert page.checks_table.rowCount() > 0
    statuses = {page.factors_table.item(r, 3).text() for r in range(page.factors_table.rowCount())}
    assert "Kullanıcı girdisi" in statuses


def test_invalid_override_is_rejected(window):
    window.level.set_value("advanced")
    page = window.wall_page
    sel = page.code_selector
    sel.code.setCurrentIndex(list(sel.codes).index("tbdy2018"))
    page.missing_card.fill({"TBDY-seismic.material.tan_phi": 0.5})
    assert not page.missing_card.save()
    assert page.missing_card.error.text()


def test_factors_page_edit_marks_user(window):
    page = window.factors_page
    assert page.code_id() == "asd"
    row = next(i for i, r in enumerate(page._shown) if r.path == "safety.sliding.static")
    page.table.selectRow(row)
    page.value.setText("1.6")
    page.note.setText("şartname")
    page.save()
    assert window.state.project.design_overrides["asd"]["safety.sliding.static"].value == 1.6
    row = next(i for i, r in enumerate(page._shown) if r.path == "safety.sliding.static")
    assert page.table.item(row, 3).text() == "Kullanıcı girdisi"
    page.table.selectRow(row)
    page.remove()
    assert "asd" not in window.state.project.design_overrides


def test_form_values_saved_in_project(window, tmp_path):
    page = window.wall_page
    page.height.setValue(4.25)
    window.state.path = tmp_path / "p.gtk"
    assert window.save()
    project = load_project(window.state.path)
    assert project.module2_inputs["wall"]["height"] == 4.25
    reopened = save_project(project, tmp_path / "q.gtk")
    from geotek.ui.main_window import MainWindow

    w2 = MainWindow(load_project(reopened), reopened)
    assert w2.wall_page.height.value() == 4.25
    assert not w2.state.dirty
    w2._confirm_discard = lambda: True
    w2.close()


def test_basic_sheet_pile(window):
    page = window.sheet_page
    page.support.set_value("anchored")
    page.H.setValue(5.0)
    page.anchor.setValue(1.0)
    page.phi.setValue(32.0)
    page.run()
    page.wait()
    r = page.result.result
    assert r.D > 0 and r.anchor_force is not None
    assert page.cases_table.rowCount() == 1
    assert len(page.canvas.figure.axes) == 3


def test_advanced_sheet_pile_needs_profile_params(window):
    window.level.set_value("advanced")
    page = window.sheet_page
    sel = page.code_selector
    sel.code.setCurrentIndex(list(sel.codes).index("ec7"))
    page.run()
    page.wait()
    # the example profile has no design phi' yet: the error is shown, nothing crashes
    assert page.form.reason.text()
