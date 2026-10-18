"""SPT log and USCS/N hand calculations, edge cases, and service integration."""

from dataclasses import asdict, fields
from pathlib import Path

import numpy as np
import pytest

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
    # Edges 0,1.5,2.1,2.6,3,4. Lens CL at 2.2 has thickness .5 < .6.
    # Both neighbours are SP; N=30 is closer to lower 32 than upper mean 10.
    # Mixed merge returns no USCS, mean (30+32+32)/3, and review warnings.
    p = processed([1, 2, 2.2, 3, 4], [10, 10, 30, 32, 32])
    result = spt_uscs_n_layers(p, ["SP", "SP", "CL", "SP", "SP"],
                              settings(min_thickness=0.6))
    assert [(s.top, s.bottom) for s in result.layers] == [(0, 2.1), (2.1, 4)]
    assert result.layers[1].n60_mean == pytest.approx(94 / 3)
    assert result.layers[1].uscs is None
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
        assert layer.n60_mean is not None
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
