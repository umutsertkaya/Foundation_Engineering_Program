"""Hand calculations, boundary choices and service integration for CPT layering."""

from dataclasses import asdict, fields
from pathlib import Path

import numpy as np
import pytest

from geotek.core.models.investigations import Investigations
from geotek.core.models.profile import LayeringSettings
from geotek.core.models.project import Project, ProjectMeta
from geotek.engine.correlations.registry import evaluate
from geotek.engine.insitu.cpt import CPTProcessed
from geotek.engine.layering import cpt_layers
from geotek.io.tabular import import_cpt
from geotek.services.layering import propose_layers


def processed(depth, ic):
    """Only Ic, qt and fs feed layering; unused processing fields are inert arrays."""
    z = np.asarray(depth, dtype=float)
    data = {f.name: np.zeros(len(z)) for f in fields(CPTProcessed)}
    data.update(sounding_id="C", depth=z, Ic=np.asarray(ic, dtype=float),
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
    assert result.warnings == ["layering.warning.similar_merged"]
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


def test_nonfinite_gamma_is_not_suggested():
    p = processed([1, 2], [1.8, 1.9])
    p.qt[1] = 0
    result = cpt_layers(p, settings())
    assert result.layers[0].gamma_suggested is None
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
        assert layer.bottom - layer.top >= opts.min_thickness
        assert np.isfinite(layer.ic_mean)
        assert layer.sbtn_zone in range(2, 8)
    assert LayeringProposal.model_validate(result).source_id == "CPT"
    assert asdict(result) == asdict(propose_layers(project, "CPT", opts))
