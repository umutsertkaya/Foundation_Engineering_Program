"""Chart palette and matplotlib styling (light theme).

Colors follow a validated reference palette: categorical slots are used in fixed order,
status colors are reserved for liquefaction states and always appear with a text label.
"""

from __future__ import annotations

import matplotlib as mpl

SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK_2 = "#52514e"
MUTED = "#898781"
GRID = "#e1e0d9"
AXIS = "#c3c2b7"

SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]

STATUS = {"good": "#0ca30c", "warning": "#fab219", "serious": "#ec835a", "critical": "#d03b3b"}
NEUTRAL = "#c3c2b7"

# Sequential blue ramp (light -> dark); ordinal use starts at step 250
BLUE_RAMP = ["#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95"]

LINE_WIDTH = 1.5        # ~2 px
MARKER_SIZE = 6         # ~8 px

_THEMES = {
    "light": dict(SURFACE="#fcfcfb", INK="#0b0b0b", INK_2="#52514e", MUTED="#898781",
                  GRID="#e1e0d9", AXIS="#c3c2b7",
                  SERIES=["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]),
    "dark": dict(SURFACE="#1a1a19", INK="#f0efec", INK_2="#c3c2b7", MUTED="#898781",
                 GRID="#2c2c2a", AXIS="#383835",
                 SERIES=["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"]),
}
theme = "light"


def set_theme(name: str) -> None:
    """Switch chart colors between the light and dark steps of the same palette."""
    global theme
    if name not in _THEMES:
        raise ValueError(f"Unknown theme {name!r}")
    theme = name
    globals().update({k: (list(v) if isinstance(v, list) else v) for k, v in _THEMES[name].items()})


def apply() -> None:
    mpl.rcParams.update({
        "figure.facecolor": SURFACE,
        "axes.facecolor": SURFACE,
        "savefig.facecolor": SURFACE,
        "font.family": ["Segoe UI", "DejaVu Sans", "sans-serif"],
        "font.size": 9,
        "text.color": INK,
        "axes.labelcolor": INK_2,
        "axes.edgecolor": AXIS,
        "axes.linewidth": 0.8,
        "axes.titlesize": 10,
        "axes.titleweight": "bold",
        "axes.titlecolor": INK,
        "axes.grid": True,
        "grid.color": GRID,
        "grid.linewidth": 0.6,
        "xtick.color": MUTED,
        "ytick.color": MUTED,
        "xtick.labelcolor": INK_2,
        "ytick.labelcolor": INK_2,
        "lines.linewidth": LINE_WIDTH,
        "lines.markersize": MARKER_SIZE,
        "legend.frameon": False,
        "legend.fontsize": 8,
        "axes.spines.right": False,
        "axes.spines.bottom": False,
    })
