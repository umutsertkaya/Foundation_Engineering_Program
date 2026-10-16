"""Soil routes, mounted at /api/m/soil; all bodies are 501 stubs."""

from __future__ import annotations

from typing import NoReturn

from fastapi import APIRouter, Request

from geotek.api import schemas as dto
from geotek.api.common import ERROR_RESPONSES, multipart_body, not_implemented
from geotek.core.models.investigations import Borehole, BoreholeLayer, CPTSounding
from geotek.core.models.parameters import DesignKey, ParameterSelection
from geotek.core.models.profile import LayeringSettings, SoilLayer, SoilProfile
from geotek.modules.soil.schemas import (
    CPTProcessedDTO,
    InvestigationsDTO,
    LayerMerge,
    LayerSplit,
    ParameterApproval,
    ProfileCreate,
    ProfileSummary,
    SelectionUpdate,
    SPTProcessedDTO,
)

def router() -> APIRouter:
    """Build a fresh router; the registry adds the prefix and module tag."""
    api = APIRouter(responses=ERROR_RESPONSES)

    @api.get(
        "/investigations", response_model=InvestigationsDTO, operation_id="list_investigations",
    )
    def list_investigations() -> NoReturn:
        """List raw borehole and CPT records."""
        not_implemented()

    @api.post(
        "/import/cpt", response_model=CPTSounding, operation_id="import_cpt",
        openapi_extra=multipart_body("sounding_id", cpt=True),
    )
    def import_cpt(request: Request) -> NoReturn:
        """Import multipart file, sounding_id, qc_unit, delimiter and decimal form parts.

        qc_unit applies to the file's cone resistance; stored sounding stresses are kPa.
        The stub deliberately does not parse uploads or require python-multipart.
        """
        not_implemented()

    @api.post(
        "/import/spt", response_model=Borehole, operation_id="import_spt",
        openapi_extra=multipart_body("borehole_id"),
    )
    def import_spt(request: Request) -> NoReturn:
        """Import multipart file and borehole_id form parts."""
        not_implemented()

    @api.put("/boreholes/{id}", response_model=Borehole, operation_id="update_borehole")
    def update_borehole(id: str, payload: Borehole) -> NoReturn:
        """Replace a borehole; the body id must identify the path resource."""
        not_implemented()

    @api.delete(
        "/boreholes/{id}", response_model=dto.DeletionResponse, operation_id="delete_borehole",
    )
    def delete_borehole(id: str) -> NoReturn:
        """Delete a borehole and return a JSON acknowledgement."""
        not_implemented()

    @api.put(
        "/boreholes/{id}/log", response_model=Borehole, operation_id="set_borehole_log",
    )
    def set_borehole_log(id: str, payload: list[BoreholeLayer]) -> NoReturn:
        """Replace the complete borehole log using a JSON array."""
        not_implemented()

    @api.put("/cpts/{id}", response_model=CPTSounding, operation_id="update_cpt")
    def update_cpt(id: str, payload: CPTSounding) -> NoReturn:
        """Replace a CPT sounding; the body id must identify the path resource."""
        not_implemented()

    @api.delete("/cpts/{id}", response_model=dto.DeletionResponse, operation_id="delete_cpt")
    def delete_cpt(id: str) -> NoReturn:
        """Delete a CPT sounding and return a JSON acknowledgement."""
        not_implemented()

    @api.get(
        "/cpts/{id}/processed", response_model=CPTProcessedDTO, operation_id="get_processed_cpt",
    )
    def get_processed_cpt(id: str) -> NoReturn:
        """Return processed CPT chart data with null samples for non-finite values."""
        not_implemented()

    @api.get(
        "/boreholes/{id}/processed", response_model=SPTProcessedDTO,
        operation_id="get_processed_spt",
    )
    def get_processed_spt(id: str) -> NoReturn:
        """Return corrected SPT chart data."""
        not_implemented()

    @api.post(
        "/layering/cpt/{cpt_id}", response_model=dto.LayeringProposal,
        operation_id="propose_cpt_layers",
    )
    def propose_cpt_layers(cpt_id: str, payload: LayeringSettings) -> NoReturn:
        """Return a synchronous, unapproved CPT layering proposal."""
        not_implemented()

    @api.post(
        "/layering/spt/{borehole_id}", response_model=dto.LayeringProposal,
        operation_id="propose_spt_layers",
    )
    def propose_spt_layers(borehole_id: str, payload: LayeringSettings) -> NoReturn:
        """Return a synchronous, unapproved SPT layering proposal."""
        not_implemented()

    @api.get("/profiles", response_model=list[ProfileSummary], operation_id="list_profiles")
    def list_profiles() -> NoReturn:
        """List profiles available for selection or copying into structures."""
        not_implemented()

    @api.post("/profiles", response_model=SoilProfile, operation_id="create_profile")
    def create_profile(payload: ProfileCreate) -> NoReturn:
        """Create from explicit layers or a proposal; assign profile and layer ids server-side."""
        not_implemented()

    @api.get("/profiles/{id}", response_model=SoilProfile, operation_id="get_profile")
    def get_profile(id: str) -> NoReturn:
        """Return a complete project soil profile."""
        not_implemented()

    @api.put("/profiles/{id}", response_model=SoilProfile, operation_id="update_profile")
    def update_profile(id: str, payload: SoilProfile) -> NoReturn:
        """Replace a profile; the body id must identify the path resource."""
        not_implemented()

    @api.delete(
        "/profiles/{id}", response_model=dto.DeletionResponse, operation_id="delete_profile",
    )
    def delete_profile(id: str) -> NoReturn:
        """Delete a project profile and return a JSON acknowledgement."""
        not_implemented()

    @api.post(
        "/profiles/{id}/layers/{layer_id}/split", response_model=SoilProfile,
        operation_id="split_layer",
    )
    def split_layer(id: str, layer_id: str, payload: LayerSplit) -> NoReturn:
        """Split the selected layer at an absolute depth below ground."""
        not_implemented()

    @api.post(
        "/profiles/{id}/layers/merge", response_model=SoilProfile, operation_id="merge_layers",
    )
    def merge_layers(id: str, payload: LayerMerge) -> NoReturn:
        """Merge two adjacent layers in the selected profile."""
        not_implemented()

    @api.get(
        "/profiles/{id}/layers/{layer_id}/parameters", response_model=list[ParameterSelection],
        operation_id="list_layer_parameters",
    )
    def list_layer_parameters(id: str, layer_id: str) -> NoReturn:
        """Return parameter selections and candidates evaluated on the server."""
        not_implemented()

    @api.put(
        "/profiles/{id}/layers/{layer_id}/parameters/{key}", response_model=ParameterSelection,
        operation_id="update_parameter_selection",
    )
    def update_parameter_selection(
        id: str, layer_id: str, key: DesignKey, payload: SelectionUpdate,
    ) -> NoReturn:
        """Choose a method, statistic or manual value without approving it."""
        not_implemented()

    @api.post(
        "/profiles/{id}/layers/{layer_id}/parameters/approve", response_model=SoilLayer,
        operation_id="approve_parameters",
    )
    def approve_parameters(id: str, layer_id: str, payload: ParameterApproval) -> NoReturn:
        """Approve only the explicitly listed design quantities."""
        not_implemented()

    @api.post(
        "/profiles/{id}/parameters/suggest-all", response_model=SoilProfile,
        operation_id="suggest_all_parameters",
    )
    def suggest_all_parameters(id: str) -> NoReturn:
        """Fill parameter suggestions throughout a profile; approve nothing."""
        not_implemented()

    return api
