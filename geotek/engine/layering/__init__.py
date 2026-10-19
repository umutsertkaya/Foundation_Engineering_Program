"""Pure automatic layering; proposals remain editable and unapproved."""

from geotek.core.models.profile import SoilLayer
from geotek.engine.layering.common import Layer, Proposal
from geotek.engine.layering.cpt import cpt_layers
from geotek.engine.layering.spt import spt_log_layers, spt_uscs_n_layers

__all__ = [
    "Layer", "Proposal", "cpt_layers", "spt_log_layers", "spt_uscs_n_layers",
    "proposal_to_layers",
]


def proposal_to_layers(
    result: Proposal, *, id_prefix: str,
    gamma: dict[int, tuple[float, float | None]] | None = None,
) -> list[SoilLayer]:
    """Convert a proposal without selecting or approving design parameters.

    ``gamma`` uses zero-based layer indices and supplies both unit weights when
    a suggestion is unavailable. Suggested weights take precedence; gamma_sat
    follows SoilLayer's existing convention when not supplied.
    """
    supplied = {} if gamma is None else gamma
    missing = [i for i, layer in enumerate(result.layers)
               if layer.gamma_suggested is None and i not in supplied]
    if missing:
        raise ValueError(f"Missing gamma for layer indices: {missing}")
    layers = []
    for i, layer in enumerate(result.layers):
        weights = ((layer.gamma_suggested, None) if layer.gamma_suggested is not None
                   else supplied[i])
        layers.append(SoilLayer(
            id=f"{id_prefix}{i + 1}", top=layer.top, bottom=layer.bottom,
            description=layer.description, uscs=layer.uscs, sbtn_zone=layer.sbtn_zone,
            behaviour=layer.behaviour, gamma=weights[0], gamma_sat=weights[1],
            source_ids=[result.source_id],
        ))
    return layers
