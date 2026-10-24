import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMockStore, mockRequest, resetMockState } from "../../../shared/api/mock";
import type { LayeringProposal, ParameterSelection, SoilLayer, SoilProfile } from "../../../shared/api/types";

beforeEach(() => resetMockState());
afterEach(() => resetMockState());

const gwt = { depth_insitu: 3 };

async function proposal(kind: "cpt/CPT-M1" | "spt/SK-M1", method: string): Promise<LayeringProposal> {
  const res = await mockRequest("POST", `/m/soil/layering/${kind}`, { method });
  expect(res.status).toBe(200);
  return res.data as LayeringProposal;
}

describe("mock layering routes", () => {
  it("returns an unapproved CPT proposal with warnings in the code: key=value format", async () => {
    const p = await proposal("cpt/CPT-M1", "cpt_ic");
    expect(p.source_id).toBe("CPT-M1");
    expect(p.layers[0].top).toBe(0);
    expect(p.layers.every((l) => l.gamma_suggested !== null)).toBe(true);
    expect(p.warnings.every((w) => /^layering\.warning\.[a-z_]+/.test(w))).toBe(true);
  });

  it("SPT proposals suggest a unit weight for granular layers only; a method that does not fit the source is a 422", async () => {
    const store = getMockStore();
    store.boreholes[0] = { ...store.boreholes[0], log: [
      { top: 0, bottom: 2.5, uscs: "SM", description: "silty sand" },
      { top: 2.5, bottom: 10, uscs: "CL", description: "clay" },
    ] };
    const p = await proposal("spt/SK-M1", "spt_log");
    expect(p.layers.map((l) => l.gamma_suggested)).toEqual([18.5, null]);
    expect(p.layers[0].gamma_source).toBe("spt_bowles");
    expect(p.layers[0].gamma_range).toEqual([17, 20]);
    expect((await mockRequest("POST", "/m/soil/layering/spt/SK-M1", { method: "cpt_ic" })).status).toBe(422);
    expect((await mockRequest("POST", "/m/soil/layering/cpt/CPT-M1", { method: "cpt_ic", min_thickness: 0 })).status).toBe(422);
    expect((await mockRequest("POST", "/m/soil/layering/cpt/nope", { method: "cpt_ic" })).status).toBe(404);
  });

  it("creates a profile from a proposal: settings kept, nothing approved; refuses missing unit weights", async () => {
    const cpt = await proposal("cpt/CPT-M1", "cpt_ic");
    const ok = await mockRequest("POST", "/m/soil/profiles", { name: "P", origin: "cpt", source_ids: ["CPT-M1"], gwt, from_proposal: cpt });
    expect(ok.status).toBe(200);
    const profile = ok.data as SoilProfile;
    expect(profile.layering?.method).toBe("cpt_ic");
    expect(profile.layers).toHaveLength(cpt.layers.length);
    expect(profile.layers.every((l) => l.selections === undefined)).toBe(true);

    const store = getMockStore();
    store.boreholes[0] = { ...store.boreholes[0], log: [{ top: 0, bottom: 10, uscs: "CL", description: "clay" }] };
    const spt = await proposal("spt/SK-M1", "spt_log");
    const bad = await mockRequest("POST", "/m/soil/profiles", { name: "P", origin: "spt", source_ids: ["SK-M1"], gwt, from_proposal: spt });
    expect(bad.status).toBe(422);
    const wrongSource = await mockRequest("POST", "/m/soil/profiles", { name: "P", origin: "cpt", source_ids: ["other"], gwt, from_proposal: cpt });
    expect(wrongSource.status).toBe(422);
  });
});

describe("mock parameter routes", () => {
  const base = "/m/soil/profiles/prof-mock-2/layers/S1/parameters";
  const list = async () => (await mockRequest("GET", base)).data as ParameterSelection[];

  it("lists one selection per design key with candidates and a suggestion", async () => {
    const all = await list();
    expect(all.map((s) => s.parameter)).toEqual(["phi_eff", "c_eff", "su", "E", "gamma", "gamma_sat", "delta_base"]);
    const phi = all[0];
    expect(phi.candidates?.length).toBeGreaterThan(1);
    expect(phi.suggested).toBeTruthy();
    expect(phi.approved).toBe(false);
  });

  it("PUT resolves a selection without approving; approve then writes the design value", async () => {
    const put = await mockRequest("PUT", `${base}/phi_eff`, { mode: "correlation", method_id: "mock_phi_eff_b" });
    expect(put.status).toBe(200);
    const sel = put.data as ParameterSelection;
    expect(sel.selected?.method_id).toBe("mock_phi_eff_b");
    expect(sel.approved).toBe(false);

    const approved = await mockRequest("POST", `${base}/approve`, { keys: ["phi_eff"] });
    expect(approved.status).toBe(200);
    const layer = approved.data as SoilLayer;
    expect(layer.design?.phi_eff).toBe(sel.selected?.value);
    expect(layer.selections?.phi_eff.approved).toBe(true);
    expect((await list())[0].approved).toBe(true);
  });

  it("statistic mode needs k_sd for mean-k*SD and ignores invalid candidates", async () => {
    const noK = await mockRequest("PUT", `${base}/phi_eff`, { mode: "statistic", statistic: "mean_minus_k_sd" });
    expect(noK.status).toBe(422);
    const max = (await mockRequest("PUT", `${base}/phi_eff`, { mode: "statistic", statistic: "max" })).data as ParameterSelection;
    const valid = (await list())[0].candidates!.filter((c) => c.validity_ok !== false).map((c) => c.value);
    expect(max.selected?.value).toBe(Math.max(...valid));
  });

  it("approving without a selection is a 422; a manual value approves as user input", async () => {
    expect((await mockRequest("POST", `${base}/approve`, { keys: ["su"] })).status).toBe(422);
    expect((await mockRequest("PUT", `${base}/su`, { mode: "manual" })).status).toBe(422);
    await mockRequest("PUT", `${base}/su`, { mode: "manual", manual_value: 55 });
    const layer = (await mockRequest("POST", `${base}/approve`, { keys: ["su"] })).data as SoilLayer;
    expect(layer.design?.su).toBe(55);
    expect(layer.selections?.su.selected?.source).toBe("user");
  });

  it("an approval goes stale (trace kept) when the layer bounds change, and re-selecting revokes it", async () => {
    await mockRequest("PUT", `${base}/phi_eff`, { mode: "correlation", method_id: "mock_phi_eff_a" });
    await mockRequest("POST", `${base}/approve`, { keys: ["phi_eff"] });
    const profile = (await mockRequest("GET", "/m/soil/profiles/prof-mock-2")).data as SoilProfile;
    profile.layers[0].bottom = 1.8;
    profile.layers[1].top = 1.8;
    expect((await mockRequest("PUT", "/m/soil/profiles/prof-mock-2", profile)).status).toBe(200);
    const phi = (await list())[0];
    expect(phi.approved).toBe(false);
    expect(phi.approved_at).toBeTruthy();
    expect(phi.basis_hash).toBeTruthy();
    const revoked = (await mockRequest("PUT", `${base}/phi_eff`, { mode: "correlation", method_id: "mock_phi_eff_a" })).data as ParameterSelection;
    expect(revoked.approved_at).toBeNull();
  });

  it("approve re-resolves the stored choice against fresh candidates, like the backend", async () => {
    const layerPath = "/m/soil/profiles/prof-mock-1/layers/L2/parameters";
    const at = async () => (await mockRequest("GET", layerPath)).data as ParameterSelection[];
    const put = (await mockRequest("PUT", `${layerPath}/phi_eff`, { mode: "correlation", method_id: "mock_phi_eff_a" })).data as ParameterSelection;
    const profile = (await mockRequest("GET", "/m/soil/profiles/prof-mock-1")).data as SoilProfile;
    profile.layers[0].bottom = 1.2;
    profile.layers[1].top = 1.2; // changes the (demo) candidates of L2
    await mockRequest("PUT", "/m/soil/profiles/prof-mock-1", profile);
    const fresh = (await at())[0];
    const freshA = fresh.candidates!.find((c) => c.method_id === "mock_phi_eff_a")!.value;
    expect(freshA).not.toBe(put.selected?.value);
    expect(fresh.selected?.value).toBe(put.selected?.value); // the GET still shows the old resolved value
    const layer = (await mockRequest("POST", `${layerPath}/approve`, { keys: ["phi_eff"] })).data as SoilLayer;
    expect(layer.design?.phi_eff).toBe(freshA); // ...but the server approves the fresh one
  });

  it("does not derive a saturated unit weight: no gamma_sat candidate when the layer has none", async () => {
    const profile = (await mockRequest("GET", "/m/soil/profiles/prof-mock-1")).data as SoilProfile;
    delete profile.layers[1].gamma_sat;
    await mockRequest("PUT", "/m/soil/profiles/prof-mock-1", profile);
    const all = (await mockRequest("GET", "/m/soil/profiles/prof-mock-1/layers/L2/parameters")).data as ParameterSelection[];
    const gammaSat = all.find((s) => s.parameter === "gamma_sat")!;
    expect(gammaSat.candidates).toEqual([]);
    expect(gammaSat.suggested).toBeNull();
  });

  it("suggest-all fills suggestions on every layer and approves nothing", async () => {
    const res = await mockRequest("POST", "/m/soil/profiles/prof-mock-2/parameters/suggest-all");
    expect(res.status).toBe(200);
    const profile = res.data as SoilProfile;
    for (const layer of profile.layers) {
      expect(Object.keys(layer.selections ?? {})).toHaveLength(7);
    }
    const approvedKeys = profile.layers.flatMap((l) => Object.values(l.selections ?? {}).filter((s) => s.approved));
    expect(approvedKeys).toHaveLength(0);
  });

  it("serves processed CPT and SPT chart data", async () => {
    const cpt = (await mockRequest("GET", "/m/soil/cpts/CPT-M1/processed")).data as { depth: number[]; Ic: number[] };
    expect(cpt.Ic).toHaveLength(cpt.depth.length);
    const spt = (await mockRequest("GET", "/m/soil/boreholes/SK-M1/processed")).data as { N60: number[] };
    expect(spt.N60.length).toBeGreaterThan(0);
    expect((await mockRequest("GET", "/m/soil/cpts/nope/processed")).status).toBe(404);
  });
});
