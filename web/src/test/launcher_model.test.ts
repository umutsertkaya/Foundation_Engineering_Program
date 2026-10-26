import { describe, expect, it } from "vitest";
import { groupOfModule, moduleStatus, nextStep } from "../app/launcherModel";
import type { ProjectSummary, StructureSummary } from "../shared/api/types";

function project(counts: Partial<ProjectSummary["counts"]>, structures: StructureSummary[] = []): ProjectSummary {
  return {
    meta: { name: "P" },
    site: {},
    counts: { boreholes: 0, cpts: 0, profiles: 0, structures: structures.length, ...counts },
    active_profile_id: null,
    structures,
  };
}

const wall = (over: Partial<StructureSummary> = {}): StructureSummary => ({
  id: "w1", name: "RW-1", kind: "retaining_wall", wall_type: null, stale: false, has_result: true, ...over,
});

describe("launcher grouping", () => {
  it("maps known modules and falls back to analyses", () => {
    expect(groupOfModule("soil")).toBe("soil");
    expect(groupOfModule("walls")).toBe("analysis");
    expect(groupOfModule("report")).toBe("output");
    expect(groupOfModule("education")).toBe("output");
    expect(groupOfModule("something_new")).toBe("analysis");
  });
});

describe("launcher status lines", () => {
  it("reports soil counts and flags a missing profile", () => {
    const status = moduleStatus("soil", project({ boreholes: 2, cpts: 1, profiles: 0 }));
    expect(status.parts[0]).toEqual({ key: "launcher.status.soil_counts", values: { boreholes: 2, cpts: 1, profiles: 0 } });
    expect(status.tone).toBe("missing");
    expect(moduleStatus("soil", project({ profiles: 1 })).chip).toBeUndefined();
  });

  it("derives wall results from the structure summaries only", () => {
    expect(moduleStatus("walls", project({}, [])).parts[0].key).toBe("launcher.status.none");
    const stale = moduleStatus("walls", project({}, [wall(), wall({ id: "w2", stale: true })]));
    expect(stale.tone).toBe("stale");
    expect(stale.parts.map((part) => part.key)).toContain("launcher.status.results_stale");
    expect(moduleStatus("walls", project({}, [wall()])).tone).toBe("current");
    expect(moduleStatus("sheet_pile", project({}, [wall()])).parts[0].key).toBe("launcher.status.none");
  });

  it("falls back to a neutral profile count for modules without readable state", () => {
    expect(moduleStatus("liquefaction", project({ profiles: 2 })).parts[0].values).toEqual({ count: 2 });
    expect(moduleStatus("anchored_wall", project({})).tone).toBe("missing");
  });
});

describe("next step", () => {
  it("asks for a profile first, then for stale results, otherwise nothing", () => {
    expect(nextStep(null)).toBeNull();
    expect(nextStep(project({}))?.textKey).toBe("launcher.next.profile.text_no_data");
    expect(nextStep(project({ boreholes: 1 }))?.textKey).toBe("launcher.next.profile.text");
    expect(nextStep(project({ profiles: 1 }, [wall({ stale: true })]))).toMatchObject({ kind: "rerun", moduleId: "walls" });
    expect(nextStep(project({ profiles: 1 }, [wall()]))).toBeNull();
  });
});
