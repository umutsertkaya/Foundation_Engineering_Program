import numpy as np
import pytest

from geotek.core.models import Borehole, SPTRecord
from geotek.engine.insitu.spt import (
    borehole_diameter_factor,
    overburden_factor_liao_whitman,
    process_borehole,
    rod_length_factor,
    sampler_factor,
)


def test_equipment_factors():
    assert rod_length_factor([2.0, 3.5, 5.0, 8.0, 12.0]).tolist() == [0.75, 0.75, 0.85, 0.95, 1.0]
    assert borehole_diameter_factor(100) == 1.0
    assert borehole_diameter_factor(150) == 1.05
    assert borehole_diameter_factor(200) == 1.15
    assert sampler_factor("standard") == 1.0
    assert sampler_factor("no_liner", 1.1) == 1.1
    with pytest.raises(ValueError):
        sampler_factor("no_liner", 1.5)


def test_cn_cap():
    assert overburden_factor_liao_whitman(101.325) == pytest.approx(1.0)
    assert overburden_factor_liao_whitman(10.0) == pytest.approx(1.7)


def test_process_borehole_hand_calc(two_layer_profile):
    bh = Borehole(id="SK1", energy_ratio=60, spt=[
        SPTRecord(depth=1.5, n_field=10), SPTRecord(depth=5.0, n_field=20, refusal=True),
    ])
    r = process_borehole(bh, two_layer_profile)
    # 1.5 m: C_R 0.75 -> N60 7.5; sigma' 27 kPa -> C_N capped at 1.7
    assert r.n60[0] == pytest.approx(7.5)
    assert r.c_n[0] == pytest.approx(1.7)
    assert r.n1_60[0] == pytest.approx(12.75)
    # 5.0 m: C_R 0.85 -> N60 17; sigma' = 95 - 3*9.81
    sigma_eff = 95.0 - 3 * 9.81
    assert r.n60[1] == pytest.approx(17.0)
    assert r.n1_60[1] == pytest.approx(17.0 * np.sqrt(101.325 / sigma_eff))
    assert "insitu.warning.spt_refusal: count=1 depths=\"5\"" in r.warnings
    assert list(r.to_dataframe().columns)[:3] == ["depth", "N", "refusal"]


def test_energy_ratio_scaling(two_layer_profile):
    bh = Borehole(id="SK2", energy_ratio=80, spt=[SPTRecord(depth=12.0 - 2.5, n_field=30)])
    r = process_borehole(bh, two_layer_profile)
    assert r.n60[0] == pytest.approx(30 * 80 / 60 * 0.95)


@pytest.mark.parametrize("lang", ["tr", "en"])
def test_spt_warnings_are_translatable_codes(two_layer_profile, lang):
    from geotek.core.warning_codes import parse_warning
    from geotek.i18n import t

    bh = Borehole(id="SK3", spt=[SPTRecord(depth=2.5, n_field=50, refusal=True),
                                 SPTRecord(depth=4.0, n_field=50, refusal=True)])
    r = process_borehole(bh, two_layer_profile)
    code, params = parse_warning(r.warnings[0])
    assert (code, params) == ("insitu.warning.spt_refusal", {"count": 2, "depths": "2.5, 4"})
    text = t(code, lang, **params)
    assert text != code and "2.5, 4" in text and "{" not in text


def test_rod_length_factor_below_4_m_is_0_75():
    # Youd et al. (2001) Table 2 / Seed et al. (1985), Skempton (1986): rods shorter than 4 m -> 0.75
    assert rod_length_factor([1.0, 3.0, 3.5, 3.99]).tolist() == [0.75] * 4
    assert rod_length_factor([4.0, 6.0, 10.0]).tolist() == [0.85, 0.95, 1.0]


def test_n_from_blows_and_refusal():
    from geotek.engine.insitu.spt import is_refusal, n_from_blows

    assert n_from_blows([8, 11, 11]) == 22
    assert not is_refusal([8, 11, 11])
    assert is_refusal([10, 30, 50])


def test_blows_must_match_n():
    with pytest.raises(ValueError):
        SPTRecord(depth=1.3, n_field=20, blows=[8, 11, 11])
    SPTRecord(depth=1.3, n_field=22, blows=[8, 11, 11])
    SPTRecord(depth=1.3, n_field=50, blows=[10, 50, 0], refusal=True)


def test_record_equipment_overrides_borehole_and_assumptions_are_visible(two_layer_profile):
    from geotek.core.warning_codes import parse_warning

    bh = Borehole(id="SK4", spt=[
        SPTRecord(depth=5.0, n_field=20, energy_ratio=55, rod_length=6.0, borehole_diameter_mm=100,
                  sampler="standard"),
        SPTRecord(depth=7.0, n_field=20),
    ])
    r = process_borehole(bh, two_layer_profile)
    # record 1: ER 55, rod 6 m -> C_R 0.95: N60 = 20 * 55/60 * 0.95
    assert r.n60[0] == pytest.approx(20 * 55 / 60 * 0.95)
    # record 2: ER not stated -> 60 %, rod = depth (7 m) -> 0.95
    assert r.n60[1] == pytest.approx(20 * 0.95)
    assert r.energy_ratio.tolist() == [55.0, 60.0]
    codes = {parse_warning(w)[0]: parse_warning(w)[1] for w in r.warnings}
    assert codes["insitu.warning.spt_energy_ratio_assumed"]["count"] == 1
    assert codes["insitu.warning.spt_rod_length_assumed"]["count"] == 1
    explicit = Borehole(id="SK5", energy_ratio=60, spt=[SPTRecord(depth=5.0, n_field=20, rod_length=6.0)])
    assert not process_borehole(explicit, two_layer_profile).warnings
