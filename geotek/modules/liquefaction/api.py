"""Liquefaction jobs using the selected project profile and existing Module 1 service."""

from __future__ import annotations

from fastapi import APIRouter

from geotek.api import schemas as dto
from geotek.api.common import ERROR_RESPONSES
from geotek.api.calculation_jobs import SessionDep, discard_stale
from geotek.api.calculation_results import liquefaction_result
from geotek.api.jobs import RunnerDep
from geotek.api.session import api_error
from geotek.core.models.project import ModuleSection
from geotek.modules.liquefaction.schemas import LiquefactionSettingsDTO
from geotek.services import module1


def _inputs(project, profile_id, use_active):
    """Hash the service's mutable project inputs; non-finite numbers are a validation error."""
    try:
        return module1.liquefaction_input_hash(project, profile_id, use_active)
    except ValueError:
        api_error(422, "validation", "Liquefaction inputs must contain finite numbers.")


def router() -> APIRouter:
    """Build a fresh router; the registry adds the prefix and module tag."""
    api = APIRouter(responses=ERROR_RESPONSES)

    @api.post("/run", response_model=dto.JobRef, status_code=202, operation_id="run_liquefaction")
    def run_liquefaction(payload: LiquefactionSettingsDTO, session: SessionDep,
                        runner: RunnerDep) -> dto.JobRef:
        """Queue liquefaction for the project investigations; poll for LiquefactionResultDTO.

        If ``profile_id`` is null the project's active profile is used; with no active profile
        the server answers 409 ``no_soil_source``. An unknown ``profile_id`` answers 404
        ``not_found``.
        """
        with runner.submission():
            with session.lock:
                project = session.require_project()
                try:
                    profile = (project.profile(payload.profile_id) if payload.profile_id is not None
                               else project.active_profile())
                except KeyError:
                    api_error(404, "not_found", f"Profile not found: {payload.profile_id}")
                if profile is None:
                    api_error(409, "no_soil_source", "Select a soil profile for liquefaction.")
                # Use the engine's established scalar limits before submitting work. The
                # DTO already enforces finite numbers; no coefficients are selected here.
                if not (0 < payload.amax_g <= 2 and 4 <= payload.mw <= 9.5
                        and payload.target_fs >= 1):
                    api_error(422, "validation", "Invalid acceleration, magnitude or target FS.")
                if ((payload.gwt_seismic is not None and payload.gwt_seismic < 0)
                        or (payload.default_fc is not None and not 0 <= payload.default_fc <= 100)
                        or payload.ic_cutoff <= 0):
                    api_error(422, "validation", "Invalid groundwater, fines content or Ic cutoff.")
                profile_id = profile.id
                use_active = payload.profile_id is None
                before = _inputs(project, profile_id, use_active)
                snapshot = project.model_copy(deep=True)
                snapshot.active_profile_id = profile_id
                settings_data = payload.model_dump(exclude={"profile_id"})
                settings = module1.LiquefactionSettings(**settings_data)

            def work(progress):
                return liquefaction_result(module1.run_liquefaction(snapshot, settings, progress=progress))

            def complete(result):
                with session.lock:
                    if session.project is not project:
                        discard_stale()
                    try:
                        unchanged = _inputs(project, profile_id, use_active) == before
                    except KeyError:
                        unchanged = False
                    if not unchanged:
                        discard_stale()
                    section = project.modules.setdefault("liquefaction", ModuleSection())
                    section.data.update(profile_id=profile_id, settings=settings_data,
                                        input_hash=before, result=result.model_dump(mode="json"))
                    session.dirty = True

            return runner.submit("liquefaction", work, complete=complete)

    return api
