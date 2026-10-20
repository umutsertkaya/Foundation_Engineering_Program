"""T10 end-to-end acceptance against a running GeoTek FastAPI server (real HTTP).

Usage: python docs/qa/t10_e2e.py [base_url]   (default http://127.0.0.1:8765)
Server: GEOTEK_SETTINGS=<tmp settings.json> python -m uvicorn geotek.api.app:create_app --factory --port 8765
Prints one line per step: PASS / FAIL / NOTE. Exit code 1 when any step FAILs.
"""

from __future__ import annotations

import io
import sys
import time
from pathlib import Path

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765"
EXAMPLES = Path(__file__).resolve().parents[2] / "examples"
OUT = Path(__file__).resolve().parent
client = httpx.Client(base_url=BASE, timeout=60)
failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}"[:400])
    if not ok:
        failures.append(name)
    return ok


def note(text: str) -> None:
    print(f"NOTE  {text}"[:400])


def job(path: str, **kwargs) -> dict:
    r = client.post(path, **kwargs)
    if r.status_code != 202:
        return {"status": f"http{r.status_code}", "body": r.text[:300]}
    jid = r.json()["job_id"]
    for _ in range(600):
        s = client.get(f"/api/jobs/{jid}").json()
        if s["status"] in {"done", "failed", "cancelled"}:
            return s
        time.sleep(0.1)
    return {"status": "timeout"}


# --- shell / project
check("health", client.get("/api/health").json()["status"] == "ok")
for lang in ("tr", "en"):
    cat = client.get(f"/api/i18n/{lang}").json()
    check(f"i18n {lang}", len(cat) > 100, f"{len(cat)} keys")
r = client.post("/api/library", json={"name": "T10 Acceptance", "number": "T10", "engineer": "QA"})
check("new project", r.status_code == 200, r.text[:120])
check("modules listed", len(client.get("/api/modules").json()) >= 4)

# --- soil: CPT / SPT import
cpt_csv = (EXAMPLES / "ornek_cpt.csv").read_bytes()
r = client.post("/api/m/soil/import/cpt", data={"sounding_id": "CPT1", "qc_unit": "MPa", "delimiter": ";", "decimal": ","},
                files={"file": ("ornek_cpt.csv", cpt_csv, "text/csv")})
check("import CPT (TR csv ; ,)", r.status_code == 200, r.text[:150])
r = client.post("/api/m/soil/import/spt", data={"borehole_id": "BH1"},
                files={"file": ("ornek_spt.csv", (EXAMPLES / "ornek_spt.csv").read_bytes(), "text/csv")})
check("import SPT", r.status_code == 200, r.text[:150])
inv = client.get("/api/m/soil/investigations").json()
check("investigations list", len(inv.get("cpts", [])) == 1 and len(inv.get("boreholes", [])) == 1)
r = client.get("/api/m/soil/cpts/CPT1/processed")
check("CPT processed without gwt -> 422 (gwt required)", r.status_code == 422, r.text[:100])
cpt = client.get("/api/m/soil/investigations").json()["cpts"][0]
cpt["gwt_depth"] = 3.0
check("set CPT gwt_depth", client.put("/api/m/soil/cpts/CPT1", json=cpt).status_code == 200)
bh = client.get("/api/m/soil/investigations").json()["boreholes"][0]
bh["gwt_depth"] = 3.0
check("set BH gwt_depth", client.put("/api/m/soil/boreholes/BH1", json=bh).status_code == 200)
r = client.get("/api/m/soil/cpts/CPT1/processed")
check("CPT processed", r.status_code == 200, r.text[:100])

# --- classification
r = client.get("/api/m/soil/cpts/CPT1/sbtn")
check("SBTn CPT1", r.status_code == 200, r.text[:100])
r = client.get("/api/m/soil/classification/sbtn/reference")
check("SBTn reference", r.status_code == 200)
r = client.post("/api/m/soil/classification/uscs", json={"fines": 60, "LL": 40, "PI": 20})
check("USCS single sample", r.status_code == 200, r.text[:160])
r = client.get("/api/m/soil/boreholes/BH1/uscs")
check("USCS borehole", r.status_code == 200, r.text[:100])
r = client.post("/api/m/soil/classification/uscs", json={"fines": 500})
check("USCS invalid input -> 422", r.status_code == 422, str(r.status_code))

# --- layering -> profile
r = client.post("/api/m/soil/layering/cpt/CPT1", json={"method": "cpt_ic"})
check("CPT layering proposal", r.status_code == 200, r.text[:150])
proposal = r.json() if r.status_code == 200 else {}
r = client.post("/api/m/soil/profiles", json={"name": "CPT profile", "origin": "cpt", "source_ids": ["CPT1"],
                                              "gwt": {"depth_insitu": 3}, "from_proposal": proposal})
check("profile from proposal", r.status_code == 200, r.text[:200])
profile = r.json() if r.status_code == 200 else {}
pid = profile.get("id")
layers = profile.get("layers", [])
note(f"profile {pid}: {len(layers)} layers; first {layers[0] if layers else None}")

# --- parameters
r = client.post(f"/api/m/soil/profiles/{pid}/parameters/suggest-all")
check("suggest-all parameters", r.status_code == 200, r.text[:200])

# select + approve design parameters per layer
prof = client.get(f"/api/m/soil/profiles/{pid}").json()
for lyr in prof["layers"]:
    base = f"/api/m/soil/profiles/{pid}/layers/{lyr['id']}/parameters"
    cands = {c["parameter"]: c for c in client.get(base).json()}
    for key, manual in (("phi_eff", 32.0), ("c_eff", 0.0)):
        c = cands.get(key, {}).get("candidates", [])
        body = ({"mode": "correlation", "method_id": c[0]["method_id"]} if c
                else {"mode": "manual", "manual_value": manual})
        r = client.put(f"{base}/{key}", json=body)
        if not check(f"select {key} layer {lyr['top']}-{lyr['bottom']}", r.status_code == 200, r.text[:160]):
            r2 = client.put(f"{base}/{key}", json={"mode": "manual", "manual_value": manual})
            note(f"  manual fallback -> {r2.status_code}")
    r = client.post(f"{base}/approve", json={"keys": ["phi_eff", "c_eff"]})
    check(f"approve layer {lyr['top']}-{lyr['bottom']}", r.status_code == 200, r.text[:160])
prof = client.get(f"/api/m/soil/profiles/{pid}").json()
check("profile design values approved", all(l["design"]["phi_eff"] is not None for l in prof["layers"]),
      str([l["design"]["phi_eff"] for l in prof["layers"]]))
check("set active profile", client.put("/api/project/active-profile", json={"profile_id": pid}).status_code == 200)

# --- structures
# missing input must be reported, not silently assumed: undrained layer without s_u
r = client.post("/api/structures", json={"kind": "retaining_wall", "name": "Eksik", "wall_type": "cantilever", "height": 4})
eid = r.json().get("id")
j = job(f"/api/m/walls/structures/{eid}/size")
check("missing s_u -> job failed with clear error", j["status"] == "failed" and "s_u" in str(j.get("error")), str(j.get("error"))[:200])
note("missing-input message (raw): " + str((j.get("error") or {}).get("message")))
client.delete(f"/api/structures/{eid}")
# approve s_u on undrained layers (manual 50 kPa test value)
for lyr in client.get(f"/api/m/soil/profiles/{pid}").json()["layers"]:
    if lyr["behaviour"] == "undrained":
        base = f"/api/m/soil/profiles/{pid}/layers/{lyr['id']}/parameters"
        c = {x["parameter"]: x for x in client.get(base).json()}.get("su", {}).get("candidates", [])
        body = {"mode": "correlation", "method_id": c[0]["method_id"]} if c else {"mode": "manual", "manual_value": 50.0}
        check("select su", client.put(f"{base}/su", json=body).status_code == 200)
        check("approve su", client.post(f"{base}/approve", json={"keys": ["su"]}).status_code == 200)
r = client.post("/api/structures", json={"kind": "retaining_wall", "name": "Duvar", "wall_type": "cantilever", "height": 4})
check("create wall", r.status_code == 200, r.text[:160]); wid = r.json().get("id")
r = client.post("/api/structures", json={"kind": "sheet_pile", "name": "Palplans", "retained_height": 4})
check("create sheet pile", r.status_code == 200, r.text[:160]); sid = r.json().get("id")

# wall: suggest size, then check
r = client.post(f"/api/m/walls/structures/{wid}/required-factors")
check("wall required-factors", r.status_code == 200, r.text[:160])
j = job(f"/api/m/walls/structures/{wid}/size")
check("wall size job", j["status"] == "done", str(j)[:300])
j = job(f"/api/m/walls/structures/{wid}/check")
check("wall check job", j["status"] == "done", str(j)[:300])
w = client.get(f"/api/structures/{wid}").json()
check("wall has result", w.get("result") is not None and w.get("result_hash"), str(list((w.get("result") or {}).keys()))[:150])

# sheet pile
j = job(f"/api/m/sheet_pile/structures/{sid}/design")
check("sheet pile design job", j["status"] == "done", str(j)[:300])
sp = client.get(f"/api/structures/{sid}").json()
check("sheet pile has result", sp.get("result") is not None)

# liquefaction
LIQ = {"method": "bi2014", "amax_g": 0.4, "mw": 7.5, "target_fs": 1.1, "default_fc": 5, "c_fc": 0, "ic_cutoff": 2.6}
j = job("/api/m/liquefaction/run", json=LIQ)
check("liquefaction job", j["status"] == "done", str(j)[:300])
if j["status"] == "done":
    note("liq result keys: " + str(list((j.get("result") or {}).keys()))[:200])

# --- report docx
secs = client.get("/api/m/report/sections").json()
note("sections: " + ", ".join(f"{x['id']}={x['status']}" for x in secs))
for lang in ("tr", "en"):
    r = client.post("/api/m/report/docx", json={"language": lang})
    ok = r.status_code == 200
    check(f"report docx {lang}", ok, f"{r.status_code} {len(r.content)}B {r.headers.get('content-disposition')}" if ok else r.text[:300])
    if ok:
        f = OUT / "t10" / f"T10-rapor-{lang}.docx"
        f.write_bytes(r.content)
        import zipfile
        from docx import Document
        check(f"docx {lang} valid zip+opens", zipfile.is_zipfile(f) and len(Document(str(f)).paragraphs) > 5)

# --- cancel
r = client.post(f"/api/m/walls/structures/{wid}/check")
if r.status_code == 202:
    jid = r.json()["job_id"]
    d = client.delete(f"/api/jobs/{jid}")
    final = "running"
    for _ in range(100):
        final = client.get(f"/api/jobs/{jid}").json()["status"]
        if final != "running" and final != "queued":
            break
        time.sleep(0.1)
    check("cancel job (DELETE)", d.status_code in (200, 202, 204) and final in {"cancelled", "done"}, f"{d.status_code} final={final}")
else:
    check("cancel job submit", False, r.text[:200])
check("cancel unknown job -> 404", client.delete("/api/jobs/nope").status_code == 404)

# --- invalid inputs
check("wall height 0 -> 422", client.post("/api/structures", json={"kind": "retaining_wall", "name": "x", "wall_type": "cantilever", "height": 0}).status_code == 422)
check("pile negative height -> 422", client.post("/api/structures", json={"kind": "sheet_pile", "name": "x", "retained_height": -1}).status_code == 422)
check("liq invalid amax -> 422", client.post("/api/m/liquefaction/run", json={**LIQ, "amax_g": 9}).status_code == 422)
check("CPT bad csv -> 4xx", 400 <= client.post("/api/m/soil/import/cpt", data={"sounding_id": "BAD", "qc_unit": "MPa"},
      files={"file": ("x.csv", b"a,b\nx,y\n", "text/csv")}).status_code < 500)

# --- save / close / open round trip + stale
check("save", client.post("/api/project/save").status_code == 200)
fname = next(f["file"] for f in client.get("/api/library").json() if f["name"] == "T10 Acceptance")
check("close", client.post("/api/project/close").status_code == 200)
r = client.post(f"/api/library/{fname}/open")
check("reopen", r.status_code == 200, r.text[:120])
wr = client.get(f"/api/structures/{wid}").json()
check("wall result survives reopen", wr.get("result_hash") == w.get("result_hash"))
summ = client.get("/api/project").json()
check("not stale after reopen", not any(x["stale"] for x in summ["structures"]), str(summ["structures"])[:300])

# stale: change an approved parameter on the source profile, then resync/report
lyr = prof["layers"][0]
base = f"/api/m/soil/profiles/{pid}/layers/{lyr['id']}/parameters"
client.put(f"{base}/phi_eff", json={"mode": "manual", "manual_value": 25.0})
client.post(f"{base}/approve", json={"keys": ["phi_eff"]})
summ = client.get("/api/project").json()
note("after profile edit stale flags: " + str([(x["name"], x["stale"]) for x in summ["structures"]]))
r = client.post("/api/m/report/docx", json={"sections": [f"structure:{wid}"]})
note(f"report of (maybe) stale wall -> {r.status_code} {r.text[:200] if r.status_code != 200 else 'docx'}")
r = client.post(f"/api/structures/{wid}/soil/resync")
check("resync soil", r.status_code == 200, r.text[:160])
summ = client.get("/api/project").json()
note("after resync: " + str([(x["name"], x["stale"], x["has_result"]) for x in summ["structures"]]))
j = job(f"/api/m/walls/structures/{wid}/check")
check("rerun wall check after resync", j["status"] == "done", str(j.get("error")))
summ = client.get("/api/project").json()
check("wall no longer stale after rerun", not next(x for x in summ["structures"] if x["id"] == wid)["stale"])

print("\nFAILURES:", failures if failures else "none")
sys.exit(1 if failures else 0)
