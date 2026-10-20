import re
from pathlib import Path

import numpy as np
import pytest

import geotek
from geotek.core.models import Borehole, LabRecord, SPTRecord
from geotek.i18n import _catalog
from geotek.io.project_io import load_project
from geotek.services.module1 import (
    LiquefactionSettings,
    process_investigations,
    run_liquefaction,
    spt_fc_pi,
)

EXAMPLE = Path(__file__).parents[2] / "examples" / "ornek_proje.gtk"


@pytest.fixture(scope="module")
def project():
    return load_project(EXAMPLE)


def test_spt_fc_pi_matching():
    bh = Borehole(id="B", spt=[SPTRecord(depth=3.0, n_field=5), SPTRecord(depth=6.0, n_field=5)],
                  lab=[LabRecord(depth=3.2, FC=20, LL=30, PL=20)])
    with pytest.raises(ValueError, match="6.0"):
        spt_fc_pi(bh, None)
    fc, pi, notes = spt_fc_pi(bh, 10.0)
    assert fc.tolist() == [20.0, 10.0]
    assert pi[0] == 10.0 and np.isnan(pi[1])
    assert notes


def test_process_example(project):
    r = process_investigations(project)
    assert set(r.spt) == {"SK-1"} and set(r.cpt) == {"CPT-1"} and not r.errors
    assert r.cpt["CPT-1"].gamma is None  # stresses from the profile


@pytest.mark.parametrize("method", ["bi2014", "youd2001"])
def test_liquefaction_example(project, method):
    s = LiquefactionSettings(method=method, amax_g=0.35, mw=7.5, default_fc=10)
    r = run_liquefaction(project, s)
    assert set(r.liquefaction) == {"SK-1", "CPT-1"}, r.errors
    cpt = r.liquefaction["CPT-1"]
    # Synthetic profile: loose sand 1.5-6 m liquefies, soft clay 6-9 m is clay-like
    assert np.any(cpt.status[(cpt.depth > 2) & (cpt.depth < 6)] == "liquefiable")
    assert np.all(cpt.status[(cpt.depth > 6.5) & (cpt.depth < 8.5)] == "clay_like")
    spt = r.liquefaction["SK-1"]
    assert spt.status[spt.depth == 7.5][0] == "clay_like"  # lab PI = 19
    assert any(w.startswith("liquefaction.warning.default_fc") for w in spt.warnings)


def test_missing_fc_is_reported_not_raised(project):
    r = run_liquefaction(project, LiquefactionSettings(default_fc=None))
    assert "SK-1" in r.errors and "CPT-1" in r.liquefaction


def test_all_literal_i18n_keys_exist():
    root = Path(geotek.__file__).parent
    keys = set()
    for path in root.rglob("*.py"):
        keys |= set(re.findall(r'\bt\("([a-z0-9_.]+)"', path.read_text(encoding="utf-8")))
    assert keys
    for lang in ("tr", "en"):
        missing = keys - set(_catalog(lang))
        assert not missing, f"{lang}: {sorted(missing)}"


def test_dynamic_i18n_keys_exist():
    """Keys built at run time from engine/config identifiers (shown by the web and the report)."""
    from geotek.config.codes import list_design_codes
    from geotek.engine.liquefaction import common

    statuses = [v for k, v in vars(common).items() if k.isupper() and isinstance(v, str) and k != "NO_FS_STATUSES"]
    dynamic = [f"status.{s}" for s in statuses] + \
              [f"fstatus.{s}" for s in ("verified", "secondary", "unverified", "not_in_source", "user")] + \
              [f"ui.code.status.{c.status}" for c in list_design_codes().values()]
    for lang in ("tr", "en"):
        assert not set(dynamic) - set(_catalog(lang))
