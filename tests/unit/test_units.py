import pytest

from geotek.core.errors import UnitError
from geotek.core.units import convert, to_si


def test_stress_conversions():
    assert convert(1.0, "MPa", "kPa") == pytest.approx(1000.0)
    assert convert(1.0, "tsf", "kPa") == pytest.approx(95.7605)
    assert convert(1.0, "kgf/cm2", "kPa") == pytest.approx(98.0665)
    assert to_si(2.5, "MPa") == pytest.approx(2500.0)


def test_list_conversion_and_roundtrip():
    assert convert([1.0, 2.0], "ft", "m") == pytest.approx([0.3048, 0.6096])
    assert convert(convert(123.4, "pcf", "kN/m3"), "kN/m3", "pcf") == pytest.approx(123.4)


def test_incompatible_and_unknown_units():
    with pytest.raises(UnitError):
        convert(1.0, "m", "kPa")
    with pytest.raises(UnitError):
        convert(1.0, "furlong", "m")


def test_area_spelled_stress_aliases():
    from geotek.core.units import convert
    assert convert(5000.0, "kN/m2", "kPa") == 5000.0
    assert convert(1.0, "kN/m²", "MPa") == 0.001
    assert abs(convert(1.0, "tf/m2", "kPa") - 9.80665) < 1e-12
