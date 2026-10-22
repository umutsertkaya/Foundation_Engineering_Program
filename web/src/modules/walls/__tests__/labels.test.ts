import { describe, expect, it } from "vitest";
import {
  caseLabel,
  checkKeyLabel,
  criticalCheck,
  deriveGoverning,
  factorPathLabel,
  stripKvPrefix,
  splitCase,
  splitCheckKey,
  type Translate,
} from "../labels";
import { check } from "./helpers";

/** Returns the default value (the raw id), i.e. a catalog without any entry. */
const rawT: Translate = (key, options) => String((options as { defaultValue?: string } | undefined)?.defaultValue ?? key);

describe("case and check keys", () => {
  it("splits global-FS and combination cases", () => {
    expect(splitCase("static")).toEqual({ state: "static", combo: null });
    expect(splitCase("seismic:TBDY-seismic")).toEqual({ state: "seismic", combo: "TBDY-seismic" });
    expect(splitCase("static:Strength I")).toEqual({ state: "static", combo: "Strength I" });
  });

  it("splits a check key on its last colon", () => {
    expect(splitCheckKey("seismic:TBDY-seismic:bearing")).toEqual({ case: "seismic:TBDY-seismic", name: "bearing" });
    expect(splitCheckKey("static:sliding")).toEqual({ case: "static", name: "sliding" });
    expect(splitCheckKey("minimum width")).toBeNull();
  });

  it("falls back to the raw id when the catalog has no entry", () => {
    expect(caseLabel("seismic:XYZ", rawT)).toBe("seismic · XYZ");
    expect(checkKeyLabel("seismic:bearing", rawT)).toBe("seismic · bearing");
    expect(factorPathLabel("ASD-static.resistance.overturning", rawT)).toBe("ASD-static › resistance › overturning");
  });

  it("returns unresolved keys unchanged", () => {
    expect(checkKeyLabel("minimum width", rawT)).toBe("minimum width");
  });
});

describe("kv prefix stripping (display only)", () => {
  it("strips the prefix for the sign given by the field", () => {
    expect(stripKvPrefix("kv yukarı: V tan(30)", "up")).toBe("V tan(30)");
    expect(stripKvPrefix("kv aşağı: M_R / M_O", "down")).toBe("M_R / M_O");
  });

  it("leaves the text alone without a sign or for a different prefix", () => {
    expect(stripKvPrefix("kv yukarı: x", null)).toBe("kv yukarı: x");
    expect(stripKvPrefix("kv yukarı: x", undefined)).toBe("kv yukarı: x");
    expect(stripKvPrefix("kv aşağı: x", "up")).toBe("kv aşağı: x");
    expect(stripKvPrefix("s_u B", "down")).toBe("s_u B");
  });
});

describe("governing check (structured fields)", () => {
  const checks = [
    check("static", "sliding", 2.0, 1.5),
    check("seismic:TBDY-seismic", "bearing", 1.45, 1.4),
    check("seismic:TBDY-seismic", "overturning", 3.0, 1.3),
  ];

  it("uses governing_check_ids for failing checks", () => {
    const failing = [check("static", "sliding", 1.2, 1.5), check("seismic", "bearing", 1.0, 1.4), check("static", "bearing", 4, 3)];
    expect(
      deriveGoverning({ passed: false, checks: failing, governing_check_ids: ["static:sliding", "seismic:bearing"] }),
    ).toEqual({ kind: "failing", keys: ["static:sliding", "seismic:bearing"] });
  });

  it("uses the id as the sizing-governing check after a passing size run", () => {
    expect(deriveGoverning({ passed: true, checks, governing_check_ids: ["seismic:TBDY-seismic:bearing"] })).toEqual({
      kind: "sizing",
      keys: ["seismic:TBDY-seismic:bearing"],
    });
  });

  it("reports minimum width without highlighting any card", () => {
    expect(deriveGoverning({ passed: true, checks, governing_check_ids: [], minimum_width_governs: true })).toEqual({
      kind: "minimum_width",
      keys: [],
    });
  });

  it("falls back to the highest utilisation only when the result names no governing check", () => {
    expect(criticalCheck(checks)?.name).toBe("bearing");
    expect(deriveGoverning({ passed: true, checks, governing_check_ids: [] })).toEqual({
      kind: "critical",
      keys: ["seismic:TBDY-seismic:bearing"],
    });
    expect(deriveGoverning({ passed: true, checks })).toMatchObject({ kind: "critical" });
  });

  it("does not parse the free-text governing field", () => {
    expect(deriveGoverning({ passed: false, checks, governing_check_ids: [], ...({ governing: "static:sliding" } as object) }).kind).toBe(
      "critical",
    );
  });

  it("ignores ids that match no check and handles an empty result", () => {
    expect(deriveGoverning({ passed: false, checks, governing_check_ids: ["nope:x"] }).kind).toBe("critical");
    expect(deriveGoverning({ passed: true, checks: [] })).toEqual({ kind: null, keys: [] });
  });

  it("treats a failing check with undefined utilisation as the worst critical check", () => {
    const broken = { ...check("static", "sliding", 0, 1.5), utilisation: null };
    expect(criticalCheck([check("static", "bearing", 1.4, 1.4), broken])?.name).toBe("sliding");
  });
});

describe("localizeCheckDetail", () => {
  it("translates the fixed engine phrases and leaves numbers and symbols alone", async () => {
    const { localizeCheckDetail } = await import("../labels");
    const map: Record<string, string> = {
      "walls.detail.bishop_centre": "Bishop dairesi merkezi",
      "walls.detail.required": "gerekli ",
    };
    const tt: Translate = (key) => map[key] ?? key;
    expect(localizeCheckDetail("Bishop circle centre (1.00, 2.00), R = 5.00 m", tt)).toBe("Bishop dairesi merkezi (1.00, 2.00), R = 5.00 m");
    expect(localizeCheckDetail("F_d = 0.9, required 1.1; M_R = 5", tt)).toBe("F_d = 0.9, gerekli 1.1; M_R = 5");
  });
});
