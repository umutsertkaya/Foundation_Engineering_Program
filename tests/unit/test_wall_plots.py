"""Agg render tests of the Module 2 figures, in both themes."""

import io

import matplotlib

matplotlib.use("Agg")

import pytest  # noqa: E402
from matplotlib.figure import Figure  # noqa: E402

from geotek.core.models.walls import Backfill  # noqa: E402
from geotek.plotting import figures, style  # noqa: E402
from geotek.services.walls_basic import (  # noqa: E402
    BasicSheetPileInput,
    BasicWallInput,
    design_sheet_pile_basic,
    size_wall,
)


def _render(fig: Figure) -> int:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=60)
    return buf.tell()


@pytest.fixture(scope="module")
def sized():
    inp = BasicWallInput(wall_type="cantilever", height=5.0, backfill_gamma=18.0, backfill_phi=32.0,
                         foundation_phi=30.0, foundation_gamma=19.0, surcharge=10.0, sds=0.5)
    return inp, size_wall(inp)


@pytest.fixture(params=["light", "dark"])
def themed(request):
    style.set_theme(request.param)
    yield request.param
    style.set_theme("light")


def test_wall_section_and_slip(sized, themed):
    inp, r = sized
    bf = Backfill(gamma=18.0, phi=32.0, slope=10.0)
    fig = Figure(figsize=(8, 6))
    for case in ("static", "seismic"):
        assert _render(figures.plot_wall_section(fig, r.geometry, bf, surcharge=10.0, analysis=r.analyses[case],
                                                 water_level=-0.5, title=case)) > 2000
    labels = [t.get_text() for t in fig.axes[0].texts]
    assert any("kN/m" in s for s in labels) and any("e =" in s for s in labels)
    assert set(r.slip_results) == {"static", "seismic"}
    assert _render(figures.plot_slip_circle(fig, r.geometry, bf, r.slip_results["seismic"], surcharge=10.0)) > 2000
    assert any("FS" in t.get_text() for t in fig.axes[0].texts)


def test_gravity_section():
    inp = BasicWallInput(wall_type="gravity", height=3.0, backfill_gamma=18.0, backfill_phi=32.0,
                         foundation_phi=30.0, foundation_gamma=19.0, include_global_stability=False)
    r = size_wall(inp)
    fig = Figure(figsize=(8, 6))
    assert _render(figures.plot_wall_section(fig, r.geometry, Backfill(gamma=18, phi=32),
                                             analysis=r.analyses["static"])) > 2000


@pytest.mark.parametrize("support", ["cantilever", "anchored"])
def test_sheet_pile_plot(support, themed):
    r = design_sheet_pile_basic(BasicSheetPileInput(support=support, retained_height=4.0,
                                                    anchor_depth=1.0 if support == "anchored" else None,
                                                    gamma=18.0, gamma_sat=20.0, phi=32.0, gwt_depth=2.0))
    fig = Figure(figsize=(9, 6))
    assert _render(figures.plot_sheet_pile(fig, r.result, gwt_depth=2.0)) > 2000
    assert len(fig.axes) == 3
