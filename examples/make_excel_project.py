"""Build examples/ornek_excel_proje.gtk from examples/Example.xlsx with the workbook import API.

    python examples/make_excel_project.py

The project holds what the importer reads from the workbook (CPT, SPT, lab samples, sieve, limits,
CU tests) and one soil profile made from the CPT layering with every unit weight confirmed from the
program's own suggestion (the same click an engineer makes in the layering dialog). It is a worked
example of the import, not a design basis. The groundwater depth 2.0 m below is an example input.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

from geotek.api.app import create_app
from geotek.library import AppSettings, save_settings

HERE = Path(__file__).parent
PREFIX = "/api/m/soil"
GWT = 2.0  # example input: the workbook does not carry a groundwater depth
NAME = "Örnek proje (Excel içe aktarma)"


def main() -> Path:
    work = Path(tempfile.mkdtemp())
    os.environ["GEOTEK_SETTINGS"] = str(work / "settings.json")
    save_settings(AppSettings(library_dir=work / "library", language="tr"))
    data = (HERE / "Example.xlsx").read_bytes()
    files = {"file": ("Example.xlsx", data, "application/octet-stream")}
    with TestClient(create_app()) as client:
        created = client.post("/api/library", json={"name": NAME, "engineer": "Örnek veri", "number": "ÖRNEK-01"})
        created.raise_for_status()
        plan = client.post(f"{PREFIX}/import/workbook/analyze", files=files).json()
        # Open question of the importer: accept its own suggestion for the sampler text of the sheet.
        plan["options"]["sampler_map"] = dict(plan["options"]["sampler_suggestions"])
        plan["issues"] = [i for i in plan["issues"] if i["severity"] != "blocker"]
        done = client.post(f"{PREFIX}/import/workbook/commit", data={"plan": json.dumps(plan)}, files=files)
        done.raise_for_status()
        found = client.get(f"{PREFIX}/investigations").json()
        for kind, route in (("boreholes", "boreholes"), ("cpts", "cpts")):
            for item in found[kind]:
                item["gwt_depth"] = GWT
                client.put(f"{PREFIX}/{route}/{item['id']}", json=item).raise_for_status()
        cpt_id = found["cpts"][0]["id"]
        proposal = client.post(f"{PREFIX}/layering/cpt/{cpt_id}", json={"method": "cpt_ic"})
        proposal.raise_for_status()
        proposal = proposal.json()
        for layer in proposal["layers"]:
            if layer.get("gamma_suggested") is None:
                raise SystemExit("layering gave no unit weight suggestion; cannot confirm one")
        profile = client.post(f"{PREFIX}/profiles", json={
            "name": "CPT'den tabakalama (örnek)", "origin": "cpt",
            "source_ids": [cpt_id, found["boreholes"][0]["id"]],
            "gwt": {"depth_insitu": GWT}, "from_proposal": proposal})
        profile.raise_for_status()
        client.post("/api/project/active-profile", json={"profile_id": profile.json()["id"]})
        client.post("/api/project/save").raise_for_status()
        target = HERE / "ornek_excel_proje.gtk"
        target.write_bytes(client.get(f"/api/library/{created.json()['file']}/download").content)
        layer = profile.json()["layers"][0]
        params = client.get(f"{PREFIX}/profiles/{profile.json()['id']}/layers/{layer['id']}/parameters").json()
        print("tabaka sayısı:", len(profile.json()["layers"]),
              "| ilk tabaka aday sayıları:", {p["parameter"]: len(p.get("candidates") or []) for p in params})
    return target


if __name__ == "__main__":
    print(main())
