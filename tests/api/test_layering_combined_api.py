"""Combined layering and automatic unit weights through the HTTP contract (HS-E)."""

from __future__ import annotations

import pytest

from .conftest import error_code

PREFIX = "/api/m/soil"
CPT_CSV = (b"depth,qc (MPa),fs (kPa)\n" + b"".join(
    f"{d / 2},10,60\n".encode() for d in range(1, 13)))
BOREHOLE = {
    "id": "B1", "x": 3.0, "y": 4.0,
    "spt": [{"depth": 1.0, "n_field": 10}, {"depth": 3.0, "n_field": 15}],
    "lab": [{"depth": 1.0, "FC": 90, "LL": 60, "PI": 40}],
}


@pytest.fixture
def opened(shell):
    assert shell.post("/api/library", json={"name": "Combined"}).status_code == 200
    files = {"file": ("cpt.csv", CPT_CSV, "text/csv")}
    data = {"sounding_id": "C1", "qc_unit": "MPa", "delimiter": ",", "decimal": "."}
    assert shell.post(f"{PREFIX}/import/cpt", data=data, files=files).status_code == 200
    depth = [d / 2 for d in range(1, 13)]
    cpt = {"id": "C1", "x": 0.0, "y": 0.0, "gwt_depth": 2.0, "depth": depth, "qc": [5000.0 + 1000.0 * i for i in range(12)], "fs": [60.0] * 12}
    assert shell.put(f"{PREFIX}/cpts/C1", json=cpt).status_code == 200
    assert shell.post(f"{PREFIX}/boreholes", json=BOREHOLE).status_code == 200
    return shell


def combined(client, **extra):
    return client.post(f"{PREFIX}/layering/combined", json={
        "cpt_id": "C1", "borehole_ids": ["B1"], "settings": {"method": "combined"}, **extra})


def create(client, proposal):
    return client.post(f"{PREFIX}/profiles", json={
        "name": "Common", "origin": "mixed", "source_ids": ["C1", "B1"],
        "gwt": {"depth_insitu": 2}, "from_proposal": proposal})


def test_combined_proposal_flags_conflict_and_needs_resolution(opened):
    response = combined(opened)
    assert response.status_code == 200, response.text
    proposal = response.json()
    assert proposal["source_ids"] == ["C1", "B1"] and proposal["source_id"] == "C1"
    assert proposal["distances"] == {"B1": pytest.approx(5.0)}  # 3-4-5 triangle
    assert "layering.warning.depth_not_aligned: borehole=\"B1\"" in proposal["warnings"]
    first = proposal["layers"][0]
    assert first["uscs"] == "CH" and first["conflict"]["cpt"] == "coarse"

    refused = create(opened, proposal)
    assert refused.status_code == 422 and error_code(refused) == "layering_conflict_unresolved"

    for item in proposal["layers"]:
        if item["conflict"] is not None:
            item["resolution"] = "cpt"
    created = create(opened, proposal)
    assert created.status_code == 200, created.text
    layers = created.json()["layers"]
    assert layers[0]["uscs"] is None and layers[0]["behaviour"] == "drained"
    assert set(layers[0]["source_ids"]) == {"C1", "B1"}
    assert created.json()["layering"]["method"] == "combined"

    proposal["layers"][0]["resolution"] = "uscs"
    by_uscs = create(opened, proposal)
    assert by_uscs.json()["layers"][0]["uscs"] == "CH"
    assert by_uscs.json()["layers"][0]["behaviour"] == "undrained"


def test_combined_rejects_unknown_ids_and_wrong_method(opened):
    absent = opened.post(f"{PREFIX}/layering/combined", json={
        "cpt_id": "C1", "borehole_ids": ["nope"], "settings": {"method": "combined"}})
    assert absent.status_code == 404
    wrong = opened.post(f"{PREFIX}/layering/combined", json={
        "cpt_id": "C1", "borehole_ids": ["B1"], "settings": {"method": "cpt_ic"}})
    assert wrong.status_code == 422


def test_spt_layering_works_without_profile_and_accepts_supplied_gamma(opened):
    body = {"method": "spt_uscs_n", "min_thickness": 0.1}
    response = opened.post(f"{PREFIX}/layering/spt/B1", json=body)
    assert response.status_code == 200, response.text
    layer = response.json()["layers"][0]
    assert layer["uscs"] == "CH" and layer["gamma_suggested"] is None  # clay: no SPT correlation
    supplied = opened.post(f"{PREFIX}/layering/spt/B1", json={
        **body, "supplied_gamma": {"0": {"gamma": 17.5, "gamma_sat": 18.5}}})
    layer = supplied.json()["layers"][0]
    assert (layer["gamma_suggested"], layer["gamma_sat_suggested"]) == (17.5, 18.5)
    assert layer["gamma_source"] == layer["gamma_sat_source"] == "user"
    assert opened.post(f"{PREFIX}/layering/spt/B1", json={
        **body, "supplied_gamma": {"9": {"gamma": 17.5}}}).status_code == 422


def test_combined_groundwater_falls_back_to_first_borehole_with_a_table(opened):
    """GWT order: CPT, first selected borehole with gwt_depth, active profile, none.

    No elevations, so no shift: a borehole table at 2 m reproduces the CPT's 2 m table.
    """
    reference = combined(opened).json()["layers"]
    depth = [d / 2 for d in range(1, 13)]
    bare = {"id": "C1", "x": 0.0, "y": 0.0, "depth": depth, "qc": [5000.0 + 1000.0 * i for i in range(12)], "fs": [60.0] * 12}
    assert opened.put(f"{PREFIX}/cpts/C1", json=bare).status_code == 200
    assert combined(opened).status_code == 422  # no table anywhere
    assert opened.put(f"{PREFIX}/boreholes/B1", json={**BOREHOLE, "gwt_depth": 2.0}).status_code == 200
    assert opened.post(f"{PREFIX}/boreholes", json={**BOREHOLE, "id": "B2", "gwt_depth": 4.0}
                       ).status_code == 200

    def run(ids):
        response = opened.post(f"{PREFIX}/layering/combined", json={
            "cpt_id": "C1", "borehole_ids": ids, "settings": {"method": "combined"}})
        assert response.status_code == 200, response.text
        return [(x["gamma_suggested"], x["gamma_sat_suggested"]) for x in response.json()["layers"]]

    expected = [(x["gamma_suggested"], x["gamma_sat_suggested"]) for x in reference]
    assert run(["B1", "B2"]) == expected
    assert run(["B2", "B1"]) != expected  # B2 (4 m) comes first in request order
