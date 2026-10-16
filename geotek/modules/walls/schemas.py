"""Walls module DTOs; WallResultDTO stays in api.schemas because JobState unions it."""

from __future__ import annotations

from geotek.api.schemas import DTO, WallType


class WallTypeInfo(DTO):
    """Selectable retaining wall type and its i18n label key."""

    id: WallType
    title_key: str
