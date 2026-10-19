"""Background lifecycle, worker bounds, cancellation, errors and finished retention."""

import threading

import pytest
from fastapi import HTTPException

from geotek.api.jobs import MAX_ACTIVE_JOBS, JobRunner
from geotek.api.schemas import LiquefactionResultDTO
from geotek.core.errors import GeoTekError, MissingFactorsError
from geotek.services.walls_advanced import MissingFactor

from .job_helpers import poll_job, wall_project


def empty_result():
    return LiquefactionResultDTO(per_sounding={}, errors={})


@pytest.mark.parametrize("method", ["get", "delete"])
def test_unknown_jobs_do_not_require_an_open_project(shell, method):
    response = getattr(shell, method)("/api/jobs/unknown")
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


def test_lifecycle_monotonic_progress_queue_and_bounded_workers(shell):
    shell.app.state.jobs.shutdown()
    runner = shell.app.state.jobs = JobRunner(max_workers=1)
    entered, advance, advanced, release = (threading.Event() for _ in range(4))

    def work(progress):
        progress(0.25, "job.step.earth_pressure")
        entered.set()
        assert advance.wait(10)
        progress(0.1, "job.step.earth_pressure")  # A callback cannot decrease progress.
        progress(0.75, "job.step.stability_checks")
        advanced.set()
        assert release.wait(10)
        return empty_result()

    try:
        first = runner.submit("liquefaction", work).job_id
        assert entered.wait(10)
        running = shell.get(f"/api/jobs/{first}").json()
        assert running["status"] == "running" and running["progress"] == 0.25
        assert running["result"] is running["error"] is None
        second = runner.submit("liquefaction", lambda progress: empty_result()).job_id
        assert shell.get(f"/api/jobs/{second}").json()["status"] == "queued"
        detached = runner.get(first)
        detached.progress = 0.99
        assert runner.get(first).progress == 0.25
        advance.set()
        assert advanced.wait(10)
        assert shell.get(f"/api/jobs/{first}").json()["progress"] == 0.75
        release.set()
        for id in (first, second):
            done = poll_job(shell, id)
            assert done["status"] == "done" and done["progress"] == 1
            assert done["result"] == {"per_sounding": {}, "errors": {}}
            assert done["error"] is None and done["message_key"] == "job.step.done"
            assert shell.delete(f"/api/jobs/{id}").json() == done
    finally:
        advance.set()
        release.set()


@pytest.mark.parametrize("checkpoint", [True, False])
def test_cancel_running_and_queued_jobs_without_writeback(shell, checkpoint):
    shell.app.state.jobs.shutdown()
    runner = shell.app.state.jobs = JobRunner(max_workers=1)
    entered, release = threading.Event(), threading.Event()
    writes, queued_calls = [], []

    def work(progress):
        progress(0.3, "job.step.earth_pressure")
        entered.set()
        assert release.wait(10)
        if checkpoint:
            progress(0.9, "job.step.stability_checks")
        return empty_result()

    try:
        running = runner.submit("liquefaction", work, complete=writes.append).job_id
        assert entered.wait(10)
        queued = runner.submit("liquefaction", lambda progress: queued_calls.append(True)).job_id
        assert shell.delete(f"/api/jobs/{queued}").json()["status"] == "cancelled"
        response = shell.delete(f"/api/jobs/{running}")
        assert response.status_code == 200 and response.json()["progress"] == 0.3
        release.set()
        cancelled = poll_job(shell, running)
        assert cancelled["status"] == "cancelled" and cancelled["progress"] == 0.3
        assert cancelled["result"] is cancelled["error"] is None
        assert poll_job(shell, queued)["status"] == "cancelled"
        assert writes == queued_calls == []
        assert shell.delete(f"/api/jobs/{running}").json() == cancelled
    finally:
        release.set()


@pytest.mark.parametrize("exc,code", [
    (GeoTekError("Engine refused the supplied inputs"), "engine_error"),
    (ValueError("Invalid inputs"), "validation"),
    (KeyError("missing"), "not_found"),
    (RuntimeError("private diagnostic"), "engine_error"),
    (MissingFactorsError([MissingFactor(path="test.factor", status="not_in_source", source="test")]),
     "missing_factors"),
])
def test_failed_job_carries_api_error(shell, exc, code):
    def work(progress):
        progress(0.4, "job.step.earth_pressure")
        raise exc

    id = shell.app.state.jobs.submit("liquefaction", work).job_id
    failed = poll_job(shell, id)
    assert failed["status"] == "failed" and failed["progress"] == 0.4
    assert failed["result"] is None and failed["error"]["code"] == code
    assert set(failed["error"]) == {"code", "message", "details", "missing_factors"}
    if code == "missing_factors":
        assert failed["error"]["missing_factors"][0]["path"] == "test.factor"
    if isinstance(exc, RuntimeError):
        assert "private diagnostic" not in failed["error"]["message"]


def test_retention_limits_and_expiration(shell, monkeypatch):
    shell.app.state.jobs.shutdown()
    runner = shell.app.state.jobs = JobRunner(max_workers=1, max_finished=1, retention_seconds=60)
    first = runner.submit("liquefaction", lambda progress: empty_result()).job_id
    assert poll_job(shell, first)["status"] == "done"
    second = runner.submit("liquefaction", lambda progress: empty_result()).job_id
    assert poll_job(shell, second)["status"] == "done"
    # Joining also ensures finished timestamps have been recorded before cleanup.
    runner.shutdown()
    runner.cleanup()
    assert shell.get(f"/api/jobs/{first}").status_code == 404
    assert shell.get(f"/api/jobs/{second}").status_code == 200
    from geotek.api import jobs
    now = jobs.time.monotonic()
    monkeypatch.setattr(jobs.time, "monotonic", lambda: now + 61)
    runner.cleanup()
    with pytest.raises(HTTPException) as error:
        runner.get(second)
    assert error.value.status_code == 404


def test_job_registry_is_application_local(shell, library_dir):
    from fastapi.testclient import TestClient
    from geotek.api.app import create_app

    id = shell.app.state.jobs.submit("liquefaction", lambda progress: empty_result()).job_id
    assert poll_job(shell, id)["status"] == "done"
    with TestClient(create_app()) as other:
        assert other.get(f"/api/jobs/{id}").status_code == 404


@pytest.mark.parametrize("path,payload", [
    ("/api/m/walls/structures/wall/size", None),
    ("/api/m/walls/structures/wall/check", None),
    ("/api/m/sheet_pile/structures/sheet/design", None),
    ("/api/m/liquefaction/run", {"method": "bi2014", "amax_g": 0.4, "mw": 7.5,
                               "target_fs": 1.1, "c_fc": 0, "ic_cutoff": 2.6}),
])
def test_active_job_cap_rejects_before_snapshot(shell, monkeypatch, path, payload):
    shell.app.state.jobs.shutdown()
    runner = shell.app.state.jobs = JobRunner(max_workers=1)
    project = wall_project(geometry=True)
    shell.app.state.session.open_project(project)
    entered, release = threading.Event(), threading.Event()

    def blocked(progress):
        entered.set()
        assert release.wait(10)
        return empty_result()

    def unexpected_copy(*args, **kwargs):
        pytest.fail("A full runner must reject before copying the project")

    try:
        runner.submit("liquefaction", blocked)
        assert entered.wait(10)
        for _ in range(MAX_ACTIVE_JOBS - 1):
            runner.submit("liquefaction", blocked)
        monkeypatch.setattr(type(project), "model_copy", unexpected_copy)
        response = shell.post(path, **({"json": payload} if payload is not None else {}))
        assert response.status_code == 429
        assert response.json()["code"] == "too_many_jobs"
        assert set(response.json()) == {"code", "message", "details", "missing_factors"}
        assert len(runner._jobs) == MAX_ACTIVE_JOBS
        with pytest.raises(HTTPException) as error:
            runner.submit("liquefaction", blocked)
        assert error.value.status_code == 429
    finally:
        release.set()


@pytest.mark.parametrize("outcome", ["done", "failed", "queued_cancel", "running_cancel"])
def test_active_slot_freed_after_completion_or_cancellation(shell, outcome):
    shell.app.state.jobs.shutdown()
    runner = shell.app.state.jobs = JobRunner(max_workers=1)
    entered, first_release, release = (threading.Event() for _ in range(3))

    def first_work(progress):
        entered.set()
        assert first_release.wait(10)
        if outcome == "failed":
            raise ValueError("Invalid calculation")
        return empty_result()

    def blocked(progress):
        assert release.wait(10)
        return empty_result()

    try:
        first = runner.submit("liquefaction", first_work).job_id
        assert entered.wait(10)
        queued = [runner.submit("liquefaction", blocked).job_id
                  for _ in range(MAX_ACTIVE_JOBS - 1)]
        if outcome == "queued_cancel":
            assert shell.delete(f"/api/jobs/{queued[-1]}").json()["status"] == "cancelled"
            assert runner._jobs[queued[-1]].work is None
        else:
            if outcome == "running_cancel":
                shell.delete(f"/api/jobs/{first}")
                # Cooperative cancellation must not free a still-running slot.
                with pytest.raises(HTTPException) as error:
                    runner.submit("liquefaction", blocked)
                assert error.value.status_code == 429
            first_release.set()
            state = poll_job(shell, first)
            assert state["status"] == ("cancelled" if outcome == "running_cancel" else outcome)
            # Publication and the finally block use separate lock acquisitions.
            runner._jobs[first].future.result(timeout=10)
        replacement = runner.submit("liquefaction", blocked).job_id
        assert runner.get(replacement).status == "queued"
        with pytest.raises(HTTPException) as error:
            runner.submit("liquefaction", blocked)
        assert error.value.status_code == 429
    finally:
        first_release.set()
        release.set()


def test_failed_preflight_and_executor_submission_do_not_consume_capacity(shell, monkeypatch):
    runner = shell.app.state.jobs
    for _ in range(MAX_ACTIVE_JOBS + 1):
        with pytest.raises(ValueError):
            with runner.submission():
                raise ValueError("Snapshot preparation failed")

    def refused(*args, **kwargs):
        raise RuntimeError("Executor refused submission")

    with monkeypatch.context() as patch:
        patch.setattr(runner._executor, "submit", refused)
        for _ in range(MAX_ACTIVE_JOBS + 1):
            with pytest.raises(RuntimeError, match="Executor refused"):
                runner.submit("liquefaction", lambda progress: empty_result())
    assert not runner._jobs
    id = runner.submit("liquefaction", lambda progress: empty_result()).job_id
    assert poll_job(shell, id)["status"] == "done"
