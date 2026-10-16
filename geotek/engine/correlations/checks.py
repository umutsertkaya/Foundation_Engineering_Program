"""Reusable validity checks for correlations. Each returns a list of warning strings."""

from __future__ import annotations

from collections.abc import Mapping


def _value(inputs: Mapping[str, float], name: str):
    v = inputs.get(name)
    return None if v is None or v != v else v  # treat NaN as missing


def sand_like(inputs, opts) -> list[str]:
    ic = _value(inputs, "Ic")
    if ic is not None and ic >= 2.6:
        return [f"I_c = {ic:.2f} >= 2.6: correlation is for sand-like (drained) soils"]
    return []


def clay_like(inputs, opts) -> list[str]:
    ic = _value(inputs, "Ic")
    if ic is not None and ic < 2.6:
        return [f"I_c = {ic:.2f} < 2.6: correlation is for clay-like (undrained) soils"]
    return []


def in_range(name: str, low: float | None, high: float | None):
    """Warn when input or option ``name`` lies outside [low, high]."""

    def check(inputs, opts) -> list[str]:
        v = _value(inputs, name)
        if v is None:
            v = opts.get(name)
        if v is None:
            return []
        if (low is not None and v < low) or (high is not None and v > high):
            return [f"{name} = {v:g} outside the range {low}-{high}"]
        return []

    return check


def all_of(*checks):
    def check(inputs, opts) -> list[str]:
        return [w for c in checks for w in c(inputs, opts)]

    return check
