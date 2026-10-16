"""Unit conversion at the I/O and UI boundary.

The engine always works in SI base units: m, kPa, kN/m3, kN, degrees.
Each unit is defined by its factor to the base unit of its dimension.
"""

from __future__ import annotations

import numpy as np

from geotek.core.errors import UnitError

# dimension -> {unit symbol: factor to base unit}
_UNITS: dict[str, dict[str, float]] = {
    "length": {  # base: m
        "m": 1.0,
        "cm": 0.01,
        "mm": 0.001,
        "ft": 0.3048,
        "in": 0.0254,
    },
    "stress": {  # base: kPa
        "kPa": 1.0,
        "Pa": 0.001,
        "MPa": 1000.0,
        "kgf/cm2": 98.0665,
        "bar": 100.0,
        "tsf": 95.7605,
        "psf": 0.0478803,
        "psi": 6.89476,
        "atm": 101.325,
    },
    "unit_weight": {  # base: kN/m3
        "kN/m3": 1.0,
        "pcf": 0.157087,
        "tf/m3": 9.80665,
    },
    "force": {  # base: kN
        "kN": 1.0,
        "N": 0.001,
        "MN": 1000.0,
        "tf": 9.80665,
        "kip": 4.44822,
    },
}

_LOOKUP: dict[str, tuple[str, float]] = {
    symbol: (dim, factor) for dim, units in _UNITS.items() for symbol, factor in units.items()
}


def dimension_of(unit: str) -> str:
    try:
        return _LOOKUP[unit][0]
    except KeyError:
        raise UnitError(f"Unknown unit: {unit!r}") from None


def units_for(dimension: str) -> list[str]:
    try:
        return list(_UNITS[dimension])
    except KeyError:
        raise UnitError(f"Unknown dimension: {dimension!r}") from None


def convert(value, from_unit: str, to_unit: str):
    """Convert a scalar or array between two units of the same dimension."""
    dim_from, f_from = _LOOKUP.get(from_unit, (None, None))
    dim_to, f_to = _LOOKUP.get(to_unit, (None, None))
    if dim_from is None:
        raise UnitError(f"Unknown unit: {from_unit!r}")
    if dim_to is None:
        raise UnitError(f"Unknown unit: {to_unit!r}")
    if dim_from != dim_to:
        raise UnitError(f"Cannot convert {dim_from} ({from_unit}) to {dim_to} ({to_unit})")
    factor = f_from / f_to
    if isinstance(value, (list, tuple)):
        return (np.asarray(value, dtype=float) * factor).tolist()
    return value * factor


def to_si(value, unit: str):
    """Convert to the internal SI base unit of the unit's dimension."""
    dim = dimension_of(unit)
    base = next(iter(_UNITS[dim]))
    return convert(value, unit, base)
