import { describe, expect, it } from "vitest";
import {
  ANALYSIS_DEFAULTS,
  applyOptions,
  formatPermeability,
  layerPermeability,
  layersWithoutPermeability,
  optionsFromSettings,
  parsePermeability,
  withPermeability,
} from "../settings";
import { layer, soilModel } from "./helpers";

describe("analysis options <-> WallSettings", () => {
  it("uses the model defaults when the structure has no settings", () => {
    expect(optionsFromSettings(undefined)).toEqual(ANALYSIS_DEFAULTS);
    expect(ANALYSIS_DEFAULTS).toMatchObject({
      kv_sign: "envelope",
      submerged_seismic: "envelope",
      uplift_moment: "overturning",
      gwt_bearing_correction: true,
      use_passive: false,
      passive_reduction: 0.5,
    });
  });

  it("reads stored values and writes back without touching other settings", () => {
    const stored = { design_code: "ec7", kv_sign: "up" as const, passive_reduction: 0.3, concrete_unit_weight: 25 };
    const options = optionsFromSettings(stored);
    expect(options.kv_sign).toBe("up");
    expect(options.passive_reduction).toBe(0.3);
    expect(options.submerged_seismic).toBe("envelope");
    const out = applyOptions(stored, { ...options, uplift_moment: "resisting" });
    expect(out).toMatchObject({ design_code: "ec7", concrete_unit_weight: 25, uplift_moment: "resisting", kv_sign: "up" });
  });
});

describe("permeability k", () => {
  it("parses scientific notation, comma decimals and empty input", () => {
    expect(parsePermeability("1e-5")).toEqual({ ok: true, value: 1e-5 });
    expect(parsePermeability(" 2,5E-4 ")).toEqual({ ok: true, value: 2.5e-4 });
    expect(parsePermeability("0.001")).toEqual({ ok: true, value: 0.001 });
    expect(parsePermeability("")).toEqual({ ok: true, value: null });
  });

  it("rejects non-positive and non-numeric input (backend: gt=0)", () => {
    for (const bad of ["0", "-1e-5", "abc", "1e", "1e-5x", "Infinity", "1 000"]) {
      expect(parsePermeability(bad), bad).toEqual({ ok: false });
    }
  });

  it("formats with the shortest exponent form", () => {
    expect(formatPermeability(1e-5)).toBe("1e-5");
    expect(formatPermeability(2.35e-5)).toBe("2.35e-5");
    expect(formatPermeability(null)).toBe("");
  });

  it("keeps other layer fields when setting k", () => {
    const l = withPermeability(layer("L1", 0, 2, { description: "x" }), 3e-6);
    expect(layerPermeability(l)).toBe(3e-6);
    expect(l.description).toBe("x");
    expect(layerPermeability(withPermeability(l, null))).toBeNull();
  });
});

describe("layers without k (conservative hint)", () => {
  it("lists every retained-side layer without k: fill first, then the profile below the fill", () => {
    const soil = soilModel({
      gwt: 1.5,
      fill: [layer("F1", 0, 1), withPermeability(layer("F2", 1, 3), 1e-6)],
      layers: [layer("L1", 0, 4), layer("L2", 4, 12)],
    });
    // retained side = F1, F2, then L1 (below the fill) and L2: no water-table or height logic is reimplemented
    expect(layersWithoutPermeability(soil)).toEqual(["F1", "L1", "L2"]);
  });

  it("is empty when every layer has k or there is no soil", () => {
    const all = soilModel({ layers: [withPermeability(layer("L1", 0, 4), 1e-5), withPermeability(layer("L2", 4, 12), 1e-7)] });
    expect(layersWithoutPermeability(all)).toEqual([]);
    expect(layersWithoutPermeability(null)).toEqual([]);
  });
});
