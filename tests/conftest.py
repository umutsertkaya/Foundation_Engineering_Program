import os
import shutil
from pathlib import Path

import pytest

from geotek.core.models import GroundwaterCondition, SoilLayer, SoilProfile


@pytest.hookimpl(tryfirst=True)
def pytest_configure(config):
    """Give every pytest process its own ``--basetemp`` below the configured one.

    pytest deletes the basetemp directory when a run starts, so two runs in the same checkout
    (e.g. a quick test while a full run is in progress) wiped each other's ``tmp_path`` and
    produced intermittent ``save -> 400`` failures.
    """
    base = config.option.basetemp
    if base is not None:
        config.option.basetemp = Path(base) / f"run-{os.getpid()}"


def pytest_sessionfinish(session, exitstatus):
    """Remove this process's temp directory after a passing run; keep it to debug failures."""
    base = session.config.option.basetemp
    if base is not None and Path(base).name == f"run-{os.getpid()}" and int(exitstatus) == 0:
        shutil.rmtree(base, ignore_errors=True)


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
