"""Depth plots, SBTn chart, borehole log and liquefaction figures.

Every function draws into a given matplotlib ``Figure`` (cleared first), so the same code
serves the Qt canvas and saved report images. Depth plots share an inverted depth axis with
the value axis on top, as is customary for geotechnical logs.
"""

from __future__ import annotations

import numpy as np
from matplotlib.figure import Figure
from matplotlib.patches import Patch, Polygon, Rectangle

from geotek.core.models.investigations import Borehole
from geotek.core.models.profile import SoilProfile
from geotek.engine.classification.robertson import IC_BOUNDS, sbtn_zone, soil_behaviour_index
from geotek.engine.insitu.cpt import CPTProcessed
from geotek.engine.insitu.spt import SPTProcessed
from geotek.engine.liquefaction import LiquefactionResult
from geotek.engine.liquefaction import common as liq
from geotek.i18n import t
from geotek.plotting import style

# Zones 7 (coarse) .. 2 (organic) on the ordinal blue ramp; 1, 8, 9 neutral
ZONE_COLORS = {7: style.BLUE_RAMP[0], 6: style.BLUE_RAMP[1], 5: style.BLUE_RAMP[2],
               4: style.BLUE_RAMP[4], 3: style.BLUE_RAMP[6], 2: style.BLUE_RAMP[7],
               1: "#c3c2b7", 8: "#898781", 9: "#52514e", 0: "#ffffff"}

STATUS_STYLE = {
    liq.LIQUEFIABLE: style.STATUS["critical"],
    liq.MARGINAL: style.STATUS["warning"],
    liq.SAFE: style.STATUS["good"],
}


def _depth_axes(fig: Figure, n: int, widths=None):
    style.apply()
    fig.clear()
    fig.set_layout_engine("constrained")
    axes = fig.subplots(1, n, sharey=True, gridspec_kw={"width_ratios": widths or [1] * n})
    axes = np.atleast_1d(axes)
    for ax in axes:
        ax.xaxis.set_label_position("top")
        ax.xaxis.tick_top()
        ax.spines["top"].set_visible(True)
    axes[0].invert_yaxis()
    axes[0].set_ylabel(t("plot.depth_m"))
    return axes


def _finish(fig: Figure, title: str):
    fig.suptitle(title, x=0.01, ha="left", fontsize=11, fontweight="bold")


# --- CPT ---------------------------------------------------------------------------------


def plot_cpt(fig: Figure, p: CPTProcessed) -> Figure:
    axes = _depth_axes(fig, 5, [1, 1, 1, 1, 0.35])
    z = p.depth
    axes[0].plot(p.qt / 1000.0, z, color=style.SERIES[0])
    axes[0].set_xlabel(t("plot.qt_mpa"))
    axes[1].plot(p.fs, z, color=style.SERIES[0])
    axes[1].set_xlabel(t("plot.fs_kpa"))
    if p.u2 is not None:
        axes[2].plot(p.u2, z, color=style.SERIES[0], label="u₂")
    axes[2].plot(p.u0, z, color=style.SERIES[1], linestyle="--", label="u₀")
    axes[2].set_xlabel(t("plot.pore_kpa"))
    axes[2].legend(loc="lower left")

    ax = axes[3]
    for b in IC_BOUNDS:
        ax.axvline(b, color=style.AXIS, linewidth=0.8)
    ax.axvline(2.6, color=style.INK_2, linewidth=1.0, linestyle=":")
    ax.plot(p.Ic, z, color=style.SERIES[0])
    ax.set_xlim(1.0, 4.0)
    ax.set_xlabel("I_c")

    _zone_strip(axes[4], z, p.zone)
    _finish(fig, f"CPT {p.sounding_id}")
    return fig


def _zone_strip(ax, z, zone):
    top, bot = liq.tributary_thickness(z)
    for a, b, zn in zip(top, bot, zone):
        ax.add_patch(Rectangle((0, a), 1, b - a, color=ZONE_COLORS.get(int(zn), "#ffffff"), linewidth=0))
    # Zone number on each run thicker than 0.5 m, so identity does not rest on color alone
    zone = np.asarray(zone)
    breaks = np.flatnonzero(np.diff(zone)) + 1
    for start, stop in zip(np.r_[0, breaks], np.r_[breaks, zone.size]):
        if bot[stop - 1] - top[start] >= 0.5 and zone[start] > 0:
            dark = int(zone[start]) in (2, 3, 4, 9)
            ax.text(0.5, (top[start] + bot[stop - 1]) / 2, str(int(zone[start])), ha="center",
                    va="center", fontsize=8, fontweight="bold", color=style.SURFACE if dark else style.INK)
    ax.set_xlim(0, 1)
    ax.set_xticks([])
    ax.set_xlabel("SBTn")
    ax.grid(False)
    present = sorted({int(v) for v in zone if v > 0})
    ax.legend(
        handles=[Patch(color=ZONE_COLORS[zn], label=str(zn)) for zn in present],
        title=t("plot.zone"), loc="upper left", bbox_to_anchor=(1.02, 1.0), fontsize=7,
    )


def plot_sbtn_chart(fig: Figure, p: CPTProcessed) -> Figure:
    """Robertson (2009) Q_tn - F_r chart with I_c boundaries; points shaded by depth."""
    style.apply()
    fig.clear()
    fig.set_layout_engine("constrained")
    ax = fig.add_subplot(1, 1, 1)
    fr = np.logspace(-1, 1, 300)
    qtn = np.logspace(0, 3, 300)
    FR, QT = np.meshgrid(fr, qtn)
    IC = soil_behaviour_index(QT, FR)
    cs = ax.contour(FR, QT, IC, levels=list(IC_BOUNDS), colors=style.INK_2, linewidths=0.8)
    ax.clabel(cs, fmt="%.2f", fontsize=7)
    zones = sbtn_zone(QT, FR, IC)
    for zn in range(1, 8):
        mask = zones == zn
        if mask.sum() > 50:
            ax.text(np.exp(np.median(np.log(FR[mask]))), np.exp(np.median(np.log(QT[mask]))),
                    str(zn), fontsize=12, color=style.MUTED, ha="center", va="center", fontweight="bold")
    ok = np.isfinite(p.Qtn) & np.isfinite(p.Fr) & (p.Fr > 0) & (p.Qtn > 0)
    sc = ax.scatter(p.Fr[ok], p.Qtn[ok], c=p.depth[ok], cmap=_blue_cmap(), s=16,
                    edgecolors=style.SURFACE, linewidths=0.5, zorder=3)
    cb = fig.colorbar(sc, ax=ax)
    cb.set_label(t("plot.depth_m"))
    cb.ax.invert_yaxis()
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_xlim(0.1, 10)
    ax.set_ylim(1, 1000)
    ax.set_xlabel(t("plot.fr_pct"))
    ax.set_ylabel("Q_tn")
    ax.spines["bottom"].set_visible(True)
    ax.set_title(f"SBTn — CPT {p.sounding_id}", loc="left")
    return fig


def _blue_cmap():
    from matplotlib.colors import LinearSegmentedColormap

    return LinearSegmentedColormap.from_list("blue_seq", style.BLUE_RAMP)


# --- SPT and borehole log ----------------------------------------------------------------


def plot_spt(fig: Figure, p: SPTProcessed) -> Figure:
    axes = _depth_axes(fig, 1)
    ax = axes[0]
    for i, (values, label) in enumerate([(p.n_field, "N"), (p.n60, "N₆₀"), (p.n1_60, "(N₁)₆₀")]):
        ax.plot(values, p.depth, marker="o", color=style.SERIES[i], label=label)
    if p.refusal.any():
        ax.plot(p.n_field[p.refusal], p.depth[p.refusal], linestyle="none", marker="o",
                markerfacecolor="none", markeredgecolor=style.INK, markersize=10,
                label=t("plot.refusal"))
    ax.set_xlabel(t("plot.blows"))
    ax.set_xlim(left=0)
    ax.legend(loc="lower right")
    _finish(fig, f"SPT {p.borehole_id}")
    return fig


_SOIL_GROUPS = [  # (prefix test, i18n key, slot color)
    (("G",), "soil.gravel", style.SERIES[1]),
    (("S",), "soil.sand", style.SERIES[3]),
    (("M",), "soil.silt", style.SERIES[2]),
    (("C",), "soil.clay", style.SERIES[0]),
    (("O", "P"), "soil.organic", style.SERIES[5]),
]


def _soil_group(layer):
    code = (layer.uscs or "").upper()
    for prefixes, key, color in _SOIL_GROUPS:
        if code.startswith(prefixes):
            return key, color
    return "soil.unknown", style.NEUTRAL


def plot_borehole_log(fig: Figure, profile: SoilProfile, spt: SPTProcessed | None = None,
                      borehole: Borehole | None = None) -> Figure:
    axes = _depth_axes(fig, 2 if spt is not None else 1, [1.4, 1] if spt is not None else None)
    ax = axes[0]
    used = {}
    for layer in profile.layers:
        key, color = _soil_group(layer)
        used[key] = color
        ax.add_patch(Rectangle((0, layer.top), 1, layer.thickness, facecolor=color, alpha=0.35,
                               edgecolor=style.SURFACE, linewidth=2))
        label = " ".join(x for x in (layer.uscs, layer.description) if x) or layer.id
        ax.text(0.05, (layer.top + layer.bottom) / 2, label, va="center", fontsize=8, color=style.INK)
    gwt = profile.gwt.depth_insitu
    ax.plot([0.92], [gwt], marker="v", color=style.SERIES[0], markersize=9, linestyle="none")
    ax.axhline(gwt, color=style.SERIES[0], linewidth=1, linestyle="--")
    ax.text(0.9, gwt, t("plot.gwt_short"), ha="right", va="bottom", fontsize=8, color=style.INK_2)
    ax.set_xlim(0, 1)
    ax.set_ylim(profile.bottom, 0)
    ax.set_xticks([])
    ax.grid(False)
    ax.set_xlabel(t("plot.log"))
    ax.legend(handles=[Patch(facecolor=c, alpha=0.35, label=t(k)) for k, c in used.items()],
              loc="lower left", fontsize=7)
    if spt is not None:
        ax2 = axes[1]
        ax2.barh(spt.depth, spt.n_field, height=0.35, color=style.SERIES[0])
        for d, n, r in zip(spt.depth, spt.n_field, spt.refusal):
            ax2.text(n + 0.5, d, f"{int(n)}{'R' if r else ''}", va="center", fontsize=7, color=style.INK_2)
        ax2.set_xlabel("SPT N")
        ax2.set_xlim(0, max(10.0, float(np.max(spt.n_field)) * 1.3))
    title = profile.name or profile.id
    _finish(fig, f"{t('plot.log')} — {title}")
    return fig


# --- Liquefaction ------------------------------------------------------------------------


def plot_liquefaction(fig: Figure, r: LiquefactionResult) -> Figure:
    axes = _depth_axes(fig, 4, [1, 1, 1, 0.35])
    z = r.depth
    marker = "o" if r.test_type == "SPT" else None
    axes[0].plot(r.resistance, z, color=style.SERIES[0], marker=marker)
    axes[0].set_xlabel("(N₁)₆₀cs" if r.test_type == "SPT" else "q_c1Ncs")

    axes[1].plot(r.csr, z, color=style.SERIES[0], marker=marker, label="CSR")
    axes[1].plot(r.crr, z, color=style.SERIES[1], marker=marker, label="CRR")
    axes[1].set_xlim(0, min(1.0, np.nanmax(np.r_[r.csr, 0.5]) * 1.6))
    axes[1].legend(loc="lower right")
    axes[1].set_xlabel(t("plot.cyclic_ratio"))

    ax = axes[2]
    fs_plot = np.clip(r.fs, 0, 2.0)
    ax.plot(fs_plot, z, color=style.INK_2, linewidth=0.8, marker=None)
    for status, color in STATUS_STYLE.items():
        m = r.status == status
        ax.plot(fs_plot[m], z[m], linestyle="none", marker="o", markersize=5 if marker is None else 7,
                color=color, markeredgecolor=style.SURFACE, markeredgewidth=0.6)
    ax.axvline(1.0, color=style.STATUS["critical"], linewidth=1)
    ax.axvline(r.target_fs, color=style.INK_2, linewidth=1, linestyle="--")
    ax.text(r.target_fs, z.min(), f" {t('plot.target')} {r.target_fs:g}", fontsize=7,
            color=style.INK_2, va="top")
    ax.set_xlim(0, 2.0)
    ax.set_xlabel(t("plot.fs_liq"))

    _status_strip(axes[3], z, r.status)
    lpi = r.lpi
    _finish(fig, f"{t('plot.liquefaction')} — {r.test_type} {r.source_id} "
                 f"({r.method}, a_max={r.amax_g:g} g, M={r.mw:g}) — LPI = {lpi:.1f}")
    return fig


STATUS_STRIP = [
    (liq.LIQUEFIABLE, style.STATUS["critical"]),
    (liq.MARGINAL, style.STATUS["warning"]),
    (liq.SAFE, style.STATUS["good"]),
    (liq.CLAY_LIKE, "#898781"),
    (liq.DENSE, "#52514e"),
    (liq.ABOVE_GWT, "#e1e0d9"),
    (liq.EXCLUDED, "#c3c2b7"),
    (liq.BEYOND_DEPTH, "#f0efec"),
    (liq.INVALID, "#ffffff"),
]


def _status_strip(ax, z, status):
    colors = dict(STATUS_STRIP)
    top, bot = liq.tributary_thickness(z)
    for a, b, s in zip(top, bot, status):
        ax.add_patch(Rectangle((0, a), 1, b - a, color=colors.get(s, "#ffffff"), linewidth=0))
    ax.set_xlim(0, 1)
    ax.set_xticks([])
    ax.grid(False)
    ax.set_xlabel(t("plot.status"))
    present = [s for s, _ in STATUS_STRIP if np.any(status == s)]
    ax.legend(handles=[Patch(facecolor=colors[s], edgecolor=style.AXIS, label=t(f"status.{s}"))
                       for s in present],
              loc="upper left", bbox_to_anchor=(1.02, 1.0), fontsize=7)


# --- retaining walls ----------------------------------------------------------------------


def _wall_outline(geometry):
    """(concrete polygons, back-face points from top to bottom of the retained soil boundary, width, H)."""
    from geotek.core.models.walls import CantileverGeometry
    from geotek.engine.walls.walls import cantilever_polygons, gravity_wall_polygon

    if isinstance(geometry, CantileverGeometry):
        base, stem, _, _ = cantilever_polygons(geometry, 0.0)
        t_b = geometry.base_thickness
        xb = geometry.x_stem_back
        back = [(xb, geometry.height), (xb, t_b), (geometry.width, t_b)]
        return [base, stem], back, geometry.width, geometry.height
    poly = gravity_wall_polygon(geometry)
    back = [(poly[2][0], geometry.height), (geometry.base_width, 0.0)]
    return [poly], back, geometry.base_width, geometry.height


def _draw_section(ax, geometry, backfill, *, surcharge: float = 0.0, water_level: float | None = None):
    """Wall, retained soil, front ground, surcharge and water level; returns (xmin, xmax, H)."""
    import math

    wall_polys, back, width, H = _wall_outline(geometry)
    tan_b = math.tan(math.radians(backfill.slope))
    D = geometry.embedment
    x_far = width + 0.9 * H
    x_near = -0.45 * H
    depth = -0.18 * H
    x_top, y_top = back[0]
    y_far = y_top + (x_far - x_top) * tan_b

    soil = style.BLUE_RAMP[0]
    retained = [back[0], (x_far, y_far), (x_far, depth), (width, depth), *back[1:][::-1]]
    ax.add_patch(Polygon(retained, closed=True, facecolor=soil, alpha=0.35, edgecolor="none", zorder=1))
    ax.add_patch(Polygon([(x_near, D), (0.0, D), (0.0, 0.0), (width, 0.0), (width, depth), (x_near, depth)],
                         closed=True, facecolor=soil, alpha=0.35, edgecolor="none", zorder=1))
    for poly in wall_polys:
        ax.add_patch(Polygon(poly, closed=True, facecolor=style.MUTED, edgecolor=style.INK_2, linewidth=1.0,
                             zorder=3))
    ax.plot([x_near, 0.0], [D, D], color=style.INK_2, linewidth=1.4, zorder=4)
    ax.plot([x_top, x_far], [y_top, y_far], color=style.INK_2, linewidth=1.4, zorder=4)

    if surcharge > 0:
        xs = np.linspace(x_top + 0.2, x_far - 0.2, 7)
        for x in xs:
            y = y_top + (x - x_top) * tan_b
            ax.annotate("", xy=(x, y), xytext=(x, y + 0.14 * H), zorder=5,
                        arrowprops=dict(arrowstyle="-|>", color=style.SERIES[3], lw=1.0))
        ax.text(xs[-1], y_far + 0.17 * H, f"q = {surcharge:g} kPa", color=style.INK_2, ha="right", va="bottom",
                fontsize=8)
    if water_level is not None:
        ax.plot([x_near, x_far], [water_level, water_level], color=style.SERIES[0], linestyle="--", linewidth=1.3,
                zorder=5)
        ax.text(x_near + 0.02 * H, water_level + 0.015 * H, f"{t('plot.gwt')} ({water_level:+.2f} m)",
                color=style.SERIES[0], fontsize=8, va="bottom")
    return x_near, x_far, H


def _spread_labels(items, gap):
    """Shift label y positions so that neighbours are at least ``gap`` apart."""
    out, last = [], -1e9
    for y, payload in sorted(items, key=lambda it: it[0]):
        y2 = max(y, last + gap)
        out.append((y2, payload))
        last = y2
    return out


FORCE_KEYS = {"Earth pressure": "force.earth_pressure", "Seismic increment": "force.seismic_increment",
              "Surcharge pressure": "force.surcharge_pressure", "Passive (front)": "force.passive"}


def _force_label(name: str) -> str:
    """Translated label of an engine force name (the engine name if no translation exists)."""
    key = FORCE_KEYS.get(name)
    return t(key) if key else name


def plot_wall_section(fig: Figure, geometry, backfill, *, surcharge: float = 0.0, analysis=None,
                      water_level: float | None = None, title: str | None = None) -> Figure:
    """Wall cross-section with backfill, front ground, surcharge, water level, force arrows,
    the base resultant and its eccentricity. ``analysis`` is a ``WallAnalysis`` (optional);
    ``water_level`` is the elevation above the base bottom [m]."""
    import math

    style.apply()
    fig.clear()
    fig.set_layout_engine("constrained")
    ax = fig.add_subplot(111)
    ax.grid(False)
    x0, x1, H = _draw_section(ax, geometry, backfill, surcharge=surcharge, water_level=water_level)
    width = geometry.width if hasattr(geometry, "width") else geometry.base_width

    if analysis is not None:
        forces = [f for f in analysis.forces
                  if f.kind in ("EH", "LS", "EQ", "PASSIVE", "WATER") and "inertia" not in f.name
                  and "vertical" not in f.name and math.hypot(f.fx, f.fy) > 1e-9]
        fmax = max((math.hypot(f.fx, f.fy) for f in forces), default=1.0) or 1.0
        placed = []
        for f in forces:
            mag = math.hypot(f.fx, f.fy)
            length = 0.12 * H + 0.28 * H * mag / fmax
            ux, uy = f.fx / mag, f.fy / mag
            tail = (f.x - ux * length, f.y - uy * length)
            ax.annotate("", xy=(f.x, f.y), xytext=tail, zorder=6,
                        arrowprops=dict(arrowstyle="-|>", color=style.SERIES[1], lw=1.6))
            placed.append((tail[1], (tail[0], f"{_force_label(f.name)}  {mag:.1f} kN/m")))
        for y, (x, label) in _spread_labels(placed, 0.1 * H):
            ax.text(x + 0.04 * H, y, label, color=style.INK, fontsize=8, va="center", ha="left", zorder=7,
                    bbox=dict(boxstyle="round,pad=0.15", fc=style.SURFACE, ec="none", alpha=0.85))
        x_r = width / 2 - analysis.eccentricity
        ax.plot([x_r], [0.0], marker="^", color=style.SERIES[2], markersize=9, zorder=8)
        ax.plot([width / 2], [0.0], marker="|", color=style.INK_2, markersize=10, zorder=8)
        ax.annotate("", xy=(x_r, -0.06 * H), xytext=(width / 2, -0.06 * H),
                    arrowprops=dict(arrowstyle="<->", color=style.SERIES[2], lw=1.2), zorder=8)
        ax.text(width / 2, -0.1 * H,
                f"R:  e = {analysis.eccentricity:+.2f} m,  q_max = {analysis.q_max:.0f} / q_min = "
                f"{analysis.q_min:.0f} kPa",
                color=style.SERIES[2], fontsize=8, ha="center", va="top")

    ax.set_aspect("equal")
    ax.set_xlim(x0, x1)
    ax.set_ylim(-0.3 * H, 1.35 * H + max(0.0, math.tan(math.radians(backfill.slope)) * (x1 - width)))
    ax.set_xlabel("x (m)")
    ax.set_ylabel("y (m)")
    ax.spines["bottom"].set_visible(True)
    if title:
        ax.set_title(title, loc="left")
    return fig


def plot_slip_circle(fig: Figure, geometry, backfill, slip, *, surcharge: float = 0.0,
                     water_level: float | None = None, title: str | None = None) -> Figure:
    """Critical Bishop circle (arc and slices) drawn on the wall section."""
    import math

    style.apply()
    fig.clear()
    fig.set_layout_engine("constrained")
    ax = fig.add_subplot(111)
    ax.grid(False)
    x0, x1, H = _draw_section(ax, geometry, backfill, surcharge=surcharge, water_level=water_level)
    s = slip.slices
    ax.vlines(s["x"], s["y_base"], s["y_base"] + s["height"], color=style.SERIES[0], linewidth=0.5, alpha=0.6,
              zorder=4)
    xs = np.linspace(slip.x_exit, slip.x_entry, 120)
    ys = slip.yc - np.sqrt(np.maximum(slip.radius**2 - (xs - slip.xc) ** 2, 0.0))
    ax.plot(xs, ys, color=style.SERIES[1], linewidth=2.0, zorder=6)
    ax.plot([slip.xc], [slip.yc], marker="+", color=style.SERIES[1], markersize=9, zorder=6)
    for xe, ye in ((xs[0], ys[0]), (xs[-1], ys[-1])):
        ax.plot([slip.xc, xe], [slip.yc, ye], color=style.SERIES[1], linewidth=0.8, linestyle=":", zorder=5)
    ax.text(slip.xc, slip.yc + 0.05 * H, f"FS = {slip.fs:.2f}", color=style.SERIES[1], ha="center", va="bottom",
            fontsize=9, fontweight="bold")
    ax.set_aspect("equal")
    ax.set_xlim(min(x0, slip.x_exit - 0.2 * H), max(x1, slip.x_entry + 0.2 * H))
    ax.set_ylim(float(ys.min()) - 0.15 * H, max(slip.yc + 0.3 * H, 1.3 * H))
    ax.set_xlabel("x (m)")
    ax.set_ylabel("y (m)")
    ax.spines["bottom"].set_visible(True)
    if title:
        ax.set_title(title, loc="left")
    return fig


def plot_sheet_pile(fig: Figure, result, *, title: str | None = None, gwt_depth: float | None = None) -> Figure:
    """Net pressure, shear and bending moment against depth for a sheet pile (``SheetPileResult``)."""
    axes = _depth_axes(fig, 3)
    z = result.z
    panels = [(result.net, t("plot.net_pressure"), style.SERIES[0]),
              (result.shear, t("plot.shear"), style.SERIES[1]),
              (result.moment, t("plot.moment"), style.SERIES[2])]
    show_gwt = gwt_depth is not None and gwt_depth < z[-1]
    for ax, (values, label, color) in zip(axes, panels):
        ax.plot(values, z, color=color)
        ax.fill_betweenx(z, 0.0, values, color=color, alpha=0.15)
        ax.axvline(0.0, color=style.AXIS, linewidth=0.8)
        ax.axhline(result.H, color=style.INK_2, linestyle=":", linewidth=1.0)
        if show_gwt:
            ax.axhline(gwt_depth, color=style.SERIES[0], linestyle="--", linewidth=1.0)
        ax.set_xlabel(label)
    axes[0].text(0.02, result.H, t("plot.dredge_line"), transform=axes[0].get_yaxis_transform(), fontsize=7,
                 color=style.INK_2, va="bottom")
    if show_gwt:
        axes[0].text(0.02, gwt_depth, t("plot.gwt"), transform=axes[0].get_yaxis_transform(), fontsize=7,
                     color=style.SERIES[0], va="bottom")
    m_at = float(np.interp(result.z_M_max, z, result.moment))  # signed value on the curve
    axes[2].plot([m_at], [result.z_M_max], marker="o", color=style.SERIES[2])
    axes[2].annotate(f"M_max = {result.M_max:.1f} kNm/m", (m_at, result.z_M_max),
                     xytext=(8, -4) if m_at <= 0 else (-8, -4),
                     textcoords="offset points", fontsize=8, color=style.INK,
                     ha="left" if m_at <= 0 else "right")
    _finish(fig, title or t("plot.sheet_pile"))
    return fig
