"""Anchored wall routes, mounted at /api/m/anchored_wall."""

from __future__ import annotations

from fastapi import APIRouter

from geotek.api.calculation_jobs import SessionDep
from geotek.api.common import ERROR_RESPONSES
from geotek.api.jobs import raise_service_error
from geotek.api.session import api_error
from geotek.core.errors import GeoTekError
from geotek.core.models.anchors import (
    ANCHOR_STATE_VERSION,
    AnchorDesignInputs,
    AnchorDesignResult,
    AnchoredWallState,
    AnchorRecord,
)
from geotek.core.module_state import get_state, set_state
from geotek.engine import anchor_tables as tables
from geotek.engine.anchors import MissingAnchorInputsError, design_anchor, inputs_hash
from geotek.modules.anchored_wall.schemas import (
    AnchorDefaults,
    AnchorReference,
    SafetyFactorGuidance,
    StateResponse,
    TendonInfo,
    TransferLoadInfo,
)

MODULE_ID = "anchored_wall"


def _stale(state: AnchoredWallState) -> bool:
    record = state.anchor
    if record is None or record.result is None:
        return False
    return record.result_hash != inputs_hash(record.inputs)


def _run(inputs: AnchorDesignInputs) -> AnchorDesignResult:
    try:
        return design_anchor(inputs)
    except MissingAnchorInputsError as exc:
        api_error(422, "missing_inputs", str(exc), missing=exc.missing)
    except GeoTekError as exc:
        api_error(422, "validation", str(exc))


def router() -> APIRouter:
    """Build a fresh router; the registry adds the prefix and module tag."""
    api = APIRouter(responses=ERROR_RESPONSES)

    @api.get("/state", response_model=StateResponse, operation_id="anchored_wall_get_state")
    def get_module_state(session: SessionDep) -> StateResponse:
        """Return the module state stored in the open project (defaults when absent)."""
        with session.lock:
            project = session.require_project()
            try:
                state = get_state(project, MODULE_ID, AnchoredWallState, ANCHOR_STATE_VERSION)
            except Exception as exc:
                raise_service_error(exc)
            return StateResponse(state=state, anchor_result_stale=_stale(state))

    @api.put("/state", response_model=StateResponse, operation_id="anchored_wall_put_state")
    def put_module_state(body: AnchoredWallState, session: SessionDep) -> StateResponse:
        """Replace the module state; a stored result must match its inputs."""
        if _stale(body):
            api_error(422, "validation", "Stored anchor result does not match its inputs.")
        with session.lock:
            project = session.require_project()
            set_state(project, MODULE_ID, body, ANCHOR_STATE_VERSION)
            session.mark_dirty()
            return StateResponse(state=body, anchor_result_stale=False)

    @api.post("/anchor/design", response_model=AnchorDesignResult,
              operation_id="anchored_wall_design_anchor")
    def design_ground_anchor(
        body: AnchorDesignInputs, session: SessionDep, save: bool = False,
    ) -> AnchorDesignResult:
        """Design one ground anchor; with ``save`` store inputs and result in the open project."""
        result = _run(body)
        if save:
            with session.lock:
                project = session.require_project()
                try:
                    state = get_state(project, MODULE_ID, AnchoredWallState, ANCHOR_STATE_VERSION)
                except Exception as exc:
                    raise_service_error(exc)
                state.anchor = AnchorRecord(inputs=body, result=result, result_hash=inputs_hash(body))
                set_state(project, MODULE_ID, state, ANCHOR_STATE_VERSION)
                session.mark_dirty()
        return result

    @api.get("/anchor/reference", response_model=AnchorReference,
             operation_id="anchored_wall_anchor_reference")
    def anchor_reference() -> AnchorReference:
        """Source-labelled tendon and presumptive load-transfer tables and engine defaults."""
        return AnchorReference(
            tendons=[TendonInfo(id=t.id, type=t.type, label=t.label, smts_kn=t.smts_kn,
                                area_mm2=t.area_mm2, source=t.source) for t in tables.TENDONS],
            transfer_loads=[TransferLoadInfo(
                id=t.id, ground=t.ground, condition=t.condition,
                q_u_kn_per_m=t.q_u_kn_per_m, source=t.source) for t in tables.TRANSFER_LOADS],
            safety_factor_guidance=[SafetyFactorGuidance(ground=g, value=v, source=s)
                                    for g, v, s in tables.SAFETY_FACTOR_GUIDANCE],
            defaults=AnchorDefaults(
                min_free_length_strand=tables.MIN_FREE_LENGTH["strand"],
                min_free_length_bar=tables.MIN_FREE_LENGTH["bar"],
                min_free_length_source=tables.MIN_FREE_LENGTH_SOURCE,
                test_factor=1.33, design_limit=0.60, lock_off_limit=0.70, test_limit=0.80,
                min_overburden=4.5, beyond_wedge_rule="max(1.5 m, 0.2 H)",
                source=f"{tables.GEC4} sections 5.3.2-5.3.8"),
        )

    return api
