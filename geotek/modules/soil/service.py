"""Soil workflow helpers using the existing domain validators and calculation engines."""

from __future__ import annotations

import math
from email import policy
from email.parser import BytesParser
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import TypeVar
from uuid import uuid4

import pandas as pd
from fastapi import Request
from pydantic import BaseModel, ValidationError

from geotek.api.session import Session, api_error
from geotek.core.constants import DEPTH_TOL
from geotek.core.errors import GeoTekError
from geotek.core.models.profile import SoilProfile
from geotek.core.models.project import Project
from geotek.io import tabular
from geotek.modules.soil.schemas import ProfileCreate

Model = TypeVar("Model", bound=BaseModel)


def find(items: list[Model], identifier: str) -> Model:
    """Look up a resource without allowing updates to create it implicitly."""
    for item in items:
        if item.id == identifier:
            return item
    api_error(404, "not_found", f"Resource not found: {identifier}")


def finite(data: object) -> None:
    """Reject non-finite input numbers also inside domain models with permissive configs."""
    if isinstance(data, float) and not math.isfinite(data):
        api_error(422, "validation", "Input numbers must be finite.")
    if isinstance(data, dict):
        for value in data.values():
            finite(value)
    elif isinstance(data, (list, tuple)):
        for value in data:
            finite(value)


def validate(model: type[Model], data: object) -> Model:
    """Translate model validation into the same safe error envelope as core routes."""
    try:
        result = model.model_validate(data)
    except ValidationError as exc:
        api_error(422, "validation", "Invalid soil data.", errors=[
            {"loc": list(item["loc"]), "msg": item["msg"], "type": item["type"]}
            for item in exc.errors()
        ])
    finite(result.model_dump())
    return result


def check_id(identifier: str, payload: BaseModel) -> None:
    """PUT requires the body and path to identify the same existing resource."""
    if payload.id != identifier:
        api_error(422, "validation", "Body id must match the path id.")
    finite(payload.model_dump())


def commit(session: Session, **changes: object) -> None:
    """Validate all project references before publishing a mutation; caller holds the lock."""
    current = session.require_project()
    candidate = current.model_copy(update=changes)
    # Round-trip nested objects so validators run even on model_copy-produced values.
    try:
        checked = Project.model_validate(candidate.model_dump())
    except ValidationError as exc:
        api_error(422, "validation", "Invalid project references or soil data.", errors=[
            {"loc": list(item["loc"]), "msg": item["msg"], "type": item["type"]}
            for item in exc.errors()
        ])
    if checked != current:
        session.project = checked
        session.mark_dirty()


def new_id() -> str:
    """Allocate a server-owned profile or layer id."""
    return uuid4().hex


def materialise(payload: ProfileCreate) -> SoilProfile:
    """Copy supplied layers or proposal intervals without computing engineering values."""
    data = payload.model_dump(exclude={"from_proposal", "layers"})
    proposal = payload.from_proposal
    if proposal is None:
        layers = [layer.model_dump() for layer in payload.layers]
    else:
        if proposal.source_id not in payload.source_ids:
            api_error(422, "validation", "Proposal source must be included in source_ids.")
        layers = []
        for interval in proposal.layers:
            if interval.gamma_suggested is None:
                api_error(422, "validation", "Proposal needs a supplied unit weight for every layer.")
            layers.append({
                **interval.model_dump(exclude={"ic_mean", "n60_mean", "gamma_suggested"}),
                "gamma": interval.gamma_suggested, "source_ids": [proposal.source_id],
            })
        data["layering"] = proposal.settings.model_dump()
    for layer in layers:
        layer["id"] = new_id()
    return validate(SoilProfile, {**data, "id": new_id(), "layers": layers})


def split(profile: SoilProfile, layer_id: str, depth: float) -> SoilProfile:
    """Keep upper id and copy all properties to the lower interval, matching the editor."""
    layer = find(profile.layers, layer_id)
    if not layer.top + DEPTH_TOL < depth < layer.bottom - DEPTH_TOL:
        api_error(422, "validation", "Split depth must lie strictly inside the layer.")
    layers = []
    for item in profile.layers:
        if item.id == layer_id:
            layers.extend([
                {**item.model_dump(), "bottom": depth},
                {**item.model_dump(), "id": new_id(), "top": depth},
            ])
        else:
            layers.append(item.model_dump())
    return validate(SoilProfile, {**profile.model_dump(), "layers": layers})


def merge(profile: SoilProfile, layer_ids: list[str]) -> SoilProfile:
    """The upper layer absorbs its neighbour and keeps its properties, as in the editor."""
    for identifier in layer_ids:
        find(profile.layers, identifier)
    indices = sorted(i for i, layer in enumerate(profile.layers) if layer.id in layer_ids)
    if len(indices) != 2 or indices[1] != indices[0] + 1:
        api_error(422, "validation", "Merge requires two distinct adjacent layers.")
    upper, lower = indices
    layers = [layer.model_dump() for layer in profile.layers]
    layers[upper]["bottom"] = layers[lower]["bottom"]
    del layers[lower]
    return validate(SoilProfile, {**profile.model_dump(), "layers": layers})


async def multipart(request: Request, identifier: str, *, cpt: bool = False) -> dict:
    """Parse the declared flat multipart form with the standard MIME parser.

    This keeps uploads usable when the optional python-multipart package is absent.
    File names are never interpreted as server paths.
    """
    content_type = request.headers.get("content-type", "")
    try:
        message = BytesParser(policy=policy.default).parsebytes(
            b"Content-Type: " + content_type.encode("ascii") + b"\r\nMIME-Version: 1.0\r\n\r\n"
            + await request.body())
    except (ValueError, UnicodeError):
        api_error(422, "validation", "Invalid multipart form.")
    if message.get_content_type() != "multipart/form-data" or not message.is_multipart():
        api_error(422, "validation", "Expected multipart/form-data with a boundary.")
    required = {"file", identifier}
    if cpt:
        required.update({"qc_unit", "delimiter", "decimal"})
    parts = {}
    for part in message.iter_parts():
        name = part.get_param("name", header="content-disposition")
        if (part.get_content_disposition() != "form-data" or name not in required
                or name in parts or part.is_multipart() or part.defects):
            api_error(422, "validation", "Unexpected or duplicate multipart part.")
        value = part.get_payload(decode=True)
        if name == "file":
            if part.get_filename() is None or not value:
                api_error(422, "validation", "A non-empty CSV file is required.")
            parts[name] = value
        else:
            if part.get_filename() is not None:
                api_error(422, "validation", "Expected a text form field.")
            try:
                parts[name] = value.decode("utf-8")
            except UnicodeError:
                api_error(422, "validation", "Form fields must use UTF-8.")
    if message.defects or set(parts) != required or not parts[identifier].strip():
        api_error(422, "validation", "Missing or invalid multipart fields.")
    if cpt and (parts["qc_unit"] not in {"MPa", "kPa"}
                or len(parts["delimiter"]) != 1 or len(parts["decimal"]) != 1
                or parts["delimiter"] in "\r\n" or parts["decimal"] in "\r\n"
                or parts["delimiter"] == parts["decimal"]):
        api_error(422, "validation", "Invalid CSV unit, delimiter or decimal separator.")
    return parts


def import_csv(parts: dict, *, cpt: bool):
    """Reuse the path-based CSV readers; temporary files remain inside the worktree.

    CPT form dialect is explicit, so normalise it before handing it to the reader,
    which otherwise detects its own dialect. Header units and aliases stay intact.
    """
    try:
        with TemporaryDirectory(prefix=".soil-import-", dir=Path(__file__).resolve().parents[3]) as tmp:
            path = Path(tmp) / "upload.csv"
            if cpt:
                frame = pd.read_csv(BytesIO(parts["file"]), sep=parts["delimiter"],
                                    decimal=parts["decimal"], encoding="utf-8-sig")
                frame.to_csv(path, index=False, encoding="utf-8")
                result = tabular.import_cpt(path, parts["sounding_id"], qc_unit=parts["qc_unit"])
            else:
                path.write_bytes(parts["file"])
                result = tabular.import_spt(path, parts["borehole_id"])
        finite(result.model_dump())
        return result
    except (GeoTekError, ValueError, OverflowError) as exc:
        api_error(422, "validation", f"Cannot import CSV: {exc}")
