import { describe, expect, it } from "vitest";
import { DEFAULT_INPUTS, DEFAULT_SOIL, missingInputs, toCreatePayload, type PileInputs, type SoilSource } from "../inputs";

const base = (patch: Partial<PileInputs> = {}): PileInputs => ({ ...DEFAULT_INPUTS, name: "Wall", retained_height: 4, surcharge: 0, ...patch });
const soil = (layers = [{ top: 0, bottom: 12, gamma: 18, phi: 30, c: 0 }]): SoilSource => ({ ...DEFAULT_SOIL, mode: "manual", gwt: 0, layers });
const issues = (inputs: PileInputs, s: SoilSource = soil()) => missingInputs(inputs, s);

describe("sheet pile client range validation", () => {
  it("enforces retained height and anchor boundaries", () => {
    expect(issues(base({ retained_height: 0.5 }))).toContain("range:retained_height");
    expect(issues(base({ retained_height: 12 }))).not.toContain("range:retained_height");
    expect(issues(base({ retained_height: 12.1 }))).toContain("range:retained_height");
    expect(issues(base({ support: "anchored", anchor_depth: 4 }))).toContain("range:anchor_depth");
  });
  it("enforces optional load, seismic and stress boundaries", () => {
    expect(issues(base({ sds: 0 }))).toContain("range:sds");
    expect(issues(base({ sds: 3 }))).toContain("range:sds");
    expect(issues(base({ allowable_stress_mpa: 0 }))).toContain("range:allowable_stress_mpa");
    expect(issues(base({ surcharge: -1 }))).toContain("range:surcharge");
  });
  it("validates advanced ranges and preserves service-default sentinels in create payload", () => {
    expect(issues(base({ depth_increase: -0.01 }))).toContain("range:depth_increase");
    expect(issues(base({ support: "anchored", anchor_depth: 1, anchor_spacing: 0 }))).toContain("range:anchor_spacing");
    expect(issues(base({ support: "anchored", anchor_depth: 1, anchor_inclination: 90 }))).toContain("range:anchor_inclination");
    expect(issues(base({ front_water_depth: -1 }))).toContain("range:front_water_depth");
    const payload = toCreatePayload(base(), { ...DEFAULT_SOIL, profile_id: "profile-1" });
    expect(payload).toMatchObject({ design_code: "asd", approach: null, analysis_level: "basic", depth_increase: null, anchor_spacing: null, anchor_inclination: null, front_water_depth: null });
  });
  it("enforces manual soil bounds and contiguous layers", () => {
    expect(issues(base(), soil([{ top: 0, bottom: 12, gamma: 5, phi: 30, c: 0 }]))).toContain("range:layer_0_gamma");
    expect(issues(base(), soil([{ top: 0, bottom: 12, gamma: 30, phi: 30, c: 0 }]))).toContain("range:layer_0_gamma");
    expect(issues(base(), soil([{ top: 0, bottom: 5, gamma: 18, phi: 30, c: 0 }, { top: 5.01, bottom: 12, gamma: 18, phi: 30, c: 0 }]))).toContain("range:layer_1_geometry");
  });
});
