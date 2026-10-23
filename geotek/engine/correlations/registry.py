"""Correlation registry.

Each empirical correlation is registered once with its metadata (parameter, inputs,
reference, reliability, validity check). The UI lists applicable correlations; the engine
evaluates one, or all of them, and returns traceable ``DerivedParameter`` objects.

Adding a correlation::

    @register(id="X_phi_SPT", parameter="phi_eff", unit="deg", source="SPT",
              inputs=("N60",), reference="...", reliability="B", validity="...")
    def x_phi(N60):
        return ...
"""

from __future__ import annotations

import math
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field

import numpy as np

from geotek.core.models.parameters import DerivedParameter, ParameterStats, Reliability, Source

CheckFn = Callable[[Mapping[str, float], Mapping[str, float]], list[str]]


@dataclass(eq=False)
class Correlation:
    id: str
    parameter: str
    unit: str
    source: Source
    inputs: tuple[str, ...]
    reference: str
    reliability: Reliability
    validity: str
    """Human-readable applicability statement (shown in UI and report)."""
    func: Callable[..., float]
    options: dict[str, float] = field(default_factory=dict)
    check: CheckFn | None = None
    verified: bool = False
    """True once checked against the original source in Phase 0."""


REGISTRY: dict[str, Correlation] = {}

NON_NEGATIVE_PARAMETERS = ("su", "E", "sigma_p", "Dr", "OCR", "K0", "Vs", "Gmax", "M")
UPPER_BOUNDS = {"Dr": 100.0, "K0": 5.0}
"""Largest value the design model accepts; a correlation result above it is marked invalid."""
"""Parameters whose correlation results must not be negative (negative -> validity_ok False)."""


def register(
    *,
    id: str,
    parameter: str,
    unit: str,
    source: Source,
    inputs: tuple[str, ...],
    reference: str,
    reliability: Reliability,
    validity: str,
    options: dict[str, float] | None = None,
    check: CheckFn | None = None,
):
    def decorator(func):
        if id in REGISTRY:
            raise ValueError(f"Correlation {id!r} registered twice")
        REGISTRY[id] = Correlation(
            id=id, parameter=parameter, unit=unit, source=source, inputs=inputs,
            reference=reference, reliability=reliability, validity=validity, func=func,
            options=dict(options or {}), check=check,
        )
        return func

    return decorator


def get(correlation_id: str) -> Correlation:
    try:
        return REGISTRY[correlation_id]
    except KeyError:
        raise KeyError(f"Unknown correlation {correlation_id!r}") from None


def applicable(
    parameter: str, inputs: Mapping[str, float], source: Source | None = None
) -> list[Correlation]:
    """Correlations for ``parameter`` whose required inputs are all available."""
    return [
        c for c in REGISTRY.values()
        if c.parameter == parameter
        and (source is None or c.source == source)
        and all(_available(inputs, name) for name in c.inputs)
    ]


def _available(inputs: Mapping[str, float], name: str) -> bool:
    value = inputs.get(name)
    return value is not None and not (isinstance(value, float) and math.isnan(value))


def evaluate(correlation_id: str, inputs: Mapping[str, float], **options: float) -> DerivedParameter:
    """Evaluate one correlation at a point. Extra keys in ``inputs`` act as context for checks
    (e.g. ``Ic`` to flag a sand correlation used in clay)."""
    c = get(correlation_id)
    missing = [name for name in c.inputs if not _available(inputs, name)]
    if missing:
        raise ValueError(f"{c.id}: missing input(s) {missing}")
    unknown = set(options) - set(c.options)
    if unknown:
        raise ValueError(f"{c.id}: unknown option(s) {sorted(unknown)}")
    opts = {**c.options, **options}
    args = {name: float(inputs[name]) for name in c.inputs}

    with np.errstate(all="ignore"):
        value = float(c.func(**args, **opts))
    warnings = list(c.check(inputs, opts)) if c.check else []
    if not math.isfinite(value):
        warnings.append("Value not computable for these inputs")
    elif value < 0 and c.parameter in NON_NEGATIVE_PARAMETERS:
        warnings.append(f"Negative {c.parameter} ({value:.4g}) is not physical; result marked invalid")
    elif c.parameter in UPPER_BOUNDS and value > UPPER_BOUNDS[c.parameter]:
        warnings.append(
            f"{c.parameter} = {value:.4g} exceeds {UPPER_BOUNDS[c.parameter]:g}; result marked invalid")
    return DerivedParameter(
        value=value, unit=c.unit, method_id=c.id, reference=c.reference, source=c.source,
        inputs_used={**args, **opts}, validity_ok=not warnings, warnings=warnings,
        reliability=c.reliability,
    )


def evaluate_all(
    parameter: str, inputs: Mapping[str, float], source: Source | None = None
) -> list[DerivedParameter]:
    return [evaluate(c.id, inputs) for c in applicable(parameter, inputs, source)]


def combine(results: list[DerivedParameter], *, only_valid: bool = True) -> DerivedParameter:
    """Mean of several correlation results, with min/mean/max spread.

    With ``only_valid`` results outside their validity range are excluded; if none remain,
    all results are used and the combined value is flagged invalid.
    """
    if not results:
        raise ValueError("Nothing to combine")
    units = {r.unit for r in results}
    if len(units) != 1:
        raise ValueError(f"Cannot combine different units: {units}")
    pool = [r for r in results if r.validity_ok and math.isfinite(r.value)] if only_valid else []
    fallback = not pool
    if fallback:
        pool = [r for r in results if math.isfinite(r.value)]
        if not pool:
            raise ValueError("No finite results to combine")
    values = [r.value for r in pool]
    sources = {r.source for r in pool}
    warnings = ["No result within its validity range; all results averaged"] if fallback else []
    return DerivedParameter(
        value=float(np.mean(values)),
        unit=pool[0].unit,
        method_id="mean(" + ",".join(r.method_id for r in pool) + ")",
        reference="; ".join(r.reference for r in pool),
        source=sources.pop() if len(sources) == 1 else "combined",
        validity_ok=not fallback,
        warnings=warnings,
        # "A" < "B" < "C": the combined value takes the weakest reliability
        reliability=max((r.reliability for r in pool if r.reliability), default=None),
        stats=ParameterStats(n=len(values), min=min(values), mean=float(np.mean(values)), max=max(values)),
    )
