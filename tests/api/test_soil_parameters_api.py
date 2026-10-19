"""Layering proposals, parameter selection/approval routes and the merged i18n catalog."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime

import pytest

from geotek.engine.layering.common import parse_warning
from geotek.i18n import _catalog

from .conftest import error_code
from .test_soil_api import CREATE, PREFIX, create_profile, upload

CPT_ROWS = "".join(f"{0.5 * i},{3 + i % 3},{30 + i},{5 * i}\n" for i in range(1, 21))
CPT_CSV = ("depth,qc (MPa),fs (kPa),u2 (kPa)\n" + CPT_ROWS).encode()
SPT_CSV = b"depth,N\n1.5,8\n3,12\n4.5,18\n6,25\n"


@pytest.fixture
def opened(shell):
    assert shell.post("/api/library", json={"name": "Soil parameters"}).status_code == 200
    return shell


def sourced_profile(client, source="C1"):
    """Manual-geometry profile whose two layers are interpreted from one sounding."""
    payload = deepcopy(CREATE)
    payload.update(origin="cpt", source_ids=[source])
    payload["layers"] = [
        {"id": "a", "top": 0, "bottom": 5, "gamma": 18, "source_ids": [source]},
        {"id": "b", "top": 5, "bottom": 10, "gamma": 19, "source_ids": [source]},
    ]
    return create_profile(client, payload)


def params_path(profile, index=0, suffix=""):
    """Layer ids are server-assigned, so address layers by position."""
    return f"{PREFIX}/profiles/{profile['id']}/layers/{profile['layers'][index]['id']}/parameters{suffix}"


def test_cpt_layering_is_read_only_and_translatable(opened):
    assert upload(opened, content=CPT_CSV).status_code == 200
    create_profile(opened)  # processing needs a unit-weight profile for stresses
    assert opened.post("/api/project/save").status_code == 200
    response = opened.post(f"{PREFIX}/layering/cpt/C1", json={"method": "cpt_ic"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["source_id"] == "C1" and body["layers"]
    assert body["layers"][0]["top"] == 0
    catalog = _catalog("en")
    for warning in body["warnings"]:
        code, _ = parse_warning(warning)
        assert code in catalog
    assert opened.get("/api/session").json()["dirty"] is False


def test_spt_layering_and_method_mismatch(opened):
    assert upload(opened, "spt", content=SPT_CSV).status_code == 200
    create_profile(opened)
    response = opened.post(f"{PREFIX}/layering/spt/B1", json={"method": "spt_uscs_n"})
    assert response.status_code == 200, response.text
    assert response.json()["source_id"] == "B1"
    mismatch = opened.post(f"{PREFIX}/layering/spt/B1", json={"method": "cpt_ic"})
    assert mismatch.status_code == 422 and error_code(mismatch) == "validation"


def test_layering_unknown_and_mismatched_investigation(opened):
    assert upload(opened, content=CPT_CSV).status_code == 200
    for kind, identifier, method in [("cpt", "nope", "cpt_ic"), ("spt", "nope", "spt_log")]:
        response = opened.post(f"{PREFIX}/layering/{kind}/{identifier}", json={"method": method})
        assert response.status_code == 404 and error_code(response) == "not_found"
    response = opened.post(f"{PREFIX}/layering/cpt/C1", json={"method": "spt_log"})
    assert response.status_code == 422 and error_code(response) == "validation"


def test_parameter_list_covers_every_design_key(opened):
    assert upload(opened, content=CPT_CSV).status_code == 200
    profile = sourced_profile(opened)
    response = opened.get(params_path(profile))
    assert response.status_code == 200, response.text
    keys = [item["parameter"] for item in response.json()]
    assert keys == ["phi_eff", "c_eff", "su", "E", "gamma", "gamma_sat", "delta_base"]
    assert any(item["candidates"] for item in response.json())
    assert not any(item["approved"] for item in response.json())


def test_selection_update_resolves_without_approving(opened):
    assert upload(opened, content=CPT_CSV).status_code == 200
    profile = sourced_profile(opened)
    response = opened.put(params_path(profile, suffix="/phi_eff"),
                          json={"mode": "manual", "manual_value": 31})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["selected"]["value"] == 31 and body["approved"] is False
    stored = opened.get(f"{PREFIX}/profiles/{profile['id']}").json()["layers"][0]
    assert stored["selections"]["phi_eff"]["selected"]["value"] == 31
    assert stored["design"]["phi_eff"] is None
    bad = opened.put(params_path(profile, suffix="/phi_eff"), json={"mode": "manual"})
    assert bad.status_code == 422 and error_code(bad) == "validation"


def test_approve_sets_flag_hash_and_design_only_for_listed_keys(opened):
    assert upload(opened, content=CPT_CSV).status_code == 200
    profile = sourced_profile(opened)
    for key, value in [("phi_eff", 31), ("c_eff", 2)]:
        assert opened.put(params_path(profile, suffix=f"/{key}"),
                          json={"mode": "manual", "manual_value": value}).status_code == 200
    response = opened.post(params_path(profile, suffix="/approve"), json={"keys": ["phi_eff"]})
    assert response.status_code == 200, response.text
    layer = response.json()
    phi, cohesion = layer["selections"]["phi_eff"], layer["selections"]["c_eff"]
    assert phi["approved"] is True and phi["basis_hash"]
    assert datetime.fromisoformat(phi["approved_at"].replace("Z", "+00:00")).tzinfo is not None
    assert layer["design"]["phi_eff"] == 31 and layer["design"]["c_eff"] == 0
    assert cohesion["approved"] is False
    stored = opened.get(f"{PREFIX}/profiles/{profile['id']}").json()["layers"][0]
    assert stored == layer
    unknown = opened.post(params_path(profile, suffix="/approve"), json={"keys": ["su"]})
    assert unknown.status_code == 422 and error_code(unknown) == "validation"


def test_boundary_change_revokes_approval_and_allows_fresh_reapproval(opened):
    assert upload(opened, content=CPT_CSV).status_code == 200
    profile = sourced_profile(opened)
    assert opened.put(params_path(profile, suffix="/phi_eff"),
                      json={"mode": "manual", "manual_value": 31}).status_code == 200
    first = opened.post(params_path(profile, suffix="/approve"), json={"keys": ["phi_eff"]})
    assert first.status_code == 200
    old_hash = first.json()["selections"]["phi_eff"]["basis_hash"]
    incoming = opened.get(f"{PREFIX}/profiles/{profile['id']}").json()
    incoming["layers"][0]["bottom"] = incoming["layers"][1]["top"] = 4
    assert opened.put(f"{PREFIX}/profiles/{profile['id']}", json=incoming).status_code == 200
    listed = opened.get(params_path(profile)).json()
    assert not any(item["approved"] for item in listed)
    again = opened.post(params_path(profile, suffix="/approve"), json={"keys": ["phi_eff"]})
    assert again.status_code == 200, again.text
    assert again.json()["selections"]["phi_eff"]["basis_hash"] != old_hash


def test_suggest_all_approves_nothing_and_persists(opened):
    assert upload(opened, content=CPT_CSV).status_code == 200
    profile = sourced_profile(opened)
    response = opened.post(f"{PREFIX}/profiles/{profile['id']}/parameters/suggest-all")
    assert response.status_code == 200, response.text
    body = response.json()
    assert any(sel["candidates"] for layer in body["layers"]
               for sel in layer["selections"].values())
    assert not any(sel["approved"] for layer in body["layers"]
                   for sel in layer["selections"].values())
    assert opened.get(f"{PREFIX}/profiles/{profile['id']}").json() == body


def test_parameter_routes_unknown_resources(opened):
    profile = create_profile(opened)
    base = f"{PREFIX}/profiles"
    for response in (
        opened.get(f"{base}/nope/layers/L/parameters"),
        opened.get(f"{base}/{profile['id']}/layers/nope/parameters"),
        opened.post(f"{base}/nope/parameters/suggest-all"),
        opened.post(f"{base}/{profile['id']}/layers/nope/parameters/approve",
                    json={"keys": ["phi_eff"]}),
    ):
        assert response.status_code == 404 and error_code(response) == "not_found"


@pytest.mark.parametrize("lang", ["tr", "en"])
def test_i18n_contains_warning_codes_and_rejects_unknown_language(shell, lang):
    catalog = shell.get(f"/api/i18n/{lang}").json()
    assert "layering.warning.thin_merged" in catalog
    assert "parameters.warning.phi_cv_assumed_equal_phi_eff" in catalog
    assert shell.get("/api/i18n/de").status_code == 422


def test_approve_resolves_against_fresh_candidates_after_data_change(opened):
    assert upload(opened, content=CPT_CSV).status_code == 200
    profile = sourced_profile(opened)
    method = next(c["method_id"] for c in opened.get(params_path(profile)).json()[0]["candidates"]
                  if c["validity_ok"])
    assert opened.put(params_path(profile, suffix="/phi_eff"),
                      json={"mode": "correlation", "method_id": method}).status_code == 200
    depths = [0.5 * i for i in range(1, 21)]
    changed = {"id": "C1", "depth": depths, "qc": [8000 + 100 * i for i in range(20)],
               "fs": [30 + i for i in range(20)]}
    assert opened.put(f"{PREFIX}/cpts/C1", json=changed).status_code == 200
    fresh = next(c for c in opened.get(params_path(profile)).json()[0]["candidates"]
                 if c["method_id"] == method)
    response = opened.post(params_path(profile, suffix="/approve"), json={"keys": ["phi_eff"]})
    assert response.status_code == 200, response.text
    layer = response.json()
    assert layer["design"]["phi_eff"] == pytest.approx(fresh["value"])
    assert layer["selections"]["phi_eff"]["selected"]["value"] == pytest.approx(fresh["value"])
    # Approval and the next refresh agree on the basis, so nothing is flagged stale.
    assert opened.get(params_path(profile)).json()[0]["approved"] is True


def test_approve_without_selection_after_suggest_all_is_422(opened):
    assert upload(opened, content=CPT_CSV).status_code == 200
    profile = sourced_profile(opened)
    assert opened.post(f"{PREFIX}/profiles/{profile['id']}/parameters/suggest-all"
                       ).status_code == 200
    response = opened.post(params_path(profile, suffix="/approve"), json={"keys": ["phi_eff"]})
    assert response.status_code == 422 and error_code(response) == "validation"
