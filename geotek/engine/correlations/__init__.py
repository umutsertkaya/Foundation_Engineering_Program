"""Empirical correlations. Importing this package registers every correlation."""

from geotek.engine.correlations import physical, state, stiffness, strength  # noqa: F401
from geotek.engine.correlations.registry import (
    REGISTRY,
    Correlation,
    applicable,
    combine,
    evaluate,
    evaluate_all,
    get,
)

__all__ = ["REGISTRY", "Correlation", "applicable", "combine", "evaluate", "evaluate_all", "get"]
