"""Helpers shared by the core router and module routers."""

from __future__ import annotations

from typing import Any, NoReturn

from fastapi import HTTPException

from geotek.api import schemas as dto

ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    400: {"model": dto.ApiError, "description": "Invalid operation or input file"},
    404: {"model": dto.ApiError, "description": "Resource not found"},
    409: {"model": dto.ApiError, "description": "Conflicting or stale structure state"},
    422: {"model": dto.ApiError, "description": "Validation error or missing_factors"},
    500: {"model": dto.ApiError, "description": "Engine or server error"},
    501: {"model": dto.ApiError, "description": "Contract stub; not implemented"},
    "4XX": {"model": dto.ApiError, "description": "Other client error"},
    "5XX": {"model": dto.ApiError, "description": "Other server error"},
}


def not_implemented() -> NoReturn:
    """Raise the same documented error from every unimplemented workflow."""
    error = dto.ApiError(code="not_implemented", message="This operation is not implemented.")
    raise HTTPException(status_code=501, detail=error.model_dump(mode="json"))


def multipart_body(identifier: str, *, cpt: bool = False) -> dict[str, Any]:
    """Describe required multipart parts without importing python-multipart."""
    properties: dict[str, Any] = {
        "file": {"type": "string", "format": "binary", "description": "Investigation file"},
        identifier: {"type": "string", "description": "Investigation id assigned at import"},
    }
    if cpt:
        properties.update({
            "qc_unit": {"type": "string", "enum": ["MPa", "kPa"]},
            "delimiter": {"type": "string", "minLength": 1},
            "decimal": {"type": "string", "minLength": 1},
        })
    return {"requestBody": {
        "required": True,
        "content": {"multipart/form-data": {"schema": {
            "type": "object", "properties": properties, "required": list(properties),
            "additionalProperties": False,
        }}},
    }}


def workbook_body(*, with_plan: bool) -> dict[str, Any]:
    """Describe the multipart parts of a workbook import (``file`` and, for commit, ``plan``)."""
    properties: dict[str, Any] = {
        "file": {"type": "string", "format": "binary", "description": "Workbook (xlsx) or CSV"},
    }
    if with_plan:
        properties["plan"] = {"type": "string", "description": "Confirmed ImportPlan as JSON"}
    return {"requestBody": {
        "required": True,
        "content": {"multipart/form-data": {"schema": {
            "type": "object", "properties": properties, "required": list(properties),
            "additionalProperties": False,
        }}},
    }}
