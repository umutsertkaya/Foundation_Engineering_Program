"""Hand calculations for the pure E3 service; no UI or external data required."""

import datetime as dt
import math

import pytest
from pydantic import ValidationError

from geotek.core.models.investigations import (
    Borehole, CPTSounding, Investigations, LabRecord, SPTRecord,
)
from geotek.core.models.parameters import DerivedParameter, ParameterSelection
from geotek.core.models.profile import (
    DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile,
)
from geotek.core.models.project import Project, ProjectMeta
from geotek.services.parameters import (
    approve, basis_hash, evaluate_candidates, layer_points, refresh_profile, resolve, suggest,
)


def _layer(**updates):
    return SoilLayer(**{"id": "L", "top": 0, "bottom": 4, "gamma": 20, **updates})


def _project(*, layers=None, boreholes=None, cpts=None, source_ids=None):
    boreholes, cpts = boreholes or [], cpts or []
    sources = [b.id for b in boreholes] + [c.id for c in cpts]
    profile = SoilProfile(
        id="P", source_ids=sources if source_ids is None else source_ids,
        gwt=GroundwaterCondition(depth_insitu=10), layers=layers or [_layer()],
    )
    return Project(
        meta=ProjectMeta(name="E3", date=dt.date(2026, 10, 19)),
        investigations=Investigations(boreholes=boreholes, cpts=cpts), soil_profiles=[profile],
    )


def _candidate(value, method="test", *, unit="deg", source="SPT", **kwargs):
    return DerivedParameter(value=value, unit=unit, method_id=method, source=source, **kwargs)


def test_layer_points_spt_interval_sources_lab_and_no_mutation():
    bh = Borehole(
        id="BH", spt=[SPTRecord(depth=z, n_field=20) for z in (0.5, 1, 2, 3, 8)],
        lab=[LabRecord(depth=1.5, LL=30, PL=20, FC=60), LabRecord(depth=3, c_eff=90)],
    )
    other = Borehole(id="OTHER", spt=[SPTRecord(depth=1, n_field=100)])
    project = _project(boreholes=[bh, other])
    before = project.model_dump()
    layer = _layer(top=1, bottom=3, source_ids=["BH"])
    points = layer_points(project, project.profile("P"), layer)
    # [1,3): SPT at 1 and 2 plus the lab at 1.5; neither boundary 3 nor depth 8 enters.
    assert [p["depth"] for p in points] == [1, 1.5, 2]
    # N60 = 20*(60/60)*1*1*0.75 = 15; sigma'=20*1=20;
    # CN=min(sqrt(101.325/20),1.7)=1.7, so (N1)60=25.5.
    assert points[0]["N60"] == 15
    assert points[0]["N1_60"] == pytest.approx(25.5)
    assert points[0]["sigma_v"] == points[0]["sigma_v_eff"] == 20
    assert points[0]["u0"] == 0
    # PI = LL-PL = 30-20 = 10, at its own sample depth (not repeated at SPT depths).
    assert points[1]["PI"] == 10
    assert "PI" not in points[0] and "PI" not in points[2]
    assert project.model_dump() == before


def test_layer_points_cpt_uses_profile_and_crops_long_sounding():
    cpt = CPTSounding(
        id="CPT", area_ratio=0.8, depth=[0.5, 1, 2, 3, 9],
        qc=[1000] * 5, fs=[10] * 5, u2=[50] * 5,
    )
    project = _project(cpts=[cpt])
    points = layer_points(project, project.profile("P"), _layer(top=1, bottom=3))
    # [1,3) includes 1,2 only. qt=1000+50*(1-.8)=1010 kPa;
    # dry profile sigma_v=20*z, u0=0, so sigma'_v=20 and 40 kPa.
    assert [p["depth"] for p in points] == [1, 2]
    assert [p["qt"] for p in points] == pytest.approx([1010, 1010])
    assert [p["sigma_v_eff"] for p in points] == [20, 40]
    assert all(p["u2"] == 50 and p["u0"] == 0 and "Ic" in p for p in points)
    assert all(isinstance(value, float) for point in points for value in point.values())


def test_layer_points_profile_fallback_manual_and_unknown_source():
    project = _project(boreholes=[Borehole(id="BH", lab=[LabRecord(depth=1, gamma=18)])])
    profile = project.profile("P")
    # An empty layer source list inherits the profile: one measured point at z=1.
    assert layer_points(project, profile, profile.layers[0]) == [{"depth": 1.0, "gamma": 18.0}]
    manual = profile.model_copy(update={"source_ids": []})
    assert layer_points(project, manual, manual.layers[0]) == []
    with pytest.raises(KeyError, match="Unknown layer sources"):
        layer_points(project, profile, _layer(source_ids=["missing"]))


def test_evaluate_candidates_one_mean_and_depth_spread_per_method():
    points = [{"depth": 1, "N1_60": 5}, {"depth": 2, "N1_60": 20}]
    before = [dict(p) for p in points]
    candidates = {c.method_id: c for c in evaluate_candidates(points, "phi_eff", [])}
    # HU: sqrt(20*5)+20=30; sqrt(20*20)+20=40; mean=35.
    hu = candidates["HU1996_phi_SPT"]
    assert hu.value == 35 and hu.validity_ok
    assert hu.stats.model_dump() == {"n": 2, "min": 30, "mean": 35, "max": 40}
    # PHT: 27.1+.3*5-.00054*25=28.5865; at 20 ->32.884;
    # their arithmetic mean is 30.73525 (evaluate at each depth before averaging).
    assert candidates["PHT1974_phi_SPT"].value == pytest.approx(30.73525)
    assert set(candidates) == {"HU1996_phi_SPT", "PHT1974_phi_SPT"}
    assert points == before


def test_evaluate_lab_values_zero_pi_and_no_duplicate_samples():
    lab = [LabRecord(depth=1, c_eff=0, phi_eff=32, PI=20),
           LabRecord(depth=2, c_eff=10, phi_eff=36, PI=20)]
    points = [r.model_dump(exclude_none=True) for r in lab]
    candidates = {c.method_id: c for c in evaluate_candidates(points, "phi_eff", lab)}
    # Two measured angles average (32+36)/2=34, range 32..36, n=2.
    measured = candidates["lab_phi_eff"]
    assert measured.value == 34 and measured.stats.n == 2
    assert measured.stats.min == 32 and measured.stats.max == 36
    # sin(phi)=.8-.094*ln(20); phi=31.2250658742 deg. PI appears twice, not four times.
    pi = candidates["TPM1996_phi_PI"]
    assert pi.value == pytest.approx(31.2250658742)
    assert pi.stats.n == 2
    # Zero is a measurement: (0+10)/2=5, not 10.
    cohesion = evaluate_candidates(points, "c_eff", lab)[0]
    assert cohesion.value == 5 and cohesion.stats.n == 2
    # Supplying only lab still makes its PI available to the registered formula.
    assert {c.method_id for c in evaluate_candidates([], "phi_eff", lab)} == set(candidates)


def test_evaluate_nonfinite_and_invalid_candidates_stay_visible():
    candidates = evaluate_candidates([{"N1_60": 5}, {"N1_60": 45}], "phi_eff", [])
    hu = next(c for c in candidates if c.method_id == "HU1996_phi_SPT")
    # HU yields 30 and 50, mean=40, but N1_60=45 exceeds its upper validity limit 30.
    assert hu.value == 40 and hu.stats.n == 2
    assert not hu.validity_ok and hu.warnings
    # qc/sigma'=100/0 is undefined: preserve the applicable method as invalid,
    # with no finite observations (rather than fabricating a value or failing refresh).
    zero_stress = evaluate_candidates([{"qc": 100, "sigma_v_eff": 0}], "phi_eff", [])
    assert len(zero_stress) == 1 and not zero_stress[0].validity_ok
    assert math.isnan(zero_stress[0].value) and zero_stress[0].stats is None


def test_cpt_unit_weight_uses_only_registered_formula():
    points = [{"qt": 10132.5, "fs": 101.325}, {"qt": 1013.25, "fs": 10.1325}]
    # In both rows Rf=1%, so log10(Rf)=0. qt/Pa=100 and 10:
    # gamma=9.81*(.36*2+1.236)=19.18836 and 9.81*(.36+1.236)=15.65676.
    candidates = evaluate_candidates(points, "gamma", [])
    assert len(candidates) == 1 and candidates[0].method_id == "RC2010_gamma_CPT"
    candidate = candidates[0]
    assert candidate.source == "CPT" and candidate.value == pytest.approx(17.42256)
    assert candidate.stats.min == pytest.approx(15.65676)
    assert candidate.stats.max == pytest.approx(19.18836) and candidate.stats.n == 2


def test_suggest_prefers_measured_lab_then_valid_registry_mean():
    lab = [LabRecord(depth=1, phi_eff=32, PI=20)]
    candidates = evaluate_candidates([{"N1_60": 20}], "phi_eff", lab)
    before = [c.model_dump() for c in candidates]
    suggestion = suggest(candidates, "phi_eff", _layer())
    # Direct measurement 32 wins over HU=40, PHT=32.884 and PI-derived phi=31.23.
    assert suggestion.value == 32 and suggestion.method_id == "lab_phi_eff"
    assert [c.model_dump() for c in candidates] == before
    candidates = evaluate_candidates([{"N1_60": 20}], "phi_eff", [])
    suggestion = suggest(candidates, "phi_eff", _layer())
    # registry.combine uses (40+32.884)/2=36.442; no reliability weighting.
    assert suggestion.value == pytest.approx(36.442)
    bad = [c.model_copy(update={"validity_ok": False}) for c in candidates]
    assert suggest(bad, "phi_eff", _layer()) is None
    # Source='lab' with a caller-supplied measurement id also has priority: 28 degrees.
    measurement = _candidate(28, "direct_shear_test", source="lab")
    assert suggest(candidates + [measurement], "phi_eff", _layer()).value == 28


def test_pi_correlation_does_not_override_direct_registry_suggestions_as_a_measurement():
    candidates = evaluate_candidates([{"N1_60": 20}], "phi_eff", [LabRecord(depth=1, PI=20)])
    suggestion = suggest(candidates, "phi_eff", _layer())
    # PI is a correlation, not a measured angle: average (40+32.884+31.2250658742)/3.
    assert suggestion.value == pytest.approx(34.7030219581)
    assert suggestion.method_id.startswith("mean(")


@pytest.mark.parametrize("uscs", ["GW", "SP", "SW-SM", "GC-GM", " sm "])
def test_granular_cohesion_zero_has_contract_reference(uscs):
    # The contract permits c'=0 for every G*/S* group; no coefficient is fitted.
    result = suggest([], "c_eff", _layer(uscs=uscs))
    assert result.value == 0
    assert result.reference == "FHWA GEC-5: granüler zeminde c' = 0"


@pytest.mark.parametrize("uscs", ["CL", "CH", "ML", "CL-ML", "PT", None])
def test_no_fine_grained_or_unknown_cohesion_default(uscs):
    # No measured c' and no granular evidence means no numeric suggestion.
    assert suggest([], "c_eff", _layer(uscs=uscs)) is None


@pytest.mark.parametrize("ic, expected", [(2.59, 0), (2.6, None), (3.0, None)])
def test_cohesion_ic_cutoff_and_lab_priority(ic, expected):
    layer = _layer(params={"Ic": _candidate(ic, source="CPT", unit="-")})
    # Strict Ic<2.6: 2.59 permits zero; 2.60 and 3.00 do not.
    result = suggest([], "c_eff", layer)
    assert (result.value if result is not None else None) == expected
    # A measured c'=7 supersedes the granular-zero rule in every case.
    measured = evaluate_candidates([], "c_eff", [LabRecord(depth=1, c_eff=7)])
    assert suggest(measured, "c_eff", layer).value == 7


@pytest.mark.parametrize("phi, expected", [(0, 0), (20, 20), (45, 30.9637565321)])
def test_delta_base_formula_in_degrees(phi, expected):
    layer = _layer(design=DesignParameters(phi_eff=phi))
    # tan20<.6 -> atan(tan20)=20deg; tan45=1>.6 -> atan(.6)=30.9637565321deg.
    result = suggest([], "delta_base", layer)
    assert result.value == pytest.approx(expected)
    assert result.inputs_used == {"phi_eff": phi}
    assert result.reference == "TBDY 2018 Tablo 16.3 (yerinde dökme beton)"


def test_delta_provisional_phi_and_no_spt_unit_weight():
    layer = _layer(selections={"phi_eff": ParameterSelection(
        parameter="phi_eff", suggested=_candidate(20),
    )})
    # Provisional phi=20 gives delta=20 without writing either value to design.
    assert suggest([], "delta_base", layer).value == pytest.approx(20)
    assert layer.design.phi_eff is None and layer.design.delta_base is None
    assert suggest([], "delta_base", _layer()) is None
    # Existing confirmed phi'=10 takes precedence over a new provisional phi'=20.
    layer.design.phi_eff = 10
    assert suggest([], "delta_base", layer).value == pytest.approx(10)
    # Registry has no SPT gamma or gamma_sat formula, so N alone yields no suggestion.
    for key in ("gamma", "gamma_sat"):
        candidates = evaluate_candidates([{"N60": 20, "N1_60": 20}], key, [])
        assert candidates == [] and suggest(candidates, key, layer) is None


def test_resolve_correlation_manual_and_suggestion_remain_unapproved_copies():
    candidate = _candidate(32, "method")
    original = ParameterSelection(
        parameter="phi_eff", candidates=[candidate], mode="correlation", method_id="method",
        selected=candidate, approved=True, approved_at=dt.datetime(2026, 1, 1), basis_hash="old",
    )
    before = original.model_dump()
    chosen = resolve(original)
    # Choosing the sole method returns its exact 32 degrees, revoking old approval.
    assert chosen.selected.value == 32 and chosen.selected is not original.candidates[0]
    assert not chosen.approved and chosen.approved_at is None and chosen.basis_hash is None
    assert original.model_dump() == before
    # An explicit manual value of zero is preserved, not treated as missing.
    manual = resolve(ParameterSelection(parameter="c_eff", mode="manual", manual_value=0))
    assert manual.selected.value == 0 and manual.selected.user_override and not manual.approved
    layer = _layer(uscs="SP")
    suggestion = suggest([], "c_eff", layer)
    chosen = resolve(ParameterSelection(
        parameter="c_eff", mode="correlation", method_id=suggestion.method_id, suggested=suggestion,
    ))
    assert chosen.selected.value == 0 and not chosen.approved


@pytest.mark.parametrize("statistic, expected", [
    ("mean", 7), ("median", 6), ("min", 3), ("max", 12), ("mean_minus_k_sd", 7 - math.sqrt(14)),
])
def test_resolve_statistics_over_valid_candidate_representatives(statistic, expected):
    # Representatives 3,6,12: mean=7; median=6; population variance=(16+1+25)/3=14.
    # With user k=1, mean-k*SD=7-sqrt(14); invalid 99 and NaN do not enter the pool.
    selection = ParameterSelection(
        parameter="su", mode="statistic", statistic=statistic,
        k_sd=1 if statistic == "mean_minus_k_sd" else None,
        candidates=[_candidate(v, str(v), unit="kPa") for v in (3, 6, 12)] + [
            _candidate(99, unit="kPa", validity_ok=False), _candidate(math.nan, unit="kPa"),
        ],
    )
    result = resolve(selection)
    assert result.selected.value == pytest.approx(expected)
    assert result.selected.stats.n == 3 and not result.approved


def test_resolve_single_candidate_population_sd_is_zero():
    selection = ParameterSelection(
        parameter="su", mode="statistic", statistic="mean_minus_k_sd", k_sd=2,
        candidates=[_candidate(50, unit="kPa")],
    )
    # A one-value population has SD=0: 50-2*0=50 (no inferred k, no sample-SD error).
    assert resolve(selection).selected.value == 50


def test_resolve_rejects_missing_choice_k_and_invalid_pools():
    # Missing k cannot imply k=0 or k=1; a suggestion alone is not an engineer choice.
    with pytest.raises(ValidationError, match="user-entered k_sd"):
        ParameterSelection(parameter="su", mode="statistic", statistic="mean_minus_k_sd")
    for selection in (
        ParameterSelection(parameter="phi_eff", suggested=_candidate(30)),
        ParameterSelection(parameter="phi_eff", mode="manual"),
        ParameterSelection(parameter="phi_eff", mode="correlation", method_id="missing"),
        ParameterSelection(parameter="phi_eff", mode="statistic", statistic="mean"),
        ParameterSelection(parameter="phi_eff", mode="statistic", candidates=[_candidate(30)]),
        ParameterSelection(parameter="phi_eff", mode="manual", manual_value=math.inf),
    ):
        with pytest.raises(ValueError):
            resolve(selection)


def test_approve_only_requested_keys_validate_and_preserve_input():
    values = {"phi_eff": 32, "c_eff": 5, "su": 50, "E": 10000, "delta_base": 20,
              "gamma": 18, "gamma_sat": 21}
    layer = _layer(selections={key: ParameterSelection(
        parameter=key, mode="manual", manual_value=value,
    ) for key, value in values.items()})
    before = layer.model_dump()
    now = dt.datetime(2026, 10, 19, 12, tzinfo=dt.timezone.utc)
    # Approve phi'=32 and gamma=18 only: the other five quantities keep their old values.
    partial = approve(layer, ["phi_eff", "gamma"], "basis", now)
    assert partial.design.phi_eff == 32 and partial.gamma == 18
    assert partial.design.c_eff == 0 and partial.design.su is None
    assert partial.design.E is None and partial.design.delta_base is None
    assert partial.gamma_sat == 20
    assert not partial.selections["su"].approved
    # Approving all seven copies exactly the seven explicit user numbers.
    result = approve(layer, list(values), "basis", now)
    for key, value in values.items():
        assert (getattr(result, key) if key in ("gamma", "gamma_sat")
                else getattr(result.design, key)) == value
        selection = result.selections[key]
        assert selection.approved and selection.approved_at == now
        assert selection.basis_hash == "basis"
    assert layer.model_dump() == before
    invalid = _layer(selections={"gamma": ParameterSelection(
        parameter="gamma", mode="manual", manual_value=31,
    )})
    with pytest.raises(ValidationError):
        approve(invalid, ["gamma"], "basis", now)
    assert invalid.gamma == 20 and not invalid.selections["gamma"].approved
    with pytest.raises(ValueError, match="basis_hash"):
        approve(layer, ["phi_eff"], "", now)
    with pytest.raises(KeyError):
        approve(_layer(), ["phi_eff"], "basis", now)


def test_basis_hash_tracks_bounds_and_input_multiset_only():
    layer = _layer()
    points = [{"depth": 1, "N60": 10}, {"depth": 2, "PI": 20}]
    original = basis_hash(layer, points)
    # Same two numeric rows, regardless of key/list order or integer/float spelling.
    assert len(original) == 64
    reordered = [{"PI": 20.0, "depth": 2.0}, {"N60": 10.0, "depth": 1.0}]
    assert basis_hash(layer, reordered) == original
    # A 10->11 input change, an extra observation, or bottom 4->5 changes the basis.
    assert basis_hash(layer, [{"depth": 1, "N60": 11}, points[1]]) != original
    assert basis_hash(layer, points + [points[0]]) != original
    assert basis_hash(layer.model_copy(update={"bottom": 5}), points) != original
    bookkeeping = layer.model_copy(deep=True)
    bookkeeping.design.phi_eff = 30
    bookkeeping.params["x"] = _candidate(12)
    bookkeeping.selections["phi_eff"] = ParameterSelection(parameter="phi_eff")
    assert basis_hash(bookkeeping, points) == original


def test_refresh_candidates_content_hash_and_purity_without_auto_approval():
    borehole = Borehole(id="BH", lab=[LabRecord(depth=1, phi_eff=32, gamma=18)])
    project = _project(boreholes=[borehole])
    before = project.model_dump()
    profile = project.profile("P")
    result = refresh_profile(project, "P")
    layer = result.layers[0]
    # Suggestions are measured phi=32, gamma=18; delta=atan(.6)=30.9637565 degrees.
    assert layer.selections["phi_eff"].suggested.value == 32
    assert layer.selections["gamma"].suggested.value == 18
    assert layer.selections["delta_base"].suggested.value == pytest.approx(30.9637565321)
    assert layer.design.phi_eff is None and layer.gamma == 20
    assert all(not s.approved and s.selected is None for s in layer.selections.values())
    assert result.content_hash() == profile.content_hash()
    assert project.model_dump() == before
    with pytest.raises(KeyError):
        refresh_profile(project, "missing")


def test_refresh_preserves_matching_approval_then_revokes_changed_lab_basis():
    project = _project(boreholes=[Borehole(id="BH", lab=[LabRecord(depth=1, phi_eff=32)])])
    refreshed = refresh_profile(project, "P")
    layer = refreshed.layers[0]
    layer.selections["phi_eff"].mode = "correlation"
    layer.selections["phi_eff"].method_id = "lab_phi_eff"
    now = dt.datetime(2026, 10, 19, tzinfo=dt.timezone.utc)
    approved_basis = basis_hash(layer, layer_points(project, refreshed, layer))
    refreshed.layers[0] = approve(layer, ["phi_eff"], approved_basis, now)
    project.soil_profiles = [refreshed]
    # An unchanged measured angle of 32 retains the exact approval and design value.
    assert refresh_profile(project, "P").layers[0].selections["phi_eff"].approved
    project.investigations.boreholes[0].lab[0].phi_eff = 36
    before = project.model_dump()
    result = refresh_profile(project, "P")
    selection = result.layers[0].selections["phi_eff"]
    # New lab angle 36 changes the basis: proposal=36, old selected/design=32 retained.
    assert selection.suggested.value == 36 and selection.selected.value == 32
    assert not selection.approved and selection.approved_at == now
    assert selection.basis_hash == approved_basis
    new_points = layer_points(project, result, result.layers[0])
    assert basis_hash(result.layers[0], new_points) != approved_basis
    assert result.layers[0].design.phi_eff == 32
    assert result.content_hash() == refreshed.content_hash()
    assert project.model_dump() == before
    # Reapproval is explicit and then changes the engineering content hash (32 -> 36).
    current = basis_hash(result.layers[0], layer_points(project, result, result.layers[0]))
    result.layers[0] = approve(result.layers[0], ["phi_eff"], current, now)
    assert result.layers[0].design.phi_eff == 36
    assert result.content_hash() != refreshed.content_hash()


def test_refresh_changed_bounds_revokes_approval_even_without_measurements():
    layer = _layer(selections={"su": ParameterSelection(
        parameter="su", mode="manual", manual_value=50,
    )})
    original_basis = basis_hash(layer, [])
    layer = approve(layer, ["su"], original_basis, dt.datetime(2026, 10, 19))
    layer.bottom = 5
    project = _project(layers=[layer])
    result = refresh_profile(project, "P")
    # The approved interval [0,4) became [0,5): stale, but su=50 remains in design.
    assert not result.layers[0].selections["su"].approved
    assert result.layers[0].selections["su"].basis_hash == original_basis
    assert result.layers[0].design.su == 50
    assert result.content_hash() == project.profile("P").content_hash()


def test_refresh_uses_lab_classification_and_cpt_ic_without_editing_uscs():
    granular = _project(boreholes=[Borehole(id="BH", lab=[LabRecord(depth=1, FC=3, gravel=0)])])
    fine = _project(boreholes=[Borehole(id="BH", lab=[LabRecord(depth=1, FC=80, LL=40, PL=20)])])
    # FC=3<5 and gravel=0 classifies as SP; FC=80>=50, PI=20>.73*(40-20)=14.6 -> CL.
    sand = refresh_profile(granular, "P")
    clay = refresh_profile(fine, "P")
    assert sand.layers[0].selections["c_eff"].suggested.value == 0
    assert clay.layers[0].selections["c_eff"].suggested is None
    assert sand.layers[0].uscs is None and clay.layers[0].uscs is None
    assert sand.content_hash() == granular.profile("P").content_hash()
    assert clay.content_hash() == fine.profile("P").content_hash()
    cpt = CPTSounding(id="CPT", depth=[1], qc=[10000], fs=[10])
    project = _project(cpts=[cpt])
    # At z=1, sigma'=20: iterative Ic is about 1.2 (well below 2.6); c'=0 is permitted.
    result = refresh_profile(project, "P")
    assert result.layers[0].params["Ic"].value < 2.6
    assert result.layers[0].selections["c_eff"].suggested.value == 0
    assert result.content_hash() == project.profile("P").content_hash()
