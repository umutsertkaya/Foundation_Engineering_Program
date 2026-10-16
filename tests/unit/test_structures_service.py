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
from geotek.services.structures import check_structure, design_sheet_pile_structure, required_factors, size_structure
from geotek.services.walls_advanced import required_inputs
from geotek.services.walls_basic import BasicSheetPileResult, BasicWallInput, proportion_for, size_wall

BASIC = BasicWallInput(wall_type="cantilever", height=5.0, backfill_gamma=18.0, backfill_phi=32.0,
                       foundation_phi=30.0, foundation_gamma=19.0, surcharge=10.0, sds=0.5)


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
    assert result.iterations == basic.iterations
    assert result.kh == basic.kh and result.kv == basic.kv
    assert set(result.analyses) == {"static", "seismic"}
    for state, old in basic.analyses.items():
        new = result.analyses[state]
        assert set(new.checks) == set(old.checks)
        for key, old_check in old.checks.items():
            check = new.checks[key]
            assert check.value == pytest.approx(old_check.value, rel=1e-4, abs=1e-8)
            assert check.required == old_check.required
            assert check.passed == old_check.passed
        assert new.bearing.q_ult == pytest.approx(old.bearing.q_ult, rel=1e-4)
    for state, old_check in basic.global_stability.items():
        assert result.global_stability[state].value == pytest.approx(old_check.value, rel=1e-4)
        assert result.global_stability[state].required == old_check.required
    assert set(result.slip_results) == {"static", "seismic"}
    assert isinstance(result.pressures["static:retained"], PressureDistribution)
    assert isinstance(result.pressures["seismic:front"], PressureDistribution)
    assert all(a.text and a.source for a in result.assumptions)


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
    payload = {"structure": structure.model_dump(mode="json", exclude={"result_hash"}),
               "design_code": "asd", "design_overrides": {}}
    expected = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False,
                                         separators=(",", ":"), allow_nan=False).encode("utf-8")).hexdigest()
    assert result.result_hash == expected
    structure.result_hash = "previous-result"
    assert check_structure(project, "wall").result_hash == expected
    reordered = Project.model_validate_json(project.model_dump_json())
    assert check_structure(reordered, "wall").result_hash == expected
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
