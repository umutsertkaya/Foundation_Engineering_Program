import pytest
from pydantic import ValidationError

from geotek.core.errors import ProfileError
from geotek.core.models import (
    Borehole,
    CPTSounding,
    GroundwaterCondition,
    Investigations,
    LabRecord,
    Project,
    ProjectMeta,
    SiteSeismic,
    SoilLayer,
    SoilProfile,
    SPTRecord,
)


def test_lab_record_derives_pi_and_rejects_inconsistent():
    assert LabRecord(depth=2, LL=45, PL=20).PI == 25
    with pytest.raises(ValidationError):
        LabRecord(depth=2, LL=45, PL=20, PI=10)
    with pytest.raises(ValidationError):
        LabRecord(depth=2, LL=20, PL=30)


def test_borehole_sorts_spt_and_rejects_duplicates():
    bh = Borehole(id="BH1", spt=[SPTRecord(depth=4.5, n_field=12), SPTRecord(depth=1.5, n_field=5)])
    assert [r.depth for r in bh.spt] == [1.5, 4.5]
    with pytest.raises(ValidationError):
        Borehole(id="BH1", spt=[SPTRecord(depth=1.5, n_field=5), SPTRecord(depth=1.5, n_field=6)])


def test_cpt_validation():
    ok = CPTSounding(id="C1", depth=[0.1, 0.2], qc=[1000, 1200], fs=[10, 12])
    assert ok.arrays()["qc"].tolist() == [1000, 1200]
    with pytest.raises(ValidationError):
        CPTSounding(id="C1", depth=[0.2, 0.1], qc=[1, 1], fs=[1, 1])
    with pytest.raises(ValidationError):
        CPTSounding(id="C1", depth=[0.1, 0.2], qc=[1], fs=[1, 1])


def test_gwt_defaults_to_insitu():
    gwt = GroundwaterCondition(depth_insitu=3.0)
    assert gwt.depth_design == 3.0 and gwt.depth_seismic == 3.0


def test_layer_defaults_and_bounds():
    layer = SoilLayer(id="L", top=0, bottom=2, gamma=18)
    # gamma_sat is never defaulted to gamma: an unset value stays None.
    assert layer.gamma_sat is None and layer.thickness == 2
    with pytest.raises(ValidationError):
        SoilLayer(id="L", top=2, bottom=2, gamma=18)


def test_profile_contiguity_and_layer_lookup(two_layer_profile):
    p = two_layer_profile
    assert p.layer_at(0.0).id == "L1"
    assert p.layer_at(3.0).id == "L2"  # boundary belongs to the lower layer
    assert p.layer_at(10.0).id == "L2"
    with pytest.raises(ProfileError):
        p.layer_at(10.5)
    gwt = GroundwaterCondition(depth_insitu=1)
    with pytest.raises(ValidationError):  # gap between layers
        SoilProfile(id="X", gwt=gwt, layers=[
            SoilLayer(id="a", top=0, bottom=2, gamma=18),
            SoilLayer(id="b", top=2.5, bottom=4, gamma=18),
        ])
    with pytest.raises(ValidationError):  # does not start at surface
        SoilProfile(id="X", gwt=gwt, layers=[SoilLayer(id="a", top=1, bottom=2, gamma=18)])


def test_content_hash_changes_with_data(two_layer_profile):
    h1 = two_layer_profile.content_hash()
    two_layer_profile.layers[0].design.phi_eff = 32
    assert two_layer_profile.content_hash() != h1


def test_site_pga_from_tbdy():
    assert SiteSeismic(source="TBDY2018", sds=1.0).pga_g == pytest.approx(0.4)
    with pytest.raises(ValidationError):
        SiteSeismic(source="TBDY2018")


def test_project_rejects_unknown_profile_source(two_layer_profile):
    two_layer_profile.source_ids = ["BH9"]
    with pytest.raises(ValidationError):
        Project(meta=ProjectMeta(name="t"), soil_profiles=[two_layer_profile])
    inv = Investigations(boreholes=[Borehole(id="BH9")])
    Project(meta=ProjectMeta(name="t"), investigations=inv, soil_profiles=[two_layer_profile])
