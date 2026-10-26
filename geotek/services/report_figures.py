"""Figures for the report: drawn from stored results only, returned as PNG bytes.

Nothing here recalculates; a figure whose data are missing returns ``None`` and the report
says so instead of drawing a guess.
"""

from __future__ import annotations

import io
import math

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import Polygon  # noqa: E402

NAVY, SOIL, CONCRETE = "#1F3A5F", "#E8DCC4", "#B8BCC2"
OK, BAD, WATER = "#3A9A5B", "#C8443B", "#2C7FB8"

plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.spines.top": False,
                     "axes.spines.right": False, "axes.titleweight": "bold"})


def _png(fig) -> bytes:
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", dpi=200, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return buffer.getvalue()


def _finite(values) -> bool:
    return all(isinstance(v, (int, float)) and math.isfinite(v) for v in values)


def _wall_outline(wall_type: str, g: dict) -> tuple[list[tuple[float, float]], float, float] | None:
    """Wall polygon (x from the toe, y up from the base bottom), base width and total height."""
    try:
        if wall_type == "cantilever":
            t, h = g["base_thickness"], g["stem_height"]
            toe, bottom, top, heel = g["toe"], g["stem_bottom"], g["stem_top"], g["heel"]
            back = toe + bottom
            width = back + heel
            points = [(0, 0), (width, 0), (width, t), (back, t), (back, t + h),
                      (back - top, t + h), (toe, t), (0, t)]
            return points, width, t + h
        width, h = g["base_width"], g["height"]
        back_top = width - g.get("back_offset", 0.0)
        return [(0, 0), (width, 0), (back_top, h), (back_top - g["top_width"], h)], width, h
    except (KeyError, TypeError):
        return None


def wall_section(wall_type: str, geometry: dict, *, slope_deg: float, surcharge: float,
                 gwt_depth: float | None, labels: dict[str, str]) -> bytes | None:
    """Scaled cross-section: wall, backfill with slope and surcharge, front soil, water level."""
    outline = _wall_outline(wall_type, geometry)
    if outline is None or not _finite(v for v in geometry.values() if isinstance(v, (int, float))):
        return None
    points, width, height = outline
    embed = geometry.get("embedment", 0.0) or 0.0
    top_x = max(p[0] for p in points if abs(p[1] - height) < 1e-9)
    reach = max(3.0, 1.2 * height)
    fig, ax = plt.subplots(figsize=(6.4, 4.2))
    # front soil (left) up to the embedment level, back soil (right) up to the wall top
    ax.add_patch(Polygon([(-1.5, -0.4), (-1.5, embed), (0, embed), (0, -0.4)], color=SOIL, lw=0))
    rise = reach * math.tan(math.radians(slope_deg))
    ax.add_patch(Polygon([(top_x, height), (width + reach, height + rise), (width + reach, -0.4), (top_x, -0.4)],
                         color=SOIL, lw=0))
    ax.add_patch(Polygon(points, facecolor=CONCRETE, edgecolor="#444", lw=1.2, zorder=3))
    ax.plot([-1.5, 0], [embed, embed], color="#7A6A45", lw=1.2)
    ax.plot([top_x, width + reach], [height, height + rise], color="#7A6A45", lw=1.2)
    if surcharge:
        xs = [top_x + 0.2 + i * 0.5 for i in range(int(reach / 0.5) - 1)]
        for x in xs:
            y0 = height + (x - top_x) * math.tan(math.radians(slope_deg))
            ax.annotate("", xy=(x, y0), xytext=(x, y0 + 0.55), arrowprops={"arrowstyle": "-|>", "color": NAVY, "lw": 0.9})
        ax.text(top_x + reach / 2, height + rise + 0.75, f"q = {surcharge:g} kPa", color=NAVY, ha="center")
    if gwt_depth is not None and math.isfinite(gwt_depth):
        y = height - gwt_depth
        if -0.4 < y < height + rise:
            ax.plot([width, width + reach], [y, y], color=WATER, lw=1.2, ls="--")
            ax.text(width + reach, y + 0.08, labels["gwt"], color=WATER, ha="right", va="bottom", fontsize=8)
    ax.annotate("", xy=(-0.9, 0), xytext=(-0.9, height), arrowprops={"arrowstyle": "<->", "color": "#333"})
    ax.text(-1.0, height / 2, f"H = {height:.2f} m", rotation=90, ha="right", va="center")
    ax.annotate("", xy=(0, -0.25), xytext=(width, -0.25), arrowprops={"arrowstyle": "<->", "color": "#333"})
    ax.text(width / 2, -0.38, f"B = {width:.2f} m", ha="center", va="top")
    if slope_deg:
        ax.text(top_x + reach * 0.75, height + rise * 0.35, f"β = {slope_deg:g}°", color="#5A4A25")
    ax.text(-0.75, embed + 0.1, labels["front"], fontsize=8, color="#5A4A25")
    ax.text(width + 0.3, height * 0.4, labels["backfill"], fontsize=8, color="#5A4A25")
    ax.set_aspect("equal")
    ax.set_xlim(-1.8, width + reach + 0.2)
    ax.set_ylim(-0.9, height + rise + 1.3)
    ax.axis("off")
    return _png(fig)


def pressure_plot(pressures: list[dict], case: str, labels: dict[str, str]) -> bytes | None:
    """Horizontal pressure on the retained side against depth (total, with the water part dashed)."""
    chosen = [p for p in pressures if p.get("case") == case and p.get("side") == "retained"]
    if not chosen or not chosen[0].get("z") or not _finite(chosen[0]["z"] + chosen[0]["sigma_h"]):
        return None
    p = chosen[0]
    fig, ax = plt.subplots(figsize=(4.0, 3.2))
    ax.fill_betweenx(p["z"], 0, p["sigma_h"], color="#F2C6A0", alpha=0.7, lw=0)
    ax.plot(p["sigma_h"], p["z"], color="#B5651D", lw=1.6, label=labels["total"])
    if any(u > 1e-9 for u in p["u"]):
        ax.plot(p["u"], p["z"], color=WATER, lw=1.2, ls="--", label=labels["water"])
    ax.invert_yaxis()
    ax.set_xlabel(labels["x"])
    ax.set_ylabel(labels["y"])
    ax.set_title(labels["title"])
    ax.grid(alpha=0.3)
    ax.legend(frameon=False, loc="upper right")
    ax.text(0.98, 0.04, f"{labels['force']} = {p['force']:.1f} kN/m", transform=ax.transAxes,
            ha="right", va="bottom", color=NAVY, fontsize=8)
    return _png(fig)


def sheet_pile_diagrams(result: dict, labels: dict[str, str]) -> bytes | None:
    """Net pressure, shear force and bending moment against depth, with the maximum moment marked."""
    z, net, shear, moment = (result.get(k) for k in ("z", "net", "shear", "moment"))
    if not z or not (len(z) == len(net) == len(shear) == len(moment)) or not _finite(z + net + shear + moment):
        return None
    fig, axes = plt.subplots(1, 3, figsize=(7.2, 4.4), sharey=True)
    series = ((net, labels["net"], "#B5651D"), (shear, labels["shear"], NAVY), (moment, labels["moment"], "#7B3F9E"))
    for ax, (values, title, color) in zip(axes, series):
        ax.fill_betweenx(z, 0, values, color=color, alpha=0.25, lw=0)
        ax.plot(values, z, color=color, lw=1.5)
        ax.axvline(0, color="#333", lw=0.8)
        ax.set_title(title, fontsize=9)
        ax.grid(alpha=0.3)
    axes[0].invert_yaxis()
    axes[0].set_ylabel(labels["y"])
    h, z_m, m_max = result.get("H"), result.get("z_M_max"), result.get("M_max")
    if isinstance(h, (int, float)):
        for ax in axes:
            ax.axhline(h, color="#888", ls=":", lw=1)
        axes[0].text(0.02, h, labels["excavation"], transform=axes[0].get_yaxis_transform(), fontsize=7,
                     va="bottom", color="#555")
    if isinstance(z_m, (int, float)) and isinstance(m_max, (int, float)):
        sign = 1 if max(moment) >= -min(moment) else -1
        axes[2].plot([sign * m_max], [z_m], "o", color=BAD)
        axes[2].annotate(f"{labels['mmax']} = {m_max:.1f}", (sign * m_max, z_m), textcoords="offset points",
                         xytext=(6, -10 if z_m > z[len(z) // 2] else 10), color=BAD, fontsize=8)
    fig.tight_layout()
    return _png(fig)


def check_bars(checks: list[dict], labels: dict[str, str]) -> bytes | None:
    """Utilisation of each check; the red 1.0 line is the limit, bars beyond it are red."""
    rows = [(c["label"], c["utilisation"]) for c in checks
            if isinstance(c.get("utilisation"), (int, float)) and math.isfinite(c["utilisation"])]
    if not rows:
        return None
    fig, ax = plt.subplots(figsize=(6.4, 0.38 * len(rows) + 1.0))
    names = [r[0] for r in rows]
    values = [r[1] for r in rows]
    ax.barh(range(len(rows)), values, color=[OK if v <= 1 else BAD for v in values], height=0.62)
    ax.axvline(1.0, color=BAD, lw=1.5)
    ax.text(1.0, -0.8, labels["limit"], color=BAD, ha="center", fontsize=8)
    for i, v in enumerate(values):
        ax.text(v + 0.02, i, f"{v:.2f}", va="center", fontsize=8)
    ax.set_yticks(range(len(rows)), names, fontsize=8)
    ax.invert_yaxis()
    ax.set_xlim(0, max(1.15, max(values) * 1.15))
    ax.set_xlabel(labels["x"])
    ax.grid(axis="x", alpha=0.3)
    return _png(fig)


def soil_column(layers: list[dict], gwt_depth: float | None, labels: dict[str, str]) -> bytes | None:
    """Layer column to scale: one coloured block per layer with its main parameters, water level line."""
    if not layers or not _finite([v for l in layers for v in (l["top"], l["bottom"])]):
        return None
    palette = ["#E8DCC4", "#D9C7A0", "#C9B38A", "#BBA27A", "#A89268", "#D7CDB6"]
    depth = max(l["bottom"] for l in layers)
    fig, ax = plt.subplots(figsize=(5.2, max(2.6, 0.45 * depth + 1.2)))
    for i, layer in enumerate(layers):
        top, bottom = layer["top"], layer["bottom"]
        ax.add_patch(Polygon([(0, top), (1, top), (1, bottom), (0, bottom)], facecolor=palette[i % len(palette)],
                             edgecolor="#555", lw=0.8))
        ax.text(0.04, (top + bottom) / 2, layer["text"], va="center", fontsize=8)
        ax.text(-0.04, top, f"{top:g}", ha="right", va="center", fontsize=8)
    ax.text(-0.04, depth, f"{depth:g}", ha="right", va="center", fontsize=8)
    if gwt_depth is not None and math.isfinite(gwt_depth) and 0 <= gwt_depth <= depth:
        ax.plot([-0.1, 1.05], [gwt_depth, gwt_depth], color=WATER, lw=1.5, ls="--", zorder=5)
        ax.text(1.06, gwt_depth, labels["gwt"], color=WATER, va="center", fontsize=8)
    ax.set_xlim(-0.2, 1.4)
    ax.set_ylim(depth, 0)
    ax.set_ylabel(labels["y"])
    ax.set_xticks([])
    ax.spines["bottom"].set_visible(False)
    return _png(fig)


def cpt_plot(data: dict, labels: dict[str, str]) -> bytes | None:
    """Cone resistance, sleeve friction and soil behaviour index Ic against depth (Ic 2.6 = sand/clay boundary)."""
    depth, qc, fs, ic = (data.get(k) for k in ("depth", "qc", "fs", "Ic"))
    if not depth or not (len(depth) == len(qc) == len(fs) == len(ic)):
        return None
    ok = [i for i in range(len(depth)) if _finite([depth[i], qc[i], fs[i], ic[i]])]
    if len(ok) < 2:
        return None
    pick = lambda values: [values[i] for i in ok]  # noqa: E731
    fig, axes = plt.subplots(1, 3, figsize=(7.2, 4.4), sharey=True)
    for ax, values, title, color in ((axes[0], qc, labels["qc"], NAVY), (axes[1], fs, labels["fs"], "#B5651D"),
                                     (axes[2], ic, labels["ic"], "#7B3F9E")):
        ax.plot(pick(values), pick(depth), color=color, lw=1.2)
        ax.set_title(title, fontsize=9)
        ax.grid(alpha=0.3)
    axes[2].axvline(2.6, color="#888", ls=":", lw=1.2)
    axes[2].text(2.6, 0.01, labels["boundary"], transform=axes[2].get_xaxis_transform(), fontsize=7, color="#555",
                 ha="center", va="bottom")
    axes[0].invert_yaxis()
    axes[0].set_ylabel(labels["y"])
    fig.tight_layout()
    return _png(fig)


def liquefaction_plot(series: dict, labels: dict[str, str]) -> bytes | None:
    """Safety factor against liquefaction with depth; the part below FS = 1 is shaded red."""
    depth, fs, status = series.get("depth"), series.get("FS"), series.get("status") or []
    if not depth or not fs or len(depth) != len(fs):
        return None
    ok = [i for i in range(len(depth)) if fs[i] is not None and _finite([depth[i], fs[i]])]
    if len(ok) < 2:
        return None
    d = [depth[i] for i in ok]
    v = [min(fs[i], 5.0) for i in ok]
    fig, ax = plt.subplots(figsize=(4.2, 4.2))
    ax.plot(v, d, color=NAVY, lw=1.4)
    ax.fill_betweenx(d, v, 1.0, where=[x < 1.0 for x in v], color=BAD, alpha=0.35, lw=0)
    ax.axvline(1.0, color=BAD, lw=1.4)
    ax.text(1.0, 1.01, labels["limit"], transform=ax.get_xaxis_transform(), color=BAD, ha="center", fontsize=8)
    ax.set_xlim(0, 5.2)
    ax.invert_yaxis()
    ax.set_xlabel(labels["x"])
    ax.set_ylabel(labels["y"])
    ax.grid(alpha=0.3)
    lpi = series.get("LPI")
    if isinstance(lpi, (int, float)) and math.isfinite(lpi):
        ax.text(0.97, 0.03, f"LPI = {lpi:.1f}", transform=ax.transAxes, ha="right", fontsize=9, color=NAVY)
    return _png(fig)


def anchored_wall_section(*, excavation_height: float, wall_length: float, levels: list[dict],
                          labels: dict[str, str]) -> bytes | None:
    """Scaled wall elevation: excavation, wall, embedment and every anchor (free length plain, bond length thick)."""
    if not _finite([excavation_height, wall_length]) or wall_length <= 0 or excavation_height <= 0:
        return None
    reach = max(6.0, 0.9 * wall_length)
    fig, ax = plt.subplots(figsize=(6.4, 4.4))
    ax.add_patch(Polygon([(0, 0), (reach, 0), (reach, wall_length + 1), (0, wall_length + 1)], color=SOIL, lw=0))
    ax.add_patch(Polygon([(-reach * 0.5, excavation_height), (0, excavation_height), (0, wall_length + 1),
                          (-reach * 0.5, wall_length + 1)], color=SOIL, lw=0))
    ax.add_patch(Polygon([(-reach * 0.5, 0), (0, 0), (0, excavation_height), (-reach * 0.5, excavation_height)],
                         color="white", lw=0))
    ax.add_patch(Polygon([(-0.25, 0), (0, 0), (0, wall_length), (-0.25, wall_length)], facecolor=CONCRETE,
                         edgecolor="#444", zorder=3))
    ax.plot([-reach * 0.5, 0], [excavation_height] * 2, color="#7A6A45", lw=1.2)
    for lv in levels:
        d, a = lv["depth"], math.radians(lv.get("inclination_deg") or 0.0)
        free, bond = lv.get("free_length"), lv.get("bond_length")
        if not _finite([d, a]):
            continue
        free_len = free if free is not None and math.isfinite(free) else 0.5 * reach
        bond_len = bond if bond is not None and math.isfinite(bond) else 0.0
        x1, y1 = free_len * math.cos(a), d + free_len * math.sin(a)
        x2, y2 = x1 + bond_len * math.cos(a), y1 + bond_len * math.sin(a)
        ax.plot([0, x1], [d, y1], color=NAVY, lw=1.6, zorder=4)
        if bond_len:
            ax.plot([x1, x2], [y1, y2], color=NAVY, lw=5, solid_capstyle="butt", zorder=4)
        ax.text(0.2, d - 0.15, f"{d:.1f} m", fontsize=8, color=NAVY)
    ax.annotate("", xy=(-0.9, 0), xytext=(-0.9, excavation_height), arrowprops={"arrowstyle": "<->"})
    ax.text(-1.0, excavation_height / 2, f"H = {excavation_height:.2f} m", rotation=90, ha="right", va="center")
    ax.annotate("", xy=(-0.9, excavation_height), xytext=(-0.9, wall_length), arrowprops={"arrowstyle": "<->"})
    ax.text(-1.0, (excavation_height + wall_length) / 2, f"D = {wall_length - excavation_height:.2f} m",
            rotation=90, ha="right", va="center")
    ax.plot([], [], color=NAVY, lw=1.6, label=labels["free"])
    ax.plot([], [], color=NAVY, lw=5, label=labels["bond"])
    ax.legend(frameon=False, loc="lower right", fontsize=8)
    ax.set_xlim(-reach * 0.5, reach)
    ax.set_ylim(wall_length + 1, -1.5)
    ax.set_aspect("equal")
    ax.axis("off")
    return _png(fig)


def shear_moment_plot(z: list[float], shear: list[float], moment: list[float], *, excavation_height: float,
                      z_m_max: float, m_max: float, anchor_depths: list[float],
                      labels: dict[str, str]) -> bytes | None:
    """Shear force and bending moment along the wall with anchor levels and the largest moment marked."""
    if not z or not (len(z) == len(shear) == len(moment)) or not _finite(z + shear + moment):
        return None
    fig, axes = plt.subplots(1, 2, figsize=(5.6, 4.4), sharey=True)
    for ax, values, title, color in ((axes[0], shear, labels["shear"], NAVY), (axes[1], moment, labels["moment"], "#7B3F9E")):
        ax.fill_betweenx(z, 0, values, color=color, alpha=0.25, lw=0)
        ax.plot(values, z, color=color, lw=1.5)
        ax.axvline(0, color="#333", lw=0.8)
        ax.axhline(excavation_height, color="#888", ls=":", lw=1)
        for depth in anchor_depths:
            ax.axhline(depth, color=NAVY, ls="--", lw=0.8, alpha=0.6)
        ax.set_title(title, fontsize=9)
        ax.grid(alpha=0.3)
    axes[0].invert_yaxis()
    axes[0].set_ylabel(labels["y"])
    if _finite([z_m_max, m_max]):
        sign = 1 if max(moment) >= -min(moment) else -1
        axes[1].plot([sign * abs(m_max)], [z_m_max], "o", color=BAD)
        axes[1].annotate(f"{labels['mmax']} = {abs(m_max):.1f}", (sign * abs(m_max), z_m_max),
                         textcoords="offset points", xytext=(6, -10), color=BAD, fontsize=8)
    fig.tight_layout()
    return _png(fig)


def apparent_envelope_plot(z: list[float], p: list[float], *, excavation_height: float,
                           anchor_depths: list[float], labels: dict[str, str]) -> bytes | None:
    """Apparent pressure envelope against depth with the anchor levels dashed."""
    if len(z) < 2 or len(z) != len(p) or not _finite(z + p) or excavation_height <= 0:
        return None
    fig, ax = plt.subplots(figsize=(3.8, 3.6))
    ax.fill_betweenx(z, 0, p, color=NAVY, alpha=0.2, lw=0)
    ax.plot(p, z, color=NAVY, lw=1.6)
    for depth in anchor_depths:
        ax.axhline(depth, color="#888", ls="--", lw=0.8)
    ax.axhline(excavation_height, color="#888", ls=":", lw=1)
    ax.set_ylim(excavation_height * 1.03, 0)
    ax.set_xlabel(labels["x"])
    ax.set_ylabel(labels["y"])
    ax.set_title(labels["title"], fontsize=9)
    ax.annotate(f"{max(p):.1f} kPa", (max(p), z[1] if len(z) > 1 else 0), textcoords="offset points",
                xytext=(-4, -10), ha="right", fontsize=8, color=NAVY)
    ax.grid(alpha=0.3)
    fig.tight_layout()
    return _png(fig)
