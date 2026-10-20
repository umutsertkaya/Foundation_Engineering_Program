"""Soil HTTP workflows, input failures, project integrity and engine result adapters."""

from __future__ import annotations

import asyncio
from copy import deepcopy
import json
from pathlib import Path

import numpy as np
import pytest

from geotek.core.models.project import Project
from geotek.core.models.structures import RetainingWallStructure, StructureSoilModel
from geotek.engine.insitu.cpt import process_cpt
from geotek.engine.insitu.spt import process_borehole
from geotek.io.project_io import load_project
from geotek.modules.soil import service

from .conftest import error_code

PREFIX = "/api/m/soil"
CPT_CSV = b"depth,qc (MPa),fs (kPa),u2 (kPa)\n1,2,20,10\n2,3,25,20\n"
SPT_CSV = b"depth,N\n1,10\n2,50/12\n"
CPT = {"id": "C1", "depth": [1, 2], "qc": [2000, 3000], "fs": [20, 25]}
CREATE = {
    "name": "Manual", "origin": "manual", "source_ids": [], "gwt": {"depth_insitu": 2},
    "layers": [{"id": "client-id", "top": 0, "bottom": 20, "gamma": 18,
                "design": {"phi_eff": 30}}],
}
PROFILE = {"id": "P1", **{k: v for k, v in CREATE.items() if k != "layers"},
           "layers": [{**CREATE["layers"][0], "id": "L1"}]}
PROPOSAL = {
    "source_id": "C1", "settings": {"method": "cpt_ic"}, "warnings": ["Review required"],
    "layers": [{"top": 0, "bottom": 10, "description": "Supplied interval", "uscs": "SP",
                "sbtn_zone": 6, "ic_mean": 1.8, "n60_mean": None,
                "gamma_suggested": 18, "behaviour": "drained"}],
}


def upload(client, kind="cpt", identifier=None, content=None, **fields):
    """Submit small CSV fixtures using the public multipart contract."""
    data = ({"sounding_id": identifier or "C1", "qc_unit": "MPa", "delimiter": ",", "decimal": "."}
            if kind == "cpt" else {"borehole_id": identifier or "B1"})
    data.update(fields)
    return client.post(f"{PREFIX}/import/{kind}", data=data,
                       files={"file": ("../untrusted.csv", content if content is not None else
                                        (CPT_CSV if kind == "cpt" else SPT_CSV), "text/csv")})


@pytest.fixture
def opened(shell):
    """Use the shared isolated shell fixture with an open, clean library project."""
    assert shell.post("/api/library", json={"name": "Soil tests"}).status_code == 200
    return shell


def create_profile(client, payload=None):
    response = client.post(f"{PREFIX}/profiles", json=payload or deepcopy(CREATE))
    assert response.status_code == 200, response.text
    return response.json()


def clean(client):
    assert client.post("/api/project/save").status_code == 200
    assert client.get("/api/session").json()["dirty"] is False


IMPLEMENTED_REQUESTS = [
    ("GET", "/investigations", None),
    ("POST", "/import/cpt", None), ("POST", "/import/spt", None),
    ("PUT", "/boreholes/B1", {"id": "B1"}), ("DELETE", "/boreholes/B1", None),
    ("PUT", "/boreholes/B1/log", []), ("PUT", "/cpts/C1", CPT),
    ("DELETE", "/cpts/C1", None), ("GET", "/cpts/C1/processed", None),
    ("GET", "/boreholes/B1/processed", None), ("GET", "/profiles", None),
    ("POST", "/profiles", CREATE), ("GET", "/profiles/P1", None),
    ("PUT", "/profiles/P1", PROFILE), ("DELETE", "/profiles/P1", None),
    ("POST", "/profiles/P1/layers/L1/split", {"depth": 1}),
    ("POST", "/profiles/P1/layers/merge", {"layer_ids": ["L1", "L2"]}),
    ("POST", "/layering/cpt/C1", {"method": "cpt_ic"}),
    ("POST", "/layering/spt/B1", {"method": "spt_log"}),
    ("GET", "/profiles/P1/layers/L1/parameters", None),
    ("PUT", "/profiles/P1/layers/L1/parameters/phi_eff", {"mode": "manual", "manual_value": 30}),
    ("POST", "/profiles/P1/layers/L1/parameters/approve", {"keys": ["phi_eff"]}),
    ("POST", "/profiles/P1/parameters/suggest-all", None),
]


@pytest.mark.parametrize("method,path,payload", IMPLEMENTED_REQUESTS)
def test_requires_open_project(shell, method, path, payload):
    if path.startswith("/import/"):
        response = upload(shell, path.rsplit("/", 1)[1])
    else:
        response = shell.request(method, PREFIX + path,
                                 **({"json": payload} if payload is not None else {}))
    assert response.status_code == 409, response.text
    assert error_code(response) == "no_project_open"


@pytest.mark.parametrize("method,path,payload", [
    row for row in IMPLEMENTED_REQUESTS
    if not row[1].startswith("/import/") and row[1] not in {"/investigations", "/profiles"}
])
def test_missing_resources(opened, method, path, payload):
    response = opened.request(method, PREFIX + path,
                              **({"json": payload} if payload is not None else {}))
    assert response.status_code == 404, response.text
    assert error_code(response) == "not_found"
    assert opened.get("/api/session").json()["dirty"] is False


def test_import_list_update_delete_investigations(opened):
    assert opened.get(f"{PREFIX}/investigations").json() == {"boreholes": [], "cpts": []}
    assert upload(opened).json()["qc"] == [2000, 3000]
    assert upload(opened, "spt").json()["spt"][1]["refusal"] is True
    records = opened.get(f"{PREFIX}/investigations").json()
    assert len(records["boreholes"]) == len(records["cpts"]) == 1
    clean(opened)
    borehole = records["boreholes"][0]
    borehole.update(energy_ratio=75, gwt_depth=1, lab=[{"depth": 1, "FC": 25}])
    assert opened.put(f"{PREFIX}/boreholes/B1", json=borehole).json()["energy_ratio"] == 75
    assert opened.get("/api/session").json()["dirty"] is True
    sounding = records["cpts"][0]
    sounding.update(area_ratio=0.9, gwt_depth=1)
    assert opened.put(f"{PREFIX}/cpts/C1", json=sounding).json()["area_ratio"] == 0.9
    for kind, identifier in [("cpts", "C1"), ("boreholes", "B1")]:
        clean(opened)
        response = opened.delete(f"{PREFIX}/{kind}/{identifier}")
        assert response.status_code == 200
        assert response.json() == {"id": identifier, "deleted": True}
        assert opened.get("/api/session").json()["dirty"] is True
        assert opened.delete(f"{PREFIX}/{kind}/{identifier}").status_code == 404
    assert opened.get(f"{PREFIX}/investigations").json() == {"boreholes": [], "cpts": []}


@pytest.mark.parametrize("delimiter,decimal,content", [
    (";", ",", "derinlik;qc (MPa);fs (kPa)\n1,5;2,5;20,5\n2,5;3,5;25,5\n"),
    ("|", ".", "depth|qc|fs\n1.5|2.5|20.5\n2.5|3.5|25.5\n"),
    ("\t", ",", "depth\tqc\tfs\n1,5\t2,5\t20,5\n2,5\t3,5\t25,5\n"),
])
def test_cpt_explicit_dialect_and_units(opened, delimiter, decimal, content):
    response = upload(opened, content=content.encode(), delimiter=delimiter, decimal=decimal)
    assert response.status_code == 200, response.text
    assert response.json()["depth"] == [1.5, 2.5]
    assert response.json()["qc"] == [2500, 3500]
    assert response.json()["fs"] == [20.5, 25.5]
    assert response.json()["u2"] is None
    # The explicitly supplied form unit overrides the unit written in a CSV header.
    assert upload(opened, identifier="C2", qc_unit="kPa").json()["qc"] == [2, 3]


def test_spt_auto_dialect_aliases_sorting(opened):
    response = upload(opened, "spt", content=b"derinlik;SPT\n2,5;50/10\n1,5;12\n")
    assert response.status_code == 200, response.text
    assert [row["depth"] for row in response.json()["spt"]] == [1.5, 2.5]
    assert response.json()["spt"][1]["refusal"] is True


@pytest.mark.parametrize("kind,content,fields", [
    ("cpt", b"wrong,headers\n1,2\n", {}), ("spt", b"depth,N\n1,invalid\n", {}),
    ("cpt", b"depth,qc,fs\n2,2,20\n1,3,30\n", {}),
    ("cpt", b"depth,qc,fs\n1,-1,2\n", {}),
    ("cpt", b"depth,qc,fs\n1,inf,2\n", {}),
    ("spt", b"depth,N\n1,inf\n", {}),
    ("spt", b"depth,N\n1,2\n1,3\n", {}), ("spt", b"depth,N\n0,2\n", {}),
    ("cpt", b"", {}), ("spt", b"\xff\xfe", {}),
    ("cpt", CPT_CSV, {"qc_unit": "psi"}), ("cpt", CPT_CSV, {"decimal": ""}),
    ("cpt", CPT_CSV, {"delimiter": "::"}),
    ("cpt", CPT_CSV, {"delimiter": "."}),
    ("cpt", CPT_CSV, {"sounding_id": " "}), ("spt", SPT_CSV, {"extra": "field"}),
])
def test_invalid_csv_is_atomic(opened, kind, content, fields):
    before = opened.app.state.session.project.model_dump()
    response = upload(opened, kind, content=content, **fields)
    assert response.status_code == 422, response.text
    assert error_code(response) == "validation"
    assert opened.app.state.session.project.model_dump() == before
    assert opened.get("/api/session").json()["dirty"] is False


@pytest.mark.parametrize("kind", ["cpt", "spt"])
@pytest.mark.parametrize("stage", ["multipart", "import_csv"])
@pytest.mark.parametrize("action", ["close", "switch"])
def test_import_rejects_session_changes_during_parse(opened, monkeypatch, kind, stage, action):
    session = opened.app.state.session
    original = session.project
    before = original.model_dump()
    replacement = original.model_copy(deep=True)
    replacement.meta.name = "Replacement project"
    replacement_before = replacement.model_dump()
    parse = getattr(service, stage)

    def change_session(*args, **kwargs):
        result = parse(*args, **kwargs)
        # Reentrant changes exercise the guard even while the route owns the RLock.
        if action == "close":
            session.close()
        else:
            session.open_project(replacement)
        return result

    monkeypatch.setattr(service, stage, change_session)
    response = upload(opened, kind)
    assert response.status_code == 409, response.text
    assert error_code(response) == ("no_project_open" if action == "close" else "project_changed")
    assert original.model_dump() == before
    assert replacement.model_dump() == replacement_before
    assert session.project is (None if action == "close" else replacement)
    assert session.dirty is False


@pytest.mark.parametrize("kind", ["cpt", "spt"])
@pytest.mark.parametrize("action", ["close", "switch"])
def test_import_rejects_session_changes_during_body_read(opened, monkeypatch, kind, action):
    session = opened.app.state.session
    original = session.project
    before = original.model_dump()
    replacement = original.model_copy(deep=True)
    replacement.meta.name = "Replacement project"
    replacement_before = replacement.model_dump()
    read_upload = service.read_upload

    async def change_session(request):
        body = await read_upload(request)
        if action == "close":
            session.close()
        else:
            session.open_project(replacement)
        return body

    def fail(*args, **kwargs):
        raise AssertionError("A stale upload must be rejected before parsing")

    monkeypatch.setattr(service, "read_upload", change_session)
    monkeypatch.setattr(service, "multipart", fail)
    response = upload(opened, kind)
    assert response.status_code == 409, response.text
    assert error_code(response) == ("no_project_open" if action == "close" else "project_changed")
    assert original.model_dump() == before
    assert replacement.model_dump() == replacement_before
    assert original.investigations.cpts == original.investigations.boreholes == []
    assert replacement.investigations.cpts == replacement.investigations.boreholes == []
    assert session.project is (None if action == "close" else replacement)
    assert session.dirty is False


@pytest.mark.parametrize("kind", ["cpt", "spt"])
def test_import_without_project_does_not_read_body(shell, monkeypatch, kind):
    async def fail(request):
        raise AssertionError("No open project: the body must not be read")

    monkeypatch.setattr(service, "read_upload", fail)
    response = upload(shell, kind)
    assert response.status_code == 409, response.text
    assert error_code(response) == "no_project_open"


@pytest.mark.parametrize("kind", ["cpt", "spt"])
def test_import_holds_session_lock_through_validation(opened, monkeypatch, kind):
    from threading import Thread

    session = opened.app.state.session
    calls = []
    body_read = False
    read_upload = service.read_upload
    require_project = session.require_project

    async def read_body(request):
        nonlocal body_read
        body = await read_upload(request)
        body_read = True
        return body

    checks = []

    def require_during_upload():
        checks.append(body_read)
        return require_project()

    monkeypatch.setattr(service, "read_upload", read_body)
    monkeypatch.setattr(session, "require_project", require_during_upload)
    for stage in ["multipart", "import_csv", "commit"]:
        original = getattr(service, stage)

        def checked(*args, _original=original, _stage=stage, **kwargs):
            acquired = []

            def probe():
                held = session.lock.acquire(blocking=False)
                acquired.append(held)
                if held:
                    session.lock.release()

            thread = Thread(target=probe)
            thread.start()
            thread.join(timeout=5)
            assert not thread.is_alive()
            assert acquired == [False], f"Session lock missing during {_stage}"
            calls.append(_stage)
            return _original(*args, **kwargs)

        monkeypatch.setattr(service, stage, checked)
    response = upload(opened, kind)
    assert response.status_code == 200, response.text
    assert calls == ["multipart", "import_csv", "commit"]
    assert checks[0] is False and all(checks[1:])


@pytest.mark.parametrize("kind", ["cpt", "spt"])
@pytest.mark.parametrize("dirty", [False, True])
def test_upload_limit_preserves_project_and_dirty(opened, monkeypatch, kind, dirty):
    session = opened.app.state.session
    if dirty:
        create_profile(opened)
    before = session.project.model_dump()
    monkeypatch.setattr(service, "MAX_UPLOAD_BYTES", 32)
    response = upload(opened, kind)
    assert response.status_code == 422, response.text
    assert error_code(response) == "validation"
    assert "32-byte limit" in response.json()["message"]
    assert session.project.model_dump() == before
    assert session.dirty is dirty


def test_upload_stream_limit_stops_before_reading_remaining_chunks(monkeypatch):
    from fastapi import HTTPException

    monkeypatch.setattr(service, "MAX_UPLOAD_BYTES", 8)

    class Upload:
        async def stream(self):
            yield b"1234"
            yield b"5678"
            yield b"9"
            raise AssertionError("Oversized upload must stop consuming the stream")

    with pytest.raises(HTTPException) as caught:
        asyncio.run(service.read_upload(Upload()))
    assert caught.value.status_code == 422
    assert caught.value.detail["code"] == "validation"


def test_upload_stream_accepts_exact_byte_limit(monkeypatch):
    monkeypatch.setattr(service, "MAX_UPLOAD_BYTES", 8)

    class Upload:
        async def stream(self):
            yield b"1234"
            yield b"5678"
            yield b""

    assert asyncio.run(service.read_upload(Upload())) == b"12345678"


@pytest.mark.parametrize("kind", ["cpt", "spt"])
@pytest.mark.parametrize("failure", ["none", "create", "write", "read", "cleanup"])
def test_import_uses_system_temp_and_cleans_up(opened, monkeypatch, kind, failure):
    from contextlib import contextmanager

    before = opened.app.state.session.project.model_dump()
    directories = []
    temporary_directory = service.TemporaryDirectory

    @contextmanager
    def tracked_directory(*args, **kwargs):
        assert "dir" not in kwargs  # Use the OS temp location, never the installed package.
        if failure == "create":
            raise OSError("temp storage unavailable")
        with temporary_directory(*args, **kwargs) as directory:
            directories.append(Path(directory))
            yield directory
        if failure == "cleanup":
            raise OSError("simulated cleanup failure")

    def fail(*args, **kwargs):
        raise OSError("simulated import I/O failure")

    monkeypatch.setattr(service, "TemporaryDirectory", tracked_directory)
    if failure == "write":
        if kind == "cpt":
            monkeypatch.setattr(service.pd.DataFrame, "to_csv", fail)
        else:
            monkeypatch.setattr(Path, "write_bytes", fail)
    elif failure == "read":
        monkeypatch.setattr(service.tabular, f"import_{kind}", fail)
    response = upload(opened, kind)
    assert all(not directory.exists() for directory in directories)
    if failure == "none":
        assert response.status_code == 200, response.text
    else:
        assert response.status_code == 422, response.text
        assert error_code(response) == "import_io_error"
        assert "temporary CSV" in response.json()["message"]
        assert opened.app.state.session.project.model_dump() == before
        assert opened.app.state.session.dirty is False


@pytest.mark.parametrize("kind", ["cpt", "spt"])
def test_invalid_csv_cleans_temp_directory(opened, monkeypatch, kind):
    directories = []
    temporary_directory = service.TemporaryDirectory

    def tracked_directory(*args, **kwargs):
        context = temporary_directory(*args, **kwargs)
        directories.append(Path(context.name))
        return context

    monkeypatch.setattr(service, "TemporaryDirectory", tracked_directory)
    response = upload(opened, kind, content=b"wrong,headers\n1,2\n")
    assert response.status_code == 422 and error_code(response) == "validation"
    assert directories and all(not directory.exists() for directory in directories)
    assert opened.app.state.session.dirty is False


@pytest.mark.parametrize("kind", ["cpt", "spt"])
def test_duplicate_investigation_ids_across_types(opened, kind):
    assert upload(opened, kind, identifier="shared").status_code == 200
    clean(opened)
    for next_kind in ["cpt", "spt"]:
        response = upload(opened, next_kind, identifier="shared")
        assert response.status_code == 422 and error_code(response) == "validation"
    assert opened.get("/api/session").json()["dirty"] is False


@pytest.mark.parametrize("kind", ["cpt", "spt"])
def test_multipart_required_and_malformed_parts(opened, kind):
    path = f"{PREFIX}/import/{kind}"
    identifier = "sounding_id" if kind == "cpt" else "borehole_id"
    fields = ({identifier: "X", "qc_unit": "kPa", "delimiter": ",", "decimal": "."}
              if kind == "cpt" else {identifier: "X"})
    for missing in ["file", *fields]:
        response = opened.post(path, data={k: v for k, v in fields.items() if k != missing},
                               files={} if missing == "file" else {"file": ("x.csv", CPT_CSV)})
        assert response.status_code == 422, response.text
    for headers, content in [
        ({"Content-Type": "application/json"}, b"{}"),
        ({"Content-Type": "multipart/form-data"}, b"invalid"),
        ({"Content-Type": "multipart/form-data; boundary=test"}, b"--test\r\ninvalid"),
    ]:
        response = opened.post(path, headers=headers, content=content)
        assert response.status_code == 422, response.text
    duplicates = [("file", ("a.csv", CPT_CSV)), ("file", ("b.csv", CPT_CSV))]
    assert opened.post(path, data=fields, files=duplicates).status_code == 422
    assert opened.get("/api/session").json()["dirty"] is False


@pytest.mark.parametrize("kind,identifier,body", [
    ("boreholes", "B1", {"id": "different"}), ("cpts", "C1", {**CPT, "id": "different"}),
    ("boreholes", "B1", {"id": "B1", "spt": [{"depth": 1, "n_field": -1}]}),
    ("cpts", "C1", {**CPT, "fs": [20]}),
    ("cpts", "C1", {**CPT, "depth": [2, 1]}),
    ("boreholes", "B1", {"id": "B1", "x": "NaN"}),
    ("cpts", "C1", {**CPT, "qc": ["Infinity", 3000]}),
])
def test_invalid_investigation_update(opened, kind, identifier, body):
    assert upload(opened, "spt" if kind == "boreholes" else "cpt").status_code == 200
    clean(opened)
    before = opened.get(f"{PREFIX}/investigations").json()
    response = opened.put(f"{PREFIX}/{kind}/{identifier}", json=body)
    assert response.status_code == 422 and error_code(response) == "validation"
    assert opened.get(f"{PREFIX}/investigations").json() == before
    assert opened.get("/api/session").json()["dirty"] is False


def test_borehole_log_validation_and_replacement(opened):
    borehole = upload(opened, "spt").json()
    path = f"{PREFIX}/boreholes/B1/log"
    log = [{"top": 3, "bottom": 5, "uscs": "cl"},
           {"top": 0, "bottom": 2, "description": "Logged sand", "uscs": "sp"}]
    response = opened.put(path, json=log)
    assert response.status_code == 200, response.text
    assert [row["uscs"] for row in response.json()["log"]] == ["SP", "CL"]
    assert response.json()["spt"] == borehole["spt"]
    clean(opened)
    for invalid in [[{"top": 0, "bottom": 2}, {"top": 1, "bottom": 3}],
                    [{"top": 0, "bottom": 1, "uscs": "invalid"}],
                    [{"top": 3, "bottom": 1}]]:
        response = opened.put(path, json=invalid)
        assert response.status_code == 422 and error_code(response) == "validation"
    assert opened.get("/api/session").json()["dirty"] is False
    assert opened.put(path, json=[]).json()["log"] == []


def test_profile_crud_and_persistence(opened, library_dir):
    assert opened.get(f"{PREFIX}/profiles").json() == []
    first = create_profile(opened)
    second = create_profile(opened)
    assert first["id"] != second["id"]
    assert first["layers"][0]["id"] != "client-id"
    assert first["layers"][0]["id"] != second["layers"][0]["id"]
    path = f"{PREFIX}/profiles/{first['id']}"
    assert opened.get(path).json() == first
    summaries = opened.get(f"{PREFIX}/profiles").json()
    assert summaries == opened.get("/api/data/profiles").json()
    assert summaries[0]["layer_count"] == 1 and "layers" not in summaries[0]
    clean(opened)
    updated = {**first, "name": "Changed", "gwt": {"depth_insitu": 1}}
    response = opened.put(path, json=updated)
    assert response.status_code == 200 and response.json()["name"] == "Changed"
    assert opened.get("/api/session").json()["dirty"] is True
    assert opened.put("/api/project/active-profile", json={"profile_id": first["id"]}).status_code == 200
    assert opened.delete(path).json() == {"id": first["id"], "deleted": True}
    assert opened.get("/api/project").json()["active_profile_id"] == second["id"]
    assert opened.delete(f"{PREFIX}/profiles/{second['id']}").status_code == 200
    assert opened.get("/api/project").json()["active_profile_id"] is None
    assert opened.get(path).status_code == 404
    clean(opened)
    saved = load_project(next(library_dir.glob("*.gtk")))
    assert saved.soil_profiles == []


DUPLICATE_IDS = {"layers": [{"id": "L", "top": 0, "bottom": 1, "gamma": 18},
                           {"id": "L", "top": 1, "bottom": 2, "gamma": 18}]}


@pytest.mark.parametrize("patch", [
    {"layers": []}, {"layers": [{"id": "L", "top": 1, "bottom": 2, "gamma": 18}]},
    {"layers": [{"id": "L", "top": 0, "bottom": 2, "gamma": 5}]},
    {"gwt": {"depth_insitu": -1}}, {"source_ids": ["missing"]},
    DUPLICATE_IDS,
    {"layers": [{"id": "L1", "top": 0, "bottom": 1, "gamma": 18},
                {"id": "L2", "top": 2, "bottom": 3, "gamma": 18}]},
    {"layers": [{"id": "L", "top": 0, "bottom": "Infinity", "gamma": 18}]},
])
def test_invalid_profile_create_and_update(opened, patch):
    profile = create_profile(opened)
    clean(opened)
    before = opened.app.state.session.project.model_dump()
    requests = [("POST", "/profiles", {**CREATE, **patch}),
                ("PUT", f"/profiles/{profile['id']}", {**profile, **patch})]
    if patch is DUPLICATE_IDS:
        requests = requests[1:]  # create assigns fresh layer ids, so only an update can carry duplicates
    for method, path, body in requests:
        response = opened.request(method, PREFIX + path, json=body)
        assert response.status_code == 422, response.text
        assert error_code(response) == "validation"
    assert opened.app.state.session.project.model_dump() == before
    assert opened.get("/api/session").json()["dirty"] is False


def test_profile_id_mismatch_and_exclusive_sources(opened):
    profile = create_profile(opened)
    clean(opened)
    assert opened.put(f"{PREFIX}/profiles/{profile['id']}",
                      json={**profile, "id": "different"}).status_code == 422
    for payload in [{k: v for k, v in CREATE.items() if k != "layers"},
                    {**CREATE, "from_proposal": PROPOSAL}, {**CREATE, "from_proposal": None}]:
        assert opened.post(f"{PREFIX}/profiles", json=payload).status_code == 422
    assert opened.get("/api/session").json()["dirty"] is False


def test_materialise_proposal_without_layering_or_approval(opened, monkeypatch):
    assert upload(opened).status_code == 200
    # Materialisation must not ask the investigation processor to compute layering.
    def fail(*args, **kwargs):
        raise AssertionError("Proposal materialisation must not process soundings")
    monkeypatch.setattr("geotek.modules.soil.api.process_investigations", fail)
    payload = {k: v for k, v in CREATE.items() if k != "layers"}
    payload.update(origin="cpt", source_ids=["C1"], from_proposal=PROPOSAL)
    profile = create_profile(opened, payload)
    assert profile["layering"]["method"] == "cpt_ic"
    layer = profile["layers"][0]
    assert layer["gamma"] == 18 and layer["source_ids"] == ["C1"]
    assert layer["description"] == "Supplied interval" and layer["sbtn_zone"] == 6
    assert layer["selections"] == layer["params"] == {}
    assert layer["design"]["phi_eff"] is None
    clean(opened)
    for bad_proposal in [
        {**PROPOSAL, "layers": []},
        {**PROPOSAL, "source_id": "unknown"},
        {**PROPOSAL, "layers": [{**PROPOSAL["layers"][0], "gamma_suggested": None}]},
        {**PROPOSAL, "layers": [{**PROPOSAL["layers"][0], "gamma_suggested": 35}]},
        {**PROPOSAL, "layers": [{**PROPOSAL["layers"][0], "top": 2}]},
    ]:
        response = opened.post(f"{PREFIX}/profiles", json={**payload, "from_proposal": bad_proposal})
        assert response.status_code == 422, response.text
    assert opened.get("/api/session").json()["dirty"] is False


def test_source_deletion_preserves_project_references(opened):
    for kind, identifier in [("cpt", "C1"), ("spt", "B1")]:
        assert upload(opened, kind).status_code == 200
        profile = create_profile(opened, {**CREATE, "source_ids": [identifier]})
        clean(opened)
        path = f"{PREFIX}/{'cpts' if kind == 'cpt' else 'boreholes'}/{identifier}"
        response = opened.delete(path)
        assert response.status_code == 422 and error_code(response) == "validation"
        assert opened.get("/api/session").json()["dirty"] is False
        assert opened.delete(f"{PREFIX}/profiles/{profile['id']}").status_code == 200
        assert opened.delete(path).status_code == 200


def selection(parameter, value, *, approved=True):
    """Supply traceable selections without using the intentionally stubbed E3 routes."""
    candidate = {"value": value, "unit": "test", "method_id": "user", "source": "user"}
    return {
        "parameter": parameter, "candidates": [candidate], "suggested": candidate,
        "mode": "manual", "manual_value": value, "selected": candidate,
        "approved": approved, "approved_at": "2026-10-19T09:00:00Z",
        "basis_hash": "old-interval",
    }


def assert_stale_selections(layer, previous):
    assert set(layer["selections"]) == set(previous)
    for key, state in layer["selections"].items():
        assert state == {
            **previous[key], "candidates": [], "suggested": None,
            "approved": False, "approved_at": None, "basis_hash": None,
        }
    assert layer["params"] == {}


@pytest.mark.parametrize("change", ["bottom", "boundary", "new", "layer_sources", "profile_sources",
                                   "unchanged"])
def test_profile_put_invalidates_only_changed_layers(opened, change):
    assert upload(opened).status_code == 200
    assert upload(opened, identifier="C2").status_code == 200
    payload = deepcopy(CREATE)
    payload["source_ids"] = ["C1"]
    payload["layers"] = [
        {"id": f"L{i}", "top": top, "bottom": bottom, "gamma": 18,
         "source_ids": ["C1"] if i == 0 else [],
         "design": {"phi_eff": 30}, "selections": {"phi_eff": selection("phi_eff", 30)},
         "params": {"phi_eff": selection("phi_eff", 30)["selected"]}}
        for i, (top, bottom) in enumerate([(0, 5), (5, 10), (10, 20)])
    ]
    profile = create_profile(opened, payload)
    path = f"{PREFIX}/profiles/{profile['id']}"
    incoming = opened.get(path).json()
    changed = {2}
    if change == "bottom":
        incoming["layers"][2]["bottom"] = 25
    elif change == "boundary":
        incoming["layers"][1]["bottom"] = incoming["layers"][2]["top"] = 12
        changed = {1, 2}
    elif change == "new":
        incoming["layers"][2]["id"] = "new-layer"
    elif change == "layer_sources":
        incoming["layers"][2]["source_ids"] = ["C2"]
    elif change == "profile_sources":
        incoming["source_ids"] = ["C1", "C2"]
        changed = {1, 2}
    else:
        incoming["name"] = "Renamed"
        changed = set()
    # Match stored layers by id even if the client sends them in a different order.
    incoming["layers"].reverse()
    response = opened.put(path, json=incoming)
    assert response.status_code == 200, response.text
    stored = opened.get(path).json()
    assert stored == response.json()
    for i, layer in enumerate(stored["layers"]):
        assert layer["design"] == profile["layers"][i]["design"]
        assert layer["gamma"] == profile["layers"][i]["gamma"]
        if i in changed:
            assert_stale_selections(layer, profile["layers"][i]["selections"])
        else:
            assert layer == profile["layers"][i]


def test_split_invalidates_approved_and_unapproved_selections_only_on_children(opened):
    values = {"phi_eff": 31, "c_eff": 12, "su": 60, "E": 15000, "delta_base": 20}
    selections = {key: selection(key, value) for key, value in values.items()}
    selections["gamma"] = selection("gamma", 18, approved=False)
    payload = deepcopy(CREATE)
    payload["layers"] = [
        {**payload["layers"][0], "bottom": 10, "design": values, "selections": selections,
         "params": {"phi_eff": selections["phi_eff"]["selected"]}},
        {"id": "untouched", "top": 10, "bottom": 20, "gamma": 21,
         "design": {"phi_eff": 35}, "selections": {"phi_eff": selection("phi_eff", 35)}},
    ]
    profile = create_profile(opened, payload)
    clean(opened)
    path = f"{PREFIX}/profiles/{profile['id']}"
    response = opened.post(f"{path}/layers/{profile['layers'][0]['id']}/split", json={"depth": 5})
    assert response.status_code == 200, response.text
    layers = response.json()["layers"]
    assert [(layer["top"], layer["bottom"]) for layer in layers] == [(0, 5), (5, 10), (10, 20)]
    for child in layers[:2]:
        assert_stale_selections(child, profile["layers"][0]["selections"])
        assert child["design"] == values
        assert child["gamma"] == 18
    assert layers[2] == profile["layers"][1]
    assert opened.get(path).json() == response.json()
    assert opened.app.state.session.dirty is True


@pytest.mark.parametrize("reverse", [False, True])
def test_merge_keeps_equal_design_values_stale_from_both_layers(opened, reverse):
    values = {"phi_eff": 30, "c_eff": 10, "su": 80, "E": 20000, "delta_base": 25}
    upper = {"phi_eff": selection("phi_eff", 30), "c_eff": selection("c_eff", 10)}
    lower = {"phi_eff": selection("phi_eff", 30), "su": selection("su", 80),
             "E": selection("E", 20000), "delta_base": selection("delta_base", 25)}
    payload = deepcopy(CREATE)
    payload["layers"] = [
        {"id": "upper", "top": 0, "bottom": 10, "gamma": 18,
         "design": values, "selections": upper,
         "params": {"phi_eff": upper["phi_eff"]["selected"]}},
        {"id": "lower", "top": 10, "bottom": 20, "gamma": 21,
         "design": values,
         "selections": lower, "params": {"su": lower["su"]["selected"]}},
        {"id": "untouched", "top": 20, "bottom": 25, "gamma": 19,
         "design": {"phi_eff": 33}, "selections": {"phi_eff": selection("phi_eff", 33)}},
    ]
    profile = create_profile(opened, payload)
    clean(opened)
    ids = [layer["id"] for layer in profile["layers"][:2]]
    path = f"{PREFIX}/profiles/{profile['id']}"
    response = opened.post(f"{path}/layers/merge", json={"layer_ids": ids[::-1] if reverse else ids})
    assert response.status_code == 200, response.text
    merged, untouched = response.json()["layers"]
    assert (merged["top"], merged["bottom"], merged["id"]) == (0, 20, ids[0])
    previous = {**profile["layers"][1]["selections"], **profile["layers"][0]["selections"]}
    assert_stale_selections(merged, previous)
    assert merged["design"] == values
    assert "Warning" not in response.headers
    assert merged["gamma"] == 18
    assert untouched == profile["layers"][2]
    assert opened.get(path).json() == response.json()
    assert opened.app.state.session.dirty is True


@pytest.mark.parametrize("reverse", [False, True])
@pytest.mark.parametrize("key,other", [
    ("phi_eff", 40), ("su", 100), ("E", 30000), ("delta_base", 15),
    ("phi_eff", None), ("su", None), ("E", None), ("delta_base", None),
])
def test_merge_clears_conflicting_design_values_and_warns(opened, key, other, reverse):
    values = {"phi_eff": 30, "c_eff": 12, "su": 80, "E": 20000, "delta_base": 25}
    selections = {name: selection(name, value) for name, value in values.items()}
    payload = deepcopy(CREATE)
    payload["layers"] = [
        {"id": "upper", "top": 0, "bottom": 10, "gamma": 18,
         "design": values, "selections": selections},
        {"id": "lower", "top": 10, "bottom": 20, "gamma": 18,
         "design": {**values, key: other},
         "selections": {key: selection(key, other)} if other is not None else {}},
        {"id": "untouched", "top": 20, "bottom": 25, "gamma": 19},
    ]
    profile = create_profile(opened, payload)
    clean(opened)
    path = f"{PREFIX}/profiles/{profile['id']}"
    ids = [layer["id"] for layer in profile["layers"][:2]]
    response = opened.post(f"{path}/layers/merge", json={"layer_ids": ids[::-1] if reverse else ids})
    assert response.status_code == 200, response.text
    merged, untouched = response.json()["layers"]
    assert merged["design"] == {**values, key: None}
    assert f"Conflicting design value {key} cleared" in response.headers["Warning"]
    assert merged["selections"][key] == {
        "parameter": key, "candidates": [], "suggested": None, "mode": None,
        "method_id": None, "statistic": None, "k_sd": None, "manual_value": None,
        "selected": None, "approved": False, "approved_at": None, "basis_hash": None,
    }
    retained = {name: state for name, state in merged["selections"].items() if name != key}
    assert_stale_selections({**merged, "selections": retained}, {
        name: state for name, state in profile["layers"][0]["selections"].items() if name != key
    })
    assert untouched == profile["layers"][2]
    assert opened.get(path).json() == response.json()
    assert opened.app.state.session.dirty is True


def test_merge_reports_all_conflicts_without_existing_selections(opened):
    payload = deepcopy(CREATE)
    payload["layers"] = [
        {"id": "upper", "top": 0, "bottom": 10, "gamma": 18,
         "design": {"phi_eff": 30, "c_eff": 12, "E": 10000}},
        {"id": "lower", "top": 10, "bottom": 20, "gamma": 18,
         "design": {"phi_eff": 40, "c_eff": 12, "E": 20000}},
    ]
    profile = create_profile(opened, payload)
    path = f"{PREFIX}/profiles/{profile['id']}"
    response = opened.post(f"{path}/layers/merge", json={
        "layer_ids": [layer["id"] for layer in profile["layers"]],
    })
    assert response.status_code == 200, response.text
    merged = response.json()["layers"][0]
    assert merged["design"]["c_eff"] == 12
    assert set(merged["selections"]) == {"phi_eff", "E"}
    for key in ["phi_eff", "E"]:
        assert merged["design"][key] is None
        assert merged["selections"][key]["selected"] is None
        assert merged["selections"][key]["approved"] is False
        assert f"Conflicting design value {key} cleared" in response.headers["Warning"]
    assert opened.get(path).json() == response.json()


@pytest.mark.parametrize("reverse", [False, True])
@pytest.mark.parametrize("lower_cohesion", [0, 20])
def test_merge_rejects_conflicting_required_cohesion_atomically(opened, reverse, lower_cohesion):
    payload = deepcopy(CREATE)
    payload["layers"] = [
        {"id": "upper", "top": 0, "bottom": 10, "gamma": 18,
         "design": {"phi_eff": 30, "c_eff": 12},
         "selections": {"c_eff": selection("c_eff", 12)}},
        {"id": "lower", "top": 10, "bottom": 20, "gamma": 18,
         "design": {"phi_eff": 40, "c_eff": lower_cohesion}},
    ]
    profile = create_profile(opened, payload)
    clean(opened)
    session = opened.app.state.session
    before = session.project.model_dump()
    ids = [layer["id"] for layer in profile["layers"]]
    path = f"{PREFIX}/profiles/{profile['id']}"
    response = opened.post(f"{path}/layers/merge", json={"layer_ids": ids[::-1] if reverse else ids})
    assert response.status_code == 409, response.text
    assert error_code(response) == "design_conflict"
    assert set(response.json()["details"]["conflicting_keys"]) == {"phi_eff", "c_eff"}
    assert session.project.model_dump() == before
    assert session.dirty is False
    assert opened.get(path).json() == profile


def test_split_merge_preserve_values_and_structure_copies(opened):
    profile = create_profile(opened)
    session = opened.app.state.session
    source = session.project.profile(profile["id"])
    structure = RetainingWallStructure(
        id="W1", wall_type="cantilever", height=4,
        soil=StructureSoilModel(source_profile_id=source.id, source_hash=source.content_hash(),
                                profile=source.model_copy(deep=True)),
    )
    session.project.structures.append(structure)
    before_copy = structure.soil.model_dump()
    clean(opened)
    path = f"{PREFIX}/profiles/{source.id}"
    layer_id = source.layers[0].id
    response = opened.post(f"{path}/layers/{layer_id}/split", json={"depth": 5})
    assert response.status_code == 200, response.text
    split = response.json()["layers"]
    assert [(row["top"], row["bottom"]) for row in split] == [(0, 5), (5, 20)]
    assert split[0]["id"] == layer_id and split[1]["id"] != layer_id
    for row in split:
        assert row["gamma"] == 18 and row["design"]["phi_eff"] == 30
    assert opened.get("/api/project").json()["structures"][0]["stale"] is True
    assert session.project.structures[0].soil.model_dump() == before_copy
    assert opened.get("/api/session").json()["dirty"] is True
    clean(opened)
    # Reversed request order still keeps the geometrically upper layer's properties.
    changed = response.json()
    changed["layers"][1]["gamma"] = 21
    assert opened.put(path, json=changed).status_code == 200
    clean(opened)
    response = opened.post(f"{path}/layers/merge", json={"layer_ids": [row["id"] for row in split[::-1]]})
    assert response.status_code == 200, response.text
    merged = response.json()["layers"]
    assert len(merged) == 1 and merged[0]["id"] == layer_id
    assert merged[0]["bottom"] == 20 and merged[0]["gamma"] == 18
    assert opened.get("/api/session").json()["dirty"] is True
    assert session.project.structures[0].soil.model_dump() == before_copy
    changed = response.json()
    changed["layers"][0]["gamma"] = 19
    assert opened.put(path, json=changed).status_code == 200
    assert opened.get("/api/project").json()["structures"][0]["stale"] is True
    # A profile that structures copy from cannot be deleted (their copy would stay stale for good).
    response = opened.delete(path)
    assert response.status_code == 409 and error_code(response) == "profile_in_use"
    assert response.json()["details"]["message_code"] == "profile_in_use"
    assert opened.get(path).status_code == 200
    assert session.project.structures[0].soil.model_dump() == before_copy
    assert Project.model_validate(session.project.model_dump()) == session.project


@pytest.mark.parametrize("depth", [0, -1, 20, 21, 1e-7, 20 - 1e-7, "Infinity", "NaN"])
def test_invalid_split(opened, depth):
    profile = create_profile(opened)
    clean(opened)
    path = f"{PREFIX}/profiles/{profile['id']}/layers/{profile['layers'][0]['id']}/split"
    response = opened.post(path, json={"depth": depth})
    assert response.status_code == 422 and error_code(response) == "validation"
    assert opened.get("/api/session").json()["dirty"] is False
    assert opened.get(f"{PREFIX}/profiles/{profile['id']}").json() == profile


def test_missing_layers_and_invalid_merge(opened):
    payload = deepcopy(CREATE)
    payload["layers"] = [{"id": str(i), "top": i * 5, "bottom": (i + 1) * 5, "gamma": 18}
                         for i in range(3)]
    profile = create_profile(opened, payload)
    ids = [layer["id"] for layer in profile["layers"]]
    path = f"{PREFIX}/profiles/{profile['id']}/layers"
    clean(opened)
    assert opened.post(f"{path}/unknown/split", json={"depth": 2}).status_code == 404
    assert opened.post(f"{path}/merge", json={"layer_ids": [ids[0], "unknown"]}).status_code == 404
    for invalid in [[ids[0]], [ids[0], ids[0]], [ids[0], ids[2]], ids]:
        response = opened.post(f"{path}/merge", json={"layer_ids": invalid})
        assert response.status_code == 422 and error_code(response) == "validation"
    assert opened.get("/api/session").json()["dirty"] is False


def test_processed_routes_match_existing_engines_and_stay_clean(opened):
    create_profile(opened)
    assert upload(opened).status_code == 200
    assert upload(opened, "spt").status_code == 200
    clean(opened)
    project = opened.app.state.session.project
    cpt = process_cpt(project.investigations.cpts[0], project.active_profile())
    spt = process_borehole(project.investigations.boreholes[0], project.active_profile())
    response = opened.get(f"{PREFIX}/cpts/C1/processed")
    assert response.status_code == 200, response.text
    for key in ["depth", "qc", "fs", "qt", "Rf", "Fr", "Bq", "Qtn", "Ic", "fc", "sigma_v", "sigma_v_eff"]:
        np.testing.assert_allclose(response.json()[key], getattr(cpt, key))
    assert response.json()["warnings"] == cpt.warnings
    assert response.json()["zone"] == cpt.zone.tolist()
    response = opened.get(f"{PREFIX}/boreholes/B1/processed")
    assert response.status_code == 200, response.text
    for key, attribute in [("depth", "depth"), ("N_field", "n_field"), ("N60", "n60"), ("N1_60", "n1_60")]:
        np.testing.assert_allclose(response.json()[key], getattr(spt, attribute))
    assert response.json()["warnings"] == spt.warnings and response.json()["warnings"]
    assert opened.get("/api/session").json()["dirty"] is False


def test_processing_missing_inputs_and_empty_borehole(opened):
    assert upload(opened).status_code == 200
    assert upload(opened, "spt").status_code == 200
    for path in ["/cpts/C1/processed", "/boreholes/B1/processed"]:
        response = opened.get(PREFIX + path)
        assert response.status_code == 422 and error_code(response) == "validation"
    assert opened.put(f"{PREFIX}/boreholes/B1", json={"id": "B1"}).status_code == 200
    create_profile(opened)
    clean(opened)
    assert opened.get(f"{PREFIX}/boreholes/B1/processed").status_code == 422
    assert opened.get("/api/session").json()["dirty"] is False


def test_cpt_without_profile_and_non_finite_output(opened):
    assert upload(opened, content=b"depth,qc,fs\n0,0,0\n1,2,20\n").status_code == 200
    records = opened.get(f"{PREFIX}/investigations").json()
    sounding = {**records["cpts"][0], "gwt_depth": 1}
    assert opened.put(f"{PREFIX}/cpts/C1", json=sounding).status_code == 200
    clean(opened)
    response = opened.get(f"{PREFIX}/cpts/C1/processed")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["Ic"][0] is None and data["Qtn"][0] is None and data["Rf"][0] is None
    assert data["zone"][0] is None and data["Bq"] is None and data["warnings"]
    json.dumps(data, allow_nan=False)
    assert opened.get("/api/session").json()["dirty"] is False


def test_processing_uses_selected_profile_and_cpt_fallback(opened):
    first = create_profile(opened)
    second = create_profile(opened, {**CREATE, "layers": [
        {"id": "x", "top": 0, "bottom": 1.5, "gamma": 22}], "gwt": {"depth_insitu": 1}})
    assert upload(opened).status_code == 200
    assert upload(opened, "spt").status_code == 200
    assert opened.put("/api/project/active-profile", json={"profile_id": second["id"]}).status_code == 200
    clean(opened)
    project = opened.app.state.session.project
    expected = process_cpt(project.investigations.cpts[0], gwt_depth=1)
    response = opened.get(f"{PREFIX}/cpts/C1/processed")
    assert response.status_code == 200, response.text
    np.testing.assert_allclose(response.json()["sigma_v"], expected.sigma_v)
    assert opened.get(f"{PREFIX}/boreholes/B1/processed").status_code == 422
    assert opened.get("/api/session").json()["dirty"] is False
    assert opened.put("/api/project/active-profile", json={"profile_id": first["id"]}).status_code == 200
    assert opened.get(f"{PREFIX}/boreholes/B1/processed").status_code == 200


def test_reopen_full_soil_workflow(opened, library_dir):
    assert upload(opened).status_code == 200
    assert upload(opened, "spt").status_code == 200
    profile = create_profile(opened, {**CREATE, "source_ids": ["C1", "B1"]})
    clean(opened)
    file = next(library_dir.glob("*.gtk"))
    assert load_project(file).profile(profile["id"]).layers[0].gamma == 18
    assert opened.post("/api/project/close").status_code == 200
    assert opened.post(f"/api/library/{file.name}/open").status_code == 200
    assert opened.get(f"{PREFIX}/profiles/{profile['id']}").json() == profile
    records = opened.get(f"{PREFIX}/investigations").json()
    assert records["cpts"][0]["qc"] == [2000, 3000]
    assert records["boreholes"][0]["spt"][1]["refusal"] is True
    assert opened.get(f"{PREFIX}/cpts/C1/processed").status_code == 200
    assert opened.get(f"{PREFIX}/boreholes/B1/processed").status_code == 200
