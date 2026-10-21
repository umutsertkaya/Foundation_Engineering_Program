"""T10c: translatable engine messages and report presentation details."""


import numpy as np
import pytest

from geotek.api.jobs import error_from_exception
from geotek.core.errors import GeoTekError, LayerDesignError
from geotek.core.models import SoilLayer
from geotek.services import report


def _layer():
    return SoilLayer(id="9b1d6c0e-uuid", top=2.0, bottom=5.5, gamma=18, gamma_sat=19)


@pytest.mark.parametrize("issue", ["su_missing", "su_not_positive", "phi_missing",
                                   "seismic_undrained_unsupported"])
def test_layer_design_error_names_depths_not_the_layer_id(issue):
    exc = LayerDesignError(_layer(), issue)
    assert "uuid" not in str(exc) and "2–5.5 m" in str(exc)
    error = error_from_exception(exc)
    assert error.code == "engine_error"
    assert error.details == {"message_code": f"layer_{issue}", "params": {"top": 2.0, "bottom": 5.5}}


def test_plain_engine_error_has_no_message_code():
    assert error_from_exception(GeoTekError("x")).details == {}


def test_every_layer_design_error_has_tr_and_en_text():
    from geotek.i18n import t
    for issue in LayerDesignError._TEXT:
        for lang in ("tr", "en"):
            text = t(f"error.detail.layer_{issue}", lang, top=2, bottom=5.5)
            assert not text.startswith("error.detail") and "2" in text and "5.5" in text


@pytest.mark.parametrize("depth, start, stop, expected", [
    ([1.0, 1.5, 2.0, 2.5], 0, 2, 2.0),    # next run starts at 2.0
    ([1.0, 1.5, 2.0, 2.5], 3, 4, 3.0),    # last sample stands for one spacing
    ([1.4], 0, 1, 1.4),                    # a lone sample has no spacing
])
def test_run_bottom_gives_single_sample_runs_a_thickness(depth, start, stop, expected):
    assert report._run_bottom(np.array(depth), start, stop) == pytest.approx(expected)


class _Writer:
    lang = "en"

    def tr(self, key, **kwargs):
        return {"report.wall.governing": "Governing check",
                "report.wall.governing_utilisation": "Highest utilisation"}[key]

    def coded(self, key, params, fallback=None):
        labels = {"case.static": "Static", "case.seismic": "Seismic",
                  "check.sliding": "Sliding", "check.bearing": "Bearing capacity"}
        return labels.get(key, str(fallback if fallback is not None else key))


def test_governing_line_falls_back_to_highest_utilisation():
    checks = [{"case": "static", "name": "sliding", "utilisation": 0.62},
              {"case": "seismic", "name": "bearing", "utilisation": 0.81},
              {"case": "static", "name": "tilt", "utilisation": None}]
    line = report._governing_line(_Writer(), {"governing": "", "checks": checks})
    assert line == "Highest utilisation: Seismic · Bearing capacity (0.81)"
    assert report._governing_line(_Writer(), {"governing": "static:sliding", "checks": checks}) \
        == "Governing check: Static · Sliding"
    assert report._governing_line(_Writer(), {"governing": "", "checks": []}) == "Governing check: -"
