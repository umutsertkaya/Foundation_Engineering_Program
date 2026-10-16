"""Generate the SYNTHETIC example data set (not a real site).

    python examples/make_example.py

Writes ornek_cpt.csv (Turkish CSV: ';' separator, ',' decimal), ornek_spt.csv and
ornek_proje.gtk. Values are invented to exercise every part of Module 1: fill over loose
silty sand (liquefiable), soft clay (clay-like) and dense sand.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

from geotek.core.models import (
    GroundwaterCondition,
    Investigations,
    LabRecord,
    Project,
    ProjectMeta,
    SiteSeismic,
    SoilLayer,
    SoilProfile,
)
from geotek.io.project_io import save_project
from geotek.io.tabular import import_cpt, import_spt

HERE = Path(__file__).parent
GWT = 1.5

# (top, bottom, qc MPa, Rf %, description, uscs, gamma, gamma_sat)
LAYERS = [
    (0.0, 1.5, 4.0, 1.5, "Dolgu", "SM", 18.0, 19.0),
    (1.5, 6.0, 4.5, 0.8, "Gevşek siltli kum", "SM", 17.5, 19.0),
    (6.0, 9.0, 0.7, 4.0, "Yumuşak kil", "CL", 17.0, 18.0),
    (9.0, 15.0, 28.0, 0.5, "Sıkı kum", "SP", 19.0, 20.5),
]


def _cpt_csv(path: Path) -> None:
    rng = np.random.default_rng(42)
    z = np.round(np.arange(0.10, 15.0 + 1e-9, 0.05), 2)
    qc, fs, u2 = np.empty_like(z), np.empty_like(z), np.empty_like(z)
    for i, depth in enumerate(z):
        top, bot, q, rf, _, uscs, *_ = next(L for L in LAYERS if L[0] <= depth < L[1] or depth == 15.0 and L[1] == 15.0)
        q = q * (1 + 0.04 * (depth - top)) * rng.lognormal(0, 0.08)
        qc[i] = q
        fs[i] = q * 1000 * rf / 100 * rng.lognormal(0, 0.05)
        u0 = 9.81 * max(0.0, depth - GWT)
        u2[i] = u0 * (3.0 if uscs == "CL" else 1.0)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("Derinlik (m);qc (MPa);fs (kPa);u2 (kPa)\n")
        for row in zip(z, qc, fs, u2):
            fh.write(";".join(f"{v:.3f}".replace(".", ",") for v in row) + "\n")


def _spt_csv(path: Path) -> None:
    rows = [(1.5, 6), (3.0, 5), (4.5, 7), (6.0, 4), (7.5, 3), (9.0, 22), (10.5, 31), (12.0, 38), (13.5, "50/12")]
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("depth,N\n")
        for depth, n in rows:
            fh.write(f"{depth},{n}\n")


def build() -> Project:
    _cpt_csv(HERE / "ornek_cpt.csv")
    _spt_csv(HERE / "ornek_spt.csv")
    cpt = import_cpt(HERE / "ornek_cpt.csv", "CPT-1", area_ratio=0.8, gwt_depth=GWT)
    bh = import_spt(HERE / "ornek_spt.csv", "SK-1", energy_ratio=60, gwt_depth=GWT)
    bh.lab = [
        LabRecord(depth=3.0, FC=18, LL=24, PL=20),
        LabRecord(depth=4.5, FC=22),
        LabRecord(depth=7.5, FC=85, LL=38, PL=19),
        LabRecord(depth=10.5, FC=4),
    ]
    profile = SoilProfile(
        id="P1", name="Örnek profil (sentetik)", source_ids=["SK-1", "CPT-1"],
        gwt=GroundwaterCondition(depth_insitu=GWT),
        layers=[SoilLayer(id=f"L{i + 1}", top=L[0], bottom=L[1], description=L[4], uscs=L[5],
                          gamma=L[6], gamma_sat=L[7], behaviour="undrained" if L[5] == "CL" else "drained")
                for i, L in enumerate(LAYERS)],
    )
    return Project(
        meta=ProjectMeta(name="Örnek proje (sentetik veri)", engineer=""),
        site=SiteSeismic(pga_g=0.35, mw=7.5),
        investigations=Investigations(boreholes=[bh], cpts=[cpt]),
        soil_profiles=[profile],
    )


if __name__ == "__main__":
    path = save_project(build(), HERE / "ornek_proje")
    print(f"Wrote {path}")

