"""Classification HTTP contracts checked against existing processing and engines."""

import json
from dataclasses import asdict

import numpy as np
import pytest

from geotek.engine.classification import robertson, uscs
from geotek.engine.classification.uscs_names import USCS_NAMES

from .conftest import error_code
from .test_soil_api import PREFIX, clean, create_profile, opened, upload  # noqa: F401


def test_sbtn_reference_matches_engine(shell):
    response = shell.get(f"{PREFIX}/classification/sbtn/reference")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["ic_bounds"] == list(robertson.IC_BOUNDS)
    assert data["fr_range"] == {"min": 0.1, "max": 10.0}
    assert data["qtn_range"] == {"min": 1.0, "max": 1000.0}
    assert [zone["zone"] for zone in data["zones"]] == list(range(1, 8))
    bounds = [None, *robertson.IC_BOUNDS, None]
    for zone in data["zones"]:
        number = zone["zone"]
        assert zone["name_en"] == robertson.ZONE_NAMES[number]["en"]
        assert zone["name_tr"] == robertson.ZONE_NAMES[number]["tr"]
        expected = [None, None] if number == 1 else bounds[7 - number:9 - number]
        assert [zone["ic_min"], zone["ic_max"]] == expected
    boundary = data["zone_1_boundary"]
    fr = np.array([point["Fr"] for point in boundary])
    assert len(fr) > 2 and fr[0] == 0.1 and fr[-1] == 10.0
    np.testing.assert_allclose(np.diff(np.log10(fr)), 2.0 / (len(fr) - 1))
    qtn = np.array([point["Qtn"] for point in boundary])
    np.testing.assert_array_equal(qtn, 12.0 * np.exp(-1.4 * fr))
    assert np.all(robertson.sbtn_zone(qtn * (1 - 1e-12), fr) == 1)
    np.testing.assert_array_equal(
        robertson.sbtn_zone(qtn, fr), robertson.zone_from_ic(robertson.soil_behaviour_index(qtn, fr)),
    )
    assert [curve["Ic"] for curve in data["ic_contours"]] == list(robertson.IC_BOUNDS)
    for curve in data["ic_contours"]:
        assert len(curve["points"]) > 2
        f = np.array([point["Fr"] for point in curve["points"]])
        q = np.array([point["Qtn"] for point in curve["points"]])
        assert np.all(np.diff(f) > 0)
        assert np.all((0.1 <= f) & (f <= 10) & (1 <= q) & (q <= 1000))
        np.testing.assert_allclose(
            robertson.soil_behaviour_index(q, f), curve["Ic"], rtol=0, atol=1e-9,
        )
    assert np.isnan(robertson.qtn_from_ic(1.31, 10.0))
    json.dumps(data, allow_nan=False)


@pytest.mark.parametrize("mode", ["profile", "fallback", "nonfinite"])
def test_cpt_sbtn_equals_processed(opened, mode):
    if mode == "profile":
        create_profile(opened)
    content = b"depth,qc,fs\n0,0,0\n1,2,20\n" if mode == "nonfinite" else None
    sounding = upload(opened, content=content).json()
    if mode != "profile":
        assert opened.put(f"{PREFIX}/cpts/C1", json={**sounding, "gwt_depth": 1}).status_code == 200
    clean(opened)
    before = opened.app.state.session.project.model_dump(mode="json")
    processed_response = opened.get(f"{PREFIX}/cpts/C1/processed")
    response = opened.get(f"{PREFIX}/cpts/C1/sbtn")
    assert response.status_code == processed_response.status_code == 200, response.text
    processed, data = processed_response.json(), response.json()
    assert data["warnings"] == processed["warnings"]
    assert len(data["points"]) == len(processed["depth"])
    for index, point in enumerate(data["points"]):
        for key in ("depth", "Fr", "Qtn", "Ic", "zone"):
            assert point[key] == processed[key][index]
        name = robertson.ZONE_NAMES.get(point["zone"], {})
        assert point["zone_name_en"] == name.get("en")
        assert point["zone_name_tr"] == name.get("tr")
    if mode == "nonfinite":
        assert data["points"][0]["Ic"] is None
        assert data["points"][0]["zone"] is None
    json.dumps(data, allow_nan=False)
    assert opened.app.state.session.project.model_dump(mode="json") == before
    assert opened.get("/api/session").json()["dirty"] is False


def test_cpt_sbtn_processing_error_matches_processed(opened):
    assert upload(opened).status_code == 200
    processed = opened.get(f"{PREFIX}/cpts/C1/processed")
    response = opened.get(f"{PREFIX}/cpts/C1/sbtn")
    assert response.status_code == processed.status_code == 422
    assert response.json() == processed.json()


def test_borehole_uscs_matches_lab_engine(opened):
    borehole = upload(opened, "spt").json()
    labs = [
        {"depth": 1, "FC": 3, "gravel": 70, "D10": 0.5, "D30": 2, "D60": 4},
        {"depth": 2, "FC": 60, "LL": 45, "PL": 20},
        {"depth": 3},
        {"depth": 4, "FC": 70},
        {"depth": 5, "FC": 8},
        {"depth": 6, "FC": 30, "gravel": 10, "LL": 25, "PI": 5},
        {"depth": 7, "FC": 30, "gravel": 50, "LL": 25, "PI": 5},
        {"depth": 8, "FC": 3, "D10": 0.1, "D60": 0.8},
    ]
    assert opened.put(f"{PREFIX}/boreholes/B1", json={**borehole, "lab": labs}).status_code == 200
    clean(opened)
    before = opened.app.state.session.project.model_dump(mode="json")
    records = opened.app.state.session.project.investigations.boreholes[0].lab
    response = opened.get(f"{PREFIX}/boreholes/B1/uscs")
    assert response.status_code == 200, response.text
    items = response.json()["items"]
    assert len(items) == len(records)
    for item, record in zip(items, records):
        expected = uscs.classify_lab_record(record)
        assert {key: item[key] for key in ("symbol", "complete", "notes")} == asdict(expected)
        for key in ("depth", "FC", "gravel", "LL", "PL", "PI", "D10", "D30", "D60"):
            assert item[key] == getattr(record, key)
        if all(value is not None for value in (record.D10, record.D30, record.D60)):
            assert item["Cu"] == pytest.approx(record.D60 / record.D10)
            assert item["Cc"] == pytest.approx(record.D30**2 / (record.D10 * record.D60))
        else:
            assert item["Cu"] is item["Cc"] is None
        plastic = uscs.fines_type(record.LL, record.PI) if (
            record.LL is not None and record.PI is not None) else None
        assert item["plastic_class"] == plastic
        name = USCS_NAMES.get(expected.symbol)
        for key in ("group_name_en", "group_name_tr", "description"):
            assert item[key] == (getattr(name, key) if name else None)
    assert items[0]["Cu"] == 8 and items[0]["Cc"] == 2
    assert items[1]["PI"] == 25
    assert opened.app.state.session.project.model_dump(mode="json") == before
    assert opened.get("/api/session").json()["dirty"] is False


def test_empty_borehole_uscs(opened):
    assert upload(opened, "spt").status_code == 200
    assert opened.get(f"{PREFIX}/boreholes/B1/uscs").json() == {"items": []}


@pytest.mark.parametrize("payload", [
    {"fines": 3, "gravel": 10, "D10": 0.1, "D30": 0.3, "D60": 0.8},
    {"fines": 60, "LL": 40, "PI": 20},
    {"fines": 70},
    {"fines": 20},
    {"fines": 60, "LL": 25, "PI": 30},
])
def test_stateless_uscs_matches_engine_without_project(shell, payload):
    response = shell.post(f"{PREFIX}/classification/uscs", json=payload)
    assert response.status_code == 200, response.text
    item = response.json()
    expected = uscs.classify(**payload)
    assert {key: item[key] for key in ("symbol", "complete", "notes")} == asdict(expected)
    if not expected.complete:
        assert item["notes"]
    assert item["depth"] is item["PL"] is None
    assert item["FC"] == payload["fines"]
    for key in ("gravel", "LL", "PI", "D10", "D30", "D60"):
        assert item[key] == payload.get(key)
    if "D30" in payload:
        assert item["Cu"] == pytest.approx(8)
        assert item["Cc"] == pytest.approx(1.125)
    assert shell.get("/api/session").json()["dirty"] is False


def test_uscs_nonfinite_ratios_are_null(shell):
    response = shell.post(f"{PREFIX}/classification/uscs", json={
        "fines": 60, "LL": 40, "PI": 20, "D10": 1e-200, "D30": 1e200, "D60": 1e200,
    })
    assert response.status_code == 200, response.text
    assert response.json()["Cu"] is response.json()["Cc"] is None
    json.dumps(response.json(), allow_nan=False)


@pytest.mark.parametrize("payload", [
    {}, {"fines": -1}, {"fines": 101}, {"fines": 3, "gravel": 101},
    {"fines": 3, "LL": -1}, {"fines": 3, "PI": -1},
    {"fines": 3, "D10": 0}, {"fines": 3, "D30": 0}, {"fines": 3, "D60": -1},
    {"fines": 3, "FC": 3},
])
def test_stateless_uscs_validation(shell, payload):
    response = shell.post(f"{PREFIX}/classification/uscs", json=payload)
    assert response.status_code == 422 and error_code(response) == "validation"


def test_uscs_reference_matches_engine(shell):
    response = shell.get(f"{PREFIX}/classification/uscs/reference")
    assert response.status_code == 200, response.text
    data = response.json()
    for key, function in (("a_line", uscs.a_line), ("u_line", uscs.u_line)):
        assert [point["LL"] for point in data[key]] == list(range(101))
        for point in data[key]:
            assert point["PI"] == function(point["LL"])
        assert data[key][0]["PI"] < 0  # Preserve the engine's unclipped line semantics.
    symbols = {item["symbol"]: item for item in data["symbols"]}
    assert len(data["symbols"]) == len(symbols) == 23
    assert set(symbols) == {
        "GW", "GP", "GM", "GC", "GC-GM", "SW", "SP", "SM", "SC", "SC-SM",
        "GW-GM", "GW-GC", "GP-GM", "GP-GC", "SW-SM", "SW-SC", "SP-SM", "SP-SC",
        "CL", "ML", "CL-ML", "CH", "MH",
    }
    for symbol, name in USCS_NAMES.items():
        assert symbols[symbol] == {"symbol": symbol, **asdict(name)}
        assert all(asdict(name).values())
    assert symbols["CL"]["group_name_en"] == "Lean clay"
    assert symbols["CH"]["group_name_en"] == "Fat clay"


@pytest.mark.parametrize("path", ["/cpts/missing/sbtn", "/boreholes/missing/uscs"])
def test_classification_missing_resource(opened, path):
    response = opened.get(PREFIX + path)
    assert response.status_code == 404 and error_code(response) == "not_found"


@pytest.mark.parametrize("path", ["/cpts/C1/sbtn", "/boreholes/B1/uscs"])
def test_classification_requires_project(shell, path):
    response = shell.get(PREFIX + path)
    assert response.status_code == 409 and error_code(response) == "no_project_open"
