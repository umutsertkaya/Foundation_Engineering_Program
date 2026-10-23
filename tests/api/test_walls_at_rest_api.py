"""POST /api/m/walls/at-rest: at-rest pressure through the shared envelope."""

import pytest

from geotek.core.models.profile import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.core.models.project import Project, ProjectMeta

from tests.unit.test_hs_c_walls import approve_k0

URL = "/api/m/walls/at-rest"


def _open(shell, k0, **approval):
    layer = SoilLayer(id="L1", top=0, bottom=10, gamma=18, gamma_sat=20,
                      design=DesignParameters(phi_eff=30, K0=k0))
    profile = SoilProfile(id="p", layers=[layer], gwt=GroundwaterCondition(depth_insitu=99.0))
    project = approve_k0(Project(meta=ProjectMeta(name="K0"), soil_profiles=[profile]), **approval)
    shell.app.state.session.open_project(project)


def test_at_rest_requires_project(shell):
    response = shell.post(URL, json={"profile_id": "p", "height": 6})
    assert response.status_code == 409 and response.json()["code"] == "no_project_open"


def test_at_rest_result(shell):
    _open(shell, 0.5)
    response = shell.post(URL, json={"profile_id": "p", "height": 6, "surcharge": 10})
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total_force"] == pytest.approx(192.0)
    assert [c["name"] for c in data["components"]] == ["surcharge", "soil"]
    assert data["layers"] == [{"layer_id": "L1", "top": 0.0, "bottom": 6.0, "K0": 0.5}]


def test_at_rest_unapproved_k0_is_422_with_message_code(shell):
    _open(shell, None)
    response = shell.post(URL, json={"profile_id": "p", "height": 6})
    assert response.status_code == 422
    error = response.json()
    assert error["details"]["message_code"] == "layer_k0_missing"
    assert error["details"]["params"] == {"top": 0.0, "bottom": 10.0}


def test_at_rest_unknown_profile_and_bad_body(shell):
    _open(shell, 0.5)
    assert shell.post(URL, json={"profile_id": "zzz", "height": 6}).status_code == 404
    assert shell.post(URL, json={"profile_id": "p", "height": -1}).status_code == 422


@pytest.mark.parametrize("approval", [dict(approved=False), dict(stale=True)])
def test_at_rest_unapproved_or_stale_k0_is_422_even_with_a_design_value(shell, approval):
    _open(shell, 0.5, **approval)
    response = shell.post(URL, json={"profile_id": "p", "height": 6})
    assert response.status_code == 422
    assert response.json()["details"]["message_code"] == "layer_k0_missing"
