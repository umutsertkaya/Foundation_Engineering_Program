"""Proposal conversion requires explicit missing weights and preserves provenance."""

from dataclasses import asdict

import pytest

from geotek.core.models.profile import LayeringSettings
from geotek.engine.layering import Layer, Proposal, proposal_to_layers


def proposal(weights):
    return Proposal(
        source_id="source", settings=LayeringSettings(method="cpt_ic"), warnings=[],
        layers=[Layer(
            top=float(i), bottom=float(i + 1), description=f"Layer {i}", uscs="CL",
            sbtn_zone=4, ic_mean=2.8, n60_mean=None, gamma_suggested=weight,
            behaviour="undrained",
        ) for i, weight in enumerate(weights)],
    )


def test_conversion_maps_valid_fields_without_approving_design_values():
    result = proposal([18.5, None])
    before = asdict(result)
    layers = proposal_to_layers(result, id_prefix="soil-", gamma={1: (19, 21)})
    assert [layer.id for layer in layers] == ["soil-1", "soil-2"]
    # No gamma_sat suggestion: it stays unset instead of silently equalling gamma.
    assert [(layer.gamma, layer.gamma_sat) for layer in layers] == [(18.5, None), (19, 21)]
    for layer, proposed in zip(layers, result.layers):
        for field in ("top", "bottom", "description", "uscs", "sbtn_zone", "behaviour"):
            assert getattr(layer, field) == getattr(proposed, field)
        assert layer.source_ids == [result.source_id]
        assert layer.params == {} and layer.selections == {}
        assert layer.design.model_fields_set == set()
        assert layer.permeability is None and layer.liquefiable is None
        assert layer.residual_su is None
    assert asdict(result) == before
    assert [layer.model_dump() for layer in layers] == [
        layer.model_dump() for layer in
        proposal_to_layers(result, id_prefix="soil-", gamma={1: (19, 21)})
    ]
    layers[0].source_ids.append("other")
    assert layers[1].source_ids == ["source"]


@pytest.mark.parametrize("gamma,missing", [
    (None, [0, 2, 3]),
    ({}, [0, 2, 3]),
    ({2: (19, 21)}, [0, 3]),
])
def test_conversion_lists_all_missing_zero_based_indices(gamma, missing):
    result = proposal([None, 18, None, None])
    with pytest.raises(ValueError) as error:
        proposal_to_layers(result, id_prefix="L", gamma=gamma)
    assert str(error.value) == f"Missing gamma for layer indices: {missing}"


def test_suggested_weights_take_precedence_over_supplied_weights():
    layers = proposal_to_layers(proposal([18]), id_prefix="CPT-", gamma={0: (20, 22)})
    assert layers[0].gamma == 18 and layers[0].gamma_sat is None


def test_suggested_saturated_weight_is_converted_with_the_suggested_weight():
    result = proposal([18])
    result.layers[0].gamma_sat_suggested = 19.5
    layers = proposal_to_layers(result, id_prefix="CPT-", gamma={0: (20, 22)})
    assert (layers[0].gamma, layers[0].gamma_sat) == (18, 19.5)


def test_suggested_weights_need_no_gamma_dictionary():
    assert proposal_to_layers(proposal([18]), id_prefix="L")[0].gamma == 18


def test_explicit_none_saturated_weight_stays_unset():
    layers = proposal_to_layers(proposal([None]), id_prefix="L", gamma={0: (19, None)})
    assert layers[0].gamma == 19 and layers[0].gamma_sat is None


def test_missing_soil_classification_is_preserved():
    result = proposal([18])
    result.layers[0].uscs = result.layers[0].sbtn_zone = None
    layer = proposal_to_layers(result, id_prefix="L")[0]
    assert layer.uscs is None and layer.sbtn_zone is None


def test_empty_proposal_converts_to_empty_list():
    assert proposal_to_layers(proposal([]), id_prefix="L") == []
