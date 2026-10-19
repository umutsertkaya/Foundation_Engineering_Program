import { describe, expect, it } from "vitest";
import type { DerivedParameter, ParameterSelection } from "../../../shared/api/types";
import { approvalState, buildUpdate, draftFromSelection, formatValue, isDirty, previewValue, readiness } from "../parameterState";

const cand = (method_id: string, value: number, extra: Partial<DerivedParameter> = {}): DerivedParameter => ({
  value,
  unit: "deg",
  method_id,
  source: "SPT",
  validity_ok: true,
  ...extra,
});

const base = (extra: Partial<ParameterSelection> = {}): ParameterSelection => ({
  parameter: "phi_eff",
  candidates: [cand("a", 30), cand("b", 33), cand("bad", 40, { validity_ok: false })],
  suggested: cand("sug", 31),
  mode: null,
  approved: false,
  ...extra,
});

describe("approvalState", () => {
  it("approved / stale (approval trace kept) / unapproved", () => {
    expect(approvalState(base({ approved: true, approved_at: "2026-10-01T00:00:00Z" }))).toBe("approved");
    expect(approvalState(base({ approved: false, approved_at: "2026-10-01T00:00:00Z", basis_hash: "x" }))).toBe("stale");
    expect(approvalState(base())).toBe("unapproved");
  });
});

describe("draft and update mapping", () => {
  it("'suggested' is the correlation mode with the suggestion's method id", () => {
    const sel = base({ mode: "correlation", method_id: "sug" });
    expect(draftFromSelection(sel).pick).toBe("suggested");
    expect(buildUpdate(draftFromSelection(sel), sel)).toEqual({ mode: "correlation", method_id: "sug" });
    const other = base({ mode: "correlation", method_id: "b" });
    expect(draftFromSelection(other)).toMatchObject({ pick: "method", method_id: "b" });
  });

  it("never defaults k_sd: the update is null until a non-negative value is entered", () => {
    const sel = base();
    const draft = { ...draftFromSelection(sel), pick: "statistic" as const, statistic: "mean_minus_k_sd" as const };
    expect(buildUpdate(draft, sel)).toBeNull();
    expect(buildUpdate({ ...draft, k_sd: -1 }, sel)).toBeNull();
    expect(buildUpdate({ ...draft, k_sd: 0 }, sel)).toEqual({ mode: "statistic", statistic: "mean_minus_k_sd", k_sd: 0 });
    expect(buildUpdate({ ...draft, statistic: "median" }, sel)).toEqual({ mode: "statistic", statistic: "median" });
  });

  it("statistic needs at least one valid candidate", () => {
    const sel = base({ candidates: [cand("bad", 40, { validity_ok: false })] });
    expect(buildUpdate({ ...draftFromSelection(sel), pick: "statistic" }, sel)).toBeNull();
  });

  it("manual needs a finite value; no pick means no update", () => {
    const sel = base();
    const draft = draftFromSelection(sel);
    expect(buildUpdate(draft, sel)).toBeNull();
    expect(buildUpdate({ ...draft, pick: "manual" }, sel)).toBeNull();
    expect(buildUpdate({ ...draft, pick: "manual", manual_value: 28.5 }, sel)).toEqual({ mode: "manual", manual_value: 28.5 });
  });

  it("isDirty compares against the stored selection", () => {
    const sel = base({ mode: "manual", manual_value: 30 });
    const draft = draftFromSelection(sel);
    expect(isDirty(draft, sel)).toBe(false);
    expect(isDirty({ ...draft, manual_value: 31 }, sel)).toBe(true);
    expect(isDirty({ ...draft, pick: "suggested" }, sel)).toBe(true);
    expect(isDirty(draftFromSelection(base()), base())).toBe(false);
  });

  it("formatValue trims noise and handles missing values", () => {
    expect(formatValue(30.000001)).toBe("30");
    expect(formatValue(null)).toBe("-");
    expect(formatValue(Number.NaN)).toBe("-");
  });
});

describe("previewValue and readiness (the value the server would approve)", () => {
  const sel = (extra: Partial<ParameterSelection>): ParameterSelection =>
    base({ selected: cand("x", 0), ...extra });

  it("re-resolves every mode on the returned candidates (valid ones only, population SD)", () => {
    expect(previewValue(sel({ mode: "correlation", method_id: "b" }))).toBe(33);
    expect(previewValue(sel({ mode: "correlation", method_id: "sug" }))).toBe(31);
    expect(previewValue(sel({ mode: "correlation", method_id: "gone" }))).toBeNull();
    expect(previewValue(sel({ mode: "manual", manual_value: 28 }))).toBe(28);
    expect(previewValue(sel({ mode: "statistic", statistic: "mean" }))).toBe(31.5); // 40 is invalid
    expect(previewValue(sel({ mode: "statistic", statistic: "median" }))).toBe(31.5);
    expect(previewValue(sel({ mode: "statistic", statistic: "min" }))).toBe(30);
    expect(previewValue(sel({ mode: "statistic", statistic: "max" }))).toBe(33);
    expect(previewValue(sel({ mode: "statistic", statistic: "mean_minus_k_sd", k_sd: 2 }))).toBe(31.5 - 2 * 1.5);
    expect(previewValue(sel({ mode: "statistic", statistic: "mean_minus_k_sd" }))).toBeNull();
  });

  it("ready only when the stored value equals the preview; stale and outdated need a re-apply", () => {
    const ready = sel({ mode: "correlation", method_id: "b", selected: cand("b", 33) });
    expect(readiness(ready)).toBe("ready");
    expect(readiness({ ...ready, selected: cand("b", 32) })).toBe("outdated"); // candidates moved on
    expect(readiness({ ...ready, approved_at: "2026-10-01T00:00:00Z", basis_hash: "h" })).toBe("stale");
    expect(readiness(base({ mode: null }))).toBe("no_selection");
    expect(readiness({ ...ready, approved: true, approved_at: "2026-10-01T00:00:00Z" })).toBe("approved");
  });
});
