"""Warning transport and acquisition-gap reporting rules (not soil thresholds)."""

import numpy as np
import pytest

from geotek.engine.layering.common import format_warning, parse_warning, warn_no_data


@pytest.mark.parametrize("params", [
    {},
    dict(top=0.0, bottom=1.0, raw_zone=5),
    dict(behaviour="drained", provisional=True, missing=None),
    dict(depths=[1.0, 2.0], runs=[dict(top=.5, bottom=.5, raw_zone=5)]),
    dict(message='Engineer review: Ic < 2.6, key=value, "quoted"; hassas ince daneli'),
    dict(message="C:\\logs\\test\nnext line", empty="", false=False),
])
def test_warning_format_round_trip_preserves_code_and_typed_params(params):
    code = "layering.warning.example"
    message = format_warning(code, **params)
    parsed_code, parsed_params = parse_warning(message)
    assert (parsed_code, parsed_params) == (code, params)
    assert format_warning(parsed_code, **parsed_params) == message


def test_warning_format_is_uniform_compact_json():
    assert format_warning("layering.warning.example", top=0.0, depths=[1.0, 2.0],
                          provisional=True, behaviour="drained") == (
        'layering.warning.example: top=0.0 depths=[1.0,2.0] '
        'provisional=true behaviour="drained"')


@pytest.mark.parametrize("message", [
    "", "bad code", ": top=0", "code:", "code: ", "code:top=0",
    "code: top=", "code: top=0top=1", "code: top=0 top=1",
    "code: bad-key=0", "code: top=0 ", "code: text=unquoted",
])
def test_warning_parser_rejects_malformed_context(message):
    with pytest.raises(ValueError):
        parse_warning(message)


@pytest.mark.parametrize("depth,expected", [
    ([0, 100], []),  # No reference increment, regardless of separation.
    ([5, 100], [(0, 5)]),  # Still report the unsupported surface extension.
    ([0, 1, 100], [(1, 100)]),  # A third observation supplies reference spacing.
    ([0, 1, 11, 31], [(1, 11), (11, 31)]),  # Use the smaller local neighbour.
])
def test_internal_gap_requires_independent_local_spacing(depth, expected):
    warnings = []
    warn_no_data(np.asarray(depth, dtype=float), warnings)
    assert [parse_warning(w) for w in warnings] == [
        ("layering.warning.no_data_interval", dict(top=float(a), bottom=float(b)))
        for a, b in expected
    ]
