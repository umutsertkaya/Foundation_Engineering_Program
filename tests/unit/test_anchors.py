"""Ground anchor design: hand calculations and GEC-4 Design Example 1 (Appendix A, A-7..A-9)."""

import math

import pytest
from pydantic import ValidationError
from scipy.optimize import brentq

from geotek.core.errors import GeoTekError
from geotek.core.models.anchors import AnchorDesignInputs
from geotek.engine import anchor_tables as tables
from geotek.engine.anchors import (
    MissingAnchorInputsError,
    design_anchor,
    inputs_hash,
    missing_inputs,
    wedge_geometry,
)


def make(**overrides):
    """GEC-4 Example 1 lower anchor: T_h = 172 kN/m, s = 2.5 m, 15 deg, q_u = 100 kN/m, FS 2."""
    data = dict(
        excavation_height=10.0, head_depth=6.25, inclination_deg=15.0, phi_deg=33.0,
        horizontal_load_per_m=172.0, spacing=2.5, ultimate_transfer_load=100.0,
        safety_factor=2.0, lock_off_ratio=1.0, tendon={"type": "strand"},
    )
    data.update(overrides)
    return AnchorDesignInputs(**data)


def test_gec4_example1_design_load_and_bond_length():
    # A-7: DL2 = 172 kN/m * 2.5 m / cos 15 deg = 445 kN; A-9: L_b = 445 * 2.0 / 100 = 8.9 m
    r = design_anchor(make())
    assert r.design_load == pytest.approx(172 * 2.5 / math.cos(math.radians(15)), rel=1e-12)
    assert r.design_load == pytest.approx(445, abs=0.5)
    assert r.bond_length_calculated == pytest.approx(8.9, abs=0.01)
    # A-13: vertical force of the lower anchor 445 * sin 15 deg = 115 kN
    assert r.vertical_load_per_anchor == pytest.approx(115, abs=0.5)
    assert r.vertical_load_per_m == pytest.approx(r.vertical_load_per_anchor / 2.5)
    # A-15: test load 1.33 DL
    assert r.test_load == pytest.approx(1.33 * r.design_load)
    # allowable bond capacity of the 8.9 m bond equals the design load
    assert r.bond_capacity == pytest.approx(r.design_load)


def test_gec4_example1_tendons():
    strand = design_anchor(make()).tendon
    assert strand.count == 3  # A-9: 3 strands, 0.6 SMTS = 469 kN
    assert 0.6 * strand.smts_total == pytest.approx(469, abs=0.5)
    assert strand.area_total_mm2 == pytest.approx(420)  # Table 10, 3 strands
    bar = design_anchor(make(tendon={"type": "bar"})).tendon
    assert bar.label.startswith("32 mm bar, Grade 150")  # A-9: 32 mm Gr 150, 501 kN
    assert 0.6 * bar.smts_total == pytest.approx(501, abs=0.5)


def test_wedge_geometry_matches_independent_intersection():
    inp = make()
    x, length = wedge_geometry(inp)
    a = math.radians(15)
    beta = math.radians(45 + 33 / 2)  # failure surface from the base corner
    # surface: depth = H - x*tan(beta); anchor line: depth = z_h + x*tan(a)
    root = brentq(lambda s: 10 - s * math.tan(beta) - (6.25 + s * math.tan(a)), 0, 10)
    assert x == pytest.approx(root, rel=1e-9)
    assert length == pytest.approx(root / math.cos(a), rel=1e-9)
    # hand value: k = tan(28.5 deg) = 0.54296; 3.75*k/(1+k*tan 15) = 1.7776
    assert x == pytest.approx(1.7776, abs=1e-3)


def test_free_length_rules_and_governing():
    # head at 2.5 m: long wedge, 0.2H = 2 m > 1.5 m
    r = design_anchor(make(head_depth=2.5))
    x, length = wedge_geometry(make(head_depth=2.5))
    assert r.beyond_wedge == pytest.approx(2.0)
    assert r.free_length_required == pytest.approx(length + 2.0)
    assert r.free_length == pytest.approx(length + 2.0)
    assert r.free_length_governing == "wedge"
    # low anchor: short wedge, 4.5 m strand minimum governs
    low = design_anchor(make())
    assert low.free_length == pytest.approx(4.5) and low.free_length_governing == "minimum"
    bar = design_anchor(make(tendon={"type": "bar"}))
    assert bar.free_length_minimum == 3.0
    assert bar.free_length == pytest.approx(max(3.0, bar.free_length_required))
    short = design_anchor(make(excavation_height=4.0, head_depth=1.0))
    assert short.beyond_wedge == pytest.approx(1.5)  # 0.2 * 4 = 0.8 < 1.5
    explicit = design_anchor(make(head_depth=2.5, beyond_wedge=3.0, min_free_length=1.0))
    assert explicit.free_length == pytest.approx(explicit.wedge_length + 3.0)


def test_bond_stress_route_equals_direct_transfer_load():
    # q_u = pi d tau = pi * 0.15 * 212.2 kPa
    tau = 100 / (math.pi * 0.15)
    a = design_anchor(make(ultimate_transfer_load=None, ultimate_bond_stress=tau, hole_diameter=0.15))
    b = design_anchor(make())
    assert a.transfer_load == pytest.approx(100) and a.transfer_load_source == "bond_stress"
    assert a.bond_length == pytest.approx(b.bond_length)


def test_min_bond_length_and_warnings():
    r = design_anchor(make(min_bond_length=10.0))
    assert r.bond_length == 10.0 and r.bond_length_governing == "minimum"
    assert r.bond_capacity == pytest.approx(10 * 100 / 2)
    long = design_anchor(make(ultimate_transfer_load=30.0, max_bond_length=10.0))
    codes = {w.code for w in long.warnings}
    assert {"bond_length_exceeds_typical", "bond_length_exceeds_limit"} <= codes
    steep = design_anchor(make(inclination_deg=50.0))
    assert "inclination_outside_range" in {w.code for w in steep.warnings}


def test_overburden_check():
    shallow = design_anchor(make(excavation_height=3.0, head_depth=0.5, inclination_deg=10.0,
                                 horizontal_load_per_m=20.0, ultimate_transfer_load=200.0))
    centre = 0.5 + (shallow.free_length + shallow.bond_length / 2) * math.sin(math.radians(10))
    assert shallow.bond_centre_depth == pytest.approx(centre)
    row = next(c for c in shallow.checks if c.id == "overburden")
    assert not row.ok and "overburden_low" in {w.code for w in shallow.warnings}
    assert next(c for c in design_anchor(make()).checks if c.id == "overburden").ok


def test_strand_count_follows_the_governing_limit():
    # one strand SMTS 260.7: design limit 156.4, lock-off 182.5, test 208.6
    r = design_anchor(make(horizontal_load_per_m=None, spacing=None, axial_load=156.0))
    assert r.tendon.count == 1 and r.tendon.count_governing == "design"
    assert design_anchor(make(horizontal_load_per_m=None, spacing=None, axial_load=157.0)).tendon.count == 2
    # test load 1.33*150 = 199.5 < 208.6 but a stricter test limit makes the test load govern
    r = design_anchor(make(horizontal_load_per_m=None, spacing=None, axial_load=150.0,
                           test_limit=0.70, design_limit=0.65))
    assert r.tendon.count == 2 and r.tendon.count_governing == "test"
    # lock-off above the design load (e.g. landslide stabilisation) can govern
    r = design_anchor(make(horizontal_load_per_m=None, spacing=None, axial_load=100.0,
                           lock_off_ratio=1.5, lock_off_limit=0.5, test_limit=0.9, design_limit=0.9))
    assert r.tendon.count == 2 and r.tendon.count_governing == "lock_off"
    assert r.lock_off_load == pytest.approx(150.0)


def test_tendon_selection_errors_and_custom():
    with pytest.raises(GeoTekError, match="at least 3"):
        design_anchor(make(tendon={"type": "strand", "count": 2}))
    assert design_anchor(make(tendon={"type": "strand", "count": 4})).tendon.count_governing == "user"
    with pytest.raises(GeoTekError, match="exceeds the design load limit"):
        design_anchor(make(tendon={"type": "bar", "library_id": "bar_150_26"}))
    with pytest.raises(GeoTekError, match="Unknown"):
        design_anchor(make(tendon={"type": "bar", "library_id": "nope"}))
    with pytest.raises(GeoTekError, match="Unknown"):  # a bar id is not a strand
        design_anchor(make(tendon={"type": "strand", "library_id": "bar_150_32"}))
    with pytest.raises(GeoTekError, match="No library bar"):
        design_anchor(make(horizontal_load_per_m=2000.0, tendon={"type": "bar"}))
    custom = design_anchor(make(tendon={"type": "bar", "custom_smts_kn": 900.0, "custom_area_mm2": 850.0}))
    assert custom.tendon.type == "custom" and custom.tendon.source == "user input"
    assert custom.tendon.smts_total == 900.0 and custom.tendon.count == 1
    big = design_anchor(make(horizontal_load_per_m=3000.0, spacing=2.5, ultimate_transfer_load=1000.0))
    assert big.tendon.count > 19 and "strand_count_beyond_table" in {w.code for w in big.warnings}


def test_missing_engineering_inputs_are_listed_not_assumed():
    bare = make(safety_factor=None, ultimate_transfer_load=None, lock_off_ratio=None)
    assert missing_inputs(bare) == [
        "safety_factor", "ultimate_transfer_load|ultimate_bond_stress", "lock_off_ratio"]
    with pytest.raises(MissingAnchorInputsError) as caught:
        design_anchor(bare)
    assert caught.value.missing == missing_inputs(bare)
    only_stress = make(ultimate_transfer_load=None, ultimate_bond_stress=200.0)
    assert missing_inputs(only_stress) == ["hole_diameter"]


def test_input_validation():
    for bad in (
        dict(horizontal_load_per_m=None, spacing=None),                    # no load
        dict(axial_load=400.0),                                            # both loads
        dict(spacing=None),                                                # horizontal needs spacing
        dict(horizontal_load_per_m=None, axial_load=400.0),                # spacing with axial
        dict(head_depth=10.0),                                             # head at the base
        dict(ultimate_bond_stress=100.0, hole_diameter=0.1),               # both transfer forms
        dict(min_bond_length=9.0, max_bond_length=8.0),
        dict(safety_factor=1.0),
        dict(tendon={"type": "bar", "count": 2}),
        dict(tendon={"type": "bar", "library_id": "bar_150_32", "custom_smts_kn": 500.0}),
        dict(tendon={"type": "bar", "custom_area_mm2": 500.0}),
        dict(inclination_deg=90.0),
    ):
        with pytest.raises(ValidationError):
            make(**bad)


def test_axial_load_input_and_assumptions_are_visible():
    r = design_anchor(make(horizontal_load_per_m=None, spacing=None, axial_load=445.0))
    assert r.load_source == "axial" and r.design_load == 445.0
    assert r.horizontal_load_per_anchor == pytest.approx(445 * math.cos(math.radians(15)))
    assert r.vertical_load_per_m is None
    codes = {a.code for a in r.assumptions}
    assert {"beyond_wedge_default", "min_free_length_default", "wedge_origin_at_corner",
            "level_ground_vertical_wall"} <= codes
    assert r.sources


def test_inputs_hash_tracks_changes():
    assert inputs_hash(make()) == inputs_hash(make())
    assert inputs_hash(make()) != inputs_hash(make(safety_factor=2.5))


def test_library_tables_match_gec4():
    strand = tables.TENDON_BY_ID[tables.STRAND_15MM_ID]
    assert (strand.smts_kn, strand.area_mm2) == (260.7, 140.0)
    # 0.6 SMTS column of Table 9 (p. 77)
    expected = {"bar_150_26": 341, "bar_150_32": 501, "bar_150_36": 633, "bar_150_45": 1068,
                "bar_150_64": 2077, "bar_160_26": 363, "bar_160_32": 534, "bar_160_36": 675}
    for key, value in expected.items():
        assert 0.6 * tables.TENDON_BY_ID[key].smts_kn == pytest.approx(value, abs=1.0)
    assert all(t.source.startswith("FHWA GEC-4") for t in tables.TENDONS)
    assert all(t.source.startswith("FHWA GEC-4") for t in tables.TRANSFER_LOADS)
    assert tables.TENDON_BY_ID["bar_150_32"].smts_kn == 835.0
    assert next(t for t in tables.TRANSFER_LOADS if t.id == "sand_loose").q_u_kn_per_m == 100
