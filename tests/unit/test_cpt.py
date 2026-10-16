import numpy as np
import pytest

from geotek.core.errors import ProfileError
from geotek.core.models import CPTSounding
from geotek.engine.classification.robertson import sbtn_zone, soil_behaviour_index, zone_from_ic
from geotek.engine.insitu.cpt import (
    corrected_tip_resistance,
    normalise_iterative,
    process_cpt,
    stress_exponent,
)


def test_qt_correction():
    assert corrected_tip_resistance([1000.0], [200.0], 0.8).tolist() == pytest.approx([1040.0])
    assert corrected_tip_resistance([1000.0], None, 0.8).tolist() == [1000.0]


def test_zone_boundaries():
    assert zone_from_ic([1.2, 1.5, 2.3, 2.8, 3.2, 3.8, np.nan]).tolist() == [7, 6, 5, 4, 3, 2, 0]


def test_zone_1_sensitive():
    assert sbtn_zone([3.0], [0.5]).tolist() == [1]


def test_clay_point_hand_calc():
    # qt 800, fs 30, sigma_v 150, sigma' 80 -> n -> 1, Qtn = Qt1 = 8.125, Fr = 4.615
    Qtn, Fr, Ic, n, conv = normalise_iterative(
        np.array([800.0]), np.array([30.0]), np.array([150.0]), np.array([80.0])
    )
    assert conv.all() and n[0] == pytest.approx(1.0)
    assert Qtn[0] == pytest.approx(650 / 80)
    assert Fr[0] == pytest.approx(30 / 650 * 100)
    expected = np.sqrt((3.47 - np.log10(650 / 80)) ** 2 + (np.log10(30 / 650 * 100) + 1.22) ** 2)
    assert Ic[0] == pytest.approx(expected)
    assert zone_from_ic(Ic).tolist() == [3]


def test_sand_point_converges_self_consistently():
    qt, fs = np.array([10000.0, 15000.0]), np.array([50.0, 60.0])
    sv, se = np.array([100.0, 150.0]), np.array([80.0, 110.0])
    Qtn, Fr, Ic, n, conv = normalise_iterative(qt, fs, sv, se)
    assert conv.all()
    assert np.allclose(n, stress_exponent(Ic, se), atol=1e-3)
    assert np.allclose(Ic, soil_behaviour_index(Qtn, Fr))
    assert np.all(Ic < 2.05)  # clean sand region


def test_invalid_points_are_nan():
    Qtn, Fr, Ic, n, conv = normalise_iterative(
        np.array([50.0]), np.array([1.0]), np.array([100.0]), np.array([60.0])
    )
    assert np.isnan(Ic[0]) and conv[0]


def _sounding():
    return CPTSounding(
        id="CPT1", gwt_depth=2.0, depth=[1.0, 2.0, 4.0, 6.0, 8.0],
        qc=[3000, 8000, 12000, 900, 1000], fs=[30, 50, 60, 35, 40], u2=[0, 0, 30, 150, 180],
    )


def test_process_with_profile(two_layer_profile):
    r = process_cpt(_sounding(), two_layer_profile)
    assert r.gamma is None
    assert r.qt[3] == pytest.approx(900 + 150 * 0.2)
    sv, u, se = two_layer_profile.stresses(4.0)
    assert r.sigma_v[2] == pytest.approx(sv)
    assert r.zone[2] in (6, 7) and r.zone[3] in (3, 4)
    df = r.to_dataframe()
    assert {"Ic", "SBTn", "FC", "Bq"} <= set(df.columns)


def test_process_without_profile_uses_cpt_unit_weight():
    r = process_cpt(_sounding())
    assert r.gamma is not None and np.all((r.gamma > 12) & (r.gamma < 23))
    assert r.sigma_v[0] == pytest.approx(r.gamma[0] * 1.0)
    assert r.u0[2] == pytest.approx(2 * 9.81)


def test_profile_too_short(two_layer_profile):
    deep = CPTSounding(id="C", depth=[5.0, 12.0], qc=[1000, 1000], fs=[10, 10])
    with pytest.raises(ProfileError):
        process_cpt(deep, two_layer_profile)
