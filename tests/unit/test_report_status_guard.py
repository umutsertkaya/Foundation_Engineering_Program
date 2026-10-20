"""Report section status must not raise when a structure cannot be fingerprinted."""

from types import SimpleNamespace

import pytest

from geotek.services import report


class _Soil:
    source_profile_id = None

    @staticmethod
    def is_stale(source):
        return False


@pytest.mark.parametrize("error", [ValueError("NaN"), KeyError("code"), TypeError("x")])
def test_unfingerprintable_structure_is_stale(monkeypatch, error):
    def boom(project, structure):
        raise error

    monkeypatch.setattr(report, "calculation_fingerprint", boom)
    project = SimpleNamespace(soil_profiles=[])
    structure = SimpleNamespace(result=object(), result_hash="abc", soil=_Soil())
    assert report._structure_status(project, structure) == "stale"


def test_matching_fingerprint_is_ready(monkeypatch):
    monkeypatch.setattr(report, "calculation_fingerprint", lambda p, s: "abc")
    project = SimpleNamespace(soil_profiles=[])
    structure = SimpleNamespace(result=object(), result_hash="abc", soil=_Soil())
    assert report._structure_status(project, structure) == "ready"
