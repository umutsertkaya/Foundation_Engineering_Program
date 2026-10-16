"""Verification against the tabulated case histories of Boulanger & Idriss.

Inputs (M, a_max, depth, stresses, penetration resistance, FC) are taken from the tables and
every intermediate quantity computed by the engine is compared with the tabulated value.
Tolerances reflect the rounding of the published tables. See data/README.md for sources.
"""

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from geotek.core.constants import PA
from geotek.engine.classification.robertson import soil_behaviour_index
from geotek.engine.correlations.physical import fines_content_from_ic
from geotek.engine.liquefaction import boulanger_idriss2014 as bi

DATA = Path(__file__).parent / "data"


def _within(calc, ref, *, abs_tol=None, rel_tol=None) -> np.ndarray:
    calc, ref = np.asarray(calc, dtype=float), np.asarray(ref, dtype=float)
    ok = np.ones(ref.shape, dtype=bool)
    if abs_tol is not None:
        ok &= np.abs(calc - ref) <= abs_tol
    if rel_tol is not None:
        ok &= np.abs(calc - ref) <= rel_tol * np.abs(ref)
    return ok


# --- CPT: Boulanger & Idriss (2014), Table 3.1 ---------------------------------------------


@pytest.fixture(scope="module")
def cpt():
    d = pd.read_csv(DATA / "bi2014_table3_1_cpt.csv")
    assert len(d) == 233
    return d


@pytest.fixture(scope="module")
def cpt_engine(cpt):
    return bi.cpt_resistance(cpt.qcN * PA, cpt.se, cpt.FC, cpt.Ic)


def test_cpt_rd(cpt):
    assert _within(bi.stress_reduction(cpt.z, cpt.M), cpt.rd, abs_tol=0.006).all()


def test_cpt_soil_behaviour_index(cpt):
    Q = (cpt.qcN - cpt.sv / PA) * (PA / cpt.se) ** cpt.n
    assert _within(Q, cpt.Q, rel_tol=0.02).all()
    assert _within(soil_behaviour_index(cpt.Q, cpt.F), cpt.Ic, abs_tol=0.025).all()


def test_cpt_fines_from_ic(cpt):
    canterbury = cpt.site.str.contains("Darfield|Christchurch")
    ref = pd.to_numeric(cpt.FC_ic, errors="coerce")
    sel = ~canterbury & ref.notna()
    assert sel.sum() > 150
    assert _within(fines_content_from_ic(cpt.Ic[sel]), ref[sel], abs_tol=1.0).all()


def test_cpt_iteration_converges(cpt_engine):
    assert cpt_engine["converged"].all()


def test_cpt_overburden_correction(cpt, cpt_engine):
    q = cpt_engine["resistance"]
    m = 1.338 - 0.249 * np.clip(q, 21, 254) ** 0.264
    cn = np.minimum((PA / cpt.se) ** m, 1.7)
    assert _within(cn, cpt.CN, rel_tol=0.01).all()
    assert _within(cn * cpt.qcN, cpt.qc1N, rel_tol=0.01).all()


def test_cpt_qc1ncs(cpt, cpt_engine):
    assert _within(cpt_engine["resistance"], cpt.qc1Ncs, abs_tol=1.5, rel_tol=0.02).all()


def test_cpt_msf_and_ksigma(cpt):
    assert _within(bi.magnitude_scaling(cpt.M, cpt.qc1Ncs, "CPT"), cpt.MSF, abs_tol=0.006).all()
    assert _within(bi.overburden_factor(cpt.se, cpt.qc1Ncs, "CPT"), cpt.Ksigma, abs_tol=0.006).all()


def test_cpt_end_to_end_csr75(cpt, cpt_engine):
    """CSR(M=7.5, 1 atm) from tabulated inputs through the engine's rd, MSF and K_sigma."""
    q = cpt_engine["resistance"]
    rd = bi.stress_reduction(cpt.z, cpt.M)
    csr = 0.65 * cpt.amax * cpt.sv / cpt.se * rd
    csr75 = csr / (bi.magnitude_scaling(cpt.M, q, "CPT") * bi.overburden_factor(cpt.se, q, "CPT"))
    assert _within(csr75, cpt.CSR75, rel_tol=0.04).mean() >= 0.99


# --- SPT: Idriss & Boulanger (2010), Table 3.1 ---------------------------------------------


@pytest.fixture(scope="module")
def spt():
    d = pd.read_csv(DATA / "ib2010_table3_1_spt.csv")
    assert len(d) == 226
    return d


@pytest.fixture(scope="module")
def spt_engine(spt):
    n60 = spt.Nm * spt.CE * spt.CB * spt.CR * spt.CS
    ncs, crr, dense, conv = bi.spt_resistance(n60, None, spt.FC, spt.se)
    return n60, ncs, conv


def test_spt_fines_adjustment(spt):
    assert _within(bi.delta_n_fines(spt.FC), spt.N1_60cs - spt.N1_60, abs_tol=0.15).all()


def test_spt_iteration(spt, spt_engine):
    n60, ncs, conv = spt_engine
    assert conv.all()
    m = 0.784 - 0.0768 * np.sqrt(np.minimum(ncs, 46))
    cn = np.minimum((PA / spt.se) ** m, 1.7)
    # 2 of 226 rows (Loma Prieta POO7-2, POR-2&3&4) carry C_N values that the report's own
    # equation does not reproduce from the tabulated stresses.
    assert _within(cn, spt.CN, abs_tol=0.02).sum() >= 224
    assert _within(ncs, spt.N1_60cs, abs_tol=0.4).sum() >= 224


def test_spt_rd(spt):
    # 6 rows deviate, mostly sites with recorded motions or tabulated rounding inconsistencies
    assert _within(bi.stress_reduction(spt.z, spt.M), spt.rd, abs_tol=0.006).sum() >= 220


def test_spt_ksigma(spt):
    # 9 rows deviate; e.g. San Juan B-3 lists K_sigma = 1.00 at sigma'_v = 156 kPa > Pa
    assert _within(bi.overburden_factor(spt.se, spt.N1_60cs, "SPT"), spt.Ksigma, abs_tol=0.006).sum() >= 217
