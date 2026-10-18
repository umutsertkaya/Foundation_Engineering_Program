"""Structure resources, isolated soil copies and atomic validation failures."""

from copy import deepcopy

import pytest

from geotek.core.models.project import Project, ProjectMeta
from geotek.io.project_io import load_project

from .conftest import error_code


PROFILE = {
    "id": "manual", "gwt": {"depth_insitu": 2},
    "layers": [{"id": "M1", "top": 0, "bottom": 20, "gamma": 18}],
}
SOIL = {"source_profile_id": None, "profile": PROFILE}
WALL = {"kind": "retaining_wall", "name": "Wall", "wall_type": "cantilever", "height": 4}
PILE = {"kind": "sheet_pile", "name": "Pile", "retained_height": 4}


@pytest.fixture
def opened(shell, two_layer_profile):
    project = Project(meta=ProjectMeta(name="Structures"), soil_profiles=[two_layer_profile],
                      active_profile_id=two_layer_profile.id)
    shell.app.state.session.open_project(project)
    return project


@pytest.mark.parametrize("method,path,body", [
    ("GET", "/structures", None),
    ("POST", "/structures", WALL),
    ("GET", "/structures/missing", None),
    ("PUT", "/structures/missing", {**WALL, "id": "missing", "soil": SOIL}),
    ("DELETE", "/structures/missing", None),
    ("PUT", "/structures/missing/soil", SOIL),
    ("POST", "/structures/missing/soil/resync", None),
])
def test_structure_routes_require_project(shell, method, path, body):
    response = shell.request(method, "/api" + path, **({"json": body} if body else {}))
    assert response.status_code == 409
    assert error_code(response) == "no_project_open"
    assert shell.app.state.session.dirty is False


@pytest.mark.parametrize("payload", [WALL, {**WALL, "wall_type": "gravity"}, PILE,
                                        {**PILE, "support": "anchored", "anchor_depth": 1}])
def test_create_variants_and_domain_defaults(shell, opened, payload):
    response = shell.post("/api/structures", json=payload)
    assert response.status_code == 200, response.text
    created = response.json()
    assert created["kind"] == payload["kind"] and created["id"]
    assert created["result_hash"] is None
    assert created["soil"]["source_profile_id"] == "P1"
    assert created["soil"]["source_hash"] == opened.profile("P1").content_hash()
    assert created["soil"]["retained_fill"] == []
    if payload["kind"] == "retaining_wall":
        assert created["geometry"] is None and created["embedment"] is None
        assert created["inputs"]["surcharge"] == 0 and created["inputs"]["sds"] is None
    assert shell.get(f"/api/structures/{created['id']}").json() == created
    assert shell.app.state.session.dirty is True
    assert opened.structures[0].soil.profile is not opened.profile("P1")


def test_create_profile_selection_and_independent_copies(shell, opened):
    other = opened.profile("P1").model_copy(deep=True, update={"id": "P2"})
    other.layers[0].gamma = 19
    opened.soil_profiles.append(other)
    opened.active_profile_id = "P2"
    active = shell.post("/api/structures", json={**WALL, "profile_id": None}).json()
    explicit = shell.post("/api/structures", json={**PILE, "profile_id": "P1"}).json()
    assert active["soil"]["source_profile_id"] == "P2"
    assert explicit["soil"]["source_profile_id"] == "P1"
    opened.structures[0].soil.profile.layers[0].gamma = 21
    assert other.layers[0].gamma == 19
    assert opened.structures[1].soil.profile.layers[0].gamma == 18
    # The domain treats an unset active id as the first-profile fallback.
    opened.active_profile_id = None
    assert shell.post("/api/structures", json=PILE).json()["soil"]["source_profile_id"] == "P1"


@pytest.mark.parametrize("payload", [WALL, PILE])
def test_no_source_unknown_profile_and_manual_soil(shell, opened, payload):
    opened.soil_profiles.clear()
    opened.active_profile_id = None
    missing = shell.post("/api/structures", json=payload)
    assert missing.status_code == 409 and error_code(missing) == "no_soil_source"
    unknown = shell.post("/api/structures", json={**payload, "profile_id": "missing"})
    assert unknown.status_code == 404 and error_code(unknown) == "not_found"
    assert opened.structures == [] and shell.app.state.session.dirty is False
    manual = shell.post("/api/structures", json={**payload, "soil": SOIL})
    assert manual.status_code == 200, manual.text
    assert manual.json()["soil"]["source_profile_id"] is None
    assert shell.get("/api/structures").json()[0]["stale"] is False


def test_list_filter_and_summary_freshness(shell, opened):
    assert shell.get("/api/structures").json() == []
    wall = shell.post("/api/structures", json=WALL).json()
    pile = shell.post("/api/structures", json=PILE).json()
    opened.structures[0].result_hash = "previous-result"
    rows = shell.get("/api/structures").json()
    assert [row["id"] for row in rows] == [wall["id"], pile["id"]]
    assert rows[0] == {"id": wall["id"], "name": "Wall", "kind": "retaining_wall",
                       "wall_type": "cantilever", "stale": False, "has_result": True}
    assert rows[1]["wall_type"] is None and rows[1]["has_result"] is False
    for kind in ("sheet_pile", "retaining_wall"):
        filtered = shell.get("/api/structures", params={"kind": kind}).json()
        assert len(filtered) == 1 and filtered[0]["kind"] == kind
    invalid = shell.get("/api/structures?kind=unknown")
    assert invalid.status_code == 422 and error_code(invalid) == "validation"
    assert shell.get("/api/project").json()["structures"] == rows


def test_update_delete_and_unique_ids(shell, opened):
    created = shell.post("/api/structures", json=WALL).json()
    url = f"/api/structures/{created['id']}"
    shell.app.state.session.dirty = False
    changed = {**created, "name": "Updated", "inputs": {**created["inputs"], "surcharge": 12}}
    updated = shell.put(url, json=changed)
    assert updated.status_code == 200 and updated.json() == changed
    assert shell.get(url).json() == changed and shell.app.state.session.dirty
    shell.app.state.session.dirty = False
    assert shell.delete(url).json() == {"id": created["id"], "deleted": True}
    assert shell.app.state.session.dirty and shell.get("/api/structures").json() == []
    assert shell.get(url).status_code == 404
    replacement = shell.post("/api/structures", json=WALL).json()
    assert replacement["id"] != created["id"]


@pytest.mark.parametrize("method,suffix,body", [
    ("GET", "", None),
    ("PUT", "", {**WALL, "id": "missing", "soil": SOIL}),
    ("DELETE", "", None), ("PUT", "/soil", SOIL), ("POST", "/soil/resync", None),
])
def test_unknown_structure(shell, opened, method, suffix, body):
    response = shell.request(method, "/api/structures/missing" + suffix,
                             **({"json": body} if body else {}))
    assert response.status_code == 404 and error_code(response) == "not_found"
    assert not shell.app.state.session.dirty and opened.structures == []


@pytest.mark.parametrize("body", [
    {**WALL, "height": 0}, {**WALL, "embedment": 5}, {**WALL, "height": 10},
    {**PILE, "support": "anchored"}, {**PILE, "anchor_depth": 5},
    {**WALL, "soil": SOIL, "profile_id": "P1"}, {**WALL, "extra": 1},
    {**WALL, "kind": "unknown"},
])
def test_create_validation_is_atomic(shell, opened, body):
    response = shell.post("/api/structures", json=body)
    assert response.status_code == 422, response.text
    assert error_code(response) == "validation"
    assert not shell.app.state.session.dirty and opened.structures == []


@pytest.mark.parametrize("kind", [WALL, PILE])
def test_update_and_soil_validation_is_atomic(shell, opened, kind):
    created = shell.post("/api/structures", json=kind).json()
    url = f"/api/structures/{created['id']}"
    shell.app.state.session.dirty = False
    invalid_soil = deepcopy(SOIL)
    invalid_soil["profile"]["layers"][0]["bottom"] = 3
    for method, path, payload in [
        ("PUT", url, {**created, "id": "different"}),
        ("PUT", url, {**created, "soil": invalid_soil}),
        ("PUT", url + "/soil", invalid_soil),
        ("PUT", url + "/soil", {"profile": {}}),
    ]:
        response = shell.request(method, path, json=payload)
        assert response.status_code == 422, response.text
        assert error_code(response) == "validation"
        assert shell.get(url).json() == created and not shell.app.state.session.dirty


@pytest.mark.parametrize("payload", [WALL, PILE])
def test_stale_resync_preserves_local_fill_and_water(shell, opened, payload):
    created = shell.post("/api/structures", json=payload).json()
    url = f"/api/structures/{created['id']}"
    soil = created["soil"]
    soil["retained_fill"] = [{"id": "fill", "top": 0, "bottom": 1, "gamma": 19}]
    soil["gwt_retained"] = {"depth_insitu": 1}
    soil["gwt_front"] = {"depth_insitu": 6}
    local = shell.put(url + "/soil", json=soil)
    assert local.status_code == 200, local.text
    assert opened.profile("P1").layers[0].gamma == 18
    opened.profile("P1").layers[0].gamma = 20
    assert shell.get("/api/structures").json()[0]["stale"] is True
    assert shell.get("/api/project").json()["structures"][0]["stale"] is True
    shell.app.state.session.dirty = False
    response = shell.post(url + "/soil/resync")
    assert response.status_code == 200, response.text
    synced = response.json()["soil"]
    assert synced["profile"]["layers"][0]["gamma"] == 20
    assert synced["source_hash"] == opened.profile("P1").content_hash()
    for key in ("retained_fill", "gwt_front", "gwt_retained"):
        assert synced[key] == local.json()["soil"][key]
    assert opened.structures[0].soil.profile is not opened.profile("P1")
    assert shell.get("/api/structures").json()[0]["stale"] is False
    assert shell.app.state.session.dirty


def test_resync_missing_source_or_incompatible_profile(shell, opened):
    created = shell.post("/api/structures", json=WALL).json()
    url = f"/api/structures/{created['id']}"
    before = opened.profile("P1").model_copy(deep=True)
    opened.soil_profiles.clear()
    opened.active_profile_id = None
    shell.app.state.session.dirty = False
    assert shell.get("/api/structures").json()[0]["stale"] is True
    response = shell.post(url + "/soil/resync")
    assert response.status_code == 404 and error_code(response) == "not_found"
    before.layers = [before.layers[0].model_copy(update={"bottom": 3})]
    opened.soil_profiles.append(before)
    response = shell.post(url + "/soil/resync")
    assert response.status_code == 422 and error_code(response) == "validation"
    assert shell.get(url).json() == created and not shell.app.state.session.dirty
    shell.put(url + "/soil", json=SOIL)
    shell.app.state.session.dirty = False
    assert shell.post(url + "/soil/resync").status_code == 404
    assert not shell.app.state.session.dirty


def test_structure_and_manual_soil_persist(shell, library_dir):
    entry = shell.post("/api/library", json={"name": "Structures"}).json()
    wall = shell.post("/api/structures", json={**WALL, "soil": SOIL}).json()
    assert shell.post("/api/project/save").status_code == 200
    saved = load_project(library_dir / entry["file"])
    assert saved.structure(wall["id"]).model_dump(mode="json") == wall
    shell.post("/api/project/close")
    shell.post(f"/api/library/{entry['file']}/open")
    assert shell.get(f"/api/structures/{wall['id']}").json() == wall
