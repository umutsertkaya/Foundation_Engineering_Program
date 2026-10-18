"""Submit structure calculations on detached inputs and guard their writeback."""

from __future__ import annotations

from typing import Annotated, NoReturn

from fastapi import Depends

from geotek.api import schemas as dto
from geotek.api.calculation_results import sheet_pile_result, wall_result
from geotek.api.jobs import JobRunner, raise_service_error
from geotek.api.session import Session, api_error, get_session
from geotek.core.errors import MissingFactorsError
from geotek.services import structures as service

SessionDep = Annotated[Session, Depends(get_session)]


def require_structure(project, id: str, kind: str):
    """A structure of another module's kind is not a resource in this module."""
    try:
        structure = project.structure(id)
    except KeyError:
        api_error(404, "not_found", f"Structure not found: {id}")
    if structure.kind != kind:
        api_error(404, "not_found", f"Structure not found in {kind}: {id}")
    return structure


def _source_hash(project, structure):
    source = next((p for p in project.soil_profiles
                   if p.id == structure.soil.source_profile_id), None)
    return source.content_hash() if source is not None else None


def discard_stale() -> NoReturn:
    """There is no stale job status in the contract: fail with no published result."""
    api_error(409, "stale_structure", "Project or calculation inputs changed; result discarded.",
              discarded=True)


def submit_structure(session: Session, runner: JobRunner, id: str,
                     kind: dto.JobKind) -> dto.JobRef:
    """Perform preflight and copy inputs under the session lock, then queue work."""
    resource_kind = "sheet_pile" if kind == "sheet_pile" else "retaining_wall"
    with session.lock:
        project = session.require_project()
        structure = require_structure(project, id, resource_kind)
        try:
            missing = service.required_factors(project, id)
            if missing:
                raise MissingFactorsError(missing)
            if kind == "wall_check" and structure.geometry is None:
                api_error(422, "validation", "Wall checking requires geometry; size the wall first.")
            before = service.calculation_fingerprint(project, structure)
            source_before = _source_hash(project, structure)
            snapshot = project.model_copy(deep=True)
        except Exception as exc:
            raise_service_error(exc)

    def work(progress):
        if kind == "sheet_pile":
            return sheet_pile_result(id, service.design_sheet_pile_structure(snapshot, id, progress))
        calculate = service.size_structure if kind == "wall_size" else service.check_structure
        result = calculate(snapshot, id, progress)
        target = snapshot.structure(id)
        if kind == "wall_size":
            target.geometry = result.geometry
            target.embedment = result.geometry.embedment
        return wall_result(id, result, service.calculation_fingerprint(snapshot, target))

    def complete(result):
        with session.lock:
            if session.project is not project:
                discard_stale()
            try:
                target = project.structure(id)
            except KeyError:
                discard_stale()
            if (service.calculation_fingerprint(project, target) != before
                    or _source_hash(project, target) != source_before):
                discard_stale()
            payload = result.model_dump(mode="json")
            fingerprint = result.result_hash if kind != "sheet_pile" else before
            if kind == "wall_size":
                target.geometry = result.geometry.model_copy(deep=True)
                target.embedment = result.geometry.embedment
            target.result_hash = fingerprint
            target.result = payload
            session.dirty = True

    # Do not acquire the runner lock while holding the session lock.
    return runner.submit(kind, work, complete=complete)
