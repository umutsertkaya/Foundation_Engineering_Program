"""Combined CPT + borehole layering (HS-E E4): alignment, boundaries, conflicts, distances."""

import numpy as np
import pytest

from geotek.core.models.investigations import LabRecord
from geotek.core.models.profile import LayeringSettings
from geotek.engine.layering.combined import CPTPoints, Site, combined_layers
from geotek.engine.layering.common import Layer, Proposal, parse_warning

SETTINGS = LayeringSettings(method="combined", min_thickness=0.5)
CH = LabRecord(depth=1.0, FC=90, LL=60, PI=40)
SP = LabRecord(depth=1.0, FC=0)


def layer(top, bottom, uscs=None):
    return Layer(top=top, bottom=bottom, description="", uscs=uscs, sbtn_zone=None,
                 ic_mean=None, n60_mean=None, gamma_suggested=None, behaviour="drained")


def proposal(source_id, *bounds, uscs=None):
    edges = [0.0, *bounds]
    layers = [layer(a, b, uscs) for a, b in zip(edges[:-1], edges[1:])]
    return Proposal(source_id, SETTINGS, layers, [], source_ids=[source_id])


def cpt_points(ic_by_depth, gamma=18.0):
    depth = np.array(sorted(ic_by_depth), dtype=float)
    return CPTPoints(depth, np.array([ic_by_depth[d] for d in sorted(ic_by_depth)]),
                     np.full(len(depth), gamma))


def run(cpt=None, bh=None, *, cpt_site=None, bh_site=None, labs=None, ic=None, spt=None):
    cpt = cpt or proposal("C", 2.0, 6.0)
    bh = bh or proposal("B", 1.0, 5.0)
    ic = ic or {0.5: 1.5, 1.5: 1.5, 2.5: 1.5, 4.5: 1.5, 5.5: 1.5}
    return combined_layers(
        cpt, {"B": bh}, cpt_points(ic), {"B": labs or []},
        cpt_site=cpt_site or Site("C"), sites={"B": bh_site or Site("B")},
        spt_points={"B": spt or []}, settings=SETTINGS, gwt=None)


def codes(result):
    return [parse_warning(w)[0] for w in result.warnings]


def test_elevation_alignment_shifts_borehole_depth_by_one_metre():
    """elev_cpt = 100.0, elev_bh = 99.0 -> d' = d + (100.0 - 99.0) = d + 1.0.

    The borehole boundary at 1.0 m becomes 2.0 m, which equals the CPT boundary: one boundary.
    """
    result = run(cpt_site=Site("C", elevation=100.0), bh_site=Site("B", elevation=99.0))
    assert [(x.top, x.bottom) for x in result.layers] == [(0.0, 2.0), (2.0, 6.0)]
    assert result.layers[1].top_source == "both"
    assert "layering.warning.depth_not_aligned" not in codes(result)


def test_missing_elevation_keeps_depths_and_warns_with_borehole_id():
    result = run()
    assert [(x.top, x.bottom) for x in result.layers] == [(0.0, 1.0), (1.0, 2.0), (2.0, 6.0)]
    assert [x.top_source for x in result.layers] == [None, "borehole", "cpt"]
    warning = next(w for w in result.warnings if w.startswith("layering.warning.depth_not_aligned"))
    assert parse_warning(warning) == ("layering.warning.depth_not_aligned", {"borehole": "B"})


def test_close_boundaries_merge_into_the_cpt_position():
    """CPT boundary 2.0 m, borehole boundary 2.3 m: |2.3 - 2.0| = 0.3 < min_thickness 0.5."""
    result = run(bh=proposal("B", 2.3, 5.0))
    tops = [x.top for x in result.layers]
    assert tops == [0.0, 2.0] and result.layers[1].top_source == "both"
    far = run(bh=proposal("B", 2.6, 5.0))  # 0.6 >= 0.5: both boundaries survive
    assert [x.top for x in far.layers] == [0.0, 2.0, 2.6]
    assert [x.top_source for x in far.layers] == [None, "cpt", "borehole"]


def test_distance_is_a_three_four_five_triangle():
    result = run(cpt_site=Site("C", x=0.0, y=0.0), bh_site=Site("B", x=3.0, y=4.0))
    assert result.distances == {"B": pytest.approx(5.0)}
    assert run().distances == {}
    assert result.source_ids == ["C", "B"]


def test_uscs_is_the_lab_majority_then_the_overlapping_borehole_layer_then_cpt_only():
    labs = [SP.model_copy(update={"depth": 0.4}), SP.model_copy(update={"depth": 0.6}),
            CH.model_copy(update={"depth": 0.8})]
    result = run(labs=labs, bh=proposal("B", 5.0, uscs="CL"))
    assert result.layers[0].uscs == "SP"        # lab majority wins over the borehole layer
    assert result.layers[1].uscs == "CL"        # no lab sample: overlapping borehole layer
    cpt_only = run(bh=proposal("B", 5.0))
    assert cpt_only.layers[0].uscs is None and cpt_only.layers[0].sbtn_zone == 6  # Ic 1.5: zone 6
    tie = run(labs=[CH.model_copy(update={"depth": 0.8}), SP.model_copy(update={"depth": 0.3})])
    assert tie.layers[0].uscs == "SP"           # tie goes to the shallowest symbol


def test_conflict_between_sandy_cpt_and_clay_uscs_is_flagged():
    """Mean Ic 1.5 < 2.05 is coarse, CH is fine: coarse <-> fine contradiction."""
    result = run(labs=[CH], bh=proposal("B", 5.0))
    first = result.layers[0]
    assert first.conflict == {"cpt": "coarse", "uscs": "CH", "ic_mean": pytest.approx(1.5)}
    assert first.behaviour == "drained"  # provisional: the CPT group; the client resolves it


def test_transitional_ic_is_no_conflict_and_follows_the_uscs_group():
    ic = {0.5: 2.3, 1.5: 2.3, 2.5: 2.3, 4.5: 2.3, 5.5: 2.3}
    result = run(labs=[CH], bh=proposal("B", 5.0), ic=ic)
    assert result.layers[0].conflict is None
    assert result.layers[0].behaviour == "undrained"
    silty = run(labs=[SP], bh=proposal("B", 5.0), ic=ic)
    assert silty.layers[0].behaviour == "drained"
    assert run(bh=proposal("B", 5.0), ic=ic).layers[0].behaviour == "drained"  # Ic < 2.6


def test_unit_weights_use_all_sources():
    lab = LabRecord(depth=0.5, FC=0, gamma=17.0)
    result = run(labs=[lab], bh=proposal("B", 5.0), spt=[(2.5, 20.0)])
    first, second = result.layers[0], result.layers[1]
    assert first.n60_mean is None and second.n60_mean == pytest.approx(20.0)
    assert (first.gamma_suggested, first.gamma_source) == (17.0, "lab")
    assert (second.gamma_suggested, second.gamma_source) == (18.0, "cpt_rc2010")
