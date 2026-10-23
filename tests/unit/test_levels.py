"""Basic / advanced analysis levels, labelled factors and user overrides."""

import json
import math

from geotek.core.errors import LayerDesignError
from pathlib import Path

import pytest

from geotek.config.codes import FactorOverride, get_design_code, resolve_code
from geotek.core.errors import GeoTekError
from geotek.core.models import Project, ProjectMeta
from geotek.core.models.walls import Backfill, CantileverGeometry, FoundationSoil, WallLoads, WallSettings
from geotek.engine.earth_pressure.coefficients import rankine_ka, rankine_kp
from geotek.engine.walls.global_stability import wall_global_stability
from geotek.engine.walls.walls import analyze_cantilever_wall
from geotek.io.project_io import load_project, save_project
from geotek.services.walls_advanced import (
    analyze_wall_advanced,
    bands_from_profile,
    foundation_from_profile,
    required_inputs,
)
from geotek.services.walls_basic import (
    BasicSheetPileInput,
    BasicWallInput,
    _bands,
    _foundation,
    design_sheet_pile_basic,
    proportion,
    size_wall,
)

EXAMPLE = Path(__file__).parents[2] / "examples" / "ornek_proje.gtk"
CANT = CantileverGeometry(stem_height=5.3, stem_top=0.3, stem_bottom=0.5, toe=0.8, heel=2.2,
                          base_thickness=0.7, embedment=1.5)
SAND = FoundationSoil(phi=30, gamma=18, overburden=18)


def _inp(**kw):
    base = dict(wall_type="cantilever", height=5.0, backfill_gamma=18, backfill_phi=32,
                foundation_phi=30, foundation_gamma=19, surcharge=10)
    return BasicWallInput(**{**base, **kw})


# --- labelled factors and overrides ---------------------------------------------------------


def test_factor_labels():
    tbdy = get_design_code("tbdy2018")
    assert tbdy.source_of("TBDY-seismic.resistance.bearing").status == "verified"
    assert "Tablo 16.2" in tbdy.source_of("TBDY-seismic.resistance.bearing").source
    assert tbdy.source_of("TBDY-seismic.material.tan_phi").status == "not_in_source"
    assert get_design_code("ec7").source_of("EQU.load.G_dst").status == "verified"
    assert get_design_code("aashto_lrfd").source_of("load.DC.max").status == "secondary"
    assert get_design_code("aashto_lrfd").source_of("resistance.strength.global_stability").status == "secondary"
    assert get_design_code("aashto_lrfd").source_of("eccentricity.soil.extreme").status == "unverified"


def test_override_changes_result_and_is_labelled():
    ov = {"safety.sliding.static": FactorOverride(value=1.3, note="şartname 4.2")}
    a = analyze_cantilever_wall(CANT, Backfill(gamma=18, phi=32), SAND, settings=WallSettings(factor_overrides=ov))
    assert a.checks["sliding"].required == 1.3
    used = {f.path: f for f in a.factors_used}
    assert used["safety.sliding.static"].status == "user"
    assert "şartname 4.2" in used["safety.sliding.static"].source
    assert used["safety.overturning.static"].status == "unverified"


def test_invalid_overrides_rejected():
    with pytest.raises(GeoTekError, match=">= 1.0"):
        resolve_code("asd", {"safety.sliding.static": FactorOverride(value=0.9)})
    with pytest.raises(GeoTekError, match="phi"):
        resolve_code("aashto_lrfd", {"resistance.strength.bearing": FactorOverride(value=1.2)})
    with pytest.raises(GeoTekError, match="no factor"):
        resolve_code("ec7", {"DA2.resistance.nonsense": FactorOverride(value=1.2)})
    assert get_design_code("asd").safety_factors["sliding"]["static"] == 1.5  # built-in untouched


def test_project_overrides_roundtrip_and_migration(tmp_path):
    p = Project(meta=ProjectMeta(name="x", analysis_level="advanced"),
                design_overrides={"tbdy2018": {"TBDY-seismic.material.tan_phi": FactorOverride(value=1.25)}})
    loaded = load_project(save_project(p, tmp_path / "p"))
    assert loaded.design_overrides["tbdy2018"]["TBDY-seismic.material.tan_phi"].value == 1.25
    old = json.loads(Project(meta=ProjectMeta(name="old")).model_dump_json())
    old["meta"]["schema_version"] = "1.0"
    del old["meta"]["analysis_level"], old["design_overrides"]
    (tmp_path / "old.gtk").write_text(json.dumps(old), encoding="utf-8")
    migrated = load_project(tmp_path / "old.gtk")
    assert migrated.meta.analysis_level == "basic" and migrated.design_overrides == {}


# --- basic level --------------------------------------------------------------------------


def _all_pass(inp, geom, D):
    analyze = analyze_cantilever_wall
    settings = WallSettings()
    bf = Backfill(gamma=inp.backfill_gamma, phi=inp.backfill_phi, slope=inp.backfill_slope)
    a = analyze(geom, bf, _foundation(inp, D), WallLoads(surcharge=inp.surcharge), settings)
    if not a.passed:
        return False
    _, chk = wall_global_stability(geom, bf, _bands(inp), WallLoads(surcharge=inp.surcharge), settings)
    return chk.passed


def test_size_wall_static_is_minimal():
    inp = _inp()
    r = size_wall(inp)
    assert r.passed and all(row[4] for row in r.summary_rows())
    D = r.geometry.embedment
    smaller = proportion(inp, round(r.geometry.width - 0.05, 6), D)
    assert smaller is None or not _all_pass(inp, smaller, D)
    assert r.governing.startswith("static:")
    sources = {a.source for a in r.assumptions}
    assert any("Tablo 16.3" in s for s in sources) and any("Das" in s for s in sources)
    assert {f.path for f in r.factors_used} >= {"safety.sliding.static", "safety.global_stability.static"}


def test_size_wall_seismic():
    static = size_wall(_inp(include_global_stability=False))
    quake = size_wall(_inp(sds=0.3, include_global_stability=False))
    assert quake.kh == pytest.approx(0.4 * 0.3 / 1.5)  # r = 1.5 by wall type
    assert quake.kv == pytest.approx(0.5 * quake.kh)
    assert quake.geometry.width > static.geometry.width
    assert any("16.22" in a.source for a in quake.assumptions)


def test_size_wall_infeasible_sliding_is_explained():
    r = size_wall(_inp(sds=1.0, include_global_stability=False))
    assert not r.passed
    assert any("Kayma dişi" in w for w in r.warnings)


def test_size_wall_refuses_high_water():
    with pytest.raises(GeoTekError, match="ileri seviye"):
        size_wall(_inp(gwt_below_base=False))


def test_gravity_wall_sizing():
    r = size_wall(_inp(wall_type="gravity", include_global_stability=False))
    assert r.passed and r.geometry.top_width >= 0.30


def test_sheet_pile_basic_closed_form():
    H = 4.0
    res = design_sheet_pile_basic(BasicSheetPileInput(retained_height=H, gamma=18, phi=30))
    ratio = (rankine_ka(30) * 1.5 / rankine_kp(30)) ** (1 / 3)
    d0 = H * ratio / (1 - ratio)
    assert res.result.D0 == pytest.approx(d0, rel=1e-3)
    assert res.result.D == pytest.approx(1.2 * d0, rel=1e-3)
    quake = design_sheet_pile_basic(BasicSheetPileInput(retained_height=H, gamma=18, phi=30, sds=0.4))
    assert quake.kh == pytest.approx(0.16)
    assert quake.result.D0 > res.result.D0


# --- advanced level -----------------------------------------------------------------------


def test_required_inputs_and_user_completion():
    missing = {m.path: m for m in required_inputs("tbdy2018", seismic=True)}
    assert set(missing) == {"TBDY-seismic.material.tan_phi", "TBDY-seismic.material.c_eff",
                            "TBDY-seismic.material.su"}
    assert "EC7" in missing["TBDY-seismic.material.tan_phi"].hint
    settings = WallSettings(design_code="tbdy2018", bearing_method="vesic")
    loads = WallLoads(kh=0.13, kv=0.065, seismic_increment_height=0.5)
    with pytest.raises(GeoTekError, match="tan_phi.*c_eff.*su"):
        analyze_wall_advanced(CANT, Backfill(gamma=18, phi=32), SAND, loads, settings, seismic=True)
    ov = {p: FactorOverride(value=1.25, note="proje kararı") for p in missing}
    settings = WallSettings(design_code="tbdy2018", factor_overrides=ov)
    r = analyze_wall_advanced(CANT, Backfill(gamma=18, phi=32), SAND, loads, settings, seismic=True)
    used = {f.path: f for f in r.factors_used}
    assert used["TBDY-seismic.material.tan_phi"].status == "user"
    assert used["TBDY-seismic.resistance.bearing"].status == "verified"
    assert any("Toptan göçme" in w for w in r.warnings)


def test_profile_link():
    project = load_project(EXAMPLE)
    profile = project.soil_profiles[0]
    # Design parameters must be set by the engineer first
    with pytest.raises(GeoTekError, match="phi"):
        foundation_from_profile(profile, 2.0)
    for layer in profile.layers:
        layer.design.phi_eff = 30.0
        layer.design.su = 40.0
    f = foundation_from_profile(profile, 2.0)
    assert f.gamma == pytest.approx(19.0 - 9.81)  # GWT at 1.5 m is above the base
    sv, u, se = profile.stresses(2.0, "design")
    assert f.overburden == pytest.approx(se)
    bands = bands_from_profile(profile, 2.0)
    assert bands[0].top == 0.0 and bands[1].top == pytest.approx(2.0 - 6.0)
    clay = foundation_from_profile(profile, 7.0)
    assert clay.drainage == "undrained" and clay.su == 40.0
    assert math.isclose(bands[1].c, 40.0)


def _dry_band_profile(gwt):
    from geotek.core.models.profile import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile

    design = DesignParameters(phi_eff=30.0)
    layers = [SoilLayer(id="A", top=0, bottom=6, gamma=18, design=design),
              SoilLayer(id="B", top=6, bottom=12, gamma=19, design=design)]
    return SoilProfile(id="P", gwt=GroundwaterCondition(depth_insitu=gwt), layers=layers)


def test_bands_need_gamma_sat_only_below_the_water_table():
    # Dry site (water table 20 m, below every layer): no gamma_sat needed, bands use gamma.
    bands = bands_from_profile(_dry_band_profile(20.0), 2.0)
    assert [b.gamma for b in bands] == [18.0, 19.0]
    # Water table inside layer A (3 m) and gamma_sat unset: the band cannot be built.
    with pytest.raises(LayerDesignError) as caught:
        bands_from_profile(_dry_band_profile(3.0), 2.0)
    assert caught.value.message_code == "layer_gamma_sat_missing"
