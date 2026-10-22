"""Structure orchestration: the 4.60 m compatibility gate, factors, hashes, cancellation."""

import copy
import hashlib
import json

import pytest

from geotek.config.codes import FactorOverride
from geotek.core.constants import GAMMA_W
from geotek.core.errors import Cancelled, GeoTekError, MissingFactorsError
from geotek.core.models.profile import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.core.models.project import Project, ProjectMeta
from geotek.core.models.structures import RetainingWallStructure, SheetPileStructure, StructureSoilModel, WallDesignInputs
from geotek.core.models.walls import WallSettings
from geotek.engine.earth_pressure.distribution import PressureDistribution
from geotek.engine.limit_state import SheetPileDesign
from geotek.engine.sheet_pile import cantilever_sheet_pile
from geotek.engine.walls.layered import soil_from_basic
from geotek.services.structures import (
    calculation_fingerprint, check_structure, design_sheet_pile_structure, required_factors,
    size_structure,
)
from geotek.services.walls_advanced import required_inputs
from geotek.services.walls_basic import BasicSheetPileResult, BasicWallInput, proportion_for, size_wall

BASIC = BasicWallInput(wall_type="cantilever", height=5.0, backfill_gamma=18.0, backfill_phi=32.0,
                       foundation_phi=30.0, foundation_gamma=19.0, surcharge=10.0, sds=0.5)


@pytest.mark.parametrize("advanced,code", [(False, "asd"), (True, "asd"), (True, "ec7")])
def test_engineer_choices_are_honoured_and_reported_in_both_levels(advanced, code):
    project = _project(advanced=advanced, code=code, sds=None)
    structure = project.structure("wall")
    structure.soil.profile.layers[0].gamma_sat = 21
    structure.soil.gwt_front = GroundwaterCondition(depth_insitu=5 + structure.geometry.width / 2)
    default = check_structure(project, "wall")
    assert calculation_fingerprint(project, structure) == default.result_hash
    structure.settings.uplift_moment = "resisting"
    structure.settings.gwt_bearing_correction = False
    before = project.model_dump_json()
    alternative = check_structure(project, "wall")
    assert project.model_dump_json() == before
    assert default.result_hash != alternative.result_hash
    key = "static" if code == "asd" else "static:DA1-C2"
    assert default.analyses[key].bearing.q_ult < alternative.analyses[key].bearing.q_ult
    for result, formula, water_choice in [(default, "M_R/(M_O+M_U)", "açık"),
                                           (alternative, "(M_R−M_U)/M_O", "kapalı")]:
        assert any(formula in a.text and a.source == "Mühendis seçimi; varsayılan güvenli taraf"
                   for a in result.assumptions)
        assert any(water_choice in a.text and a.source ==
                   "Das, Principles of Foundation Engineering, taşıma gücüne yeraltı suyu etkisi (Durum III)"
                   for a in result.assumptions)


def test_partial_global_service_passes_and_logs_combination_load_factors(monkeypatch):
    from geotek.engine.stability import SlipResult
    from geotek.engine.walls.base import CheckResult
    from geotek.services import structures as service

    project = _project(with_global=True, advanced=True, code="ec7", sds=None)
    project.design_overrides["ec7"] = {
        "DA1-C1.load.G_unfav": FactorOverride(value=1.4, note="E4 G test"),
        "DA1-C2.load.Q_unfav": FactorOverride(value=1.6, note="E4 Q test")}
    captured = []

    def capture(*args, **kwargs):
        captured.append(kwargs)
        return (SlipResult(fs=2, xc=1, yc=8, radius=10, x_entry=10, x_exit=-2),
                CheckResult("global_stability", 2, kwargs["required"], True))

    monkeypatch.setattr(service, "wall_global_stability", capture)
    before = project.model_dump_json()
    result = check_structure(project, "wall")
    assert project.model_dump_json() == before
    assert len(captured) == 2
    assert captured[0]["footprint_factors"]["DC"] == captured[0]["footprint_factors"]["EV"] == 1.4
    assert captured[1]["surcharge_factor"] == 1.6
    for key, path, value in [("static:DA1-C1", "DA1-C1.load.G_unfav", 1.4),
                              ("static:DA1-C2", "DA1-C2.load.Q_unfav", 1.6)]:
        assert any(f.path == path and f.value == value and f.status == "user"
                   for f in result.global_stability[key].factors_used)
        assert any(f.path == path and f.value == value for f in result.factors_used)
    assert any("DA1-C1/DA2" in a.text and "karakteristik" in a.text for a in result.assumptions)


@pytest.mark.parametrize("factor", ["G_unfav", "Q_unfav"])
@pytest.mark.parametrize("omitted", [False, True])
def test_missing_partial_global_action_factors_surface_before_calculation(monkeypatch, factor, omitted):
    from geotek.engine import limit_state

    project = _project(with_global=True, advanced=True, code="ec7", sds=None)
    code = limit_state.layered_design_code(project.structure("wall").settings)
    if omitted:
        code.combination("DA1-C2").load_factors.pop(factor)
    else:
        code.combination("DA1-C2").load_factors[factor] = None
    monkeypatch.setattr(limit_state, "layered_design_code", lambda settings: code)
    path = f"DA1-C2.load.{factor}"
    assert path in {m.path for m in required_factors(project, "wall")}
    with pytest.raises(MissingFactorsError) as error:
        check_structure(project, "wall")
    assert path in {m.path for m in error.value.missing}


def _project(*, with_global=False, sds=0.5, advanced=False, code="asd", geometry=True):
    structure = RetainingWallStructure(
        id="wall", wall_type="cantilever", height=5, embedment=0.6,
        geometry=proportion_for("cantilever", 5, 4.6, 0.6) if geometry else None,
        soil=soil_from_basic(BASIC, 0.6),
        inputs=WallDesignInputs(surcharge=10, sds=sds, include_global_stability=with_global),
        settings=WallSettings(design_code=code), analysis_level="advanced" if advanced else "basic",
        approach="TBDY" if code == "tbdy2018" else None,
    )
    return Project(meta=ProjectMeta(name="E4"), structures=[structure])


@pytest.fixture(scope="module")
def compatibility_results():
    project = _project(with_global=True, geometry=False)
    calls = []
    original = project.model_dump_json()
    layered = size_structure(project, "wall", lambda fraction, key: calls.append((fraction, key)))
    assert project.model_dump_json() == original
    return project, layered, size_wall(BASIC), calls


def test_structure_sizing_mandatory_basic_regression(compatibility_results):
    _, result, basic, _ = compatibility_results
    assert result.passed and basic.passed
    assert result.geometry.width == pytest.approx(4.60)
    assert result.geometry.model_dump() == basic.geometry.model_dump()
    assert result.governing == basic.governing == "seismic:bearing"
    assert result.governing_check_ids == ["seismic:bearing"] and not result.minimum_width_governs
    seismic = [c for case, a in result.analyses.items() if case == "seismic" for c in a.checks.values()]
    assert seismic and all(c.kv_sign in ("up", "down") for c in seismic)
    assert all(c.kv_sign is None for a in result.analyses.values() if a is result.analyses["static"]
               for c in a.checks.values())
    assert result.iterations == basic.iterations
    assert result.kh == basic.kh and result.kv == basic.kv
    assert WallSettings().kv_sign == "envelope"
    assert set(result.analyses) == {"static", "seismic"}
    for state, old in basic.analyses.items():
        new = result.analyses[state]
        assert set(new.checks) == set(old.checks)
        for key, old_check in old.checks.items():
            check = new.checks[key]
            if state == "static":
                assert check.value == pytest.approx(old_check.value, rel=1e-4, abs=1e-8)
            elif check.comparison == "<=":
                assert check.value >= old_check.value - 1e-4 * abs(old_check.value) - 1e-8
            else:
                assert check.value <= old_check.value + 1e-4 * abs(old_check.value) + 1e-8
            assert check.required == old_check.required
            assert check.passed == old_check.passed
        if state == "static":
            assert new.bearing.q_ult == pytest.approx(old.bearing.q_ult, rel=1e-4)
    for state, old_check in basic.global_stability.items():
        assert result.global_stability[state].value == pytest.approx(old_check.value, rel=1e-4)
        assert result.global_stability[state].required == old_check.required
    assert set(result.slip_results) == {"static", "seismic"}
    assert isinstance(result.pressures["static:retained"], PressureDistribution)
    assert isinstance(result.pressures["seismic:front"], PressureDistribution)
    assert all(a.text and a.source for a in result.assumptions)


def test_downward_kv_sizes_same_wall_to_450():
    project = _project(with_global=True, geometry=False)
    project.structure("wall").settings.kv_sign = "down"
    before = project.model_dump_json()
    result = size_structure(project, "wall")
    assert project.model_dump_json() == before
    assert result.passed and result.geometry.width == pytest.approx(4.50)
    assert result.kv == -abs(result.kh) / 2
    assert not any("kv_envelope" in w for w in result.warnings)


@pytest.mark.parametrize("advanced,code", [(False, "asd"), (True, "asd"), (True, "aashto_lrfd")])
def test_check_kv_envelope_selects_each_check_and_keeps_governing_forces_and_pressures(advanced, code, monkeypatch):
    from geotek.services import structures as service

    original = service.verify_wall_layered

    def capture(geometry, soil, loads, settings, **kwargs):
        analyses = original(geometry, soil, loads, settings, **kwargs)
        if kwargs["seismic"]:
            for analysis in analyses:
                analysis.warnings.append(f"sign-specific warning: {loads.kv:g}")
        return analyses

    monkeypatch.setattr(service, "verify_wall_layered", capture)
    project = _project(advanced=advanced, code=code)
    structure = project.structure("wall")
    before = project.model_dump_json()
    envelope = check_structure(project, "wall")
    assert project.model_dump_json() == before
    signed = {}
    for sign in ("up", "down"):
        structure.settings.kv_sign = sign
        signed[sign] = check_structure(project, "wall")
    for key, analysis in envelope.analyses.items():
        if not key.startswith("seismic"):
            assert analysis == signed["up"].analyses[key] == signed["down"].analyses[key]
            continue
        for name, check in analysis.checks.items():
            candidates = {sign: r.analyses[key].checks[name] for sign, r in signed.items()}
            choose = max if check.comparison == "<=" else min
            sign = choose(candidates, key=lambda s: candidates[s].value)
            expected = candidates[sign]
            assert (check.value, check.required, check.passed) == (expected.value, expected.required, expected.passed)
            direction = "yukarı" if sign == "up" else "aşağı"
            assert check.detail == f"kv {direction}: {expected.detail}"
            assert check.kv_sign == sign and expected.kv_sign == sign
        critical = min(analysis.checks.values(), key=lambda c:
                       c.required / c.value if c.comparison == "<=" and c.value else
                       float("inf") if c.comparison == "<=" else c.value / c.required)
        sign = "up" if critical.detail.startswith("kv yukarı:") else "down"
        reference = signed[sign].analyses[key]
        assert analysis.forces == reference.forces
        assert analysis.warnings == reference.warnings
        assert (analysis.sum_v, analysis.sum_h, analysis.q_max) == (reference.sum_v, reference.sum_h, reference.q_max)
        assert envelope.pressures[f"{key}:retained"].K == pytest.approx(signed[sign].pressures[f"{key}:retained"].K)
    warnings = [w for w in envelope.warnings if "kv_envelope" in w]
    assert warnings == ["wall.warning.kv_envelope"]


def test_kv_envelope_runs_global_stability_for_each_sign_and_keeps_worst_slip(monkeypatch):
    from geotek.engine.stability import SlipResult
    from geotek.engine.walls.base import CheckResult
    from geotek.services import structures as service

    project = _project(with_global=True)
    captured = []

    def capture(geometry, backfill, foundation, loads, settings, *, seismic, **kwargs):
        captured.append((seismic, loads.kv))
        fs = 2.0 if not seismic else 1.3 if loads.kv > 0 else 0.9
        return (SlipResult(fs=fs, xc=1, yc=8, radius=10, x_entry=10, x_exit=-2),
                CheckResult("global_stability", fs, 1.1, fs >= 1.1))

    monkeypatch.setattr(service, "wall_global_stability", capture)
    before = project.model_dump_json()
    result = check_structure(project, "wall")
    assert project.model_dump_json() == before
    assert captured == [(False, result.kv), (True, result.kv), (True, -result.kv)]
    assert result.global_stability["seismic"].value == result.slip_results["seismic"].fs == 0.9
    assert result.global_stability["seismic"].detail.startswith("kv aşağı:")
    assert not result.passed and "seismic:global_stability" in result.governing


@pytest.mark.parametrize("kv_sign", ["envelope", "up", "down"])
def test_zero_kv_runs_seismic_analysis_once_without_envelope_warning(monkeypatch, kv_sign):
    from geotek.services import structures as service

    project = _project()
    project.structure("wall").settings.kv_sign = kv_sign
    loads, kh, _ = service._loads(project.structure("wall"))
    monkeypatch.setattr(service, "_loads", lambda structure: (loads.model_copy(update={"kv": 0.0}), kh, 0.0))
    original = service.verify_wall_layered
    captured = []

    def capture(geometry, soil, loads, settings, **kwargs):
        captured.append((kwargs["seismic"], loads.kv))
        return original(geometry, soil, loads, settings, **kwargs)

    monkeypatch.setattr(service, "verify_wall_layered", capture)
    result = check_structure(project, "wall")
    assert captured == [(False, 0.0), (True, 0.0)]
    assert not any("kv_envelope" in w for w in result.warnings)


@pytest.mark.parametrize("kv_sign", ["envelope", "up", "down"])
def test_kv_sign_project_roundtrip_and_missing_field_default(tmp_path, kv_sign):
    from geotek.io.project_io import load_project, save_project

    project = _project()
    project.structure("wall").settings.kv_sign = kv_sign
    path = save_project(project, tmp_path / "wall")
    assert load_project(path) == project
    data = project.model_dump(mode="json")
    del data["structures"][0]["settings"]["kv_sign"]
    path.write_text(json.dumps(data), encoding="utf-8")
    assert load_project(path).structure("wall").settings.kv_sign == "envelope"


@pytest.mark.parametrize("version", ["1_0", "1_1"])
def test_kv_sign_does_not_break_legacy_project_fixtures(tmp_path, version):
    from geotek.io.project_io import load_project, save_project

    project = load_project(f"tests/data/project_{version}.gtk")
    assert load_project(save_project(project, tmp_path / "legacy")) == project


def test_progress_monotone_finite_and_uses_job_keys(compatibility_results):
    *_, calls = compatibility_results
    fractions = [fraction for fraction, _ in calls]
    assert fractions[0] == 0 and fractions[-1] == 1
    assert all(0 <= f <= 1 for f in fractions)
    assert all(b > a for a, b in zip(fractions, fractions[1:]))
    assert {key for _, key in calls} == {
        "job.step.static_checks", "job.step.seismic_checks", "job.step.global_stability", "job.step.sizing"}


def test_check_sized_and_narrower_geometry(compatibility_results):
    project, sized, _, _ = compatibility_results
    project = project.model_copy(deep=True)
    structure = project.structure("wall")
    structure.geometry = sized.geometry
    structure.inputs.include_global_stability = False
    calls = []
    checked = check_structure(project, "wall", lambda f, key: calls.append((f, key)))
    assert checked.passed and checked.iterations == 0
    assert checked.pressures["static:retained"].force > 0
    assert calls[0][0] == 0 and calls[-1][0] == 1
    structure.geometry = sized.geometry.model_copy(update={"heel": sized.geometry.heel - 0.05})
    narrow = check_structure(project, "wall")
    assert not narrow.passed and "seismic:bearing" in narrow.governing


def test_tbdy_missing_factors_are_all_reported_before_sizing():
    project = _project(advanced=True, code="tbdy2018", geometry=False)
    missing = {m.path: m for m in required_factors(project, "wall")}
    assert "TBDY-seismic.material.tan_phi" in missing
    assert "TBDY-seismic.material.c_eff" in missing
    assert "TBDY-seismic.material.su" in missing
    assert missing["TBDY-seismic.material.tan_phi"].status == "not_in_source"
    assert not any(path.endswith(".WA") for path in missing)  # no water action in this case
    with pytest.raises(MissingFactorsError, match="eksik") as error:
        size_structure(project, "wall")
    assert {m.path for m in error.value.missing} == set(missing)


@pytest.mark.parametrize("code,paths", [
    ("ec7", {"DA1-C1.load.WA", "DA1-C2.load.WA", "EQU.load.WA"}),
    ("aashto_lrfd", {"load.WA.strength_I"}),
])
def test_wet_partial_code_requires_WA_and_accepts_labelled_project_values(code, paths):
    project = _project(advanced=True, code=code, sds=None)
    project.structure("wall").soil.gwt_retained = GroundwaterCondition(depth_insitu=3)
    missing = required_factors(project, "wall")
    assert {m.path for m in missing} == paths
    assert all(m.status == "not_in_source" for m in missing)
    with pytest.raises(MissingFactorsError):
        check_structure(project, "wall")
    # Test-only engineer inputs; these numbers are not proposed standard coefficients.
    project.design_overrides[code] = {path: FactorOverride(value=1.1, note="E4 test input") for path in paths}
    assert not required_factors(project, "wall")
    checked = check_structure(project, "wall")
    wa = {f.path: f for f in checked.factors_used if f.path in paths}
    assert set(wa) == paths
    assert all(f.status == "user" and "E4 test input" in f.source and f.value == 1.1 for f in wa.values())
    assert any(f.kind == "WA" for a in checked.analyses.values() for f in a.forces)
    for a in checked.analyses.values():
        uplift = next(f for f in a.forces if f.name == "Uplift")
        assert uplift.fy == pytest.approx(1.1 * 0.5 * GAMMA_W * 2 * a.width)
    if code == "ec7":
        assert "static:EQU:retained" in checked.pressures


def test_legacy_missing_factor_contract_is_unchanged():
    assert {m.path for m in required_inputs("tbdy2018", seismic=True)} == {
        "TBDY-seismic.material.tan_phi", "TBDY-seismic.material.c_eff", "TBDY-seismic.material.su"}
    assert required_inputs("ec7") == []


def test_hash_stable_excludes_result_hash_and_is_canonical():
    project = _project(sds=None)
    structure = project.structure("wall")
    result = check_structure(project, "wall")
    assert len(result.result_hash) == 64
    dumped = structure.model_dump(mode="json", exclude={"name", "result_hash", "result"})
    del dumped["inputs"]["surcharge_basis"]  # default-valued later additions keep legacy hashes
    del dumped["geometry"]["key"]
    payload = {"structure": dumped, "design_code": "asd", "design_overrides": {}}
    expected = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False,
                                         separators=(",", ":"), allow_nan=False).encode("utf-8")).hexdigest()
    assert result.result_hash == expected
    assert calculation_fingerprint(project, structure) == expected
    structure.result_hash = "previous-result"
    structure.result = {"warnings": ["Previous display output is not an input"]}
    assert check_structure(project, "wall").result_hash == expected
    reordered = Project.model_validate_json(project.model_dump_json())
    assert check_structure(reordered, "wall").result_hash == expected
    structure.name = "Renamed"  # display name only
    assert check_structure(project, "wall").result_hash == expected
    structure.inputs.surcharge = 11
    changed = check_structure(project, "wall").result_hash
    assert changed != expected
    project.design_overrides["asd"] = {"safety.sliding.static": FactorOverride(value=1.6, note="test")}
    assert check_structure(project, "wall").result_hash != changed


def test_hash_ignores_other_projects_code_overrides_and_changes_with_code():
    project = _project(sds=None)
    initial = check_structure(project, "wall").result_hash
    project.design_overrides["ec7"] = {"DA1-C1.load.G_unfav": FactorOverride(value=1.4)}
    assert check_structure(project, "wall").result_hash == initial
    structure = project.structure("wall")
    structure.analysis_level = "advanced"
    structure.settings.design_code = "ec7"
    assert check_structure(project, "wall").result_hash != initial


def test_cancellation_propagates_and_does_not_mutate_project():
    project = _project(geometry=False)
    before = copy.deepcopy(project.model_dump())

    def cancel(fraction, key):
        if fraction > 0:
            raise Cancelled("test cancellation")

    with pytest.raises(Cancelled, match="test cancellation"):
        size_structure(project, "wall", cancel)
    assert project.model_dump() == before


def test_missing_geometry_unknown_structure_and_wrong_kind():
    project = _project(geometry=False)
    with pytest.raises(GeoTekError, match="geometrisi"):
        check_structure(project, "wall")
    with pytest.raises(KeyError):
        size_structure(project, "missing")
    with pytest.raises(GeoTekError, match="not a sheet pile"):
        design_sheet_pile_structure(project, "wall")


def _sheet_project(*, advanced=False, code="asd", fill=False, wet=False):
    layer = SoilLayer(id="sand", top=0, bottom=35, gamma=18, gamma_sat=20,
                      design=DesignParameters(phi_eff=30))
    soil = StructureSoilModel(profile=SoilProfile(id="sheet", layers=[layer],
                                                gwt=GroundwaterCondition(depth_insitu=100)))
    if fill:
        soil.retained_fill = [SoilLayer(id="fill", top=0, bottom=4, gamma=17,
                                        design=DesignParameters(phi_eff=35))]
    if wet:
        soil.gwt_retained = GroundwaterCondition(depth_insitu=2)
        soil.gwt_front = GroundwaterCondition(depth_insitu=4)
    sheet = SheetPileStructure(id="sheet", retained_height=4, soil=soil, design_code=code,
                               analysis_level="advanced" if advanced else "basic")
    return Project(meta=ProjectMeta(name="sheet"), structures=[sheet])


def test_sheet_pile_structure_reuses_homogeneous_solver_basis():
    project = _sheet_project()
    before = project.model_dump_json()
    calls = []
    result = design_sheet_pile_structure(project, "sheet", lambda f, key: calls.append((f, key)))
    reference = cantilever_sheet_pile(project.structure("sheet").soil.profile, 4, passive_factor=1.5)
    assert isinstance(result, BasicSheetPileResult)
    assert result.result.D0 == pytest.approx(reference.D0, rel=1e-6)
    assert result.result.D == pytest.approx(reference.D, rel=1e-6)
    assert result.result.M_max == pytest.approx(reference.M_max, rel=1e-6)
    assert calls[0][0] == 0 and calls[-1][0] == 1
    assert project.model_dump_json() == before


def test_sheet_pile_fill_does_not_replace_front_foundation():
    plain = design_sheet_pile_structure(_sheet_project(), "sheet")
    filled = design_sheet_pile_structure(_sheet_project(fill=True), "sheet")
    assert filled.result.D0 < plain.result.D0  # lower retained thrust; passive remains natural sand


@pytest.mark.parametrize("code", ["asd", "ec7"])
@pytest.mark.parametrize("anchored", [False, True])
def test_sheet_pile_optional_defaults_are_bit_identical(code, anchored):
    import numpy as np

    project = _sheet_project(advanced=code != "asd", code=code)
    pile = project.structure("sheet")
    if anchored:
        pile.support, pile.anchor_depth = "anchored", 1.0
    before = design_sheet_pile_structure(project, "sheet")
    pile.depth_increase = 0.0 if anchored else 0.2
    if anchored:
        pile.anchor_spacing, pile.anchor_inclination = 1.0, 0.0
    after = design_sheet_pile_structure(project, "sheet")
    old_cases = before.cases if code != "asd" else {"basic": before.result}
    new_cases = after.cases if code != "asd" else {"basic": after.result}
    for key, old in old_cases.items():
        new = new_cases[key]
        assert (new.D0, new.D, new.M_max, new.anchor_force) == (old.D0, old.D, old.M_max, old.anchor_force)
        for name in ("z", "net", "shear", "moment"):
            np.testing.assert_array_equal(getattr(new, name), getattr(old, name))
    pile.depth_increase = 0.35
    increased = design_sheet_pile_structure(project, "sheet")
    for key, new in (increased.cases if code != "asd" else {"basic": increased.result}).items():
        assert new.D == old_cases[key].D0 * 1.35
        assert new.M_max == old_cases[key].M_max


@pytest.mark.parametrize("seismic", [False, True])
def test_sheet_pile_front_water_override_is_consistent_and_does_not_mutate(seismic):
    import numpy as np

    project = _sheet_project(wet=True)
    pile = project.structure("sheet")
    pile.sds = 0.3 if seismic else None
    pile.front_water_depth = 8.0
    original = project.model_dump_json()
    deeper = design_sheet_pile_structure(project, "sheet")
    assert project.model_dump_json() == original
    reference = copy.deepcopy(project)
    reference.structure("sheet").front_water_depth = None
    reference.structure("sheet").soil.gwt_front = GroundwaterCondition(depth_insitu=8.0)
    equal = design_sheet_pile_structure(reference, "sheet")
    assert deeper.result.D == equal.result.D
    for name in ("net", "moment", "shear", "z"):
        np.testing.assert_array_equal(getattr(deeper.result, name), getattr(equal.result, name))
    assert any("8 m" in a.text and "Ön YASS" in a.text for a in deeper.assumptions)
    pile.front_water_depth = 4.0
    shallower = design_sheet_pile_structure(project, "sheet")
    # In this sand, lost effective passive resistance exceeds the opposing water thrust.
    assert shallower.result.D > deeper.result.D


@pytest.mark.parametrize("field,value", [
    ("depth_increase", 0.3), ("anchor_spacing", 2.0),
    ("anchor_inclination", 15.0), ("front_water_depth", 5.0),
])
def test_sheet_pile_optional_inputs_invalidate_fingerprint(field, value):
    project = _sheet_project()
    pile = project.structure("sheet")
    pile.support, pile.anchor_depth = "anchored", 1.0
    pile.result_hash = calculation_fingerprint(project, pile)
    setattr(pile, field, value)
    assert calculation_fingerprint(project, pile) != pile.result_hash


@pytest.mark.parametrize("seismic", [False, True])
def test_sheet_pile_front_override_limit_states_require_water_and_match_soil(seismic):
    from geotek.api.calculation_results import sheet_pile_result

    # EC7 has no seismic combination; AASHTO provides Extreme Event I.
    code = "aashto_lrfd" if seismic else "ec7"
    project = _sheet_project(advanced=True, code=code)
    pile = project.structure("sheet")
    pile.sds = 0.3 if seismic else None
    pile.front_water_depth = 8.0
    missing = required_factors(project, "sheet")
    assert any("WA" in item.path for item in missing)
    project.design_overrides[code] = {
        item.path: FactorOverride(value=1.0, note="Test water factor") for item in missing
    }
    original = project.model_dump_json()
    actual = design_sheet_pile_structure(project, "sheet")
    assert project.model_dump_json() == original
    reference = copy.deepcopy(project)
    reference.structure("sheet").front_water_depth = None
    reference.structure("sheet").soil.gwt_front = GroundwaterCondition(depth_insitu=8.0)
    expected = design_sheet_pile_structure(reference, "sheet")
    for key, case in actual.cases.items():
        assert case.D == expected.cases[key].D
        assert case.M_max == expected.cases[key].M_max
    assert any("Ön YASS" in item.text for item in actual.assumptions)
    assert any("Ön YASS" in item.text for item in sheet_pile_result("sheet", actual).assumptions)


def test_sheet_pile_optional_inputs_gtk_round_trip_and_old_file(tmp_path):
    from geotek.io.project_io import load_project, save_project

    project = _sheet_project()
    path = save_project(project, tmp_path / "old")
    payload = json.loads(path.read_text(encoding="utf-8"))
    names = ("depth_increase", "anchor_spacing", "anchor_inclination", "front_water_depth")
    for name in names:
        payload["structures"][0].pop(name)
    path.write_text(json.dumps(payload), encoding="utf-8")
    loaded = load_project(path)
    assert loaded == project
    pile = loaded.structure("sheet")
    pile.support, pile.anchor_depth = "anchored", 1.0
    pile.depth_increase, pile.anchor_spacing = 0.3, 2.0
    pile.anchor_inclination, pile.front_water_depth = 15.0, 5.0
    assert load_project(save_project(loaded, tmp_path / "new")) == loaded


@pytest.mark.parametrize("inputs", [
    {"depth_increase": -0.1}, {"anchor_spacing": 0}, {"anchor_spacing": -1},
    {"anchor_inclination": -1}, {"anchor_inclination": 90},
    {"front_water_depth": -1},
    {"support": "cantilever", "anchor_spacing": 1},
    {"support": "cantilever", "anchor_inclination": 0},
])
def test_sheet_pile_optional_input_validation(inputs):
    from pydantic import ValidationError
    from geotek.api.schemas import SheetPileCreate

    payload = _sheet_project().structure("sheet").model_dump()
    payload.update(support="anchored", anchor_depth=1.0)
    payload.update(inputs)
    with pytest.raises(ValidationError):
        SheetPileStructure.model_validate(payload)
    with pytest.raises(ValidationError):
        SheetPileCreate.model_validate({k: v for k, v in payload.items()
                                       if k not in {"id", "result", "result_hash"}})


def test_sheet_pile_partial_envelope_and_missing_water_factor():
    project = _sheet_project(advanced=True, code="ec7")
    result = design_sheet_pile_structure(project, "sheet")
    assert isinstance(result, SheetPileDesign)
    assert result.D_required == max(case.D for case in result.cases.values())
    assert result.M_design == max(case.M_max for case in result.cases.values())
    wet = _sheet_project(advanced=True, code="ec7", wet=True)
    assert any(m.path.endswith(".WA") for m in required_factors(wet, "sheet"))
    assert not any(m.path.startswith("EQU.") for m in required_factors(wet, "sheet"))
    with pytest.raises(MissingFactorsError):
        design_sheet_pile_structure(wet, "sheet")


@pytest.mark.parametrize("separate_heads", [False, True])
def test_wall_service_selects_seismic_water_for_checks_diagrams_and_bishop(monkeypatch, separate_heads):
    from geotek.engine.stability import SlipResult
    from geotek.engine.walls.base import CheckResult
    from geotek.engine.limit_state import verify_wall_layered
    from geotek.engine.walls.layered import bands_from_structure, soil_at_case
    from geotek.services import structures as service

    project = _project(with_global=True)
    structure = project.structure("wall")
    structure.settings.kv_sign = "up"  # Isolate water-case selection from the sign envelope.
    structure.inputs.gwt_case = "insitu"
    structure.soil.profile.gwt = GroundwaterCondition(depth_insitu=4, depth_design=3, depth_seismic=2)
    # soil_from_basic sets explicit heads; clear them to exercise profile fallback.
    structure.soil.gwt_retained = structure.soil.gwt_front = None
    if separate_heads:
        structure.soil.gwt_retained = GroundwaterCondition(depth_insitu=3.5, depth_design=3, depth_seismic=1.5)
        structure.soil.gwt_front = GroundwaterCondition(depth_insitu=4.9, depth_design=4.8, depth_seismic=4.5)
    before = project.model_dump_json()
    captured = []

    def capture(geometry, backfill, bands, loads, settings, **kwargs):
        captured.append((kwargs["seismic"], kwargs["water_level"], bands, kwargs["retained_bands"]))
        return (SlipResult(fs=2, xc=1, yc=8, radius=10, x_entry=10, x_exit=-2),
                CheckResult("global_stability", 2, 1.5, True))

    monkeypatch.setattr(service, "wall_global_stability", capture)
    result = check_structure(project, "wall")
    assert project.model_dump_json() == before
    loads, _, _ = service._loads(structure)
    settings = service._settings(project, structure)
    for i, (state, case) in enumerate([("static", "insitu"), ("seismic", "seismic")]):
        seismic = state == "seismic"
        expected = verify_wall_layered(structure.geometry, structure.soil, loads, settings,
                                       seismic=seismic, approach=None, gwt_case=case)[0]
        for name, check in expected.checks.items():
            assert result.analyses[state].checks[name].value == pytest.approx(check.value)
        zr = structure.soil.retained_profile().gwt.depth_for(case)
        zf = structure.soil.front_profile().gwt.depth_for(case)
        assert result.pressures[f"{state}:retained"].component("water")[0] == pytest.approx(GAMMA_W * (5 - zr)**2 / 2)
        uplift = next(f for f in result.analyses[state].forces if f.name == "Uplift")
        assert uplift.fy == pytest.approx(structure.geometry.width * GAMMA_W * ((5 - zr) + (5 - zf)) / 2)
        retained, foundation = bands_from_structure(soil_at_case(structure.soil, case), 5)
        assert captured[i] == (seismic, 5 - min(zr, zf), foundation, retained)
    assert any("Deprem YASS senaryosu seismic" in a.text for a in result.assumptions)


def test_seismic_only_water_requires_explicit_seismic_WA_before_calculation():
    project = _project(advanced=True, code="aashto_lrfd")
    structure = project.structure("wall")
    structure.soil.gwt_retained = GroundwaterCondition(depth_insitu=100, depth_design=100, depth_seismic=2)
    missing = required_factors(project, "wall")
    assert {m.path for m in missing} == {"load.WA.extreme_I"}
    with pytest.raises(MissingFactorsError):
        check_structure(project, "wall")
    project.design_overrides["aashto_lrfd"] = {
        "load.WA.extreme_I": FactorOverride(value=1.1, note="E4 seismic water test input")}
    assert required_factors(project, "wall") == []
    result = check_structure(project, "wall")
    assert not any(f.kind == "WA" for f in result.analyses["static:Strength I"].forces)
    assert any(f.kind == "WA" for f in result.analyses["seismic:Extreme Event I"].forces)
    assert result.pressures["static:Strength I:retained"].component("water")[0] == 0
    assert result.pressures["seismic:Extreme Event I:retained"].component("water")[0] > 0


@pytest.mark.parametrize("water_side,depth", [("retained", 3), ("front", 8), ("front", 100)])
@pytest.mark.parametrize("r", [None, 1.5])
def test_tbdy_default_r_warning_for_wet_retained_or_foundation_layer(water_side, depth, r):
    project = _project()
    structure = project.structure("wall")
    structure.inputs.r = r
    setattr(structure.soil, f"gwt_{water_side}", GroundwaterCondition(
        depth_insitu=100, depth_design=100, depth_seismic=depth))
    result = check_structure(project, "wall")
    warnings = [w for w in result.warnings if "pore_pressure_r" in w]
    assert bool(warnings) == (r is None and depth < structure.soil.profile.bottom)
    if warnings:
        assert warnings[0] == "wall.warning.pore_pressure_r"
    assert result.kh == pytest.approx(0.4 * 0.5 / 1.5)  # warning never changes r


def test_passive_reduction_is_labelled_as_engineer_input():
    project = _project(sds=None, advanced=True)
    structure = project.structure("wall")
    structure.settings.use_passive = True
    structure.settings.passive_reduction = 0.4
    result = check_structure(project, "wall")
    text = "Pasif azaltma katsayısı = 0.4 — mühendis seçimi (yayımlanmış kaynak gösterilmedi)"
    assumptions = [a for a in result.assumptions if a.text == text]
    assert len(assumptions) == 1 and assumptions[0].source == "Kullanıcı girdisi"
    structure.settings.use_passive = False
    assert not any(a.text.startswith("Pasif azaltma katsayısı =") for a in check_structure(project, "wall").assumptions)


@pytest.mark.parametrize("static_case,static_depth", [("insitu", 4.0), ("design", 3.0)])
@pytest.mark.parametrize("override_side", [None, "retained", "front"])
def test_seismic_heads_keep_profile_fallback_with_one_side_override(static_case, static_depth, override_side):
    project = _project(advanced=True)
    structure = project.structure("wall")
    structure.inputs.gwt_case = static_case
    structure.soil.profile.gwt = GroundwaterCondition(depth_insitu=4, depth_design=3, depth_seismic=2)
    structure.soil.gwt_retained = structure.soil.gwt_front = None
    if override_side is not None:
        setattr(structure.soil, f"gwt_{override_side}", GroundwaterCondition(
            depth_insitu=3.5, depth_design=2.5, depth_seismic=1.5))
    before = project.model_dump_json()
    result = check_structure(project, "wall")
    assert project.model_dump_json() == before
    for state, profile_depth in [("static", static_depth), ("seismic", 2.0)]:
        retained_depth = profile_depth - 0.5 if override_side == "retained" else profile_depth
        front_depth = profile_depth - 0.5 if override_side == "front" else profile_depth
        water = next(f for f in result.analyses[state].forces if f.name == "Water (retained)")
        uplift = next(f for f in result.analyses[state].forces if f.name == "Uplift")
        assert -water.fx == pytest.approx(GAMMA_W * (5 - retained_depth)**2 / 2)
        assert result.pressures[f"{state}:retained"].component("water")[0] == pytest.approx(-water.fx)
        assert uplift.fy == pytest.approx(
            structure.geometry.width * GAMMA_W * ((5 - front_depth) + (5 - retained_depth)) / 2)


@pytest.mark.parametrize("sds,r,seismic_depth,expected_warning", [
    (0.5, None, 19.0, True),  # Only the foundation is wet in the seismic case.
    (0.5, None, 20.0, False),  # Water at the profile bottom wets no finite layer.
    (0.5, None, 100.0, False),  # Static saturation must not trigger this warning.
    (0.5, 0.8, 19.0, False),  # Preserve an explicitly chosen r, including r < 1.
    (None, None, 19.0, False),  # No seismic analysis, even with a wet profile.
])
def test_default_r_warning_uses_seismic_layer_overlap_and_preserves_input(sds, r, seismic_depth, expected_warning):
    project = _project(advanced=True, sds=sds)
    structure = project.structure("wall")
    structure.inputs.r = r
    structure.soil.profile.gwt = GroundwaterCondition(depth_insitu=3, depth_design=3, depth_seismic=seismic_depth)
    structure.soil.gwt_retained = structure.soil.gwt_front = None
    before = project.model_dump_json()
    result = check_structure(project, "wall")
    warnings = [w for w in result.warnings if "pore_pressure_r" in w]
    assert len(warnings) == int(expected_warning)
    if warnings:
        assert warnings[0] == "wall.warning.pore_pressure_r"
    assert project.model_dump_json() == before
    if sds is None:
        assert result.kh is None and result.kv is None
    else:
        kh = 0.4 * sds / (r if r is not None else 1.5)
        assert result.kh == pytest.approx(kh)
        assert result.kv == pytest.approx(kh / 2)


@pytest.mark.parametrize("reduction", [0.25, 0.75])
def test_passive_engineer_assumption_reports_custom_reduction_once(reduction):
    project = _project(advanced=True, sds=None)
    structure = project.structure("wall")
    structure.settings.use_passive = True
    structure.settings.passive_reduction = reduction
    result = check_structure(project, "wall")
    assumptions = [a for a in result.assumptions if a.text.startswith("Pasif azaltma katsayısı =")]
    assert [(a.text, a.source) for a in assumptions] == [
        (f"Pasif azaltma katsayısı = {reduction:g} — mühendis seçimi (yayımlanmış kaynak gösterilmedi)",
         "Kullanıcı girdisi")]


@pytest.mark.parametrize("advanced", [False, True])
@pytest.mark.parametrize("r", [1., 2.])
def test_submerged_service_uses_unreduced_water_kh_and_honours_mode(advanced, r):
    from geotek.services import structures as service

    project = _project(advanced=advanced)
    structure = project.structure("wall")
    structure.inputs.r = r
    structure.settings.submerged_seismic = "pervious"
    structure.soil.gwt_retained = GroundwaterCondition(depth_insitu=100, depth_seismic=2.)
    before = project.model_dump_json()
    loads, kh, kv = service._loads(structure)
    assert loads.water_kh == .4 * structure.inputs.sds
    assert kh == loads.water_kh / r and kv == kh / 2
    result = check_structure(project, "wall")
    assert project.model_dump_json() == before
    water = next(f for f in result.analyses["seismic"].forces
                 if f.name == "Dinamik su itkisi (TBDY Denk. 16.20)")
    assert water.fx == pytest.approx(-(7 / 12) * .2 * GAMMA_W * 3**2)
    assert water.fy == 0 and water.kind == "EQ" and water.y == pytest.approx(1.2)
    assert not any(f.name == water.name for f in result.analyses["static"].forces)
    assert any("seçim: pervious, yöneten: pervious." in w for w in result.warnings)
    assert any("Kısmen su altındaki dolgu" in w for w in result.warnings)
    assert any("16.07.2026 değişikliği" in w for w in result.warnings)
    assert any(a.source == "TBDY 2018 16.12.3.2, Denk. 16.26 ve 16.20"
               and "pervious" in a.text for a in result.assumptions)
    assert not any("hidrodinamik basınç, sıvılaşma" in a.text for a in result.assumptions)


def test_submerged_service_default_envelope_and_missing_permeability_warning():
    project = _project()
    structure = project.structure("wall")
    structure.soil.gwt_retained = GroundwaterCondition(depth_insitu=100, depth_seismic=0.)
    default = check_structure(project, "wall")
    assert structure.settings.submerged_seismic == "envelope"
    assert any("seçim: envelope, yöneten:" in w for w in default.warnings)
    assert not any("Kısmen su altındaki dolgu" in w for w in default.warnings)
    structure.settings.submerged_seismic = "by_permeability"
    classified = check_structure(project, "wall")
    assert any("k girilmedi" in w and "envelope" in w for w in classified.warnings)
    assert classified.analyses["seismic"].forces == default.analyses["seismic"].forces
    assert classified.result_hash != default.result_hash


@pytest.mark.parametrize("sds,r,side,depth,expected", [
    (.5, None, "retained", 2., True),
    (.5, 2., "retained", 2., True),
    (.5, 1., "retained", 2., False),
    (.5, .8, "retained", 2., False),
    (.5, 2., "retained", 5., False),
    (.5, 2., "front", 2., False),
    (None, 2., "retained", 2., False),
])
def test_submerged_r_reduction_warning_includes_explicit_r(sds, r, side, depth, expected):
    project = _project(sds=sds)
    structure = project.structure("wall")
    structure.inputs.r = r
    setattr(structure.soil, f"gwt_{side}", GroundwaterCondition(depth_insitu=100., depth_seismic=depth))
    before = project.model_dump_json()
    result = check_structure(project, "wall")
    warnings = [w for w in result.warnings if "submerged_fill_r" in w]
    assert len(warnings) == int(expected)
    if warnings:
        assert warnings[0] == "wall.warning.submerged_fill_r"
    assert project.model_dump_json() == before


def test_dry_service_does_not_report_submerged_assumptions_or_warnings():
    result = check_structure(_project(), "wall")
    assert not any(a.source == "TBDY 2018 16.12.3.2, Denk. 16.26 ve 16.20" for a in result.assumptions)
    assert not any("Su altındaki dolgu:" in w or "16.07.2026 değişikliği" in w for w in result.warnings)


def test_governing_check_ids_match_failing_checks_for_narrow_wall():
    project = _project(sds=0.5)
    project.structure("wall").geometry = proportion_for("cantilever", 5, 1.5, 0.6)
    result = check_structure(project, "wall")
    ids = [f"{case}:{name}" for case, a in result.analyses.items()
           for name, c in a.checks.items() if not c.passed]
    assert not result.passed and ids
    assert result.governing_check_ids == ids == result.governing.split(", ")
    assert not result.minimum_width_governs


def test_aashto_wall_makes_ls_extreme_assumption_visible():
    ls_warning = "report.assumption.wall.ls_extreme_i"

    result = check_structure(_project(advanced=True, code="aashto_lrfd"), "wall")
    assert any(f.path == "load.LS.extreme_I" for f in result.factors_used)
    assert any(a.code == "wall.ls_extreme_i" and "0.50" in a.text for a in result.assumptions)
    assert ls_warning in result.warnings
    other = check_structure(_project(advanced=True, code="asd"), "wall")
    assert ls_warning not in other.warnings


def test_sizing_treats_a_bearing_failure_as_a_failed_trial_width(monkeypatch):
    """A narrow trial whose base cannot carry the load must not abort the whole sizing job."""
    from geotek.core.errors import BearingFailureError
    from geotek.services import structures as service

    real = service._evaluate_wall
    tried = []

    def narrow_fails(structure, geometry, *args, **kwargs):
        tried.append(geometry.width)
        if geometry.width < 4.0:
            raise BearingFailureError("Horizontal load exceeds base adhesion (m H >= A' s_u N_c)")
        return real(structure, geometry, *args, **kwargs)

    project = _project(with_global=True, geometry=False)
    project.structure("wall").settings.kv_sign = "down"
    monkeypatch.setattr(service, "_evaluate_wall", narrow_fails)
    result = size_structure(project, "wall")
    assert min(tried) < 4.0
    assert result.passed and result.geometry.width == pytest.approx(4.50)

    def always_fails(*args, **kwargs):
        raise BearingFailureError("Eccentricity too large: effective width <= 0")

    monkeypatch.setattr(service, "_evaluate_wall", always_fails)
    with pytest.raises(BearingFailureError, match="effective width"):
        size_structure(project, "wall")
