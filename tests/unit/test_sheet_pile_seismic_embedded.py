"""Seismic M-O active increment below the dredge line (review 2026-10-21).

Ebeling & Morrison (1992) apply the M-O active pressure over the embedded part as well; the
increment Delta K_h (sigma'_v + q) is added below the dredge line, above it the existing uniform
H/2 convention (TBDY 16.12.2.8) is kept. Hand numbers: phi 30, gamma 18, H 5 m, S_DS 0.5 (kh 0.2,
kv 0.1, r = 1).
"""

import numpy as np
import pytest

from geotek.core.models.profile import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.core.models.project import Project, ProjectMeta
from geotek.core.models.structures import SheetPileStructure, StructureSoilModel
from geotek.engine.earth_pressure.coefficients import mononobe_okabe_kae, rankine_ka
from geotek.engine.sheet_pile import net_pressure
from geotek.services.structures import design_sheet_pile_structure
from geotek.services.walls_basic import BasicSheetPileInput, design_sheet_pile_basic

H = 5.0


def _profile():
    return SoilProfile(id="p", gwt=GroundwaterCondition(depth_insitu=100.0), layers=[
        SoilLayer(id="s", top=0, bottom=40, gamma=18, design=DesignParameters(phi_eff=30))])


def test_net_pressure_adds_increment_below_dredge_only():
    dk = 0.9 * mononobe_okabe_kae(30, kh=0.2, kv=0.1) - rankine_ka(30)
    base = net_pressure(_profile(), H, surcharge=10)
    seis = net_pressure(_profile(), H, surcharge=10, seismic_increment_below=dk)
    for depth in (6.0, 8.0):
        i = int(np.searchsorted(base.z, depth))
        assert seis.active[i] - base.active[i] == pytest.approx(dk * (18 * base.z[i] + 10), rel=1e-9)
    i = int(np.searchsorted(base.z, 3.0))
    assert seis.active[i] == pytest.approx(base.active[i])


def test_basic_and_structure_paths_agree_and_embedment_grows():
    basic = design_sheet_pile_basic(BasicSheetPileInput(retained_height=H, gamma=18, phi=30, sds=0.5))
    layer = SoilLayer(id="s", top=0, bottom=40, gamma=18, design=DesignParameters(phi_eff=30))
    soil = StructureSoilModel(profile=SoilProfile(id="p", layers=[layer],
                                                  gwt=GroundwaterCondition(depth_insitu=100.0)))
    project = Project(meta=ProjectMeta(name="x"),
                      structures=[SheetPileStructure(id="s", retained_height=H, soil=soil, sds=0.5)])
    structure = design_sheet_pile_structure(project, "s")
    assert structure.result.D0 == pytest.approx(basic.result.D0, rel=2e-3)
    assert structure.result.M_max == pytest.approx(basic.result.M_max, rel=2e-3)
    # Same inputs without the embedded increment (old convention) give a shallower pile.
    kh, kv = 0.2, 0.1
    dk = (1 - kv) * mononobe_okabe_kae(30, kh=kh, kv=kv) - rankine_ka(30)
    from geotek.engine.earth_pressure.coefficients import mononobe_okabe_kpe, rankine_kp
    from geotek.engine.sheet_pile import cantilever_sheet_pile
    old = cantilever_sheet_pile(_profile(), H, passive_factor=1.5, seismic_increment=0.5 * 18 * H * dk,
                                passive_seismic_ratio=min(1, (1 - kv) * mononobe_okabe_kpe(30, kh=kh, kv=kv)
                                                          / rankine_kp(30)))
    assert basic.result.D0 > old.D0 * 1.1 and basic.result.M_max > old.M_max * 1.2


def test_basic_seismic_increment_includes_surcharge_like_structure_path():
    kw = dict(retained_height=4.0, gamma=19, phi=34, sds=0.6, backfill_slope=8, surcharge=20)
    basic = design_sheet_pile_basic(BasicSheetPileInput(**kw))
    layer = SoilLayer(id="s", top=0, bottom=40, gamma=19, design=DesignParameters(phi_eff=34))
    soil = StructureSoilModel(profile=SoilProfile(id="p", layers=[layer],
                                                  gwt=GroundwaterCondition(depth_insitu=100.0)))
    project = Project(meta=ProjectMeta(name="x"), structures=[SheetPileStructure(
        id="s", retained_height=4.0, soil=soil, sds=0.6, backfill_slope=8, surcharge=20)])
    structure = design_sheet_pile_structure(project, "s")
    assert basic.result.D0 == pytest.approx(structure.result.D0, rel=3e-3)
    assert basic.result.M_max == pytest.approx(structure.result.M_max, rel=3e-3)
