import datetime as dt
import json

import pytest
from pydantic import ValidationError

from geotek.core.models import (
    Borehole,
    BoreholeLayer,
    CPTSounding,
    DerivedParameter,
    GroundwaterCondition,
    Investigations,
    ParameterSelection,
    Project,
    ProjectMeta,
    RetainingWallStructure,
    SheetPileStructure,
    SoilLayer,
    SoilProfile,
    StructureSoilModel,
    WallDesignInputs,
)
from geotek.core.models.walls import CantileverGeometry, GravityGeometry
from geotek.services.module1 import active_profile


def profile(bottom=8.0):
    layers = [
        SoilLayer(id="L1", top=0, bottom=2, uscs="SM", gamma=18),
        SoilLayer(id="L2", top=2, bottom=4, uscs="CL", gamma=17, behaviour="undrained"),
        SoilLayer(id="L3", top=4, bottom=bottom, uscs="SP", gamma=19),
    ]
    if bottom != 8.0:
        layers[-1] = SoilLayer(id="L3", top=4, bottom=bottom, uscs="SP", gamma=19)
    return SoilProfile(id="P1", source_ids=["SK-1"], gwt=GroundwaterCondition(depth_insitu=3), layers=layers)


def structure_soil(**updates):
    data = {"profile": profile(), "source_profile_id": "P1", "source_hash": profile().content_hash()}
    data.update(updates)
    return StructureSoilModel(**data)


def wall(**updates):
    data = dict(id="W1", wall_type="cantilever", height=5, embedment=0.6, soil=structure_soil())
    data.update(updates)
    return RetainingWallStructure(**data)


def test_borehole_layer_validation_normalises_sorts_and_allows_gaps():
    assert BoreholeLayer(top=1, bottom=2, uscs=" sm ").uscs == "SM"
    bh = Borehole(id="BH", log=[
        BoreholeLayer(top=3, bottom=4, uscs="SP"),
        BoreholeLayer(top=0, bottom=1, uscs="SM"),
    ])
    assert [(x.top, x.bottom) for x in bh.log] == [(0, 1), (3, 4)]
    with pytest.raises(ValidationError):
        BoreholeLayer(top=1, bottom=1)
    with pytest.raises(ValidationError):
        BoreholeLayer(top=0, bottom=1, uscs="BAD")
    with pytest.raises(ValidationError):
        Borehole(id="BH", log=[BoreholeLayer(top=0, bottom=2), BoreholeLayer(top=1, bottom=3)])


def test_parameter_selection_invariants():
    with pytest.raises(ValidationError):
        ParameterSelection(parameter="phi_eff", approved=True)
    with pytest.raises(ValidationError):
        ParameterSelection(parameter="phi_eff", statistic="mean_minus_k_sd")
    selection = ParameterSelection(
        parameter="phi_eff", statistic="mean_minus_k_sd", k_sd=1.0,
        selected=DerivedParameter(value=30, unit="deg", method_id="user", source="user"),
        approved=True, approved_at=dt.datetime(2026, 1, 1), basis_hash="abc",
    )
    assert selection.approved


def test_soil_layer_selection_key_must_match_parameter():
    with pytest.raises(ValidationError):
        SoilLayer(id="L", top=0, bottom=1, gamma=18, selections={
            "phi_eff": ParameterSelection(parameter="c_eff")
        })


def test_profile_content_hash_ignores_candidates_and_selections_but_tracks_design():
    base = profile()
    changed_metadata = base.model_copy(deep=True)
    changed_metadata.layers[0].params["x"] = DerivedParameter(
        value=1, unit="kPa", method_id="m", source="CPT"
    )
    changed_metadata.layers[0].selections["phi_eff"] = ParameterSelection(parameter="phi_eff")
    assert changed_metadata.content_hash() == base.content_hash()
    changed_design = base.model_copy(deep=True)
    changed_design.layers[0].design.phi_eff = 32
    assert changed_design.content_hash() != base.content_hash()


def test_structure_fill_validation_and_partial_trim():
    fill = [SoilLayer(id="F1", top=0, bottom=3, gamma=18)]
    model = structure_soil(retained_fill=fill)
    retained = model.retained_profile()
    assert [(x.id, x.top, x.bottom) for x in retained.layers] == [
        ("F1", 0, 3), ("L2", 3, 4), ("L3", 4, 8)
    ]
    with pytest.raises(ValidationError):
        structure_soil(retained_fill=[SoilLayer(id="F", top=1, bottom=2, gamma=18)])
    with pytest.raises(ValidationError):
        structure_soil(retained_fill=[SoilLayer(id="F", top=0, bottom=1, gamma=18),
                                      SoilLayer(id="F", top=1, bottom=2, gamma=18)])
    with pytest.raises(ValidationError):
        structure_soil(retained_fill=[SoilLayer(id="L1", top=0, bottom=1, gamma=18)])


def test_structure_water_profiles_and_zones():
    retained_gwt = GroundwaterCondition(depth_insitu=1)
    front_gwt = GroundwaterCondition(depth_insitu=4)
    model = structure_soil(gwt_retained=retained_gwt, gwt_front=front_gwt)
    assert model.retained_profile().gwt == retained_gwt
    assert model.front_profile().gwt == front_gwt
    zones = model.zones(4, 4)
    assert zones.front == []
    assert zones.backfill and zones.foundation
    with pytest.raises(ValueError):
        model.zones(4, 8)
    with pytest.raises(ValueError):
        model.zones(5, 4)


def test_structure_staleness():
    source = profile()
    model = StructureSoilModel(source_profile_id="P1", source_hash=source.content_hash(), profile=source)
    assert not model.is_stale(source)
    assert model.is_stale(None)
    altered = source.model_copy(deep=True)
    altered.layers[0].gamma = 18.5
    assert model.is_stale(altered)
    assert not structure_soil(source_profile_id=None, source_hash=None).is_stale(None)


def test_retaining_wall_constraints_and_front_depth():
    assert wall().front_depth == pytest.approx(4.4)
    gravity = GravityGeometry(height=5, base_width=3, top_width=1, embedment=0.6)
    with pytest.raises(ValidationError):
        wall(geometry=gravity)
    with pytest.raises(ValidationError):
        wall(geometry=CantileverGeometry(stem_height=4, stem_top=0.2, stem_bottom=0.4,
                                         toe=0.5, heel=1, base_thickness=1, embedment=0.6), height=6)
    with pytest.raises(ValidationError):
        wall(geometry=CantileverGeometry(stem_height=4, stem_top=0.2, stem_bottom=0.4,
                                         toe=0.5, heel=1, base_thickness=1, embedment=0.8))
    with pytest.raises(ValidationError):
        wall(embedment=5)
    with pytest.raises(ValidationError):
        wall(soil=structure_soil(profile=profile(bottom=5)))


def test_sheet_pile_anchor_and_profile_coverage():
    with pytest.raises(ValidationError):
        SheetPileStructure(id="S", support="anchored", retained_height=3, soil=structure_soil())
    with pytest.raises(ValidationError):
        SheetPileStructure(id="S", support="anchored", retained_height=3, anchor_depth=3,
                           soil=structure_soil())
    with pytest.raises(ValidationError):
        SheetPileStructure(id="S", retained_height=8, soil=structure_soil())
    anchored = SheetPileStructure(id="S", support="anchored", retained_height=3, anchor_depth=1,
                                  soil=structure_soil())
    assert anchored.anchor_depth == 1


def test_project_structure_union_and_active_profile():
    bh = Borehole(id="SK-1")
    cpt = CPTSounding(id="CPT-1", depth=[1], qc=[1000], fs=[10])
    p1 = profile()
    p2 = p1.model_copy(update={"id": "P2"})
    project = Project(meta=ProjectMeta(name="x"), investigations=Investigations(boreholes=[bh], cpts=[cpt]),
                      soil_profiles=[p1, p2], active_profile_id="P2", structures=[wall()])
    assert active_profile(project).id == "P2"
    assert project.structure("W1").id == "W1"
    assert project.model_copy(update={"active_profile_id": None}).active_profile().id == "P1"
    with pytest.raises(ValidationError):
        Project(meta=ProjectMeta(name="x"), soil_profiles=[p1], active_profile_id="missing")
    with pytest.raises(ValidationError):
        Project(meta=ProjectMeta(name="x"), soil_profiles=[p1, p1.model_copy(deep=True)])
    with pytest.raises(ValidationError):
        Project(meta=ProjectMeta(name="x"), structures=[wall(), wall()])
    payload = json.loads(project.model_dump_json())
    restored = Project.model_validate(payload)
    assert isinstance(restored.structure("W1"), RetainingWallStructure)
