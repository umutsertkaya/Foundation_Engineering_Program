"""Fine-grained (undrained, Q-case) sheet-pile passive factor 2.0 (EM 1110-2-2504 Table 5-1)."""

from geotek.services.walls_basic import BasicSheetPileInput, design_sheet_pile_basic


def test_undrained_front_uses_fs_two():
    res = design_sheet_pile_basic(BasicSheetPileInput(
        retained_height=4.0, gamma=18, drainage="undrained", su=40, surcharge=20))
    assert any("2.0" in a.text for a in res.assumptions)
    drained = design_sheet_pile_basic(BasicSheetPileInput(retained_height=5.0, gamma=18, phi=30))
    assert not any("Tablo 5-1" in a.text for a in drained.assumptions)
