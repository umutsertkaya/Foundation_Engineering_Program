"""Unit-weight suggestions (HS-E E2): hand calculations, source priority and SPT/Bowles rules."""

import pytest

from geotek.engine.layering.common import Layer, parse_warning
from geotek.engine.layering.unit_weight import suggest_unit_weights


def layer(top, bottom, uscs=None):
    return Layer(top=top, bottom=bottom, description="", uscs=uscs, sbtn_zone=None,
                 ic_mean=None, n60_mean=None, gamma_suggested=None, behaviour="drained")


def suggest(layers, *, gwt=None, lab=(), cpt=(), spt=(), supplied=None):
    return suggest_unit_weights(layers, gwt=gwt, lab=list(lab), cpt_points=list(cpt),
                                spt_points=list(spt), supplied=supplied)


def codes(warnings):
    return [parse_warning(w)[0] for w in warnings]


def test_bowles_hand_example_single_sand_layer():
    """N60 = 15 at 3 m in SP 0-6 m, no groundwater table (Bowles 1996 Table 3-4).

    Start gamma = 18: sigma'v = 18 * 3 = 54 kPa, C_N = sqrt(101.325/54) = 1.3698 (cap 1.7 not
    reached), N'70 = 15 * 60/70 * 1.3698 = 17.61. Classes containing 17.61: medium (7-25,
    17-20) and dense (16-45, 17-22) -> range 17-22 -> middle 19.5. Second step: gamma = 19.5,
    sigma'v = 58.5, C_N = 1.3161, N'70 = 16.92 -> same classes -> 19.5, change 0 < 0.01.
    """
    [result], warnings = suggest([layer(0, 6, "SP")], spt=[(3.0, 15.0)])
    assert result.gamma == pytest.approx(19.5)
    assert result.gamma_sat == pytest.approx(19.5)
    assert result.gamma_source == result.gamma_sat_source == "spt_bowles"
    assert result.range == (17.0, 22.0)
    assert codes(warnings) == ["layering.warning.gwt_unknown_for_gamma"]


def test_bowles_uses_user_supplied_upper_layer_for_stress():
    """Layer 1 is the user's (20, 20); layer 2 SP 3-6 m has N60 = 10 at 5 m, no table.

    Trial gamma = 18: sigma'v = 20*3 + 18*2 = 96, C_N = sqrt(101.325/96) = 1.0273,
    N'70 = 10*60/70*1.0273 = 8.805 -> loose (3-9, 14-18) and medium (7-25, 17-20) -> 14-20 -> 17.
    Trial 17: sigma'v = 60 + 34 = 94, N'70 = 8.899 -> same classes -> 17.0.
    """
    results, _ = suggest([layer(0, 3, "CL"), layer(3, 6, "SP")], spt=[(5.0, 10.0)],
                         supplied={0: (20.0, 20.0)})
    assert (results[0].gamma, results[0].gamma_source) == (20.0, "user")
    assert results[1].gamma == pytest.approx(17.0)
    assert results[1].range == (14.0, 20.0)


def test_bowles_below_groundwater_uses_buoyant_weight_and_reports_non_convergence():
    """SP 0-6 m, table at 2 m, N60 = 15 at 5 m. sigma'v = 2*g + 3*(g - 9.81).

    g = 18: 60.57 kPa, C_N = 1.2934, N'70 = 16.63 -> medium+dense -> 19.5.
    g = 19.5: 68.07 kPa, C_N = 1.2201, N'70 = 15.69 (< 16, dense not reached) -> medium -> 18.5.
    g = 18.5: 63.07 kPa, N'70 = 16.30 -> medium+dense -> 19.5 again: the table is discontinuous
    at N'70 = 16, the iteration oscillates and the 50-step limit is reported.
    """
    [result], warnings = suggest([layer(0, 6, "SP")], gwt=2.0, spt=[(5.0, 15.0)])
    assert result.gamma in (pytest.approx(18.5), pytest.approx(19.5))
    assert "layering.warning.gamma_not_converged" in codes(warnings)
    assert "layering.warning.gwt_unknown_for_gamma" not in codes(warnings)


def test_clay_layer_gets_no_spt_unit_weight():
    [result], warnings = suggest([layer(0, 4, "CH")], spt=[(2.0, 12.0)])
    assert result.gamma is None and result.gamma_sat is None
    assert codes(warnings) == ["layering.warning.spt_gamma_granular_only"]
    [unknown], warnings = suggest([layer(0, 4, None)], spt=[(2.0, 12.0)])
    assert unknown.gamma is None
    assert codes(warnings) == ["layering.warning.spt_gamma_granular_only"]


def test_missing_upper_layer_blocks_lower_spt_suggestion():
    results, warnings = suggest([layer(0, 3, "CL"), layer(3, 6, "SP")], spt=[(5.0, 10.0)])
    assert results[1].gamma is None
    assert "layering.warning.gamma_above_missing" in codes(warnings)


def test_source_priority_lab_then_phase_then_cpt_then_spt():
    """Layer 0-6 with every source: gamma from lab (mean 17.5), gamma_sat from phase relations.

    Phase (S = 1): w = 30 %, Gs = 2.70 -> e = 0.30 * 2.70 = 0.81,
    gamma_sat = (2.70 + 0.81) * 9.81 / 1.81 = 19.02 kN/m3.
    """
    lab = [(1.0, 17.0, None, None), (2.0, 18.0, 30.0, 2.70)]
    cpt = [(1.0, 16.0), (4.0, 21.0)]
    [result], _ = suggest([layer(0, 6, "SP")], gwt=3.0, lab=lab, cpt=cpt, spt=[(3.0, 15.0)])
    assert (result.gamma, result.gamma_source) == (pytest.approx(17.5), "lab")
    assert (result.gamma_sat, result.gamma_sat_source) == (pytest.approx(19.02, abs=0.005), "phase")
    assert result.range is None

    # Without w/Gs the measured gamma is also gamma_sat.
    [no_phase], _ = suggest([layer(0, 6, "SP")], gwt=3.0, lab=[(1.0, 17.0, None, None)], cpt=cpt)
    assert (no_phase.gamma_sat, no_phase.gamma_sat_source) == (17.0, "lab")

    # Without lab data CPT: above the table for gamma, below for gamma_sat.
    [from_cpt], _ = suggest([layer(0, 6, "SP")], gwt=3.0, cpt=cpt, spt=[(3.0, 15.0)])
    assert (from_cpt.gamma, from_cpt.gamma_source) == (16.0, "cpt_rc2010")
    assert (from_cpt.gamma_sat, from_cpt.gamma_sat_source) == (21.0, "cpt_rc2010")

    # No table: every CPT point feeds both.
    [no_gwt], _ = suggest([layer(0, 6, "SP")], cpt=cpt)
    assert no_gwt.gamma == no_gwt.gamma_sat == pytest.approx(18.5)


def test_cpt_layer_entirely_below_table_uses_all_points_with_warning():
    [result], warnings = suggest([layer(2, 6)], gwt=1.0, cpt=[(3.0, 19.0), (5.0, 21.0)])
    assert result.gamma == result.gamma_sat == pytest.approx(20.0)
    assert "layering.warning.gamma_above_gwt_from_below" in codes(warnings)


def test_supplied_values_win_and_are_marked_user():
    lab = [(1.0, 17.0, None, None)]
    [result], warnings = suggest([layer(0, 6, "SP")], lab=lab, spt=[(3.0, 15.0)],
                                 supplied={0: (16.0, None)})
    assert (result.gamma, result.gamma_source) == (16.0, "user")
    assert (result.gamma_sat, result.gamma_sat_source) == (None, None)
    assert warnings == []
