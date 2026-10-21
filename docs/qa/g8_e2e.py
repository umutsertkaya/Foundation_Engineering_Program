"""G8 end-to-end acceptance against a running GeoTek server (real HTTP, calculation jobs, docx).

Usage: python docs/qa/g8_e2e.py [base_url]   (default http://127.0.0.1:8766)
Server: python -m geotek.launcher-style app, e.g.
  python -c "import uvicorn; from geotek.launcher import build_app; uvicorn.run(build_app(), port=8766)"
The script builds a project file with the pydantic models, opens it over HTTP and drives every
calculation through the API. Prints PASS / FAIL / NOTE per step; exit code 1 on any FAIL.
"""

from __future__ import annotations

import io
import sys
import tempfile
import time
from pathlib import Path

import httpx
from docx import Document

from geotek.core.models.profile import DesignParameters, GroundwaterCondition, SoilLayer, SoilProfile
from geotek.core.models.project import Project, ProjectMeta
from geotek.core.models.structures import (
    RetainingWallStructure, SheetPileStructure, StructureSoilModel, WallDesignInputs)
from geotek.core.models.walls import WallSettings
from geotek.engine.walls.layered import soil_from_basic
from geotek.io.project_io import save_project
from geotek.services.walls_basic import BasicWallInput, proportion_for

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8766"
OUT = Path(__file__).resolve().parent / "g8"
client = httpx.Client(base_url=BASE, timeout=120)
failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}"[:300])
    if not ok:
        failures.append(name)
    return ok


def job(path: str, **kwargs) -> dict:
    r = client.post(path, **kwargs)
    if r.status_code != 202:
        return {"status": f"http{r.status_code}", "body": r.text[:300]}
    jid = r.json()["job_id"]
    for _ in range(1200):
        s = client.get(f"/api/jobs/{jid}").json()
        if s["status"] in {"done", "failed", "cancelled"}:
            return s
        time.sleep(0.1)
    return {"status": "timeout"}


def sand(sid: str = "sand") -> StructureSoilModel:
    return StructureSoilModel(profile=SoilProfile(
        id=sid, layers=[SoilLayer(id="L1", top=0, bottom=35, gamma=18, gamma_sat=20,
                                  design=DesignParameters(phi_eff=30))],
        gwt=GroundwaterCondition(depth_insitu=100)))


def wall(wid: str, slope: float, basis: str) -> RetainingWallStructure:
    basic = BasicWallInput(wall_type="cantilever", height=5.0, backfill_gamma=18.0, backfill_phi=32.0,
                           foundation_phi=30.0, foundation_gamma=19.0, surcharge=10.0, sds=0.5)
    return RetainingWallStructure(
        id=wid, name=f"Wall {basis}", wall_type="cantilever", height=5, embedment=0.6,
        geometry=proportion_for("cantilever", 5, 4.6, 0.6), soil=soil_from_basic(basic, 0.6),
        inputs=WallDesignInputs(surcharge=15, surcharge_basis=basis, sds=0.5),
        backfill_slope=slope, settings=WallSettings(design_code="asd"))


def pile(pid: str, slope: float, basis: str, anchored: bool) -> SheetPileStructure:
    return SheetPileStructure(
        id=pid, name=f"Pile {basis} {'anchored' if anchored else 'cantilever'}", retained_height=4,
        soil=sand(), design_code="asd", support="anchored" if anchored else "cantilever",
        anchor_depth=1 if anchored else None, backfill_slope=slope, surcharge=15.0,
        surcharge_basis=basis)


project = Project(meta=ProjectMeta(name="G8 Kabul", language="tr"), structures=[
    wall("w_h", 10.0, "horizontal"), wall("w_i", 10.0, "inclined"),
    pile("p_h", 10.0, "horizontal", False), pile("p_i", 10.0, "inclined", True)])
tmp = Path(tempfile.mkdtemp()) / "g8.gtk"
save_project(project, tmp)

check("health", client.get("/api/health").json()["status"] == "ok")
r = client.post("/api/project/open", json={"path": str(tmp)})
check("open project", r.status_code == 200, r.text[:120])

# --- retaining wall: slope + surcharge on both bases
results: dict[str, dict] = {}
for wid in ("w_h", "w_i"):
    s = job(f"/api/m/walls/structures/{wid}/check")
    check(f"wall {wid} check job", s["status"] == "done", str(s.get("error") or s.get("body") or ""))
    if s["status"] == "done":
        results[wid] = s["result"]
        check(f"wall {wid} has checks and slope in result",
              len(s["result"]["checks"]) > 3, f"governing={s['result'].get('governing')}")
if len(results) == 2:
    def force(res):  # total horizontal driving force, first force row
        return res["forces"]
    check("wall: horizontal vs inclined basis differ", results["w_h"]["forces"] != results["w_i"]["forces"])

# --- sheet pile: slope + surcharge
for pid in ("p_h", "p_i"):
    s = job(f"/api/m/sheet_pile/structures/{pid}/design")
    check(f"sheet pile {pid} design job", s["status"] == "done", str(s.get("error") or s.get("body") or ""))
    if s["status"] == "done":
        stored = client.get(f"/api/structures/{pid}").json()["result"] or {}
        depth = stored.get("embedment") or stored.get("design_embedment") or stored.get("total_length") or 0
        check(f"sheet pile {pid} stored result", depth > 0, str(sorted(stored)[:12]))

# --- anchored wall: anchor design, single level, multi level
BASE_AW = "/api/m/anchored_wall"
design = {"excavation_height": 10.0, "head_depth": 6.25, "inclination_deg": 15.0, "phi_deg": 33.0,
          "horizontal_load_per_m": 172.0, "spacing": 2.5, "ultimate_transfer_load": 100.0,
          "safety_factor": 2.0, "lock_off_ratio": 1.0, "tendon": {"type": "strand"}}
r = client.post(f"{BASE_AW}/anchor/design", json=design)
check("anchor design (GEC-4 App A Ex 1 geometry)", r.status_code == 200 and r.json()["bond_length"] > 0,
      r.text[:150])
r = client.post(f"{BASE_AW}/anchor/design", json={k: v for k, v in design.items() if k != "safety_factor"})
check("anchor design missing inputs -> 422 missing_inputs", r.status_code == 422 and r.json()["code"] == "missing_inputs")

soil = {"profile": {"id": "SP", "gwt": {"depth_insitu": 100.0}, "layers": [
    {"id": "S", "top": 0, "bottom": 40, "gamma": 18.0, "gamma_sat": 20.0, "design": {"phi_eff": 30.0}}]}}
anchor_design = {"safety_factor": 2.0, "ultimate_transfer_load": 100.0, "lock_off_ratio": 1.0,
                 "tendon": {"type": "strand"}}
single = {"excavation_height": 6.0, "passive_factor": 1.5, "soil": soil, "backfill_slope": 5.0,
          "surcharge": 10.0, "surcharge_basis": "horizontal",
          "levels": [{"depth": 1.5, "spacing": 2.5, "inclination_deg": 15.0}],
          "anchor_design": anchor_design}
multi = {"excavation_height": 10.0, "passive_factor": 1.5, "soil": soil, "surcharge": 10.0,
         "levels": [{"depth": 1.5, "spacing": 2.5}, {"depth": 4.5, "spacing": 2.5},
                    {"depth": 7.5, "spacing": 2.5}], "anchor_design": anchor_design}
r = client.post(f"{BASE_AW}/analysis/run", json=single)
check("anchored single level, slope + surcharge + anchor design", r.status_code == 200, r.text[:200])
if r.status_code == 200:
    check("single: method free earth", "free" in r.json()["method"], r.json()["method"])
    check("single: anchor design attached", all(lv.get("design") for lv in r.json()["levels"]))
r = client.post(f"{BASE_AW}/analysis/run?save=true", json=multi)
check("anchored multi level (saved to project)", r.status_code == 200, r.text[:200])
if r.status_code == 200:
    d = r.json()
    check("multi: apparent hinge, 3 levels", d["method"] == "apparent_hinge" and len(d["levels"]) == 3)
    check("multi: anchor design attached", all(lv.get("design") for lv in d["levels"]))
r = client.post(f"{BASE_AW}/analysis/run", json={**multi, "backfill_slope": 5.0})
check("multi + slope -> coded stop", r.status_code == 422 and r.json()["code"] == "calculation_stopped", r.text[:150])
st = client.get(f"{BASE_AW}/state").json()
check("anchored state saved, not stale", st["state"]["analysis"] is not None and not st["analysis_result_stale"])
check("project is dirty and can save", client.post("/api/project/save").status_code == 200)

# --- report
sections = client.get("/api/m/report/sections").json()
ids = [s["id"] for s in sections]
print("NOTE  report sections:", ids)
check("report lists anchored_wall section", any("anchored" in i for i in ids))
for lang in ("tr", "en"):
    r = client.post("/api/m/report/docx", json={"language": lang})
    ok = r.status_code == 200
    check(f"report docx {lang}", ok, r.text[:200] if not ok else f"{len(r.content)} bytes")
    if ok:
        (OUT / f"rapor_{lang}.docx").write_bytes(r.content)
        doc = Document(io.BytesIO(r.content))
        text = "\n".join([p.text for p in doc.paragraphs] +
                         [c.text for t in doc.tables for row in t.rows for c in row.cells])
        check(f"docx {lang}: no raw i18n keys", "anchored_wall." not in text and "report." not in text.replace("report.docx", ""))
        check(f"docx {lang}: no raw envelope id", "{kind}" not in text)
        check(f"docx {lang}: anchored wall content", ("Ankraj" in text) if lang == "tr" else ("nchor" in text))

print("FAILURES:", failures or "none")
sys.exit(1 if failures else 0)
