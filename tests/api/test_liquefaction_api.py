"""Liquefaction profile selection, real sounding results, errors and cancellation."""

import threading

import pytest

from geotek.core.models.investigations import Borehole, CPTSounding, Investigations, SPTRecord
from geotek.core.models.project import Project, ProjectMeta
from geotek.services import module1

from .job_helpers import poll_job, submit


PATH = "/api/m/liquefaction/run"
SETTINGS = {"method": "bi2014", "amax_g": 0.4, "mw": 7.5, "target_fs": 1.1,
            "default_fc": 5, "c_fc": 0, "ic_cutoff": 2.6}


@pytest.fixture
def liquefaction_project(two_layer_profile):
    borehole = Borehole(id="BH1", spt=[SPTRecord(depth=1.5, n_field=6),
                                      SPTRecord(depth=5, n_field=8)])
    cpt = CPTSounding(id="CPT1", depth=[1, 2, 4, 5, 7, 9],
                     qc=[3000, 3000, 3000, 3000, 800, 800],
                     fs=[20, 20, 20, 20, 35, 35])
    return Project(meta=ProjectMeta(name="API liquefaction"), soil_profiles=[two_layer_profile],
                   active_profile_id=two_layer_profile.id,
                   investigations=Investigations(boreholes=[borehole], cpts=[cpt]))


def test_liquefaction_requires_project_and_profile(shell, liquefaction_project):
    response = shell.post(PATH, json=SETTINGS)
    assert response.status_code == 409 and response.json()["code"] == "no_project_open"
    shell.app.state.session.open_project(Project(meta=ProjectMeta(name="Empty")))
    response = shell.post(PATH, json=SETTINGS)
    assert response.status_code == 409 and response.json()["code"] == "no_soil_source"
    for project in (None, liquefaction_project):
        if project is not None:
            shell.app.state.session.open_project(project)
        response = shell.post(PATH, json={**SETTINGS, "profile_id": "unknown"})
        assert response.status_code == 404 and response.json()["code"] == "not_found"


@pytest.mark.parametrize("patch", [
    {"method": "unknown"}, {"amax_g": -1}, {"amax_g": 2.1}, {"mw": 3.9},
    {"mw": 10}, {"target_fs": 0.9}, {"gwt_seismic": -1}, {"default_fc": 101},
    {"ic_cutoff": 0}, {"c_fc": "NaN"}, {"target_fs": None}, {"extra": 1},
])
def test_liquefaction_invalid_settings(shell, liquefaction_project, patch):
    shell.app.state.session.open_project(liquefaction_project)
    response = shell.post(PATH, json={**SETTINGS, **patch})
    assert response.status_code == 422 and response.json()["code"] == "validation"
    assert not shell.app.state.session.dirty


@pytest.mark.parametrize("method", ["bi2014", "youd2001"])
def test_liquefaction_matches_existing_service_and_finite_json(shell, liquefaction_project, method):
    project = liquefaction_project
    settings = {**SETTINGS, "method": method}
    reference = module1.run_liquefaction(project, module1.LiquefactionSettings(**settings))
    assert not reference.errors
    session = shell.app.state.session
    session.open_project(project)
    state = poll_job(shell, submit(shell, PATH, json=settings))
    assert state["status"] == "done", state
    result = state["result"]
    assert result["errors"] == {} and set(result["per_sounding"]) == {"BH1", "CPT1"}
    for id, raw in reference.liquefaction.items():
        sounding = result["per_sounding"][id]
        assert sounding["depth"] == raw.depth.tolist()
        assert sounding["status"] == raw.status.tolist()
        assert len(sounding["depth"]) == len(sounding["CSR"]) == len(sounding["CRR"]) == len(sounding["FS"])
        import math
        for field, values in (("CSR", raw.csr), ("CRR", raw.crr), ("FS", raw.fs)):
            for actual, expected in zip(sounding[field], values):
                if math.isfinite(expected):
                    assert actual == pytest.approx(expected)
                else:
                    assert actual is None
    assert session.dirty
    assert project.modules["liquefaction"].data["result"] == result
    assert project.modules["liquefaction"].data["profile_id"] == "P1"


@pytest.mark.parametrize("explicit", [False, True])
def test_liquefaction_selects_requested_or_fallback_profile(shell, liquefaction_project, monkeypatch, explicit):
    project = liquefaction_project
    other = project.soil_profiles[0].model_copy(deep=True, update={"id": "P2"})
    project.soil_profiles.append(other)
    project.active_profile_id = "P2" if explicit else None
    shell.app.state.session.open_project(project)
    observed = []

    def capture(snapshot, settings, *, progress):
        assert snapshot is not project
        observed.append(snapshot.active_profile().id)
        progress(0.5, "job.step.stability_checks")
        return module1.Module1Results()

    monkeypatch.setattr(module1, "run_liquefaction", capture)
    state = poll_job(shell, submit(shell, PATH, json={**SETTINGS, "profile_id": "P1" if explicit else None}))
    assert state["status"] == "done" and observed == ["P1"]
    assert project.active_profile_id == ("P2" if explicit else None)


def test_per_sounding_failure_does_not_fail_the_whole_job(shell, liquefaction_project):
    shell.app.state.session.open_project(liquefaction_project)
    state = poll_job(shell, submit(shell, PATH, json={**SETTINGS, "default_fc": None}))
    assert state["status"] == "done", state
    result = state["result"]
    assert "BH1" in result["errors"] and "FC" in result["errors"]["BH1"]
    assert "CPT1" in result["per_sounding"] and "BH1" not in result["per_sounding"]


@pytest.mark.parametrize("change", ["profile", "investigation", "selection", "fallback", "project", "cancel"])
def test_liquefaction_snapshot_discard_and_cancel(shell, liquefaction_project, monkeypatch, change):
    project = liquefaction_project
    if change == "fallback":
        project.active_profile_id = None
    session = shell.app.state.session
    session.open_project(project)
    entered, release = threading.Event(), threading.Event()

    def blocked(snapshot, settings, *, progress):
        progress(0.2, "job.step.stability_checks")
        entered.set()
        assert release.wait(10)
        assert snapshot.soil_profiles[0].layers[0].gamma == 18
        assert snapshot.investigations.boreholes[0].spt[0].n_field == 6
        progress(0.8, "job.step.stability_checks")
        return module1.Module1Results()

    monkeypatch.setattr(module1, "run_liquefaction", blocked)
    try:
        id = submit(shell, PATH, json=SETTINGS)
        assert entered.wait(10)
        with session.lock:
            if change == "profile":
                project.soil_profiles[0].layers[0].gamma = 19
            elif change == "investigation":
                project.investigations.boreholes[0].spt[0].n_field = 7
            elif change == "selection":
                project.soil_profiles.append(project.soil_profiles[0].model_copy(deep=True, update={"id": "P2"}))
                project.active_profile_id = "P2"
            elif change == "fallback":
                project.soil_profiles.insert(0, project.soil_profiles[0].model_copy(deep=True, update={"id": "P2"}))
            elif change == "project":
                session.open_project(project.model_copy(deep=True))
        if change == "cancel":
            assert shell.delete(f"/api/jobs/{id}").status_code == 200
        release.set()
        state = poll_job(shell, id)
        assert state["result"] is None
        if change == "cancel":
            assert state["status"] == "cancelled" and state["error"] is None
        else:
            assert state["status"] == "failed" and state["error"]["code"] == "stale_structure"
        assert "liquefaction" not in project.modules and not session.dirty
    finally:
        release.set()


def test_explicit_profile_ignores_unrelated_active_selection_change(shell, liquefaction_project, monkeypatch):
    project = liquefaction_project
    session = shell.app.state.session
    session.open_project(project)
    entered, release = threading.Event(), threading.Event()

    def blocked(snapshot, settings, *, progress):
        entered.set()
        assert release.wait(10)
        assert snapshot.active_profile().id == "P1"
        return module1.Module1Results()

    monkeypatch.setattr(module1, "run_liquefaction", blocked)
    try:
        id = submit(shell, PATH, json={**SETTINGS, "profile_id": "P1"})
        assert entered.wait(10)
        with session.lock:
            project.soil_profiles.append(project.soil_profiles[0].model_copy(deep=True, update={"id": "P2"}))
            project.active_profile_id = "P2"
        release.set()
        assert poll_job(shell, id)["status"] == "done"
        assert project.modules["liquefaction"].data["profile_id"] == "P1"
        assert project.active_profile_id == "P2"
    finally:
        release.set()


def test_liquefaction_service_progress_propagates_cancellation(shell, liquefaction_project, monkeypatch):
    project = liquefaction_project
    session = shell.app.state.session
    session.open_project(project)
    original = module1.process_investigations
    entered, release = threading.Event(), threading.Event()

    def blocked(snapshot):
        processed = original(snapshot)
        entered.set()
        assert release.wait(10)
        return processed

    monkeypatch.setattr(module1, "process_investigations", blocked)
    try:
        id = submit(shell, PATH, json=SETTINGS)
        assert entered.wait(10)
        assert shell.delete(f"/api/jobs/{id}").status_code == 200
        release.set()
        state = poll_job(shell, id)
        assert state["status"] == "cancelled" and state["error"] is None
        assert not session.dirty and "liquefaction" not in project.modules
    finally:
        release.set()
