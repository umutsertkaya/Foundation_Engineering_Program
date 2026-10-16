"""Sheet pile page: cantilever or single-anchored wall; embedment, moment, anchor force and diagrams."""

from __future__ import annotations

from PySide6.QtWidgets import QStackedWidget, QTabWidget, QVBoxLayout, QWidget

from geotek.i18n import t
from geotek.plotting.figures import plot_sheet_pile
from geotek.services.walls_advanced import design_sheet_pile_advanced
from geotek.services.walls_basic import BasicSheetPileInput, design_sheet_pile_basic
from geotek.ui.pages.base import FormColumn, Page, split_layout
from geotek.ui.pages.factor_widgets import CodeSelector, MissingFactorsCard
from geotek.ui.labels import factor_symbol
from geotek.ui.widgets import (
    Banner,
    Card,
    EmptyState,
    FormGrid,
    NumberField,
    OptionalNumber,
    PlotCanvas,
    Segmented,
    button,
    fill_table,
    label,
    make_table,
    table_item,
)
from geotek.ui.worker import Task, error_text


class SheetPilePage(Page):
    def __init__(self, state):
        super().__init__(t("ui.nav.sheet_pile"), t("ui.sheet.subtitle"))
        self.state = state
        self.task: Task | None = None
        self.result = None

        form = FormColumn(410)
        self.form = form
        self.code_card = form.add(Card(t("ui.code.title")))
        self.code_selector = CodeSelector(state, allow_global_fs=False)
        self.code_selector.changed.connect(self.refresh_missing)
        self.code_card.body.addWidget(self.code_selector)
        self.missing_card = form.add(MissingFactorsCard(state))

        geo = form.add(Card(t("ui.sheet.card.wall")))
        g = FormGrid()
        self.support = Segmented([("cantilever", t("ui.sheet.cantilever")), ("anchored", t("ui.sheet.anchored"))])
        self.support.changed.connect(lambda _: self._support_changed())
        self.H = NumberField(1.0, 12.0, 4.0, step=0.25, unit="m")
        self.anchor = NumberField(0.0, 10.0, 1.0, step=0.25, unit="m")
        g.add(t("ui.sheet.support"), self.support)
        g.add(t("ui.sheet.height"), self.H, t("ui.sheet.height_tip"))
        g.add(t("ui.sheet.anchor_depth"), self.anchor, t("ui.sheet.anchor_tip"))
        self.geo_grid = g
        geo.body.addLayout(g)

        soil = form.add(Card(t("ui.sheet.card.soil")))
        self.soil_hint = label(t("ui.sheet.profile_used"), "Hint", wrap=True)
        soil.body.addWidget(self.soil_hint)
        s = FormGrid()
        self.drainage = Segmented([("drained", t("ui.behaviour.drained")), ("undrained", t("ui.behaviour.undrained"))])
        self.drainage.changed.connect(lambda _: self._drainage_changed())
        self.gamma = NumberField(10.5, 24.5, 18.0, unit="kN/m³")
        self.gamma_sat = OptionalNumber(NumberField(10.5, 24.5, 20.0, unit="kN/m³"), t("ui.sheet.same_as_gamma"))
        self.phi = NumberField(10.5, 44.5, 30.0, decimals=1, step=1, unit="°")
        self.c = NumberField(0.0, 200.0, 0.0, decimals=1, step=1, unit="kPa")
        self.su = NumberField(1.0, 500.0, 40.0, decimals=1, step=5, unit="kPa")
        self.gwt = OptionalNumber(NumberField(0.0, 50.0, 2.0, step=0.25, unit="m"), t("ui.sheet.no_water"))
        s.add(t("ui.wall.drainage"), self.drainage)
        s.add("γ", self.gamma, t("term.unit_weight"))
        s.add("γ_sat", self.gamma_sat, t("term.sat_unit_weight"))
        s.add("φ'", self.phi, t("term.friction_angle"))
        s.add("c'", self.c, t("term.cohesion"))
        s.add("s_u", self.su, t("term.undrained_strength"))
        s.add(t("ui.sheet.gwt"), self.gwt, t("ui.sheet.gwt_tip"))
        self.soil_grid = s
        soil.body.addLayout(s)

        loads = form.add(Card(t("ui.wall.card.loads")))
        lg = FormGrid()
        self.surcharge = NumberField(0.0, 200.0, 10.0, decimals=1, step=5, unit="kPa")
        self.sds = OptionalNumber(NumberField(0.01, 2.99, 0.5, step=0.05), t("ui.sheet.use_sds"),
                                  checked_is_auto=False, checked=False)
        self.allow = OptionalNumber(NumberField(50.0, 500.0, 180.0, decimals=0, step=10, unit="MPa"),
                                    t("ui.sheet.use_allow"), checked_is_auto=False, checked=False)
        lg.add(t("ui.wall.surcharge"), self.surcharge)
        lg.add("S_DS", self.sds, t("ui.wall.sds_tip"))
        lg.add(t("ui.sheet.allowable"), self.allow, t("ui.sheet.allowable_tip"))
        self.loads_grid = lg
        loads.body.addLayout(lg)
        form.finish()
        self.run_button = button(t("ui.sheet.run"), "primary", self.run)
        form.buttons.addWidget(self.run_button, 1)

        self.results = QStackedWidget()
        self.results.addWidget(EmptyState(t("ui.sheet.empty_title"), t("ui.sheet.empty_text")))
        view = QWidget()
        vl = QVBoxLayout(view)
        vl.setContentsMargins(0, 0, 0, 0)
        vl.setSpacing(12)
        self.banner = Banner()
        vl.addWidget(self.banner)
        card = Card()
        self.tabs = QTabWidget()
        self.canvas = PlotCanvas()
        self.cases_table = make_table(["", "D₀ (m)", "D (m)", "M_max (kNm/m)", "T (kN/m)"])
        self.notes_table = make_table([t("ui.col.assumption"), t("ui.col.source")])
        self.warnings_label = label("", "Error", wrap=True)
        notes = QWidget()
        nl = QVBoxLayout(notes)
        nl.setContentsMargins(0, 8, 0, 0)
        nl.addWidget(self.notes_table, 1)
        nl.addWidget(self.warnings_label)
        self.tabs.addTab(self.canvas, t("ui.sheet.tab.diagrams"))
        self.tabs.addTab(self.cases_table, t("ui.sheet.tab.cases"))
        self.tabs.addTab(notes, t("ui.wall.tab.notes"))
        card.body.addWidget(self.tabs, 1)
        vl.addWidget(card, 1)
        self.results.addWidget(view)
        self.body.addLayout(split_layout(form, self.results), 1)

        self.restore_form(state.form("sheet_pile"))
        state.levelChanged.connect(lambda _: self._level_changed())
        state.overridesChanged.connect(lambda _: self.refresh_missing())
        self._level_changed()

    @property
    def advanced(self) -> bool:
        return self.state.level == "advanced"

    def _level_changed(self) -> None:
        self.result = None
        self.results.setCurrentIndex(0)
        a = self.advanced
        self.code_card.setVisible(a)
        self.soil_hint.setVisible(a)
        for w in (self.gamma, self.gamma_sat, self.phi, self.c, self.su, self.gwt):
            self.soil_grid.set_row_visible(w, not a)
        self.loads_grid.set_row_visible(self.sds, not a)
        self.loads_grid.set_row_visible(self.allow, not a)
        self._support_changed()
        if not a:
            self._drainage_changed()
        self.refresh_missing()

    def _support_changed(self) -> None:
        self.geo_grid.set_row_visible(self.anchor, self.support.value() == "anchored")

    def _drainage_changed(self) -> None:
        if self.advanced:
            return
        drained = self.drainage.value() == "drained"
        self.soil_grid.set_row_visible(self.phi, drained)
        self.soil_grid.set_row_visible(self.c, drained)
        self.soil_grid.set_row_visible(self.su, not drained)

    def refresh_missing(self) -> None:
        if not self.advanced:
            self.missing_card.setVisible(False)
            self.run_button.setEnabled(True)
            self.form.set_reason("")
            return
        code = self.code_selector.code_id()
        missing = self.missing_card.update_for(code, self.code_selector.approach_id(), [False])
        self.run_button.setEnabled(not missing)
        names = ", ".join(dict.fromkeys(factor_symbol(code, m.path) for m in missing))
        self.form.set_reason(t("ui.wall.blocked", names=names) if missing else "")

    # --- run ----------------------------------------------------------------------------

    def _job(self):
        support = self.support.value()
        anchor = self.anchor.value() if support == "anchored" else None
        if not self.advanced:
            drained = self.drainage.value() == "drained"
            gwt = self.gwt.value()
            inp = BasicSheetPileInput(
                support=support, retained_height=self.H.value(), anchor_depth=anchor, gamma=self.gamma.value(),
                gamma_sat=self.gamma_sat.value(), drainage=self.drainage.value(),
                phi=self.phi.value() if drained else None, c=self.c.value() if drained else 0.0,
                su=None if drained else self.su.value(), gwt_depth=gwt if gwt is not None else 100.0,
                surcharge=self.surcharge.value(), sds=self.sds.value(), allowable_stress_mpa=self.allow.value())
            return lambda: ("basic", design_sheet_pile_basic(inp), gwt)
        profile = self.state.profile()
        if profile is None:
            raise ValueError(t("ui.wall.no_profile"))
        code, approach = self.code_selector.code_id(), self.code_selector.approach_id()
        overrides = self.state.overrides(code)
        H, q, drainage = self.H.value(), self.surcharge.value(), self.drainage.value()
        gwt = profile.gwt.depth_design
        return lambda: ("advanced", design_sheet_pile_advanced(profile, H, code=code, approach=approach,
                                                               overrides=overrides, support=support,
                                                               anchor_depth=anchor, surcharge=q, drainage=drainage),
                        gwt)

    def run(self) -> None:
        try:
            job = self._job()
        except Exception as exc:  # noqa: BLE001
            self.form.set_reason(error_text(exc), error=True)
            return
        self.store_form()
        self.form.set_reason("")
        self.form.set_busy(True)
        self.run_button.setEnabled(False)
        self.task = Task(job, self)
        self.task.succeeded.connect(self._on_done)
        self.task.failed.connect(self._on_failed)
        self.task.start()

    def wait(self) -> None:
        from PySide6.QtWidgets import QApplication

        if self.task is not None:
            self.task.wait()
            QApplication.processEvents()
            QApplication.processEvents()

    def _on_failed(self, message: str) -> None:
        self.form.set_busy(False)
        self.refresh_missing()
        self.form.set_reason(message, error=True)

    def _on_done(self, payload) -> None:
        self.form.set_busy(False)
        self.refresh_missing()
        level, res, gwt = payload
        self.result = res
        if level == "basic":
            r = res.result
            cases = {t("ui.sheet.design"): r}
            notes = [(a.text, a.source) for a in res.assumptions]
            warnings = res.warnings
            shown, title = r, t("ui.sheet.basic_basis")
            D, M, T = r.D, r.M_max, r.anchor_force
            extra = [("S", f"{r.section_modulus_cm3:.0f} cm³")] if r.section_modulus_cm3 else []
        else:
            cases = res.cases
            notes = [(f"{f.path} = {f.value:g}", f.source) for used in res.factors_used.values() for f in used]
            warnings = sorted({w for r in cases.values() for w in r.warnings})
            shown = cases[res.governing_moment]
            title = t("ui.sheet.governing", d=res.governing_embedment, m=res.governing_moment)
            D, M, T = res.D_required, res.M_design, res.anchor_force_design
            extra = []
        tiles = [("D₀", f"{shown.D0:.2f} m"), (t("ui.sheet.tile.D"), f"{D:.2f} m"),
                 ("M_max", f"{M:.1f} kNm/m")]
        if T is not None:
            tiles.append((t("ui.sheet.tile.T"), f"{T:.1f} kN/m"))
        tiles += extra
        self.banner.set_result("neutral", t("ui.sheet.result_title", D=f"{D:.2f}"), "", title,
                               t("ui.sheet.total_length", L=f"{self.H.value() + D:.2f}"), tiles)
        fill_table(self.cases_table, [[table_item(name, bold=True), table_item(f"{r.D0:.2f}", align_right=True),
                                       table_item(f"{r.D:.2f}", align_right=True),
                                       table_item(f"{r.M_max:.1f}", align_right=True),
                                       table_item("–" if r.anchor_force is None else f"{r.anchor_force:.1f}",
                                                  align_right=True)] for name, r in cases.items()])
        fill_table(self.notes_table, [[table_item(a), table_item(b, tooltip=b)] for a, b in notes])
        self.warnings_label.setText("\n".join(f"⚠ {w}" for w in warnings))
        self.warnings_label.setVisible(bool(warnings))
        self.results.setCurrentIndex(1)
        self.canvas.draw(plot_sheet_pile, shown, gwt_depth=gwt)
        self.store_form()

    # --- persistence --------------------------------------------------------------------

    def form_values(self) -> dict:
        return {"support": self.support.value(), "H": self.H.value(), "anchor": self.anchor.value(),
                "drainage": self.drainage.value(), "gamma": self.gamma.value(), "gamma_sat": self.gamma_sat.value(),
                "phi": self.phi.value(), "c": self.c.value(), "su": self.su.value(), "gwt": self.gwt.value(),
                "surcharge": self.surcharge.value(), "sds": self.sds.value(), "allow": self.allow.value()}

    def store_form(self) -> None:
        self.state.store_form("sheet_pile", self.form_values())

    def restore_form(self, v: dict) -> None:
        if not v:
            return
        dirty = self.state.dirty
        self.support.set_value(v.get("support", "cantilever"))
        self.drainage.set_value(v.get("drainage", "drained"))
        for key, w in (("H", self.H), ("anchor", self.anchor), ("gamma", self.gamma), ("phi", self.phi),
                       ("c", self.c), ("su", self.su), ("surcharge", self.surcharge)):
            if key in v:
                w.setValue(v[key])
        for key, w in (("gamma_sat", self.gamma_sat), ("gwt", self.gwt), ("sds", self.sds), ("allow", self.allow)):
            w.set_value(v.get(key))
        self.state.mark_dirty(dirty)
