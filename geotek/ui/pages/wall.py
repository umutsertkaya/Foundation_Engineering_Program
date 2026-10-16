"""Retaining wall page: one flow for both levels — suggest dimensions, edit them, check them.

Inputs on the left (soil, loads, seismic, options, wall dimensions), results on the right
(pass/fail banner, section with forces, checks, critical slip circle, factors, assumptions).
Calculations run in a worker thread; figures are drawn on the GUI thread afterwards.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QHBoxLayout,
    QHeaderView,
    QStackedWidget,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

from geotek.core.models.walls import (
    Backfill,
    CantileverGeometry,
    FoundationSoil,
    GravityGeometry,
    WallLoads,
    WallSettings,
)
from geotek.engine.earth_pressure.coefficients import TBDY_R, tbdy_seismic_coefficients
from geotek.engine.stability import SoilBand
from geotek.i18n import t
from geotek.plotting.figures import plot_slip_circle, plot_wall_section
from geotek.services import walls_advanced as adv
from geotek.services.walls_basic import BasicWallInput, _ceil, check_wall, proportion_for, size_wall
from geotek.ui.labels import STATUS_TONE, case_label, check_label, factor_symbol, governing_label, status_text
from geotek.ui.pages.base import FormColumn, Page, split_layout
from geotek.ui.pages.factor_widgets import CodeSelector, MissingFactorsCard
from geotek.ui.widgets import (
    Badge,
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
from geotek.ui.worker import Task

CANTILEVER_FIELDS = ("stem_top", "stem_bottom", "toe", "heel", "base_thickness")
GRAVITY_FIELDS = ("base_width", "top_width", "back_offset")


@dataclass
class WallOutcome:
    """Level-independent view of a wall result for display."""

    mode: str  # "suggest" | "check"
    level: str
    passed: bool
    governing: str
    geometry: CantileverGeometry | GravityGeometry
    backfill: Backfill
    surcharge: float
    analyses: list = field(default_factory=list)          # WallAnalysis
    global_stability: list = field(default_factory=list)  # (case, CheckResult)
    slips: dict = field(default_factory=dict)              # case -> SlipResult
    factors_used: list = field(default_factory=list)
    assumptions: list = field(default_factory=list)        # (text, source)
    warnings: list = field(default_factory=list)
    code: str = "asd"
    kh: float | None = None
    kv: float | None = None
    water_level: float | None = None

    def rows(self):
        out = [(a.case, c) for a in self.analyses for c in a.checks.values()]
        return out + list(self.global_stability)

    def critical(self) -> str:
        """Check with the smallest margin (value/required, or required/value for '<=' checks)."""
        best, key = math.inf, ""
        for case, c in self.rows():
            if c.comparison == "<=":
                ratio = c.required / c.value if c.value > 0 else math.inf
            else:
                ratio = c.value / c.required if c.required else math.inf
            if ratio < best:
                best, key = ratio, f"{case}:{c.name}"
        return key


class WallPage(Page):
    def __init__(self, state):
        super().__init__(t("ui.nav.wall"), t("ui.wall.subtitle"))
        self.state = state
        self.task: Task | None = None
        self.outcome: WallOutcome | None = None
        self.geometry_source = "draft"
        self._setting_geometry = False

        self.form = FormColumn(430)
        self._build_code_cards()
        self._build_wall_card()
        self._build_backfill_card()
        self._build_foundation_card()
        self._build_loads_card()
        self._build_options_card()
        self._build_geometry_card()
        self.form.finish()
        self.suggest_button = button(t("ui.wall.suggest"), "primary", self.suggest)
        self.suggest_button.setToolTip(t("ui.wall.suggest_tip"))
        self.check_button = button(t("ui.wall.check"), None, self.check)
        self.check_button.setToolTip(t("ui.wall.check_tip"))
        self.form.buttons.addWidget(self.suggest_button, 1)
        self.form.buttons.addWidget(self.check_button, 1)

        self.results = QStackedWidget()
        self.empty = EmptyState(t("ui.wall.empty_title"), t("ui.wall.empty_text"),
                                [t("ui.wall.step1"), t("ui.wall.step2"), t("ui.wall.step3")])
        self.results.addWidget(self.empty)
        self.results.addWidget(self._build_result_view())
        self.body.addLayout(split_layout(self.form, self.results), 1)

        self.restore_form(state.form("wall"))
        state.levelChanged.connect(lambda _: self._level_changed())
        state.overridesChanged.connect(lambda _: self.refresh_missing())
        state.profileChanged.connect(self._update_profile_info)
        self._level_changed()

    # --- form construction --------------------------------------------------------------

    def _build_code_cards(self) -> None:
        self.code_card = self.form.add(Card(t("ui.code.title")))
        self.code_selector = CodeSelector(self.state)
        self.code_selector.changed.connect(self.refresh_missing)
        self.code_selector.changed.connect(lambda: self.outcome and self.outcome.level == "advanced"
                                           and self.clear_result())
        self.code_card.body.addWidget(self.code_selector)
        self.missing_card = self.form.add(MissingFactorsCard(self.state))

    def _build_wall_card(self) -> None:
        card = self.form.add(Card(t("ui.wall.card.wall")))
        grid = FormGrid()
        self.wall_type = Segmented([("cantilever", t("ui.wall.cantilever")), ("gravity", t("ui.wall.gravity"))])
        self.wall_type.changed.connect(self._type_changed)
        self.height = NumberField(1.0, 15.0, 5.0, step=0.25, unit="m")
        self.height.valueChanged.connect(self._height_changed)
        self.embedment = OptionalNumber(NumberField(0.0, 5.0, 0.6, step=0.05, unit="m"), t("ui.auto"))
        self.embedment.setToolTip(t("ui.wall.embedment_tip"))
        self.embedment.changed.connect(self._update_geometry_summary)
        grid.add(t("ui.wall.type"), self.wall_type)
        grid.add(t("ui.wall.height"), self.height, t("ui.wall.height_tip"))
        grid.add(t("ui.wall.embedment"), self.embedment, t("ui.wall.embedment_tip"))
        card.body.addLayout(grid)

    def _build_backfill_card(self) -> None:
        card = self.form.add(Card(t("ui.wall.card.backfill")))
        grid = FormGrid()
        self.bf_gamma = NumberField(10.5, 24.5, 18.0, unit="kN/m³")
        self.bf_phi = NumberField(15.5, 44.5, 32.0, decimals=1, step=1, unit="°")
        self.bf_slope = NumberField(0.0, 34.5, 0.0, decimals=1, step=1, unit="°")
        grid.add("γ", self.bf_gamma, t("term.unit_weight"))
        grid.add("φ'", self.bf_phi, t("term.friction_angle"))
        grid.add(t("ui.wall.slope"), self.bf_slope, t("ui.wall.slope_tip"))
        card.body.addLayout(grid)

    def _build_foundation_card(self) -> None:
        card = self.form.add(Card(t("ui.wall.card.foundation")))
        self.from_profile = QCheckBox(t("ui.wall.from_profile"))
        self.from_profile.toggled.connect(self._foundation_mode_changed)
        card.body.addWidget(self.from_profile)
        self.profile_grid = FormGrid()
        self.base_depth = NumberField(0.0, 50.0, 0.6, step=0.1, unit="m")
        self.profile_grid.add(t("ui.wall.base_depth"), self.base_depth, t("ui.wall.base_depth_tip"))
        self.profile_info = label("", "Hint", wrap=True)
        self.profile_grid.add_full(self.profile_info)
        card.body.addLayout(self.profile_grid)

        self.found_grid = FormGrid()
        self.drainage = Segmented([("drained", t("ui.behaviour.drained")), ("undrained", t("ui.behaviour.undrained"))])
        self.drainage.changed.connect(lambda _: self._drainage_changed())
        self.f_phi = NumberField(0.0, 44.5, 30.0, decimals=1, step=1, unit="°")
        self.f_c = NumberField(0.0, 500.0, 0.0, decimals=1, step=1, unit="kPa")
        self.f_su = NumberField(1.0, 1000.0, 50.0, decimals=1, step=5, unit="kPa")
        self.f_gamma = NumberField(10.5, 24.5, 19.0, unit="kN/m³")
        self.f_delta = OptionalNumber(NumberField(0.0, 44.5, 20.0, decimals=1, step=1, unit="°"), t("ui.auto"))
        self.f_adhesion = NumberField(0.0, 200.0, 0.0, decimals=1, step=1, unit="kPa")
        self.found_grid.add(t("ui.wall.drainage"), self.drainage)
        self.found_grid.add("φ'", self.f_phi, t("term.friction_angle"))
        self.found_grid.add("c'", self.f_c, t("term.cohesion"))
        self.found_grid.add("s_u", self.f_su, t("term.undrained_strength"))
        self.found_grid.add("γ", self.f_gamma, t("term.unit_weight"))
        self.found_grid.add("δ_b", self.f_delta, t("ui.wall.delta_base_tip"))
        self.found_grid.add("c_a", self.f_adhesion, t("ui.wall.adhesion_tip"))
        card.body.addLayout(self.found_grid)
        self.foundation_card = card

    def _build_loads_card(self) -> None:
        card = self.form.add(Card(t("ui.wall.card.loads")))
        grid = FormGrid()
        self.surcharge = NumberField(0.0, 200.0, 10.0, decimals=1, step=5, unit="kPa")
        grid.add(t("ui.wall.surcharge"), self.surcharge, t("ui.wall.surcharge_tip"))
        self.seismic = QCheckBox(t("ui.wall.seismic"))
        self.seismic.setChecked(True)
        self.seismic.toggled.connect(self._seismic_changed)
        grid.add_full(self.seismic)
        self.sds = NumberField(0.01, 2.99, 0.5, step=0.05)
        self.r = OptionalNumber(NumberField(0.5, 2.0, 1.5, step=0.5), t("ui.wall.r_auto"))
        self.r.setToolTip(t("ui.wall.r_tip"))
        self.inc_height = NumberField(0.3, 0.7, 0.5, step=0.05, unit="× H")
        grid.add("S_DS", self.sds, t("ui.wall.sds_tip"))
        grid.add("r", self.r, t("ui.wall.r_tip"))
        grid.add(t("ui.wall.inc_height"), self.inc_height, t("ui.wall.inc_height_tip"))
        self.loads_grid = grid
        card.body.addLayout(grid)

    def _build_options_card(self) -> None:
        card = self.form.add(Card(t("ui.wall.card.options")))
        grid = FormGrid()
        self.global_check = QCheckBox(t("ui.wall.global"))
        self.global_check.setChecked(True)
        self.global_check.setToolTip(t("ui.wall.global_tip"))
        grid.add_full(self.global_check)
        self.bearing = QComboBox()
        for m in ("vesic", "hansen", "meyerhof"):
            self.bearing.addItem(m.capitalize(), m)
        self.passive = OptionalNumber(NumberField(0.1, 1.0, 0.5, step=0.1), t("ui.wall.use_passive"),
                                      checked_is_auto=False, checked=False)
        self.passive.setToolTip(t("ui.wall.passive_tip"))
        self.toe_soil = QCheckBox(t("ui.wall.toe_soil"))
        self.concrete = NumberField(18.0, 28.0, 24.0, step=0.5, unit="kN/m³")
        self.water = OptionalNumber(NumberField(-20.0, 15.0, -1.0, step=0.5, unit="m"), t("ui.wall.water_use"),
                                    checked_is_auto=False, checked=False)
        grid.add(t("ui.wall.bearing"), self.bearing)
        grid.add(t("ui.wall.passive"), self.passive, t("ui.wall.passive_tip"))
        grid.add_full(self.toe_soil)
        grid.add(t("ui.wall.concrete"), self.concrete)
        grid.add(t("ui.wall.water"), self.water, t("ui.wall.water_tip"))
        self.options_grid = grid
        card.body.addLayout(grid)

    def _build_geometry_card(self) -> None:
        card = self.form.add(Card(t("ui.wall.card.geometry"), t("ui.wall.geometry_hint")))
        self.geometry_badge = Badge("", "neutral")
        card.add_header_widget(self.geometry_badge)
        grid = FormGrid()
        self.geo: dict[str, NumberField] = {}
        for key in CANTILEVER_FIELDS + GRAVITY_FIELDS:
            lo = 0.0 if key in ("toe", "back_offset") else 0.1
            f = NumberField(lo, 20.0, 0.5, step=0.05, unit="m")
            f.valueChanged.connect(self._geometry_edited)
            self.geo[key] = f
            grid.add(t(f"ui.geo.{key}"), f, t(f"ui.geo.{key}_tip"))
        self.geo_summary = label("", "Hint", wrap=True)
        grid.add_full(self.geo_summary)
        self.geo_grid = grid
        card.body.addLayout(grid)

    # --- result view --------------------------------------------------------------------

    def _build_result_view(self) -> QWidget:
        view = QWidget()
        lay = QVBoxLayout(view)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(12)
        self.banner = Banner()
        lay.addWidget(self.banner)

        tabs_card = Card()
        top = QHBoxLayout()
        top.addWidget(label(t("ui.wall.case_shown"), "Muted"))
        self.case_pick = Segmented([("static", case_label("static"))])
        self.case_pick.changed.connect(lambda _: self._draw_plots())
        self.case_holder = QHBoxLayout()
        self.case_holder.addWidget(self.case_pick)
        top.addLayout(self.case_holder)
        top.addStretch(1)
        tabs_card.body.addLayout(top)

        self.tabs = QTabWidget()
        self.section_canvas = PlotCanvas()
        self.slip_canvas = PlotCanvas()
        self.checks_table = make_table([t("ui.col.case"), t("ui.col.check"), t("ui.col.value"), "", t("ui.col.limit"),
                                        t("ui.col.result")], stretch_last=False)
        self.checks_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self.factors_table = make_table([t("ui.col.symbol"), t("ui.col.path"), t("ui.col.value"), t("ui.col.status"),
                                         t("ui.col.source")])
        self.assumptions_table = make_table([t("ui.col.assumption"), t("ui.col.source")])
        self.warnings_label = label("", "Error", wrap=True)
        notes = QWidget()
        nl = QVBoxLayout(notes)
        nl.setContentsMargins(0, 8, 0, 0)
        nl.addWidget(self.assumptions_table, 1)
        nl.addWidget(self.warnings_label)
        self.tabs.addTab(self.section_canvas, t("ui.wall.tab.section"))
        self.tabs.addTab(self.checks_table, t("ui.wall.tab.checks"))
        self.tabs.addTab(self.slip_canvas, t("ui.wall.tab.global"))
        self.tabs.addTab(self.factors_table, t("ui.wall.tab.factors"))
        self.tabs.addTab(notes, t("ui.wall.tab.notes"))
        tabs_card.body.addWidget(self.tabs, 1)
        lay.addWidget(tabs_card, 1)
        return view

    # --- reactions ----------------------------------------------------------------------

    @property
    def advanced(self) -> bool:
        return self.state.level == "advanced"

    def clear_result(self) -> None:
        """Drop a result that no longer matches the chosen level or design code."""
        self.outcome = None
        self.results.setCurrentIndex(0)

    def _level_changed(self) -> None:
        self.clear_result()
        adv_on = self.advanced
        self.code_card.setVisible(adv_on)
        self.from_profile.setVisible(adv_on)
        if not adv_on:
            self.from_profile.setChecked(False)
        for f in (self.f_delta, self.f_adhesion):
            self.found_grid.set_row_visible(f, adv_on)
        self.loads_grid.set_row_visible(self.inc_height, adv_on and self.seismic.isChecked())
        for f in (self.bearing, self.passive, self.concrete, self.water):
            self.options_grid.set_row_visible(f, adv_on)
        self.toe_soil.setVisible(adv_on)
        self._foundation_mode_changed()
        self.refresh_missing()

    def _foundation_mode_changed(self) -> None:
        use_profile = self.from_profile.isChecked()
        self.profile_grid.set_row_visible(self.base_depth, use_profile)
        self.profile_info.setVisible(use_profile)
        self.found_grid.set_row_visible(self.drainage, True)
        self._drainage_changed()
        self._update_profile_info()

    def _drainage_changed(self) -> None:
        manual = not self.from_profile.isChecked()
        drained = self.drainage.value() == "drained"
        self.found_grid.set_row_visible(self.f_phi, manual and drained)
        self.found_grid.set_row_visible(self.f_c, manual and drained)
        self.found_grid.set_row_visible(self.f_su, manual and not drained)
        self.found_grid.set_row_visible(self.f_gamma, manual)
        adv_on = self.advanced
        self.found_grid.set_row_visible(self.f_delta, manual and adv_on and drained)
        self.found_grid.set_row_visible(self.f_adhesion, manual and adv_on and drained)

    def _update_profile_info(self) -> None:
        profile = self.state.profile()
        if profile is None:
            self.profile_info.setText(t("ui.wall.no_profile"))
            return
        try:
            layer = profile.layer_at(self.base_depth.value() + 1e-6)
        except Exception:  # noqa: BLE001 - depth outside the profile
            self.profile_info.setText(t("ui.wall.depth_outside", bottom=f"{profile.bottom:g}"))
            return
        d = layer.design
        params = ", ".join(p for p in (
            f"φ' = {d.phi_eff:g}°" if d.phi_eff is not None else "",
            f"c' = {d.c_eff:g} kPa" if d.c_eff else "",
            f"s_u = {d.su:g} kPa" if d.su is not None else "") if p) or t("ui.wall.no_design_params")
        self.profile_info.setText(t("ui.wall.profile_layer", id=layer.id, desc=layer.description or "", params=params))

    def _seismic_changed(self, on: bool) -> None:
        self.loads_grid.set_row_visible(self.sds, on)
        self.loads_grid.set_row_visible(self.r, on)
        self.loads_grid.set_row_visible(self.inc_height, on and self.advanced)
        self.refresh_missing()

    def _type_changed(self, _=None) -> None:
        cantilever = self.wall_type.value() == "cantilever"
        for key in CANTILEVER_FIELDS:
            self.geo_grid.set_row_visible(self.geo[key], cantilever)
        for key in GRAVITY_FIELDS:
            self.geo_grid.set_row_visible(self.geo[key], not cantilever)
        if self.geometry_source != "user":
            self._set_geometry(self._draft_geometry(), "draft")
        self._update_geometry_summary()

    def _height_changed(self, _=None) -> None:
        if self.geometry_source == "draft":
            self._set_geometry(self._draft_geometry(), "draft")
        self._update_geometry_summary()

    def _geometry_edited(self, _=None) -> None:
        if not self._setting_geometry:
            self._set_source("user")
            self._update_geometry_summary()

    def _set_source(self, source: str) -> None:
        self.geometry_source = source
        tone = {"draft": "neutral", "suggested": "info", "user": "user"}[source]
        self.geometry_badge.set_tone(tone, t(f"ui.wall.source.{source}"))

    def refresh_missing(self) -> None:
        if not self.advanced:
            self.missing_card.setVisible(False)
            self._set_enabled(True)
            return
        cases = [False, True] if self.seismic.isChecked() else [False]
        missing = self.missing_card.update_for(self.code_selector.code_id(), self.code_selector.approach_id(), cases)
        if missing:
            names = ", ".join(dict.fromkeys(factor_symbol(self.code_selector.code_id(), m.path) for m in missing))
            self._set_enabled(False, t("ui.wall.blocked", names=names))
        else:
            self._set_enabled(True)

    def _set_enabled(self, enabled: bool, reason: str = "") -> None:
        busy = self.task is not None and self.task.isRunning()
        self.suggest_button.setEnabled(enabled and not busy)
        self.check_button.setEnabled(enabled and not busy)
        self.form.set_reason(reason)

    # --- geometry helpers ---------------------------------------------------------------

    def embedment_value(self) -> float:
        v = self.embedment.value()
        return v if v is not None else max(0.6, _ceil(self.height.value() / 10))

    def _draft_geometry(self):
        H, D = self.height.value(), self.embedment_value()
        B = _ceil(0.6 * H)
        geom = None
        while geom is None and B <= 1.5 * H:
            geom = proportion_for(self.wall_type.value(), H, B, D)
            B += 0.05
        return geom

    def _set_geometry(self, g, source: str) -> None:
        if g is None:
            return
        self._setting_geometry = True
        try:
            if isinstance(g, CantileverGeometry):
                self.wall_type.set_value("cantilever")
                for key in CANTILEVER_FIELDS:
                    self.geo[key].setValue(getattr(g, key))
            else:
                self.wall_type.set_value("gravity")
                for key in GRAVITY_FIELDS:
                    self.geo[key].setValue(getattr(g, key))
        finally:
            self._setting_geometry = False
        self._set_source(source)
        self._update_geometry_summary()

    def geometry(self) -> CantileverGeometry | GravityGeometry:
        H, D = self.height.value(), self.embedment_value()
        v = {k: f.value() for k, f in self.geo.items()}
        if self.wall_type.value() == "cantilever":
            return CantileverGeometry(stem_height=H - v["base_thickness"], stem_top=v["stem_top"],
                                      stem_bottom=v["stem_bottom"], toe=v["toe"], heel=v["heel"],
                                      base_thickness=v["base_thickness"], embedment=D)
        return GravityGeometry(height=H, base_width=v["base_width"], top_width=v["top_width"],
                               back_offset=v["back_offset"], embedment=D)

    def _update_geometry_summary(self) -> None:
        v = {k: f.value() for k, f in self.geo.items()}
        D = self.embedment_value()
        if self.wall_type.value() == "cantilever":
            B = v["toe"] + v["stem_bottom"] + v["heel"]
            text = t("ui.wall.summary_cantilever", B=f"{B:.2f}", hs=f"{self.height.value() - v['base_thickness']:.2f}",
                     D=f"{D:.2f}")
        else:
            text = t("ui.wall.summary_gravity", B=f"{v['base_width']:.2f}", D=f"{D:.2f}")
        self.geo_summary.setText(text)

    # --- inputs -------------------------------------------------------------------------

    def basic_input(self) -> BasicWallInput:
        drained = self.drainage.value() == "drained"
        return BasicWallInput(
            wall_type=self.wall_type.value(), height=self.height.value(),
            backfill_gamma=self.bf_gamma.value(), backfill_phi=self.bf_phi.value(), backfill_slope=self.bf_slope.value(),
            foundation_drainage=self.drainage.value(),
            foundation_phi=self.f_phi.value() if drained else 0.0, foundation_c=self.f_c.value() if drained else 0.0,
            foundation_su=None if drained else self.f_su.value(), foundation_gamma=self.f_gamma.value(),
            surcharge=self.surcharge.value(), embedment=self.embedment.value(),
            sds=self.sds.value() if self.seismic.isChecked() else None,
            r=self.r.value() if self.seismic.isChecked() else None,
            include_global_stability=self.global_check.isChecked(),
            factor_overrides=self.state.overrides("asd"),
        )

    def advanced_inputs(self) -> dict:
        D = self.embedment_value()
        backfill = Backfill(gamma=self.bf_gamma.value(), phi=self.bf_phi.value(), slope=self.bf_slope.value())
        drainage = self.drainage.value()
        bands = None
        if self.from_profile.isChecked():
            profile = self.state.profile()
            if profile is None:
                raise ValueError(t("ui.wall.no_profile"))
            depth = self.base_depth.value()
            foundation = adv.foundation_from_profile(profile, depth, drainage=drainage)
            if self.global_check.isChecked():
                bands = adv.bands_from_profile(profile, depth, drainage=drainage)
        else:
            gamma = self.f_gamma.value()
            if drainage == "undrained":
                foundation = FoundationSoil(drainage="undrained", su=self.f_su.value(), gamma=gamma, overburden=gamma * D)
                band = SoilBand(top=0.0, gamma=gamma, c=self.f_su.value(), phi=0.0)
            else:
                foundation = FoundationSoil(phi=self.f_phi.value(), c=self.f_c.value(), gamma=gamma,
                                            overburden=gamma * D, delta_base=self.f_delta.value(),
                                            adhesion=self.f_adhesion.value())
                band = SoilBand(top=0.0, gamma=gamma, c=self.f_c.value(), phi=self.f_phi.value())
            if self.global_check.isChecked():
                bands = [band]
        loads = WallLoads(surcharge=self.surcharge.value())
        kh = kv = None
        if self.seismic.isChecked():
            r = self.r.value() if self.r.value() is not None else TBDY_R["gravity_80sds_mm"]
            kh, kv = tbdy_seismic_coefficients(self.sds.value(), r)
            loads = WallLoads(surcharge=self.surcharge.value(), kh=kh, kv=kv,
                              seismic_increment_height=self.inc_height.value())
        code = self.code_selector.code_id()
        passive = self.passive.value()
        settings = WallSettings(design_code=code, bearing_method=self.bearing.currentData(),
                                use_passive=passive is not None, passive_reduction=passive or 0.5,
                                include_toe_soil=self.toe_soil.isChecked(),
                                concrete_unit_weight=self.concrete.value(), factor_overrides=self.state.overrides(code))
        return dict(backfill=backfill, foundation=foundation, loads=loads, settings=settings, bands=bands,
                    approach=self.code_selector.approach_id(), seismic=self.seismic.isChecked(), D=D, kh=kh, kv=kv,
                    water_level=self.water.value())

    # --- running ------------------------------------------------------------------------

    def suggest(self) -> None:
        self._run("suggest")

    def check(self) -> None:
        self._run("check")

    def _run(self, mode: str) -> None:
        try:
            job = self._job(mode)
        except Exception as exc:  # noqa: BLE001 - invalid input is shown next to the buttons
            from geotek.ui.worker import error_text

            self.form.set_reason(error_text(exc), error=True)
            return
        self.store_form()
        self.form.set_reason("")
        self.form.set_busy(True)
        self.suggest_button.setEnabled(False)
        self.check_button.setEnabled(False)
        self.task = Task(job, self)
        self.task.succeeded.connect(self._on_done)
        self.task.failed.connect(self._on_failed)
        self.task.start()

    def _job(self, mode: str):
        """Validate inputs on the GUI thread; return the function the worker will run."""
        if not self.advanced:
            inp = self.basic_input()
            geom = self.geometry() if mode == "check" else None

            def basic_job():
                r = size_wall(inp) if mode == "suggest" else check_wall(inp, geom)
                return WallOutcome(
                    mode=mode, level="basic", passed=r.passed, governing=r.governing, geometry=r.geometry,
                    backfill=Backfill(gamma=inp.backfill_gamma, phi=inp.backfill_phi, slope=inp.backfill_slope),
                    surcharge=inp.surcharge, analyses=list(r.analyses.values()),
                    global_stability=list(r.global_stability.items()), slips=dict(r.slip_results),
                    factors_used=r.factors_used, assumptions=[(a.text, a.source) for a in r.assumptions],
                    warnings=r.warnings, code="asd", kh=r.kh, kv=r.kv)
            return basic_job

        a = self.advanced_inputs()
        geom = self.geometry() if mode == "check" else None
        wall_type, H = self.wall_type.value(), self.height.value()

        def advanced_job():
            common = dict(include_seismic=a["seismic"], approach=a["approach"], foundation_bands=a["bands"],
                          water_level=a["water_level"])
            if mode == "suggest":
                s = adv.size_wall_advanced(wall_type, H, a["backfill"], a["foundation"], a["loads"], a["settings"],
                                           embedment=a["D"], **common)
                res, g, passed, gov, warn = s.result, s.geometry, s.passed, s.governing, s.warnings
            else:
                res = adv.check_wall_advanced(geom, a["backfill"], a["foundation"], a["loads"], a["settings"], **common)
                g, passed = geom, res.passed
                gov = ", ".join(adv._failing(res))
                warn = []
            return WallOutcome(
                mode=mode, level="advanced", passed=passed, governing=gov, geometry=g, backfill=a["backfill"],
                surcharge=a["loads"].surcharge, analyses=res.analyses, global_stability=res.global_stability,
                factors_used=res.factors_used, warnings=warn + res.warnings, code=res.code, kh=a["kh"], kv=a["kv"],
                water_level=a["water_level"])
        return advanced_job

    def _finish_task(self) -> None:
        self.form.set_busy(False)
        self.refresh_missing()

    def _on_failed(self, message: str) -> None:
        self._finish_task()
        self.form.set_reason(message, error=True)

    def _on_done(self, outcome: WallOutcome) -> None:
        self._finish_task()
        self.outcome = outcome
        if outcome.mode == "suggest":
            self._set_geometry(outcome.geometry, "suggested")
        self.store_form()
        self.show_outcome(outcome)

    def wait(self) -> None:
        """Block until the running calculation is done and its result is shown (tests)."""
        from PySide6.QtWidgets import QApplication

        if self.task is not None:
            self.task.wait()
            QApplication.processEvents()
            QApplication.processEvents()

    # --- result display -----------------------------------------------------------------

    def show_outcome(self, o: WallOutcome) -> None:
        g = o.geometry
        tiles = [(t("ui.wall.tile.B"), f"{g.width:.2f} m")]
        if isinstance(g, CantileverGeometry):
            tiles += [(t("ui.geo.toe"), f"{g.toe:.2f} m"), (t("ui.geo.heel"), f"{g.heel:.2f} m"),
                      (t("ui.geo.base_thickness"), f"{g.base_thickness:.2f} m"),
                      (t("ui.wall.tile.stem"), f"{g.stem_bottom:.2f} / {g.stem_top:.2f} m")]
        else:
            tiles += [(t("ui.geo.top_width"), f"{g.top_width:.2f} m")]
        tiles.append((t("ui.wall.embedment"), f"{g.embedment:.2f} m"))
        if o.kh is not None:
            tiles.append(("k_h / k_v", f"{o.kh:.3f} / {o.kv:.3f}"))
        mode = t("ui.wall.mode.suggest") if o.mode == "suggest" else t("ui.wall.mode.check")
        if o.mode == "suggest" and o.passed:
            line1 = t("ui.wall.governing", label=governing_label(o.governing))
        elif o.passed:
            line1 = t("ui.wall.critical", label=governing_label(o.critical()))
        else:
            line1 = t("ui.wall.failing", label=governing_label(o.governing))
        code_name = t("ui.wall.basis_basic") if o.level == "basic" else self.code_selector.code.currentText()
        self.banner.set_result("good" if o.passed else "bad", t("ui.ok") if o.passed else t("ui.not_ok"), mode,
                               line1, code_name, tiles)

        # case selector for the plots
        cases = [a.case for a in o.analyses if a.case != "EQU" and not math.isnan(a.q_max)]
        self.case_holder.removeWidget(self.case_pick)
        self.case_pick.deleteLater()
        self.case_pick = Segmented([(c, case_label(c)) for c in cases] or [("static", case_label("static"))],
                                   cases[-1] if cases else None)
        self.case_pick.changed.connect(lambda _: self._draw_plots())
        self.case_holder.addWidget(self.case_pick)

        rows = []
        for case, c in o.rows():
            tone = "good" if c.passed else "bad"
            rows.append([table_item(case_label(case)), table_item(check_label(c.name), tooltip=c.detail),
                         table_item(f"{c.value:.2f}" if math.isfinite(c.value) else "∞", align_right=True, bold=True),
                         table_item("≥" if c.comparison == ">=" else "≤"),
                         table_item(f"{c.required:.2f}", align_right=True),
                         table_item(("✓  " + t("ui.ok")) if c.passed else ("✗  " + t("ui.not_ok")), tone=tone)])
        fill_table(self.checks_table, rows)

        frows = []
        for f in o.factors_used:
            frows.append([table_item(factor_symbol(o.code, f.path), bold=True), table_item(f.path),
                          table_item(f"{f.value:g}", align_right=True),
                          table_item(status_text(f.status), tone=STATUS_TONE.get(f.status)),
                          table_item(f.source, tooltip=f.source)])
        fill_table(self.factors_table, frows)

        arows = [[table_item(text), table_item(src, tooltip=src)] for text, src in o.assumptions]
        if not arows:
            arows = [[table_item(t("ui.wall.advanced_assumptions")), table_item("")]]
        fill_table(self.assumptions_table, arows)
        self.warnings_label.setText("\n".join(f"⚠ {w}" for w in o.warnings))
        self.warnings_label.setVisible(bool(o.warnings))
        self.results.setCurrentIndex(1)
        self._draw_plots()

    def _draw_plots(self) -> None:
        o = self.outcome
        if o is None:
            return
        case = self.case_pick.value()
        analysis = next((a for a in o.analyses if a.case == case), None)
        self.section_canvas.draw(plot_wall_section, o.geometry, o.backfill, surcharge=o.surcharge, analysis=analysis,
                                 water_level=o.water_level, title=f"{t('ui.wall.tab.section')} — {case_label(case)}")
        slip = o.slips.get(case) or next(iter(o.slips.values()), None)
        if slip is not None:
            self.slip_canvas.draw(plot_slip_circle, o.geometry, o.backfill, slip, surcharge=o.surcharge,
                                  water_level=o.water_level, title=t("ui.wall.slip_title"))
        elif o.level == "advanced" and o.global_stability:
            self.slip_canvas.show_message(t("ui.wall.slip_basic_only"))
        else:
            self.slip_canvas.show_message(t("ui.wall.slip_none"))

    # --- persistence --------------------------------------------------------------------

    def form_values(self) -> dict:
        return {
            "wall_type": self.wall_type.value(), "height": self.height.value(), "embedment": self.embedment.value(),
            "bf_gamma": self.bf_gamma.value(), "bf_phi": self.bf_phi.value(), "bf_slope": self.bf_slope.value(),
            "from_profile": self.from_profile.isChecked(), "base_depth": self.base_depth.value(),
            "drainage": self.drainage.value(), "f_phi": self.f_phi.value(), "f_c": self.f_c.value(),
            "f_su": self.f_su.value(), "f_gamma": self.f_gamma.value(), "f_delta": self.f_delta.value(),
            "f_adhesion": self.f_adhesion.value(), "surcharge": self.surcharge.value(),
            "seismic": self.seismic.isChecked(), "sds": self.sds.value(), "r": self.r.value(),
            "inc_height": self.inc_height.value(), "global": self.global_check.isChecked(),
            "bearing": self.bearing.currentData(), "passive": self.passive.value(),
            "toe_soil": self.toe_soil.isChecked(), "concrete": self.concrete.value(), "water": self.water.value(),
            "approach": self.code_selector.approach_id(), "geometry_source": self.geometry_source,
            "geometry": {k: f.value() for k, f in self.geo.items()},
        }

    def store_form(self) -> None:
        self.state.store_form("wall", self.form_values())

    def restore_form(self, v: dict) -> None:
        if not v:
            self._type_changed()
            self._seismic_changed(self.seismic.isChecked())
            return
        dirty = self.state.dirty
        self.wall_type.set_value(v.get("wall_type", "cantilever"))
        self.height.setValue(v.get("height", 5.0))
        self.embedment.set_value(v.get("embedment"))
        for key, w in (("bf_gamma", self.bf_gamma), ("bf_phi", self.bf_phi), ("bf_slope", self.bf_slope),
                       ("base_depth", self.base_depth), ("f_phi", self.f_phi), ("f_c", self.f_c),
                       ("f_su", self.f_su), ("f_gamma", self.f_gamma), ("f_adhesion", self.f_adhesion),
                       ("surcharge", self.surcharge), ("sds", self.sds), ("inc_height", self.inc_height),
                       ("concrete", self.concrete)):
            if key in v:
                w.setValue(v[key])
        self.from_profile.setChecked(bool(v.get("from_profile")))
        self.drainage.set_value(v.get("drainage", "drained"))
        self.f_delta.set_value(v.get("f_delta"))
        self.seismic.setChecked(v.get("seismic", True))
        self.r.set_value(v.get("r"))
        self.global_check.setChecked(v.get("global", True))
        idx = self.bearing.findData(v.get("bearing", "vesic"))
        self.bearing.setCurrentIndex(max(idx, 0))
        self.passive.set_value(v.get("passive"))
        self.toe_soil.setChecked(bool(v.get("toe_soil")))
        self.water.set_value(v.get("water"))
        if v.get("approach"):
            i = self.code_selector.approach.findData(v["approach"])
            if i >= 0:
                self.code_selector.approach.setCurrentIndex(i)
        self._type_changed()
        source = v.get("geometry_source", "draft")
        if source != "draft" and v.get("geometry"):
            self._setting_geometry = True
            for k, val in v["geometry"].items():
                if k in self.geo:
                    self.geo[k].setValue(val)
            self._setting_geometry = False
            self._set_source(source)
        self._seismic_changed(self.seismic.isChecked())
        self._update_geometry_summary()
        self.state.mark_dirty(dirty)
