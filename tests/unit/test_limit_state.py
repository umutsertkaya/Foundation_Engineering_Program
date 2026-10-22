import math
import shutil

import pytest

from geotek.config import codes
from geotek.core.errors import GeoTekError
from geotek.core.models import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.core.models.walls import (
    Backfill,
    CantileverGeometry,
    FoundationSoil,
    GravityGeometry,
    WallLoads,
    WallSettings,
)
from geotek.engine.earth_pressure.coefficients import coulomb_ka, rankine_ka, rankine_kp
from geotek.engine.limit_state import (
    design_sheet_pile,
    limit_state_cases,
    verify_wall,
    verify_wall_global_stability,
)
from geotek.engine.sheet_pile import cantilever_sheet_pile
from geotek.engine.stability import SoilBand
from geotek.engine.walls.global_stability import wall_global_stability
from geotek.engine.walls.walls import analyze_cantilever_wall, analyze_gravity_wall

CANT = CantileverGeometry(stem_height=5.3, stem_top=0.3, stem_bottom=0.5, toe=0.8, heel=2.2,
                          base_thickness=0.7, embedment=1.5)
GRAV = GravityGeometry(height=4, base_width=2.5, top_width=0.6, embedment=1.0)
SAND = FoundationSoil(phi=30, gamma=18, overburden=18)
UNITY = """
id: unity
label: {tr: Birim, en: Unity}
approach: partial_factors
reference: test
status: draft
approaches: {DA2: [DA2]}
combinations:
  - id: EQU
    label: {tr: EQU, en: EQU}
    load_factors: {G_dst: 1.0, G_stb: 1.0, Q_dst: 1.0, Q_stb: 0.0}
    material_factors: {tan_phi: 1.0, c_eff: 1.0, su: 1.0, gamma: 1.0}
  - id: DA2
    label: {tr: DA2, en: DA2}
    load_factors: {G_unfav: 1.0, G_fav: 1.0, Q_unfav: 1.0, Q_fav: 0.0}
    material_factors: {tan_phi: 1.0, c_eff: 1.0, su: 1.0, gamma: 1.0}
    resistance_factors: {bearing: 1.0, sliding: 1.0, earth_resistance: 1.0, global_stability: 1.0}
"""


@pytest.fixture
def unity_code(tmp_path, monkeypatch):
    for f in codes.BUILTIN_DIR.glob("*.yaml"):
        shutil.copy(f, tmp_path)
    (tmp_path / "unity.yaml").write_text(UNITY, encoding="utf-8")
    monkeypatch.setattr(codes, "BUILTIN_DIR", tmp_path)
    return "unity"


@pytest.mark.parametrize("geometry, analyze", [(CANT, analyze_cantilever_wall), (GRAV, analyze_gravity_wall)])
def test_unity_factors_reproduce_asd(unity_code, geometry, analyze):
    bf = Backfill(gamma=18, phi=32, delta=20)
    loads = WallLoads(surcharge=10)
    asd = analyze(geometry, bf, SAND, loads)
    ls = {a.case: a for a in verify_wall(geometry, bf, SAND, loads, WallSettings(design_code=unity_code),
                                         approach="DA2")}
    assert ls["DA2"].checks["sliding"].value == pytest.approx(asd.checks["sliding"].value, rel=1e-9)
    assert ls["DA2"].checks["bearing"].value == pytest.approx(asd.checks["bearing"].value, rel=1e-9)
    assert ls["EQU"].checks["overturning"].value == pytest.approx(asd.checks["overturning"].value, rel=1e-9)
    assert ls["DA2"].eccentricity == pytest.approx(asd.eccentricity, rel=1e-9)


def test_unity_global_stability_matches_asd(unity_code):
    bf = Backfill(gamma=18, phi=32)
    bands = [SoilBand(top=0, gamma=19, c=5, phi=28)]
    asd, _ = wall_global_stability(CANT, bf, bands)
    (name, chk), = verify_wall_global_stability(CANT, bf, bands, settings=WallSettings(design_code=unity_code),
                                               approach="DA2")
    assert chk.value == pytest.approx(asd.fs, rel=1e-9)


def test_ec7_da1_c2_sliding_hand_calc():
    bf = Backfill(gamma=18, phi=30, delta=20)
    res = {a.case: a for a in verify_wall(GRAV, bf, SAND, settings=WallSettings(design_code="ec7"))}
    c2 = res["DA1-C2"]
    phi_d = math.degrees(math.atan(math.tan(math.radians(30)) / 1.25))
    delta_d = math.degrees(math.atan(math.tan(math.radians(20)) / 1.25))
    pa = 0.5 * 18 * 16 * coulomb_ka(phi_d, delta_d)
    ph, pv = pa * math.cos(math.radians(delta_d)), pa * math.sin(math.radians(delta_d))
    w = 24 * 6.2
    rd = (w + pv) * math.tan(math.radians(phi_d)) / 1.0
    assert c2.checks["sliding"].value == pytest.approx(rd / ph, rel=1e-4)
    assert set(res) == {"DA1-C1", "DA1-C2", "EQU"}


def test_lrfd_strength_sliding_and_bearing_sets():
    bf = Backfill(gamma=18, phi=32)
    (a,) = verify_wall(CANT, bf, SAND, settings=WallSettings(design_code="aashto_lrfd"))
    dc = 3.5 * 0.7 * 24 + 0.4 * 5.3 * 24
    ev = 2.2 * 5.3 * 18
    eh = 0.5 * 18 * 36 * rankine_ka(32)
    v_min = 0.9 * dc + 1.0 * ev
    assert a.sum_v == pytest.approx(v_min, rel=1e-6)
    assert a.checks["sliding"].value == pytest.approx(0.8 * v_min * math.tan(math.radians(30)) / (1.5 * eh), rel=1e-4)
    v_max = 1.25 * dc + 1.35 * ev
    assert a.bearing.Q_ult * 0.55 / a.checks["bearing"].value == pytest.approx(v_max, rel=1e-6)
    assert "overturning" not in a.checks  # replaced by eccentricity in LRFD


def test_lrfd_extreme_event_and_errors():
    loads = WallLoads(kh=0.15)
    (ee,) = verify_wall(CANT, Backfill(gamma=18, phi=32), SAND, loads,
                        WallSettings(design_code="aashto_lrfd"), seismic=True)
    assert ee.case == "Extreme Event I"
    assert any(f.kind == "EQ" for f in ee.forces)
    with pytest.raises(GeoTekError, match="1998"):
        limit_state_cases("ec7", seismic=True)
    with pytest.raises(GeoTekError, match=r"TBDY-static\.load\.G_unfav.*not_in_source"):
        limit_state_cases("tbdy2018")  # static load factors are not given by TBDY
    with pytest.raises(GeoTekError, match=r"TBDY-seismic\.material\.tan_phi"):
        limit_state_cases("tbdy2018", seismic=True)  # gamma_R,phi defined without a value
    with pytest.raises(GeoTekError, match="global factors"):
        limit_state_cases("asd")
    with pytest.raises(GeoTekError, match="Unknown design approach"):
        limit_state_cases("ec7", approach="DA9")
    assert [c.name for c in limit_state_cases("ec7", approach="DA2")] == ["DA2"]


@pytest.fixture
def tbdy_filled(tmp_path, monkeypatch):
    """TBDY file with the engineer's own material factors entered (values for the test only)."""
    for f in codes.BUILTIN_DIR.glob("*.yaml"):
        shutil.copy(f, tmp_path)
    text = (tmp_path / "tbdy2018.yaml").read_text(encoding="utf-8")
    text = text.replace("material_factors: {tan_phi: null, c_eff: null, su: null, gamma: 1.0}",
                        "material_factors: {tan_phi: 1.0, c_eff: 1.0, su: 1.0, gamma: 1.0}")
    (tmp_path / "tbdy2018.yaml").write_text(text, encoding="utf-8")
    monkeypatch.setattr(codes, "BUILTIN_DIR", tmp_path)
    return "tbdy2018"


def test_tbdy_seismic_rules(tbdy_filled):
    from geotek.engine.earth_pressure.coefficients import tbdy_seismic_coefficients

    kh, kv = tbdy_seismic_coefficients(sds=1.0, r=2.0)
    assert (kh, kv) == pytest.approx((0.2, 0.1))
    loads = WallLoads(kh=kh, kv=kv, seismic_increment_height=0.5)
    bf = Backfill(gamma=18, phi=32)
    base = WallSettings(design_code=tbdy_filled)
    with_pp = WallSettings(design_code=tbdy_filled, use_passive=True)
    (a,) = verify_wall(CANT, bf, SAND, loads, base, seismic=True)
    (b,) = verify_wall(CANT, bf, SAND, loads, with_pp, seismic=True)
    # Sliding: V tan(delta) / 1.1 (+ 0.3 x passive / 1.4)
    v, h = a.sum_v, a.sum_h
    assert a.checks["sliding"].value == pytest.approx(v * math.tan(math.radians(30)) / 1.1 / h, rel=1e-6)
    kp = rankine_kp(30)
    # Seismic passive: (1 - kv) K_PE / K_P (M-O passive), review 2026-10-21
    from geotek.engine.earth_pressure.coefficients import mononobe_okabe_kpe
    pp = 0.5 * kp * 18 * 1.5**2 * (1 - kv) * mononobe_okabe_kpe(30, kh=kh, kv=kv) / kp
    assert b.checks["sliding"].value == pytest.approx((v * math.tan(math.radians(30)) / 1.1 + 0.3 * pp / 1.4) / h, rel=1e-6)
    # Overturning with gamma_Rdev = 1.3 and bearing with gamma_Rv = 1.4
    assert a.checks["overturning"].value == pytest.approx(a.m_resisting / 1.3 / a.m_overturning, rel=1e-9)
    assert "bearing" in a.checks
    # Weights at 0.9 (Eq. 4.12) in the stabilising set
    dc = 3.5 * 0.7 * 24 + 0.4 * 5.3 * 24
    ev = 2.2 * 5.3 * 18
    vert_eq = -sum(f.fy for f in a.forces if f.kind == "EQ")
    assert v == pytest.approx(0.9 * (dc + ev) + vert_eq, rel=1e-6)


def test_verification_records():
    for code_id in ("asd", "ec7", "aashto_lrfd", "tbdy2018"):
        code = codes.get_design_code(code_id)
        assert code.verification, code_id
    tbdy = codes.get_design_code("tbdy2018")
    statuses = {v.item: v.status for v in tbdy.verification}
    assert any(s == "not_in_source" for s in statuses.values())
    assert tbdy.combination("TBDY-seismic").passive_participation == 0.3
    assert tbdy.combination("TBDY-seismic").resistance_factors["bearing"] == 1.4


def _sand_profile(phi=30.0):
    layer = SoilLayer(id="S", top=0, bottom=40, gamma=18, design=DesignParameters(phi_eff=phi))
    return SoilProfile(id="SP", gwt=GroundwaterCondition(depth_insitu=100), layers=[layer])


def test_sheet_pile_lrfd_closed_form():
    H = 5.0
    d = design_sheet_pile(_sand_profile(), H, code="aashto_lrfd")
    r = (1.5 * rankine_ka(30) / (0.75 * rankine_kp(30))) ** (1 / 3)
    assert d.cases["Strength I"].D0 == pytest.approx(H * r / (1 - r), rel=1e-3)
    assert d.D_required == pytest.approx(1.2 * H * r / (1 - r), rel=1e-3)


def test_sheet_pile_ec7_envelope():
    H = 5.0
    d = design_sheet_pile(_sand_profile(), H, code="ec7")
    phi_d = math.degrees(math.atan(math.tan(math.radians(30)) / 1.25))
    r = (rankine_ka(phi_d) / rankine_kp(phi_d)) ** (1 / 3)
    assert d.cases["DA1-C2"].D0 == pytest.approx(H * r / (1 - r), rel=1e-3)
    assert d.D_required == max(c.D for c in d.cases.values())
    assert d.governing_embedment == "DA1-C2"
    unfactored = cantilever_sheet_pile(_sand_profile(), H)
    assert d.M_design > unfactored.M_max


def test_sheet_pile_anchored_and_guard():
    d = design_sheet_pile(_sand_profile(), 5.0, code="ec7", support="anchored", anchor_depth=1.0)
    assert d.anchor_force_design == max(c.anchor_force for c in d.cases.values())
    with pytest.raises(GeoTekError, match="passive_factor"):
        design_sheet_pile(_sand_profile(), 5.0, code="ec7", passive_factor=1.5)


def _tbdy_gravity_sliding(code_id, delta_base=None):
    from geotek.config.codes import FactorOverride
    from geotek.core.models.walls import Backfill, FoundationSoil, GravityGeometry, WallLoads, WallSettings
    from geotek.engine.limit_state import verify_wall
    overrides = {}
    if code_id == "tbdy2018":
        overrides = {f"TBDY-static.{block}.{key}": FactorOverride(value=1, note="explicit unity for test")
                     for block, keys in (("load", ["G_unfav", "G_fav", "Q_unfav"]),
                                         ("material", ["tan_phi", "c_eff", "su"])) for key in keys}
    geometry = GravityGeometry(height=6, base_width=4, top_width=1)
    result = verify_wall(geometry, Backfill(gamma=18, phi=30, delta=0),
                         FoundationSoil(phi=40, gamma=18, delta_base=delta_base),
                         loads=WallLoads(surcharge=45),
                         settings=WallSettings(design_code=code_id, factor_overrides=overrides))
    return result[0].checks["sliding"]


def test_tbdy_caps_base_friction_at_tan_delta_0_6():
    """ENG-C-002. Hand calc: V = (1+4)/2*6*24 = 360 kN/m (delta=0 -> no vertical earth force);
    H = 0.5*(1/3)*18*6^2 + (1/3)*45*6 = 108 + 90 = 198 kN/m;
    R_d = 360*0.6/1.1 = 196.36 kN/m (gammaRh = 1.1), ratio = 196.36/198 = 0.9917 (fails)."""
    check = _tbdy_gravity_sliding("tbdy2018")
    assert check.value == pytest.approx(360 * 0.6 / 1.1 / 198, rel=1e-4)
    assert not check.passed
    assert "Tablo 16.3" in check.detail


def test_tbdy_cap_takes_the_smaller_user_delta_base():
    # tan(20 deg) = 0.364 < 0.6: the user value stays; no cap text.
    check = _tbdy_gravity_sliding("tbdy2018", delta_base=20.0)
    assert check.value == pytest.approx(360 * math.tan(math.radians(20)) / 1.1 / 198, rel=1e-4)
    assert "Tablo 16.3" not in check.detail
