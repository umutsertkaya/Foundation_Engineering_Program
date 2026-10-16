"""Liquefaction page: settings, run, per-test summary and plot."""

from __future__ import annotations

from PySide6.QtWidgets import QComboBox, QHBoxLayout, QPlainTextEdit, QVBoxLayout, QWidget

from geotek.engine.liquefaction import lpi_category
from geotek.i18n import t
from geotek.plotting.figures import plot_liquefaction
from geotek.services.module1 import LiquefactionSettings, process_investigations, run_liquefaction
from geotek.ui.pages.base import FormColumn, Page, split_layout
from geotek.ui.widgets import Banner, Card, FormGrid, NumberField, OptionalNumber, PlotCanvas, button, label


class LiquefactionPage(Page):
    def __init__(self, state):
        super().__init__(t("ui.nav.liquefaction"), t("ui.liq.subtitle"))
        self.state = state
        self.settings_used: LiquefactionSettings | None = None

        form = FormColumn(380)
        card = form.add(Card(t("ui.liq.settings")))
        grid = FormGrid()
        self.method = QComboBox()
        self.method.addItem("Boulanger & Idriss (2014)", "bi2014")
        self.method.addItem("Youd et al. (2001) — NCEER", "youd2001")
        self.amax = NumberField(0.01, 2.0, 0.30, step=0.05, unit="g")
        self.mw = NumberField(4.0, 9.5, 7.5, decimals=1, step=0.1)
        self.target_fs = NumberField(1.0, 2.0, 1.10, step=0.05)
        self.gwt = OptionalNumber(NumberField(0, 100, 2.0, unit="m"), t("ui.liq.from_profile"))
        self.default_fc = OptionalNumber(NumberField(0, 100, 10, decimals=0, step=1, unit="%"),
                                         t("ui.liq.use_default"), checked_is_auto=False, checked=False)
        self.c_fc = NumberField(-0.29, 0.29, 0.0, step=0.01)
        grid.add(t("ui.liq.method"), self.method)
        grid.add("a_max", self.amax)
        grid.add("M_w", self.mw)
        grid.add(t("ui.liq.target_fs"), self.target_fs)
        grid.add(t("ui.liq.gwt_seismic"), self.gwt)
        grid.add(t("ui.liq.default_fc"), self.default_fc)
        grid.add("C_FC", self.c_fc, t("ui.liq.cfc_tip"))
        card.body.addLayout(grid)
        form.finish()
        self.run_button = button(t("ui.liq.run"), "primary", self.run)
        form.buttons.addWidget(self.run_button, 1)
        self.form = form

        results = QWidget()
        rl = QVBoxLayout(results)
        rl.setContentsMargins(0, 0, 0, 0)
        rl.setSpacing(12)
        self.banner = Banner()
        self.banner.setVisible(False)
        rl.addWidget(self.banner)
        pick = QHBoxLayout()
        pick.addWidget(label(t("ui.liq.show"), "Muted"))
        self.source = QComboBox()
        self.source.currentIndexChanged.connect(self._show)
        pick.addWidget(self.source, 1)
        rl.addLayout(pick)
        plot_card = Card()
        self.canvas = PlotCanvas()
        self.canvas.show_message(t("ui.liq.not_run"))
        plot_card.body.addWidget(self.canvas, 1)
        rl.addWidget(plot_card, 3)
        self.summary = QPlainTextEdit()
        self.summary.setReadOnly(True)
        self.summary.setMaximumHeight(150)
        rl.addWidget(self.summary)
        self.body.addLayout(split_layout(form, results), 1)

    def settings(self) -> LiquefactionSettings:
        return LiquefactionSettings(method=self.method.currentData(), amax_g=self.amax.value(), mw=self.mw.value(),
                                    target_fs=self.target_fs.value(), gwt_seismic=self.gwt.value(),
                                    default_fc=self.default_fc.value(), c_fc=self.c_fc.value())

    def run(self) -> None:
        s = self.state
        self.settings_used = self.settings()
        s.results = run_liquefaction(s.project, self.settings_used, process_investigations(s.project))
        res = s.results
        self.source.blockSignals(True)
        self.source.clear()
        for ident in res.liquefaction:
            self.source.addItem(ident, ident)
        self.source.blockSignals(False)
        failed = ", ".join(res.errors)
        n = len(res.liquefaction)
        self.banner.set_result("good" if n and not failed else "bad" if not n else "neutral",
                               t("ui.msg.liq_done", count=n), "",
                               t("ui.msg.liq_failed", ids=failed) if failed else "", "", [])
        self.banner.setVisible(True)
        self._show()

    def _show(self) -> None:
        ident = self.source.currentData()
        result = self.state.results.liquefaction.get(ident) if ident else None
        if result is None:
            self.canvas.show_message(t("ui.liq.not_run"))
            self.summary.clear()
            return
        self.canvas.draw(plot_liquefaction, result)
        s = result.summary()
        lines = [
            f"{t('ui.liq.method')}: {result.method}   {result.test_type} {result.source_id}",
            f"a_max = {result.amax_g:g} g, M_w = {result.mw:g}, {t('term.gwt')} = {result.gwt_depth:g} m",
            f"LPI = {s['LPI']:.1f} ({t('lpi.' + lpi_category(s['LPI']))})",
            f"{t('ui.liq.min_fs')}: {s['min_fs']:.2f}" if s["min_fs"] is not None else t("ui.liq.no_fs"),
        ]
        if s["liquefiable_depths"]:
            a, b = s["liquefiable_depths"]
            lines.append(t("ui.liq.liq_range", top=f"{a:g}", bottom=f"{b:g}"))
        lines += [f"{t('status.' + k)}: {v}" for k, v in s["status_counts"].items()]
        if result.warnings:
            lines += ["", t("ui.warnings") + ":"] + [f"• {w}" for w in result.warnings]
        self.summary.setPlainText("\n".join(lines))
