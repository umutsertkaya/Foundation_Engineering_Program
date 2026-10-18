"""Hand calculations, boundary choices and service integration for CPT layering."""

from dataclasses import asdict, fields
from pathlib import Path

import numpy as np
import pytest

from geotek.core.models.investigations import Investigations
from geotek.core.models.profile import LayeringSettings
from geotek.core.models.project import Project, ProjectMeta
from geotek.engine.classification.robertson import sbtn_zone, soil_behaviour_index, zone_from_ic
from geotek.engine.correlations.registry import evaluate
from geotek.engine.insitu.cpt import CPTProcessed
from geotek.engine.layering import cpt_layers
from geotek.engine.layering.common import parse_warning
from geotek.io.tabular import import_cpt
from geotek.services.layering import propose_layers


def processed(depth, ic):
    """Provide consistent ordinary zones; unused processing fields are inert arrays."""
    z = np.asarray(depth, dtype=float)
    data = {f.name: np.zeros(len(z)) for f in fields(CPTProcessed)}
    data.update(sounding_id="C", depth=z, Ic=np.asarray(ic, dtype=float),
                zone=zone_from_ic(ic),
                qt=np.full(len(z), 1013.25), fs=np.full(len(z), 10.1325), warnings=[])
    return CPTProcessed(**data)


def settings(**kwargs):
    return LayeringSettings(method="cpt_ic", **{
        "smoothing_window": 0.1, "min_thickness": 0.1, "merge_ic_tol": 0, **kwargs,
    })


def test_cpt_hand_calculation():
    # z = [1,2,3,4], Ic = [1.6,1.8,3.0,3.2]. Window 0.1 m leaves Ic unchanged.
    # Robertson zones = [6,6,3,3]. The only split is (2+3)/2 = 2.5 m.
    # Profile extent = [0,4]; Ic means = (1.6+1.8)/2 = 1.7, (3+3.2)/2 = 3.1.
    # 1.7 < 2.6 is drained; 3.1 >= 2.6 is undrained. Neither interval is thin.
    result = cpt_layers(processed([1, 2, 3, 4], [1.6, 1.8, 3.0, 3.2]), settings())
    assert [(s.top, s.bottom) for s in result.layers] == [(0, 2.5), (2.5, 4)]
    assert [s.ic_mean for s in result.layers] == pytest.approx([1.7, 3.1])
    assert [s.sbtn_zone for s in result.layers] == [6, 3]
    assert [s.behaviour for s in result.layers] == ["drained", "undrained"]
    # Independent substitution in RC2010_gamma_CPT: Pa=101.325 kPa,
    # qt=1013.25 kPa, fs=10.1325 kPa, so Rf=1%, qt/Pa=10,
    # gamma = 9.81*(0.27*log10(1)+0.36*log10(10)+1.236) = 15.65676.
    assert [s.gamma_suggested for s in result.layers] == pytest.approx([15.65676] * 2)


def test_smoothing_uses_depth_width_and_original_stats():
    # Width 1: windows [1,1.5], [1,1.5,2], [1.5,2] give [1.9, 2.1333, 2.5].
    # Zones [6,5,5], split at 1.25. Stats retain original Ic: 1.4 and (2.4+2.6)/2.
    result = cpt_layers(processed([1, 1.5, 2], [1.4, 2.4, 2.6]),
                        settings(smoothing_window=1))
    assert [(s.top, s.bottom) for s in result.layers] == [(0, 1.25), (1.25, 2)]
    assert [s.ic_mean for s in result.layers] == pytest.approx([1.4, 2.5])


def test_irregular_spacing_does_not_use_sample_count_window():
    result = cpt_layers(processed([1, 1.01, 5], [1.6, 1.8, 3.2]),
                        settings(smoothing_window=0.1))
    assert [(s.top, s.bottom) for s in result.layers] == [(0, 3.005), (3.005, 5)]


@pytest.mark.parametrize("ic", [[1.7], [1.6, 1.7, 1.8]])
def test_single_sample_and_one_zone(ic):
    result = cpt_layers(processed(range(1, len(ic) + 1), ic), settings())
    assert len(result.layers) == 1
    assert result.layers[0].top == 0
    assert result.layers[0].bottom == len(ic)
    assert result.layers[0].ic_mean == pytest.approx(np.mean(ic))


def test_thin_lens_merges_into_closest_neighbour():
    # Lens at 2.2 owns [2.1,2.6], thickness 0.5 < 0.6. It chooses lower Ic=1.9
    # over upper mean=1.75: distances 1.3 vs 1.45. New mean=(3.2+1.9)/2=2.55.
    result = cpt_layers(processed([1, 2, 2.2, 3], [1.7, 1.8, 3.2, 1.9]),
                        settings(min_thickness=0.6))
    assert [(s.top, s.bottom) for s in result.layers] == [(0, 2.1), (2.1, 3)]
    assert [s.ic_mean for s in result.layers] == pytest.approx([1.75, 2.55])
    assert "layering.warning.thin_merged" in result.warnings


def test_thin_merge_tie_chooses_upper():
    result = cpt_layers(processed([1, 2, 2.2, 3, 4], [1.75, 1.75, 3.25, 1.75, 1.75]),
                        settings(min_thickness=0.6))
    assert result.layers[0].bottom == 2.6
    assert result.layers[0].ic_mean == pytest.approx(2.25)


def test_tolerance_merge_and_strict_threshold():
    p = processed([1, 2, 3, 4], [2.0, 2.0, 2.1, 2.1])
    result = cpt_layers(p, settings(merge_ic_tol=0.15))
    assert len(result.layers) == 1
    assert result.layers[0].ic_mean == pytest.approx(2.05)
    assert "layering.warning.similar_merged" in result.warnings
    # Exactly representable difference 0.25 equals, rather than falls below, tolerance.
    assert len(cpt_layers(processed([1, 2], [2.0, 2.25]),
                          settings(merge_ic_tol=0.25)).layers) == 2


def test_minimum_merging_repeats_and_retains_short_record():
    result = cpt_layers(processed([0.1, 0.2, 0.3], [1.5, 3.1, 2.4]),
                        settings(min_thickness=0.5))
    assert len(result.layers) == 1
    assert result.layers[0].bottom == 0.3
    assert result.layers[0].ic_mean == pytest.approx(7 / 3)


@pytest.mark.parametrize("depth,ic,message", [
    ([], [], "at least one sample"),
    ([1], [np.nan], "no finite Ic"),
    ([0], [2], "positive final data depth"),
    ([1, 1], [2, 3], "unique"),
    ([np.nan], [2], "finite"),
    ([1, 2], [2], "aligned"),
])
def test_invalid_inputs(depth, ic, message):
    with pytest.raises(ValueError, match=message):
        cpt_layers(processed(depth, ic), settings())


def test_invalid_ic_preserves_full_extent_and_finite_means():
    result = cpt_layers(processed([1, 2, 3], [np.nan, 1.8, np.inf]), settings())
    assert [(s.top, s.bottom) for s in result.layers] == [(0, 3)]
    assert result.layers[0].ic_mean == 1.8
    assert "layering.warning.invalid_ic" in result.warnings


def test_gamma_is_from_registered_correlation_even_with_profile_gamma():
    p = processed([1, 2], [1.8, 1.9])
    p.gamma = np.array([29.0, 29.0])  # not a correlation suggestion
    expected = evaluate("RC2010_gamma_CPT", {"qt": 1013.25, "fs": 10.1325}).value
    assert cpt_layers(p, settings()).layers[0].gamma_suggested == pytest.approx(expected)


def test_gamma_uses_valid_subset_and_warns():
    p = processed([1, 2], [1.8, 1.9])
    p.qt[1] = 0
    result = cpt_layers(p, settings())
    # Remaining qt=10 Pa and Rf=1%: 9.81*(.36+1.236)=15.65676.
    assert result.layers[0].gamma_suggested == pytest.approx(15.65676)
    assert "layering.warning.gamma_unavailable" in result.warnings


def test_deterministic_sorted_editable_and_settings_copied():
    p = processed([3, 1, 2], [3.1, 1.7, 1.8])
    opts = settings()
    a, b = cpt_layers(p, opts), cpt_layers(p, opts)
    assert asdict(a) == asdict(b)
    a.layers[0].description = "Engineer interpretation"
    a.settings.min_thickness = 9
    assert opts.min_thickness == 0.1
    assert b.layers[0].description != a.layers[0].description
    assert p.depth.tolist() == [3, 1, 2]


def test_wrong_method():
    with pytest.raises(ValueError, match="cpt_ic"):
        cpt_layers(processed([1], [1.8]), LayeringSettings(method="spt_log"))


def test_cpt_csv_service_and_transport_mapping():
    from geotek.api.schemas import LayeringProposal

    source = import_cpt(Path("examples/ornek_cpt.csv"), "CPT", gwt_depth=2.0)
    project = Project(meta=ProjectMeta(name="Layering"),
                      investigations=Investigations(cpts=[source]))
    before = project.model_dump_json()
    opts = LayeringSettings(method="cpt_ic")
    result = propose_layers(project, "CPT", opts)
    assert project.model_dump_json() == before
    assert result.source_id == "CPT" and result.settings == opts
    assert result.layers[0].top == 0
    assert result.layers[-1].bottom == source.depth[-1]
    for a, b in zip(result.layers, result.layers[1:]):
        assert a.bottom == b.top and a.top < b.top
    for layer in result.layers:
        assert layer.bottom > layer.top
        assert (layer.bottom - layer.top >= opts.min_thickness or
                any(w.startswith("layering.warning.thin_retained:") for w in result.warnings))
        assert np.isfinite(layer.ic_mean)
        assert layer.sbtn_zone in range(1, 10)
    assert LayeringProposal.model_validate(result).source_id == "CPT"
    assert asdict(result) == asdict(propose_layers(project, "CPT", opts))


def test_sensitive_zone_exact_review_sample_is_protected():
    # Qtn=8, Fr=.1%: sqrt((3.47-.90309)^2+(-1+1.22)^2) ~=2.57632.
    # Ic bands alone give 5, but 8 < 12*exp(-.14) ~=10.432 => sbtn_zone=1.
    ic = float(soil_behaviour_index(8, 0.1))
    p = processed([0, 1, 2], [1.7, ic, 1.7])
    p.Qtn[1], p.Fr[1] = 8, 0.1
    p.zone[1] = sbtn_zone(8, 0.1, ic)
    assert p.zone[1] == 1 and int(zone_from_ic(ic)) == 5
    result = cpt_layers(p, settings(smoothing_window=10, min_thickness=10,
                                     merge_ic_tol=10))
    # Midpoints .5 and 1.5 bound the protected sensitive sample despite both merges.
    assert [s.sbtn_zone for s in result.layers] == [6, 1, 6]
    assert [(s.top, s.bottom) for s in result.layers] == [(0, .5), (.5, 1.5), (1.5, 2)]
    assert result.layers[1].behaviour == "undrained"
    assumed = [parse_warning(w)[1] for w in result.warnings
               if parse_warning(w)[0] == "layering.warning.behaviour_assumed"]
    assert assumed == [dict(top=.5, bottom=1.5, raw_zone=1,
                            behaviour="undrained", provisional=True)]
    assert all(s.description == "" for s in result.layers)


@pytest.mark.parametrize("fr,zone", [(3, 8), (5, 9)])
def test_enabled_exceptional_zones_survive(fr, zone):
    # At Fr=3/5 the existing denominators are .0068/.0132, so Qtn=1000
    # exceeds 1/denom and assigns the enabled zones 8/9 respectively.
    ic = float(soil_behaviour_index(1000, fr))
    p = processed([0, 1, 2], [1.7, ic, 1.7])
    p.zone[1] = sbtn_zone(1000, fr, ic, include_zones_8_9=True)
    result = cpt_layers(p, settings(min_thickness=10, merge_ic_tol=10))
    assert [s.sbtn_zone for s in result.layers] == [6, zone, 6]
    assert ic < 2.6 and result.layers[1].behaviour == "drained"
    assumed = [parse_warning(w)[1] for w in result.warnings
               if parse_warning(w)[0] == "layering.warning.behaviour_assumed"]
    assert assumed == [dict(top=.5, bottom=1.5, raw_zone=zone,
                            behaviour="drained", provisional=True)]


def test_predrill_discarded_gap_and_trailing_extension_are_reported():
    # Acquisition increment is 1 m; discarding z=3 bridges [2,4] (2>1).
    # First retained z=2 extends to 0; discarded last z=6 extends [5,6].
    result = cpt_layers(processed([2, 3, 4, 5, 6], [1.7, np.nan, 1.7, 1.7, np.nan]),
                        settings())
    assert [(s.top, s.bottom) for s in result.layers] == [(0, 6)]
    assert {"layering.warning.no_data_interval: top=0.0 bottom=2.0",
            "layering.warning.no_data_interval: top=2.0 bottom=4.0",
            "layering.warning.no_data_interval: top=5.0 bottom=6.0"} <= set(result.warnings)


def test_acquisition_gap_exceeding_local_spacing_is_reported():
    # Neighbouring increments are .1 m; [0.1,1] spans .9 m > .1 m.
    result = cpt_layers(processed([0, .1, 1, 1.1], [1.7] * 4), settings())
    assert "layering.warning.no_data_interval: top=0.1 bottom=1.0" in result.warnings


@pytest.mark.parametrize("lens_count", [1, 2])
def test_smoothed_lens_includes_single_samples(lens_count):
    # 11 samples at .1 m. Five-point central windows (width .5) give
    # (4*1.7+3.2)/5=2.0 for one lens sample; (3*1.7+2*3.2)/5=2.3 for two.
    # One lens gives final mean 20.2/11 <2.05 => zone 6. Two lens samples
    # produce a central four-sample zone-5 segment, mean (1.7+3.2+3.2+1.7)/4=2.45.
    # Raw 3.2 is zone 3 (2.95 <= Ic <3.60), lost in both final proposals.
    ic = [1.7] * 11
    ic[5:5 + lens_count] = [3.2] * lens_count
    result = cpt_layers(processed(np.arange(11) / 10, ic),
                        settings(smoothing_window=.5))
    assert [s.sbtn_zone for s in result.layers] == ([6] if lens_count == 1 else [6, 5, 6])
    lens = [parse_warning(w)[1] for w in result.warnings
            if parse_warning(w)[0] == "layering.warning.lens_smoothed"]
    assert len(lens) == 1
    assert dict(top=.5, bottom=.5 if lens_count == 1 else .6, raw_zone=3) in lens[0]["runs"]
    assert any(w.startswith("layering.warning.drainage_transitional:") for w in result.warnings)


def test_exact_single_sample_zone_5_lens_is_reported():
    # Review example: z=0..1 at .1 m, Ic=1.7 except Ic=2.5 at .5 m.
    # Width .5 smooths the single raw zone-5 sample into final zone 6.
    ic = [1.7] * 11
    ic[5] = 2.5
    result = cpt_layers(processed(np.arange(11) / 10, ic), settings(smoothing_window=.5))
    assert [layer.sbtn_zone for layer in result.layers] == [6]
    lens = [parse_warning(w)[1] for w in result.warnings
            if parse_warning(w)[0] == "layering.warning.lens_smoothed"]
    assert lens == [dict(top=0.0, bottom=1.0,
                         runs=[dict(top=.5, bottom=.5, raw_zone=5)])]


def test_lens_runs_aggregate_raw_zones_in_one_warning_per_layer():
    # Whole-record smoothing gives mean 14.2/7 <2.05 (zone 6).
    result = cpt_layers(processed(range(7), [1.7, 2.5, 1.7, 3.2, 1.7, 1.7, 1.7]),
                        settings(smoothing_window=20))
    assert [layer.sbtn_zone for layer in result.layers] == [6]
    lens = [parse_warning(w)[1] for w in result.warnings
            if parse_warning(w)[0] == "layering.warning.lens_smoothed"]
    assert lens == [dict(top=0.0, bottom=6.0, runs=[
        dict(top=1.0, bottom=1.0, raw_zone=5),
        dict(top=3.0, bottom=3.0, raw_zone=3),
    ])]


def test_discarded_samples_break_lens_runs_in_aggregated_warning():
    ic = [1.7] * 11
    ic[4:7] = [2.5, np.nan, 2.5]
    result = cpt_layers(processed(np.arange(11) / 10, ic), settings(smoothing_window=10))
    lens = [parse_warning(w)[1] for w in result.warnings
            if parse_warning(w)[0] == "layering.warning.lens_smoothed"]
    assert lens == [dict(top=0.0, bottom=1.0, runs=[
        dict(top=.4, bottom=.4, raw_zone=5),
        dict(top=.6, bottom=.6, raw_zone=5),
    ])]


def test_lens_warnings_belong_to_each_final_layer():
    ic = [1.7] * 11 + [3.1] * 11
    ic[5], ic[16] = 2.5, 2.7
    depth = np.r_[np.arange(11) / 10, 2 + np.arange(11) / 10]
    result = cpt_layers(processed(depth, ic), settings(smoothing_window=.5))
    assert [layer.sbtn_zone for layer in result.layers] == [6, 3]
    lens = [parse_warning(w)[1] for w in result.warnings
            if parse_warning(w)[0] == "layering.warning.lens_smoothed"]
    assert lens == [
        dict(top=0.0, bottom=1.5, runs=[dict(top=.5, bottom=.5, raw_zone=5)]),
        dict(top=1.5, bottom=3.0, runs=[dict(top=2.5, bottom=2.5, raw_zone=4)]),
    ]


@pytest.mark.parametrize("ic", [1.7, 2.59, 2.6, 3.1])
def test_every_cpt_proposal_warns_about_ic_only_drainage(ic):
    result = cpt_layers(processed([0, 1], [ic, ic]), settings())
    assert result.layers[0].behaviour == ("drained" if ic < 2.6 else "undrained")
    warnings = [parse_warning(w)[1] for w in result.warnings
                if parse_warning(w)[0] == "layering.warning.drainage_ic_based"]
    assert len(warnings) == 1
    message = warnings[0]["message"]
    assert "Ic < 2.6" in message and "Robertson 2009" in message
    assert "confirmed by the engineer for the loading case" in message
    assert not any(parse_warning(w)[0] == "layering.warning.drainage_transitional"
                   for w in result.warnings)


@pytest.mark.parametrize("zone", [8, 9])
@pytest.mark.parametrize("ic,behaviour", [
    ([1.7, 1.7], "drained"), ([3.1, 3.1], "undrained"),
    ([3.1, 1.7], "drained"), ([2.5, 2.9], "undrained"),
])
def test_exceptional_zones_use_mean_ic_and_remain_provisional(zone, ic, behaviour):
    p = processed([0, 1], ic)
    p.zone[:] = zone
    result = cpt_layers(p, settings())
    assert result.layers[0].sbtn_zone == zone
    assert result.layers[0].behaviour == behaviour
    assumed = [parse_warning(w)[1] for w in result.warnings
               if parse_warning(w)[0] == "layering.warning.behaviour_assumed"]
    assert assumed == [dict(top=0.0, bottom=1.0, raw_zone=zone,
                            behaviour=behaviour, provisional=True)]


def test_tolerance_merge_cascade_recomputes_sample_weighted_means():
    # Zones [7,6,6,5]. Merge 1.25 with mean(1.5,1.5): difference .25<.75.
    # New mean 4.25/3; difference to 2.125 is 17/24 <.75, so merge again.
    # Final mean (1.25+1.5+1.5+2.125)/4=1.59375, not a mean of segment means.
    result = cpt_layers(processed([0, 1, 2, 3], [1.25, 1.5, 1.5, 2.125]),
                        settings(merge_ic_tol=.75))
    assert len(result.layers) == 1
    assert result.layers[0].ic_mean == pytest.approx(1.59375)


@pytest.mark.parametrize("ic,zone,behaviour", [(2.60, 4, "undrained"), (2.05, 5, "drained")])
def test_exact_ic_edges(ic, zone, behaviour):
    # zone_from_ic uses strict upper bounds: 2.60 enters 4, 2.05 enters 5.
    # is_sand_like is strictly Ic<2.6, so equality is undrained.
    layer = cpt_layers(processed([0, 1], [ic, ic]), settings()).layers[0]
    assert (layer.sbtn_zone, layer.behaviour) == (zone, behaviour)


def test_cpt_processing_warnings_are_flagged_without_mutation():
    p = processed([0, 1], [1.7, 1.7])
    p.warnings = ["upstream diagnostic"]
    result = cpt_layers(p, settings())
    assert "layering.warning.processing_warnings" in result.warnings
    assert p.warnings == ["upstream diagnostic"]


def test_all_invalid_gamma_is_absent():
    p = processed([0, 1], [1.7, 1.7])
    p.qt[:] = 0
    result = cpt_layers(p, settings())
    assert result.layers[0].gamma_suggested is None
    assert "layering.warning.gamma_unavailable" in result.warnings


def test_thinnest_segment_is_merged_before_upper_thin_segment():
    # Edges [0,.5,1.5,2.2,2.5,3.3,4]: zone thicknesses [1.5,.7,.3,1.5].
    # The .3 segment (Ic=3.25) merges upward into 2.5: distance .75 vs 2.
    # Combined thickness 1 >=.8; mean (2.5+3.25)/2=2.875.
    # Processing the upper .7 first would tie at .75 and absorb it upward instead.
    result = cpt_layers(processed([0, 1, 2, 2.4, 2.6, 4],
                                 [1.75, 1.75, 2.5, 3.25, 1.25, 1.25]),
                        settings(min_thickness=.8))
    assert [s.bottom for s in result.layers] == pytest.approx([1.5, 2.5, 4])
    assert [s.ic_mean for s in result.layers] == pytest.approx([1.75, 2.875, 1.25])
