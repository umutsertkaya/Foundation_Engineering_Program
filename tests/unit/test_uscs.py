import pytest

from geotek.core.models import LabRecord
from geotek.engine.classification.uscs import classify, classify_lab_record


@pytest.mark.parametrize(
    "kwargs, symbol",
    [
        (dict(fines=60, LL=40, PI=20), "CL"),
        (dict(fines=60, LL=40, PI=2), "ML"),
        (dict(fines=60, LL=25, PI=6), "CL-ML"),
        (dict(fines=60, LL=60, PI=40), "CH"),
        (dict(fines=60, LL=60, PI=15), "MH"),
        (dict(fines=3, gravel=10, D10=0.1, D30=0.3, D60=0.8), "SW"),
        (dict(fines=3, gravel=70, D10=0.5, D30=2.0, D60=4.0), "GW"),
        (dict(fines=3, gravel=10, D10=0.1, D30=0.15, D60=0.2), "SP"),
        (dict(fines=8, gravel=5, LL=30, PI=15, D10=0.1, D30=0.15, D60=0.2), "SP-SC"),
        (dict(fines=20, gravel=50, LL=25, PI=5), "GC-GM"),
        (dict(fines=30, gravel=10, LL=35, PI=3), "SM"),
        (dict(fines=30, gravel=10, LL=35, PI=15), "SC"),
    ],
)
def test_symbols(kwargs, symbol):
    result = classify(**kwargs)
    assert result.symbol == symbol
    assert result.complete


def test_missing_data_marked_incomplete():
    r = classify(fines=20)
    assert r.symbol == "SM" and not r.complete and len(r.notes) == 2
    assert classify(fines=70).symbol is None


def test_lab_record():
    assert classify_lab_record(LabRecord(depth=3, FC=75, LL=45, PL=20)).symbol == "CL"
    assert classify_lab_record(LabRecord(depth=3)).symbol is None
