"""Contract drift, route coverage, validation envelopes and finite JSON checks."""

from __future__ import annotations

import json
import os
import re
from dataclasses import fields
from pathlib import Path

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from pydantic import ValidationError

from geotek.api import schemas as dto
from geotek.api.app import create_app
from geotek.config.codes import UsedFactor
from geotek.core.models.project import ProjectMeta
from geotek.engine.sheet_pile import SheetPileResult
from geotek.engine.walls.base import Force, WallAnalysis
from geotek.services.walls_advanced import FactorRow, MissingFactor
from geotek.services.walls_basic import Assumption
from tools.export_openapi import OUTPUT, export_openapi


PROFILE = {
    "id": "P1", "name": "Profile", "gwt": {"depth_insitu": 2},
    "layers": [{"id": "L1", "top": 0, "bottom": 20, "gamma": 18}],
}
SOIL = {"source_profile_id": "P1", "source_hash": "source-hash", "profile": PROFILE}
WALL = {
    "kind": "retaining_wall", "id": "W1", "name": "Wall", "wall_type": "cantilever",
    "height": 4, "soil": SOIL,
}
BOREHOLE = {"id": "BH1"}
CPT = {"id": "CPT1", "depth": [1, 2], "qc": [1000, 2000], "fs": [10, 20]}
LAYERING = {"method": "cpt_ic"}
PROPOSAL = {
    "source_id": "CPT1", "settings": LAYERING, "warnings": [], "layers": [{
        "top": 0, "bottom": 20, "description": "Sand", "uscs": "SP", "sbtn_zone": 6,
        "ic_mean": 1.8, "n60_mean": None, "gamma_suggested": 18, "behaviour": "drained",
    }],
}
PROFILE_CREATE = {
    "name": "Profile", "origin": "manual", "source_ids": [],
    "gwt": {"depth_insitu": 2}, "layers": PROFILE["layers"],
}

# Explicit coverage is independent of app route discovery: missing routes fail the test.
# Engineering values below are test fixtures, never API defaults.
REQUESTS = [
    ("GET", "/api/health", None),
    ("GET", "/api/modules", None),
    ("GET", "/api/settings", None),
    ("PUT", "/api/settings", {"library_dir": "lib", "language": "tr", "recent": []}),
    ("GET", "/api/library", None),
    ("POST", "/api/library", {"name": "Contract"}),
    ("POST", "/api/library/import", {"path": "sample.gtk"}),
    ("POST", "/api/library/{file}/open", None),
    ("POST", "/api/library/{file}/duplicate", None),
    ("POST", "/api/library/{file}/rename", {"name": "Renamed"}),
    ("POST", "/api/library/{file}/export", {"dest": "out.gtk"}),
    ("DELETE", "/api/library/{file}", None),
    ("GET", "/api/session", None),
    ("GET", "/api/i18n/{lang}", None),
    ("POST", "/api/project/new", {"name": "Contract", "language": "en"}),
    ("POST", "/api/project/open", {"path": "sample.gtk"}),
    ("POST", "/api/project/save", {"path": None}),
    ("POST", "/api/project/close", None),
    ("GET", "/api/project", None),
    ("PATCH", "/api/project/meta", {"engineer": "Engineer"}),
    ("PUT", "/api/project/site", {"pga_g": 0.2, "mw": 7}),
    ("PUT", "/api/project/active-profile", {"profile_id": "P1"}),
    ("GET", "/api/m/soil/investigations", None),
    ("POST", "/api/m/soil/import/cpt", None),
    ("POST", "/api/m/soil/import/spt", None),
    ("PUT", "/api/m/soil/boreholes/{id}", BOREHOLE),
    ("DELETE", "/api/m/soil/boreholes/{id}", None),
    ("PUT", "/api/m/soil/boreholes/{id}/log", [{"top": 0, "bottom": 3, "uscs": "SP"}]),
    ("PUT", "/api/m/soil/cpts/{id}", CPT),
    ("DELETE", "/api/m/soil/cpts/{id}", None),
    ("GET", "/api/m/soil/cpts/{id}/processed", None),
    ("GET", "/api/m/soil/boreholes/{id}/processed", None),
    ("POST", "/api/m/soil/layering/cpt/{cpt_id}", LAYERING),
    ("POST", "/api/m/soil/layering/spt/{borehole_id}", {"method": "spt_log"}),
    ("GET", "/api/m/soil/profiles", None),
    ("POST", "/api/m/soil/profiles", PROFILE_CREATE),
    ("GET", "/api/m/soil/profiles/{id}", None),
    ("PUT", "/api/m/soil/profiles/{id}", PROFILE),
    ("DELETE", "/api/m/soil/profiles/{id}", None),
    ("POST", "/api/m/soil/profiles/{id}/layers/{layer_id}/split", {"depth": 2}),
    ("POST", "/api/m/soil/profiles/{id}/layers/merge", {"layer_ids": ["L1", "L2"]}),
    ("GET", "/api/m/soil/profiles/{id}/layers/{layer_id}/parameters", None),
    ("PUT", "/api/m/soil/profiles/{id}/layers/{layer_id}/parameters/{key}",
     {"mode": "manual", "manual_value": 30}),
    ("POST", "/api/m/soil/profiles/{id}/layers/{layer_id}/parameters/approve", {"keys": ["phi_eff"]}),
    ("POST", "/api/m/soil/profiles/{id}/parameters/suggest-all", None),
    ("GET", "/api/data/profiles", None),
    ("GET", "/api/structures", None),
    ("POST", "/api/structures", {
        "kind": "retaining_wall", "name": "Wall", "profile_id": "P1",
        "wall_type": "cantilever", "height": 4,
    }),
    ("GET", "/api/structures/{id}", None),
    ("PUT", "/api/structures/{id}", WALL),
    ("DELETE", "/api/structures/{id}", None),
    ("PUT", "/api/structures/{id}/soil", SOIL),
    ("POST", "/api/structures/{id}/soil/resync", None),
    ("GET", "/api/m/walls/wall-types", None),
    ("POST", "/api/m/walls/structures/{id}/required-factors", None),
    ("POST", "/api/m/walls/structures/{id}/size", None),
    ("POST", "/api/m/walls/structures/{id}/check", None),
    ("GET", "/api/jobs/{job_id}", None),
    ("DELETE", "/api/jobs/{job_id}", None),
    ("POST", "/api/m/sheet_pile/structures/{id}/design", None),
    ("POST", "/api/m/liquefaction/run", {
        "method": "bi2014", "amax_g": 0.3, "mw": 7.5, "target_fs": 1.1,
        "gwt_seismic": None, "default_fc": None, "c_fc": 0, "ic_cutoff": 2.6,
    }),
    ("GET", "/api/codes", None),
    ("GET", "/api/codes/{code_id}/factors", None),
    ("GET", "/api/codes/{code_id}/required", None),
    ("PUT", "/api/project/design-overrides/{code_id}", {
        "safety.sliding.static": {"value": 1.6, "note": "Contract fixture"},
    }),
]


# Core shell routes are implemented and exercised against a temporary library in
# test_library_api.py / test_project_api.py; the contract test only checks their declaration.
IMPLEMENTED = {
    (method, path) for method, path, _ in REQUESTS
    if path in {
        "/api/health", "/api/modules", "/api/settings", "/api/library", "/api/library/import",
        "/api/session", "/api/project", "/api/project/new", "/api/project/open",
        "/api/project/save", "/api/project/close", "/api/project/meta", "/api/project/site",
        "/api/project/active-profile", "/api/data/profiles",
        "/api/i18n/{lang}", "/api/structures", "/api/structures/{id}",
        "/api/structures/{id}/soil", "/api/structures/{id}/soil/resync",
        "/api/codes", "/api/codes/{code_id}/factors", "/api/codes/{code_id}/required",
        "/api/project/design-overrides/{code_id}",
        "/api/m/soil/import/cpt", "/api/m/soil/import/spt", "/api/m/soil/investigations",
        "/api/m/soil/boreholes/{id}", "/api/m/soil/boreholes/{id}/log",
        "/api/m/soil/boreholes/{id}/processed", "/api/m/soil/cpts/{id}",
        "/api/m/soil/cpts/{id}/processed", "/api/m/soil/profiles", "/api/m/soil/profiles/{id}",
        "/api/m/soil/profiles/{id}/layers/{layer_id}/split",
        "/api/m/soil/profiles/{id}/layers/merge",
    } or path.startswith("/api/library/{file}")
}


@pytest.fixture(scope="module")
def app(tmp_path_factory):
    """Build the contract application on an isolated settings file."""
    root = tmp_path_factory.mktemp("contract")
    previous = os.environ.get("GEOTEK_SETTINGS")
    os.environ["GEOTEK_SETTINGS"] = str(root / "settings.json")
    try:
        yield create_app()
    finally:
        if previous is None:
            os.environ.pop("GEOTEK_SETTINGS", None)
        else:
            os.environ["GEOTEK_SETTINGS"] = previous


@pytest.fixture(scope="module")
def client(app):
    """Exercise ASGI request validation, routing and error serialization."""
    with TestClient(app) as test_client:
        yield test_client


def test_create_app_builds(app):
    assert app.title == "GeoTek API"
    assert app.version == "0.2.0"
    assert create_app() is not app


def test_export_matches_committed_contract(tmp_path: Path, app):
    first = tmp_path / "first.json"
    second = tmp_path / "second.json"
    exported = export_openapi(first)
    export_openapi(second)
    assert exported == app.openapi() == json.loads(OUTPUT.read_text(encoding="utf-8"))
    assert first.read_bytes() == second.read_bytes() == OUTPUT.read_bytes()
    assert b"\r\n" not in first.read_bytes()


def test_all_routes_have_stable_unique_operation_ids_and_tags(app):
    routes = [route for route in app.routes if isinstance(route, APIRoute)]
    # FastAPI may wrap included routers; the spec is the stable public surface.
    operations = [
        operation for path in app.openapi()["paths"].values()
        for method, operation in path.items() if method in {"get", "post", "put", "patch", "delete"}
    ]
    ids = [operation["operationId"] for operation in operations]
    assert len(ids) == len(set(ids))
    assert all(re.fullmatch(r"[a-z][a-z0-9_]*", operation_id) for operation_id in ids)
    assert all(operation["tags"] for operation in operations)
    assert all(route.operation_id for route in routes)


def test_module_routes_are_tagged_with_module_id(app):
    seen = set()
    for path, item in app.openapi()["paths"].items():
        match = re.match(r"/api/m/([a-z][a-z0-9_]*)/", path)
        if match is None:
            continue
        seen.add(match.group(1))
        for method, operation in item.items():
            assert operation["tags"] == [match.group(1)], (method, path)
    assert seen == {"soil", "liquefaction", "walls", "sheet_pile"}


def test_route_coverage_and_error_models(app):
    paths = app.openapi()["paths"]
    declared = {
        (method.upper(), path) for path, item in paths.items()
        for method in item if method in {"get", "post", "put", "patch", "delete"}
    }
    assert declared == {(method, path) for method, path, _ in REQUESTS}
    for path in paths.values():
        for operation in path.values():
            for status in ("400", "404", "409", "422", "500", "501", "4XX", "5XX"):
                schema = operation["responses"][status]["content"]["application/json"]["schema"]
                assert schema == {"$ref": "#/components/schemas/ApiError"}


@pytest.mark.parametrize("method,path,payload", REQUESTS, ids=[
    f"{method} {path}" for method, path, _ in REQUESTS
])
def test_unimplemented_operations_return_501(client, method, path, payload):
    if path == "/api/health":
        response = client.get(path)
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "version": "0.2.0"}
        return
    if (method, path) in IMPLEMENTED:
        return
    url = path.format(id="item", layer_id="L1", key="phi_eff", lang="tr", cpt_id="CPT1",
                      borehole_id="BH1", code_id="asd", job_id="job-1")
    kwargs = {}
    if path.startswith("/api/m/soil/import/"):
        kwargs["files"] = {"file": ("fixture.csv", b"depth,qc,fs\n1,1000,10\n", "text/csv")}
        kwargs["data"] = (
            {"sounding_id": "CPT1", "qc_unit": "kPa", "delimiter": ",", "decimal": "."}
            if path.endswith("cpt") else {"borehole_id": "BH1"}
        )
    elif payload is not None:
        kwargs["json"] = payload
    response = client.request(method, url, **kwargs)
    assert response.headers["content-type"] == "application/json"
    assert response.status_code == 501, response.text
    error = dto.ApiError.model_validate(response.json())
    assert error.code == "not_implemented"
    assert error.details == {}
    assert error.missing_factors == []
    assert "detail" not in response.json()


@pytest.mark.parametrize("method,url,payload", [
    ("GET", "/api/i18n/de", None),
    ("POST", "/api/project/new", {"name": "Invalid", "language": "de"}),
    ("PATCH", "/api/project/meta", {"name": None}),
    ("PUT", "/api/m/soil/profiles/P1/layers/L1/parameters/unknown", {"mode": "manual"}),
    ("POST", "/api/m/soil/profiles/P1/layers/merge", {"layer_ids": ["L1"]}),
    ("POST", "/api/structures", {"kind": "unknown", "name": "Bad"}),
])
def test_validation_errors_use_api_error(client, method, url, payload):
    response = client.request(method, url, **({"json": payload} if payload is not None else {}))
    assert response.status_code == 422
    assert dto.ApiError.model_validate(response.json()).code == "validation"
    assert "detail" not in response.json()


def test_http_errors_use_api_error(client):
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert dto.ApiError.model_validate(response.json()).code == "not_found"
    response = client.post("/api/health")
    assert response.status_code == 405
    assert dto.ApiError.model_validate(response.json()).code == "validation"


def test_metadata_patch_preserves_omission():
    assert set(dto.ProjectMetaPatch.model_fields) == set(ProjectMeta.model_fields)
    assert dto.ProjectMetaPatch().model_dump(exclude_unset=True) == {}
    assert dto.ProjectMetaPatch(number="42").model_dump(exclude_unset=True) == {"number": "42"}


def test_profile_creation_alternatives(client):
    from_proposal = {key: value for key, value in PROFILE_CREATE.items() if key != "layers"}
    from_proposal["from_proposal"] = PROPOSAL
    # Request validation passes; without an open project the route answers 409.
    assert client.post("/api/m/soil/profiles", json=from_proposal).status_code == 409
    neither = {key: value for key, value in PROFILE_CREATE.items() if key != "layers"}
    both = {**PROFILE_CREATE, "from_proposal": PROPOSAL}
    assert client.post("/api/m/soil/profiles", json=neither).status_code == 422
    assert client.post("/api/m/soil/profiles", json=both).status_code == 422


def test_sheet_pile_creation_variant(client):
    response = client.post("/api/structures", json={
        "kind": "sheet_pile", "name": "Pile", "profile_id": "P1",
        "retained_height": 4, "support": "anchored", "anchor_depth": 1,
    })
    # The sheet_pile variant passes request validation; without an open project the route answers 409.
    assert response.status_code == 409, response.text
    assert response.json()["code"] == "no_project_open"


def test_multipart_and_discriminators_are_documented(app):
    spec = app.openapi()
    for route, expected in (
        ("cpt", {"file", "sounding_id", "qc_unit", "delimiter", "decimal"}),
        ("spt", {"file", "borehole_id"}),
    ):
        body = spec["paths"][f"/api/m/soil/import/{route}"]["post"]["requestBody"]
        assert set(body["content"]) == {"multipart/form-data"}
        schema = body["content"]["multipart/form-data"]["schema"]
        assert set(schema["required"]) == expected
        assert schema["properties"]["file"]["format"] == "binary"
    for method, path in (("post", "/api/structures"), ("put", "/api/structures/{id}")):
        schema = spec["paths"][path][method]["requestBody"]["content"]["application/json"]["schema"]
        assert schema["discriminator"]["propertyName"] == "kind"


@pytest.mark.parametrize("value", [float("inf"), float("-inf"), float("nan")])
def test_non_finite_result_samples_become_null(value):
    check = dto.CheckDTO(case="static", name="sliding", value=value, required=1.5,
                         passed=True, comparison=">=", utilisation=value, detail="")
    series = dto.SoundingLiquefactionDTO(depth=[1], CSR=[value], CRR=[value], FS=[value],
                                        status=["invalid"], warnings=[])
    diagram = dto.PressureDiagramDTO(side="front", case="static", z=[0], sigma_h_eff=[0],
                                     u=[0], sigma_h=[0], force=0, z_resultant=value)
    for model in (check, series, diagram):
        # allow_nan=False rejects any non-standard numeric token remaining anywhere.
        encoded = json.dumps(model.model_dump(mode="json"), allow_nan=False)
        assert "null" in encoded
        assert "NaN" not in encoded and "Infinity" not in encoded
    assert check.value is None and check.utilisation is None
    assert json.loads(series.model_dump_json())["FS"] == [None]


def test_undefined_check_has_no_utilisation():
    check = dto.CheckDTO(case="static", name="sliding", value=None, required=1.5,
                         passed=True, comparison=">=", utilisation=0, detail="")
    assert check.utilisation is None


def test_job_union_and_progress_bounds():
    wall_result = {
        "structure_id": "W1", "geometry": {
            "height": 4, "base_width": 3, "top_width": 0.5,
        }, "passed": True, "governing": "sliding", "checks": [], "forces": {},
        "pressures": [], "slip_circles": [], "assumptions": [], "factors_used": [],
        "warnings": [], "kh": None, "kv": None, "iterations": 0, "result_hash": "hash",
    }
    pile_result = {
        "structure_id": "SP1", "support": "cantilever", "H": 4, "D0": 2, "D": 2.4,
        "total_length": 6.4, "anchor_depth": None, "anchor_force": None, "toe_force": 10,
        "M_max": 20, "z_M_max": 3, "z": [0, 6.4], "shear": [0, 0], "moment": [0, 0],
        "net": [0, 0], "section_modulus_cm3": None, "assumptions": [], "warnings": [],
    }
    examples = [
        ("wall_size", wall_result, dto.WallResultDTO),
        ("wall_check", wall_result, dto.WallResultDTO),
        ("sheet_pile", pile_result, dto.SheetPileResultDTO),
        ("layering", PROPOSAL, dto.LayeringProposal),
        ("liquefaction", {"per_sounding": {}, "errors": {}}, dto.LiquefactionResultDTO),
    ]
    for kind, result, result_type in examples:
        job = dto.JobState(job_id="job-1", kind=kind, status="done", progress=1,
                           message_key=None, result=result, error=None)
        assert isinstance(job.result, result_type)
        assert dto.JobState.model_validate_json(job.model_dump_json()) == job
    for progress in (-0.1, 1.1, float("nan"), float("inf")):
        with pytest.raises(ValidationError):
            dto.JobState(job_id="job-1", kind="wall_check", status="running", progress=progress,
                         message_key=None, result=None, error=None)


def test_engine_mirror_field_names():
    for api_model, domain_model in (
        (dto.MissingFactorDTO, MissingFactor), (dto.FactorRowDTO, FactorRow),
        (dto.UsedFactorDTO, UsedFactor), (dto.AssumptionDTO, Assumption),
    ):
        assert set(api_model.model_fields) == set(domain_model.model_fields)
    assert set(dto.ForceDTO.model_fields) == {field.name for field in fields(Force)}
    assert set(dto.WallAnalysisDTO.model_fields) == {field.name for field in fields(WallAnalysis)}
    assert set(dto.SheetPileResultDTO.model_fields) == {
        field.name for field in fields(SheetPileResult)
    } | {"structure_id", "total_length", "assumptions"}
