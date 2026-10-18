"""Bounded, application-local jobs with cooperative cancellation and retention.

Successful jobs use the contract's ``done`` status. Completion callbacks run once,
before publication, and must check their snapshot under the session lock. Callers
must release that lock before submitting a job (lock order: runner, then session).
"""

from __future__ import annotations

import math
import threading
import time
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass
from typing import Annotated, NoReturn
from uuid import uuid4

from fastapi import Depends, HTTPException, Request
from pydantic import ValidationError

from geotek.api import schemas as dto
from geotek.api.session import api_error
from geotek.core.errors import Cancelled, GeoTekError, MissingFactorsError

Progress = Callable[[float, str], None]
JobResult = (dto.WallResultDTO | dto.SheetPileResultDTO | dto.LiquefactionResultDTO
             | dto.LayeringProposal)


def error_from_exception(exc: Exception) -> dto.ApiError:
    """Translate service failures without losing missing-factor provenance."""
    if isinstance(exc, HTTPException) and isinstance(exc.detail, dict) and "code" in exc.detail:
        try:
            return dto.ApiError.model_validate(exc.detail)
        except ValidationError:
            return dto.ApiError(code="engine_error", message="Invalid calculation error payload.")
    if isinstance(exc, MissingFactorsError):
        return dto.ApiError(code="missing_factors", message=str(exc), missing_factors=[
            dto.MissingFactorDTO.model_validate(item) for item in exc.missing
        ])
    if isinstance(exc, KeyError):
        return dto.ApiError(code="not_found", message=str(exc))
    if isinstance(exc, (ValidationError, ValueError)):
        return dto.ApiError(code="validation", message=str(exc))
    if isinstance(exc, GeoTekError):
        return dto.ApiError(code="engine_error", message=str(exc))
    return dto.ApiError(code="engine_error", message="An internal calculation error occurred.")


def raise_service_error(exc: Exception) -> NoReturn:
    """Map synchronous preflight errors to the documented HTTP envelopes."""
    if isinstance(exc, HTTPException):
        raise exc
    error = error_from_exception(exc)
    status = {"not_found": 404, "validation": 422, "missing_factors": 422}.get(
        error.code, 400 if isinstance(exc, GeoTekError) else 500)
    raise HTTPException(status_code=status, detail=error.model_dump(mode="json")) from exc


@dataclass
class _Job:
    state: dto.JobState
    cancelled: bool = False
    future: Future | None = None
    finished_at: float | None = None


class JobRunner:
    """Run at most two analyses concurrently; retain only bounded finished history."""

    def __init__(self, *, max_workers: int = 2, retention_seconds: float = 3600,
                 max_finished: int = 256) -> None:
        if max_workers < 1 or retention_seconds < 0 or max_finished < 0:
            raise ValueError("Invalid job runner limits")
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="geotek-job")
        self._lock = threading.RLock()
        self._jobs: dict[str, _Job] = {}
        self._retention_seconds = retention_seconds
        self._max_finished = max_finished
        self._closed = False

    def cleanup(self) -> None:
        """Expire finished jobs by age and count; never evict active work."""
        with self._lock:
            now = time.monotonic()
            finished = sorted(
                ((job.finished_at, id) for id, job in self._jobs.items()
                 if job.finished_at is not None),
            )
            excess = max(0, len(finished) - self._max_finished)
            for index, (ended, id) in enumerate(finished):
                if index < excess or now - ended >= self._retention_seconds:
                    del self._jobs[id]

    def submit(self, kind: dto.JobKind, work: Callable[[Progress], JobResult], *,
               complete: Callable[[JobResult], None] | None = None) -> dto.JobRef:
        """Submit snapshot-only work and an optional guarded result writeback."""
        with self._lock:
            self.cleanup()
            if self._closed:
                api_error(409, "engine_error", "Job runner is shutting down.")
            id = str(uuid4())
            job = _Job(dto.JobState(job_id=id, kind=kind, status="queued", progress=0,
                                    message_key="job.step.queued", result=None, error=None))
            self._jobs[id] = job
            job.future = self._executor.submit(self._run, job, work, complete)
            return dto.JobRef(job_id=id)

    def _run(self, job: _Job, work: Callable[[Progress], JobResult],
             complete: Callable[[JobResult], None] | None) -> None:
        def progress(fraction: float, key: str) -> None:
            with self._lock:
                if job.cancelled:
                    raise Cancelled()
                if not math.isfinite(fraction):
                    raise ValueError("Job progress must be finite")
                job.state.progress = max(job.state.progress, min(1.0, max(0.0, fraction)))
                job.state.message_key = key

        try:
            with self._lock:
                if job.cancelled:
                    raise Cancelled()
                job.state.status = "running"
            result = work(progress)
            with self._lock:
                # Cancellation and writeback are serialized, including when a service
                # returns without a final progress callback.
                if job.cancelled:
                    raise Cancelled()
                result = dto.JobState.model_validate({**job.state.model_dump(), "result": result}).result
                if result is None:
                    raise ValueError("A successful calculation must return a result")
                if complete is not None:
                    complete(result)
                job.state.result = result.model_copy(deep=True)
                job.state.status = "done"
                job.state.progress = 1.0
                job.state.message_key = "job.step.done"
        except Cancelled:
            with self._lock:
                job.state.status = "cancelled"
                job.state.result = None
                job.state.error = None
                job.state.message_key = None
        except Exception as exc:
            with self._lock:
                job.state.status = "cancelled" if job.cancelled else "failed"
                job.state.result = None
                job.state.error = None if job.cancelled else error_from_exception(exc)
                job.state.message_key = None
        finally:
            with self._lock:
                job.finished_at = time.monotonic()
                self.cleanup()

    def _get(self, id: str) -> _Job:
        self.cleanup()
        if id not in self._jobs:
            api_error(404, "not_found", f"Job not found: {id}", job_id=id)
        return self._jobs[id]

    def get(self, id: str) -> dto.JobState:
        """Return a detached state safe for response serialization."""
        with self._lock:
            return self._get(id).state.model_copy(deep=True)

    def cancel(self, id: str) -> dto.JobState:
        """Request cooperative cancellation; terminal states remain immutable."""
        with self._lock:
            job = self._get(id)
            if job.state.status in {"queued", "running"}:
                job.cancelled = True
                if job.future is not None and job.future.cancel():
                    job.state.status = "cancelled"
                    job.state.message_key = None
                    job.finished_at = time.monotonic()
            return job.state.model_copy(deep=True)

    def shutdown(self) -> None:
        """Cancel outstanding work and join workers at application shutdown."""
        with self._lock:
            self._closed = True
            for id in list(self._jobs):
                # Avoid cleanup during this iteration; expired jobs need no action.
                job = self._jobs[id]
                if job.state.status in {"queued", "running"}:
                    job.cancelled = True
        self._executor.shutdown(wait=True)


def get_runner(request: Request) -> JobRunner:
    """Resolve the application-local runner, independently of the open project."""
    return request.app.state.jobs


RunnerDep = Annotated[JobRunner, Depends(get_runner)]
