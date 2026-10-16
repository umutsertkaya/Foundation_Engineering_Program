import pytest

from geotek.core.models import GroundwaterCondition, SoilLayer, SoilProfile


@pytest.fixture
def two_layer_profile() -> SoilProfile:
    """0-3 m: gamma 18 / 19; 3-10 m: gamma 17 / 20; GWT at 2 m."""
    return SoilProfile(
        id="P1",
        gwt=GroundwaterCondition(depth_insitu=2.0, depth_design=1.0, depth_seismic=4.0),
        layers=[
            SoilLayer(id="L1", top=0, bottom=3, gamma=18, gamma_sat=19),
            SoilLayer(id="L2", top=3, bottom=10, gamma=17, gamma_sat=20),
        ],
    )
