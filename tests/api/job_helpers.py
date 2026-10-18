"""Deadline-based polling and the existing service regression inputs for API tests."""

import time

from geotek.core.models.profile import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.core.models.project import Project, ProjectMeta
from geotek.core.models.structures import RetainingWallStructure, SheetPileStructure, StructureSoilModel, WallDesignInputs
from geotek.core.models.walls import WallSettings
from geotek.engine.walls.layered import soil_from_basic
from geotek.services.walls_basic import BasicWallInput, proportion_for


def poll_job(client, id, *, timeout=30, until=None):
    """Poll with a short interval and a hard deadline; assert monotonic progress."""
    deadline = time.monotonic() + timeout
    previous = 0.0
    while time.monotonic() < deadline:
        response = client.get(f"/api/jobs/{id}")
        assert response.status_code == 200, response.text
        state = response.json()
        assert 0 <= previous <= state["progress"] <= 1
        previous = state["progress"]
        ready = (until(state) if until is not None
                 else state["status"] in {"done", "failed", "cancelled"})
        if ready:
            return state
        time.sleep(0.005)
    raise AssertionError(f"Job {id} did not reach the requested state within {timeout}s")


def submit(client, path, **kwargs):
    response = client.post(path, **kwargs)
    assert response.status_code == 202, response.text
    assert set(response.json()) == {"job_id"}
    return response.json()["job_id"]


def wall_project(*, geometry=False, with_global=False, advanced=False, code="asd", sds=0.5):
    """Reuse test_structures_service's mandatory five metre BASIC regression inputs."""
    basic = BasicWallInput(wall_type="cantilever", height=5.0, backfill_gamma=18.0,
                          backfill_phi=32.0, foundation_phi=30.0, foundation_gamma=19.0,
                          surcharge=10.0, sds=0.5)
    wall = RetainingWallStructure(
        id="wall", wall_type="cantilever", height=5, embedment=0.6,
        geometry=proportion_for("cantilever", 5, 4.6, 0.6) if geometry else None,
        soil=soil_from_basic(basic, 0.6),
        inputs=WallDesignInputs(surcharge=10, sds=sds, include_global_stability=with_global),
        settings=WallSettings(design_code=code), analysis_level="advanced" if advanced else "basic",
        approach="TBDY" if code == "tbdy2018" else None,
    )
    return Project(meta=ProjectMeta(name="API wall regression"), structures=[wall])


def sheet_project(*, advanced=False, code="asd", wet=False, anchored=False):
    """Reuse the homogeneous structure service sheet pile fixture."""
    soil = StructureSoilModel(profile=SoilProfile(
        id="sheet", layers=[SoilLayer(id="sand", top=0, bottom=35, gamma=18,
                                      gamma_sat=20, design=DesignParameters(phi_eff=30))],
        gwt=GroundwaterCondition(depth_insitu=100),
    ))
    if wet:
        soil.gwt_retained = GroundwaterCondition(depth_insitu=2)
        soil.gwt_front = GroundwaterCondition(depth_insitu=4)
    pile = SheetPileStructure(id="sheet", retained_height=4, soil=soil, design_code=code,
                             support="anchored" if anchored else "cantilever",
                             anchor_depth=1 if anchored else None,
                             analysis_level="advanced" if advanced else "basic")
    return Project(meta=ProjectMeta(name="API sheet pile"), structures=[pile])
