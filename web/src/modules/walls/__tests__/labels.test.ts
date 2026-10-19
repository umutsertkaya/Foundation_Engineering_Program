import { describe, expect, it } from "vitest";
import {
  caseLabel,
  checkKeyLabel,
  criticalCheck,
  deriveGoverning,
  factorPathLabel,
  parseKvSign,
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

describe("kv sign prefix", () => {
  it("extracts the governing sign and strips the prefix", () => {
    expect(parseKvSign("kv yukarı: V tan(30) + c_a B")).toEqual({ direction: "up", text: "V tan(30) + c_a B" });
    expect(parseKvSign("kv aşağı: M_R / M_O")).toEqual({ direction: "down", text: "M_R / M_O" });
  });

  it("leaves details without a prefix alone", () => {
    expect(parseKvSign("s_u B")).toEqual({ direction: null, text: "s_u B" });
    expect(parseKvSign("a kv yukarı: b")).toEqual({ direction: null, text: "a kv yukarı: b" });
  });
});

describe("governing check", () => {
  const checks = [
    check("static", "sliding", 2.0, 1.5),
    check("seismic:TBDY-seismic", "bearing", 1.45, 1.4),
    check("seismic:TBDY-seismic", "overturning", 3.0, 1.3),
  ];

  it("picks the highest utilisation when nothing is listed (all checks pass, empty governing)", () => {
    expect(criticalCheck(checks)?.name).toBe("bearing");
    expect(deriveGoverning({ governing: "", passed: true, checks }, "check")).toEqual({
      kind: "critical",
      keys: ["seismic:TBDY-seismic:bearing"],
    });
  });

  it("highlights every failing check from the comma list", () => {
    const failing = [check("static", "sliding", 1.2, 1.5), check("seismic", "bearing", 1.0, 1.4), check("static", "bearing", 4, 3)];
    expect(
      deriveGoverning({ governing: "static:sliding, seismic:bearing", passed: false, checks: failing }, "check"),
    ).toEqual({ kind: "failing", keys: ["static:sliding", "seismic:bearing"] });
  });

  it("reports the check that last forced a wider base when sizing succeeded", () => {
    expect(
      deriveGoverning({ governing: "seismic:TBDY-seismic:bearing", passed: true, checks }, "suggest"),
    ).toEqual({ kind: "sizing", keys: ["seismic:TBDY-seismic:bearing"] });
  });

  it("handles the engine text 'minimum width'", () => {
    expect(deriveGoverning({ governing: "minimum width", passed: true, checks }, "suggest").kind).toBe("minimum_width");
    expect(deriveGoverning({ governing: "minimum width", passed: true, checks }, "check").kind).toBe("critical");
  });

  it("falls back to the worst check when the failing keys do not resolve", () => {
    const failing = [check("static", "sliding", 1.0, 1.5), check("static", "bearing", 4, 3)];
    expect(deriveGoverning({ governing: "garbage", passed: false, checks: failing }, "check")).toEqual({
      kind: "critical",
      keys: ["static:sliding"],
    });
  });

  it("returns nothing for an empty result", () => {
    expect(deriveGoverning({ governing: "", passed: true, checks: [] }, "check")).toEqual({ kind: null, keys: [] });
  });

  it("treats a failing check with undefined utilisation as the worst", () => {
    const broken = { ...check("static", "sliding", 0, 1.5), utilisation: null };
    expect(criticalCheck([check("static", "bearing", 1.4, 1.4), broken])?.name).toBe("sliding");
  });
});
