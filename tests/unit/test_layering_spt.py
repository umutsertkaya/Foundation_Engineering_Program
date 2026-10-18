"""SPT log and USCS/N hand calculations, edge cases, and service integration."""

from dataclasses import asdict, fields
from pathlib import Path

import numpy as np
import pytest

from geotek.core.constants import DEPTH_TOL
from geotek.core.models.investigations import (
    Borehole, BoreholeLayer, Investigations, LabRecord, SPTRecord,
)
from geotek.core.models.profile import GroundwaterCondition, LayeringSettings, SoilLayer, SoilProfile
from geotek.core.models.project import Project, ProjectMeta
from geotek.engine.insitu.spt import SPTProcessed
from geotek.engine.layering import spt_log_layers, spt_uscs_n_layers
from geotek.io.tabular import import_spt
from geotek.services.layering import propose_layers


def processed(depth, n):
    z = np.asarray(depth, dtype=float)
    data = {f.name: np.zeros(len(z)) for f in fields(SPTProcessed)}
    data.update(borehole_id="B", depth=z, n60=np.asarray(n, dtype=float), warnings=[])
    return SPTProcessed(**data)


def settings(method="spt_uscs_n", **kwargs):
    return LayeringSettings(method=method, **{"min_thickness": 0.1, **kwargs})


def test_log_hand_calculation():
    # Log [0,2),[2,4]; tests z=[1,2,3,4], corrected N60=[6,10,14,18].
    # Shared-boundary z=2 belongs to lower; final-bottom z=4 is included there.
    # Means: 6/1=6 and (10+14+18)/3=14. Geometry remains exactly the log.
    bh = Borehole(id="B", log=[
        BoreholeLayer(top=0, bottom=2, uscs="CL", description="Upper clay"),
        BoreholeLayer(top=2, bottom=4, uscs="SP", description="Lower sand"),
    ])
    result = spt_log_layers(bh, processed([1, 2, 3, 4], [6, 10, 14, 18]),
                            settings("spt_log"))
    assert [(s.top, s.bottom) for s in result.layers] == [(0, 2), (2, 4)]
    assert [s.n60_mean for s in result.layers] == [6, 14]
    assert [s.uscs for s in result.layers] == ["CL", "SP"]
    assert [s.behaviour for s in result.layers] == ["undrained", "drained"]
    assert [s.description for s in result.layers] == ["Upper clay", "Lower sand"]
    assert all(s.ic_mean is None and s.gamma_suggested is None for s in result.layers)
    assert "layering.warning.behaviour_assumed" in result.warnings


def test_uscs_n_hand_calculation():
    # z=[1,2,3,4,5], USCS=[SP,SP,SP,CL,CL], N60=[10,12,20,20,22].
    # Start mean=10; 12 differs by 2/10=.2 <= .5, updated mean=11.
    # 20 differs by 9/11=.818 > .5 => split at (2+3)/2=2.5.
    # CL at z=4 changes group => split at (3+4)/2=3.5.
    # Last 22 differs by 2/20=.1 <= .5. Means: 11,20,21; extent [0,5].
    p = processed([1, 2, 3, 4, 5], [10, 12, 20, 20, 22])
    result = spt_uscs_n_layers(p, ["SP", "SP", "SP", "CL", "CL"], settings())
    assert [(s.top, s.bottom) for s in result.layers] == [(0, 2.5), (2.5, 3.5), (3.5, 5)]
    assert [s.n60_mean for s in result.layers] == [11, 20, 21]
    assert [s.uscs for s in result.layers] == ["SP", "SP", "CL"]


def test_ratio_threshold_is_strict_and_uses_corrected_n():
    p = processed([1, 2], [10, 15])
    p.n_field = np.array([1, 99])
    assert len(spt_uscs_n_layers(p, ["SP", "SP"], settings()).layers) == 1


def test_thin_lens_prefers_same_uscs_then_nearest_n():
    # Edges 0,1.5,2.1,2.6,3.5,4. Lens CL at 2.2 has thickness .5 < .6.
    # Both neighbours are SP; N=30 is closer to lower 32 than upper mean 10.
    # Mixed merge retains SP: 1.4 m versus CL .5 m; mean (30+32+32)/3.
    p = processed([1, 2, 2.2, 3, 4], [10, 10, 30, 32, 32])
    result = spt_uscs_n_layers(p, ["SP", "SP", "CL", "SP", "SP"],
                              settings(min_thickness=0.6))
    assert [(s.top, s.bottom) for s in result.layers] == [(0, 2.1), (2.1, 4)]
    assert result.layers[1].n60_mean == pytest.approx(94 / 3)
    assert result.layers[1].uscs == "SP"
    assert "layering.warning.thin_merged" in result.warnings
    assert "layering.warning.uscs_mixed" in result.warnings


def test_same_group_thin_merge_uses_n_similarity_and_upper_tie():
    p = processed([1, 2, 2.2, 3, 4], [10, 10, 30, 10, 10])
    result = spt_uscs_n_layers(p, ["SP"] * 5, settings(min_thickness=0.6))
    assert result.layers[0].bottom == 2.6
    assert result.layers[0].n60_mean == pytest.approx(50 / 3)


def test_thin_merge_prefers_same_uscs_before_n_distance():
    p = processed([1, 2, 2.2, 3, 4], [10, 10, 30, 32, 32])
    result = spt_uscs_n_layers(p, ["SP", "SP", "SP", "CL", "CL"],
                              settings(min_thickness=0.6))
    assert [(s.top, s.bottom) for s in result.layers] == [(0, 2.6), (2.6, 4)]
    assert [s.uscs for s in result.layers] == ["SP", "CL"]
    assert result.layers[0].n60_mean == pytest.approx(50 / 3)


@pytest.mark.parametrize("n,expected", [
    ([0, 0, 10], [0, 10]),
    ([np.nan, np.nan, np.nan], [None]),
    ([10, np.nan, 10], [10]),
    ([0, np.nan, 0], [0]),
])
def test_zero_and_absent_n(n, expected):
    result = spt_uscs_n_layers(processed([1, 2, 3], n), ["SP"] * 3, settings())
    assert [s.n60_mean for s in result.layers] == expected
    assert "layering.warning.n_missing_or_zero" in result.warnings


def test_missing_uscs_is_not_invented():
    result = spt_uscs_n_layers(processed([1, 2], [10, 10]), [None, "SP"], settings())
    assert [s.uscs for s in result.layers] == [None, "SP"]
    assert "layering.warning.uscs_missing" in result.warnings


def test_single_sample_and_short_record():
    result = spt_uscs_n_layers(processed([0.2], [10]), ["CL"],
                              settings(min_thickness=0.5))
    assert [(s.top, s.bottom, s.n60_mean) for s in result.layers] == [(0, 0.2, 10)]


def test_all_one_group_and_n_range():
    result = spt_uscs_n_layers(processed([1, 2, 3], [10, 11, 12]), ["SP"] * 3,
                              settings())
    assert [(s.top, s.bottom, s.n60_mean) for s in result.layers] == [(0, 3, 11)]


@pytest.mark.parametrize("depth,n,groups,message", [
    ([], [], [], "at least one sample"),
    ([1], [10], [], "align"),
    ([1], [-1], ["SP"], "negative"),
    ([1], [10], ["INVALID"], "Unknown USCS"),
    ([1, 1], [10, 10], ["SP", "SP"], "unique"),
    ([0], [10], ["SP"], "positive final data depth"),
])
def test_invalid_uscs_n_input(depth, n, groups, message):
    with pytest.raises(ValueError, match=message):
        spt_uscs_n_layers(processed(depth, n), groups, settings())


def test_unsorted_input_and_groups_are_sorted_together():
    p = processed([3, 1, 2], [30, 10, 10])
    result = spt_uscs_n_layers(p, ["CL", "SP", "SP"], settings())
    assert [s.uscs for s in result.layers] == ["SP", "CL"]
    assert [s.n60_mean for s in result.layers] == [10, 30]
    assert asdict(result) == asdict(spt_uscs_n_layers(p, ["CL", "SP", "SP"], settings()))


def test_log_gaps_no_tests_and_uncovered_tests():
    bh = Borehole(id="B", log=[
        BoreholeLayer(top=1, bottom=2), BoreholeLayer(top=3, bottom=4, uscs="CL"),
    ])
    result = spt_log_layers(bh, processed([0.5, 3.5], [10, 20]), settings("spt_log"))
    assert [(s.top, s.bottom) for s in result.layers] == [(1, 2), (3, 4)]
    assert [s.n60_mean for s in result.layers] == [None, 20]
    assert {"layering.warning.log_gap", "layering.warning.log_no_test",
            "layering.warning.tests_outside_log", "layering.warning.uscs_missing"} <= set(
                result.warnings)


def test_log_preserves_thin_intervals():
    bh = Borehole(id="B", log=[BoreholeLayer(top=0, bottom=0.1),
                               BoreholeLayer(top=0.1, bottom=3)])
    result = spt_log_layers(bh, None, settings("spt_log", min_thickness=1))
    assert len(result.layers) == 2 and result.layers[0].bottom == 0.1
    assert "layering.warning.thin_merged" not in result.warnings


def test_log_without_data_is_clear_error():
    with pytest.raises(ValueError, match="log interval"):
        spt_log_layers(Borehole(id="B"), None, settings("spt_log"))


def test_log_requires_processing_existing_tests():
    bh = Borehole(id="B", log=[BoreholeLayer(top=0, bottom=2)],
                  spt=[SPTRecord(depth=1, n_field=10)])
    with pytest.raises(ValueError, match="processed N60"):
        spt_log_layers(bh, None, settings("spt_log"))


def test_log_empty_processed_tests():
    bh = Borehole(id="B", log=[BoreholeLayer(top=0, bottom=2)])
    result = spt_log_layers(bh, processed([], []), settings("spt_log"))
    assert result.layers[0].n60_mean is None
    assert "layering.warning.log_no_test" in result.warnings


def project_for(bh, *, with_profile=True):
    profiles = [SoilProfile(id="P", gwt=GroundwaterCondition(depth_insitu=2), layers=[
        SoilLayer(id="L", top=0, bottom=20, gamma=18),
    ])] if with_profile else []
    return Project(meta=ProjectMeta(name="SPT layering"),
                   investigations=Investigations(boreholes=[bh]), soil_profiles=profiles)


@pytest.mark.parametrize("method", ["spt_uscs_n", "spt_log"])
def test_spt_csv_service_structure_and_processing(method):
    from geotek.api.schemas import LayeringProposal

    bh = import_spt(Path("examples/ornek_spt.csv"), "B")
    bh.lab = [LabRecord(depth=r.depth, FC=90, LL=35, PI=20) for r in bh.spt]
    if method == "spt_log":
        bh.log = [BoreholeLayer(top=0, bottom=8, uscs="CL"),
                  BoreholeLayer(top=8, bottom=13.5, uscs="SP")]
    project = project_for(bh)
    before = project.model_dump_json()
    opts = LayeringSettings(method=method)
    result = propose_layers(project, "B", opts)
    assert project.model_dump_json() == before
    assert result.layers[0].top == 0 and result.layers[-1].bottom == bh.spt[-1].depth
    for a, b in zip(result.layers, result.layers[1:]):
        assert a.bottom == b.top and a.top < b.top
    for layer in result.layers:
        assert layer.bottom - layer.top >= opts.min_thickness
        # A layer containing only refusal tests has no exact numeric mean.
        assert (layer.n60_mean is not None or
                any(w.startswith("layering.warning.refusal_in_layer:") for w in result.warnings))
        assert layer.gamma_suggested is None
    # ER=60%, CB=CS=1. CR at z=[1.5,3,4.5,6,7.5] is [.75,.80,.85,.95,.95].
    # The first group's corrected N is [4.5,4,5.95,3.8,2.85]; mean=21.1/5=4.22.
    # All successive relative deviations stay <= .5, until N60=20.9 at z=9.
    # This proves service processing precedes statistics.
    if method == "spt_uscs_n":
        assert result.layers[0].n60_mean == pytest.approx(4.22)
    assert "layering.warning.processing_warnings" in result.warnings  # refusal
    assert LayeringProposal.model_validate(result).settings == opts


def test_service_log_fallback_and_no_lab():
    bh = Borehole(id="B", spt=[SPTRecord(depth=1, n_field=10)])
    opts = settings("spt_log")
    result = propose_layers(project_for(bh), "B", opts)
    assert result.settings.method == "spt_uscs_n" and opts.method == "spt_log"
    assert result.layers[0].uscs is None
    assert "layering.warning.log_missing" in result.warnings
    assert "layering.warning.uscs_missing" in result.warnings


def test_service_lab_matching_uses_existing_tolerance_and_stable_tie():
    bh = Borehole(id="B", spt=[SPTRecord(depth=1, n_field=10),
                               SPTRecord(depth=3, n_field=10)], lab=[
        LabRecord(depth=1.5, FC=90, LL=35, PI=20),
        LabRecord(depth=0.5, FC=90, LL=60, PI=40),
        LabRecord(depth=3.51, FC=90, LL=35, PI=20),
    ])
    result = propose_layers(project_for(bh), "B", settings())
    assert [s.uscs for s in result.layers] == ["CH", None]


def test_service_qualified_uscs_is_flagged():
    bh = Borehole(id="B", spt=[SPTRecord(depth=1, n_field=10)],
                  lab=[LabRecord(depth=1, FC=0)])
    result = propose_layers(project_for(bh), "B", settings())
    assert result.layers[0].uscs == "SP"  # existing classifier's qualified result
    assert "layering.warning.uscs_qualified" in result.warnings


def test_service_requires_profile_for_spt_tests():
    bh = Borehole(id="B", spt=[SPTRecord(depth=1, n_field=10)])
    with pytest.raises(ValueError, match="unit weights"):
        propose_layers(project_for(bh, with_profile=False), "B", settings())


def test_service_no_profile_needed_for_log_without_tests():
    bh = Borehole(id="B", log=[BoreholeLayer(top=0, bottom=2)])
    result = propose_layers(project_for(bh, with_profile=False), "B", settings("spt_log"))
    assert result.layers[0].n60_mean is None


def test_service_missing_source_and_empty_data():
    project = project_for(Borehole(id="B"))
    with pytest.raises(KeyError):
        propose_layers(project, "absent", settings())
    with pytest.raises(ValueError, match="at least one SPT"):
        propose_layers(project, "B", settings())
    with pytest.raises(ValueError, match="type"):
        propose_layers(project, "B", LayeringSettings(method="cpt_ic"))


def test_engines_reject_wrong_methods_and_sources():
    p = processed([1], [10])
    with pytest.raises(ValueError, match="spt_uscs_n"):
        spt_uscs_n_layers(p, ["SP"], settings("spt_log"))
    bh = Borehole(id="other", log=[BoreholeLayer(top=0, bottom=2)])
    with pytest.raises(ValueError, match="spt_log"):
        spt_log_layers(bh, p, settings())
    with pytest.raises(ValueError, match="source"):
        spt_log_layers(bh, p, settings("spt_log"))


def test_sp_lens_merged_into_cl_retains_dominant_cl_behaviour():
    # Edges 0,1.5,2.1,2.6,3.5,4: SP lens owns .5 m; lower CL owns 1.4 m.
    # N=30 is nearer lower CL=32 than upper CL=10, so lower absorbs the lens.
    # CL dominates by thickness; mean (30+32+32)/3=94/3, undrained provisionally.
    result = spt_uscs_n_layers(processed([1, 2, 2.2, 3, 4], [10, 10, 30, 32, 32]),
                              ["CL", "CL", "SP", "CL", "CL"],
                              settings(min_thickness=.6))
    assert [s.uscs for s in result.layers] == ["CL", "CL"]
    assert result.layers[1].behaviour == "undrained"
    assert result.layers[1].n60_mean == pytest.approx(94 / 3)
    assert "layering.warning.uscs_mixed" in result.warnings


@pytest.mark.parametrize("depth,groups,dominant", [
    ([0, 1, 2, 3, 4], ["CL", "SP", "SP", "CL", "CL"], "CL"),
    ([1, 2, 3, 4, 5], ["CL", "CL", "SP", "SP", "SP"], "SP"),
])
def test_dominant_group_thickness_tie_uses_count(depth, groups, dominant):
    # First widths .5,1,1,1,.5: both groups total 2 m, CL wins 3 samples vs 2.
    # Second widths 1.5,1,1,1,.5: both total 2.5 m, SP wins 3 vs 2 despite
    # CL being uppermost. Combining all cells is forced by min_thickness=10.
    result = spt_uscs_n_layers(processed(depth, [10] * 5), groups,
                              settings(min_thickness=10))
    assert len(result.layers) == 1
    assert result.layers[0].uscs == dominant
    assert "layering.warning.uscs_mixed" in result.warnings


def test_dominant_group_thickness_and_count_tie_uses_upper():
    # z=0,1,2,3 has cell widths .5,1,1,.5; CL owns .5+1=1.5 m
    # and SP owns 1+.5=1.5 m, both two samples. Upper CL wins.
    result = spt_uscs_n_layers(processed([0, 1, 2, 3], [10] * 4),
                              ["CL", "SP", "CL", "SP"], settings(min_thickness=10))
    assert result.layers[0].uscs == "CL"


@pytest.mark.parametrize("method", ["spt_log", "spt_uscs_n"])
@pytest.mark.parametrize("all_refusal", [False, True])
def test_refusal_means_and_depth_warning(method, all_refusal):
    from geotek.api.schemas import LayeringProposal

    # Unsorted z=3,1,2 verifies refusal alignment. Excluding refusal N=100 at z=2
    # gives (10+10)/2=10. All refusal has no exact mean, so serialize as null.
    p = processed([3, 1, 2], [10, 10, 100])
    p.refusal = np.array([all_refusal, all_refusal, True])
    if method == "spt_log":
        bh = Borehole(id="B", log=[BoreholeLayer(top=0, bottom=3, uscs="CL")])
        result = spt_log_layers(bh, p, settings(method))
    else:
        result = spt_uscs_n_layers(p, ["CL"] * 3, settings(method))
    assert len(result.layers) == 1
    assert result.layers[0].n60_mean == (None if all_refusal else 10)
    depths = "[1.0, 2.0, 3.0]" if all_refusal else "[2.0]"
    assert f"layering.warning.refusal_in_layer: top=0.0 bottom=3.0 depths={depths}" in result.warnings
    assert LayeringProposal.model_validate(result).layers[0].n60_mean == (None if all_refusal else 10)
    assert p.n60.tolist() == [10, 10, 100]


def test_log_missing_uscs_has_explicit_provisional_behaviour():
    # No group supplies a drainage interpretation; the required value is provisional.
    bh = Borehole(id="B", log=[BoreholeLayer(top=0, bottom=2, uscs=None)])
    result = spt_log_layers(bh, None, settings("spt_log"))
    assert result.layers[0].uscs is None
    assert result.layers[0].behaviour == "undrained"
    assert {"layering.warning.uscs_missing", "layering.warning.behaviour_assumed"} <= set(result.warnings)


@pytest.mark.parametrize("sign", [-1, 1])
def test_log_sub_tolerance_mismatch_snaps_before_assigning_tests(sign):
    # Mismatch is half Borehole's existing tolerance on either side of z=2.
    # Snap to 2: z=2 belongs only to lower, so exact means remain 10 and 20.
    bh = Borehole(id="B", log=[BoreholeLayer(top=0, bottom=2, uscs="CL"),
                               BoreholeLayer(top=2 + sign * DEPTH_TOL / 2,
                                             bottom=3, uscs="SP")])
    before = bh.model_dump_json()
    result = spt_log_layers(bh, processed([1, 2], [10, 20]), settings("spt_log"))
    assert [(s.top, s.bottom) for s in result.layers] == [(0, 2), (2, 3)]
    assert [s.n60_mean for s in result.layers] == [10, 20]
    assert "layering.warning.log_gap" not in result.warnings
    assert not any(w.startswith("layering.warning.no_data_interval:") for w in result.warnings)
    assert bh.model_dump_json() == before


def test_uscs_n_segment_first_sample_nan_does_not_poison_mean():
    # New CL segment starts with NaN: next finite N=10 initializes mean,
    # then 12 changes by .2 <=.5. Final CL mean (10+12)/2=11.
    result = spt_uscs_n_layers(processed([1, 2, 3, 4], [8, np.nan, 10, 12]),
                              ["SP", "CL", "CL", "CL"], settings())
    assert [s.uscs for s in result.layers] == ["SP", "CL"]
    assert [s.n60_mean for s in result.layers] == [8, 11]
    assert "layering.warning.n_missing_or_zero" in result.warnings


def test_uscs_n_extrapolation_and_local_gap_are_warned():
    # Retained increments .1,.9,.1: [1.1,2] exceeds local .1; top extends [0,1].
    result = spt_uscs_n_layers(processed([1, 1.1, 2, 2.1], [10] * 4),
                              ["CL"] * 4, settings())
    assert {"layering.warning.no_data_interval: top=0.0 bottom=1.0",
            "layering.warning.no_data_interval: top=1.1 bottom=2.0"} <= set(result.warnings)
