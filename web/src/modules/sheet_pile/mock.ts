import { NOT_HANDLED, type MockHandler } from "../../shared/api/mock/dispatcher";
import { isMockSessionOpen } from "../../shared/api/mock/core";
import { getMockStore, notFound } from "../../shared/api/mock/store";
import type { SheetPileResultDTO, SheetPileStructure } from "../../shared/api/types";

const PREFIX = "/m/sheet_pile";
let jobSeq = 0;

/** Synthetic values on the real DTO shape; NOT a calculation (flagged by a warning key). */
function syntheticResult(s: SheetPileStructure): SheetPileResultDTO {
  const H = s.retained_height;
  const anchored = (s.support ?? "cantilever") === "anchored";
  const D = 5;
  const z = [0, H / 2, H, H + D / 2, H + D];
  return {
    structure_id: s.id,
    support: s.support ?? "cantilever",
    H,
    D0: 4,
    D,
    total_length: H + D,
    anchor_depth: anchored ? (s.anchor_depth ?? null) : null,
    anchor_force: anchored ? 100 : null,
    toe_force: 50,
    M_max: 200,
    z_M_max: H,
    z,
    shear: [0, 40, 0, -30, 0],
    moment: [0, 120, 200, 80, 0],
    net: [0, 10, 30, -20, 0],
    section_modulus_cm3: s.allowable_stress_mpa ? (200 / s.allowable_stress_mpa) * 1000 : null,
    assumptions: [{ text: "Mock result (not a calculation)", source: "mock" }],
    warnings: ["mock_result_not_a_calculation"],
  };
}

const handle: MockHandler = (method, path) => {
  const match = /^\/m\/sheet_pile\/structures\/([^/]+)\/design$/.exec(path.split("?")[0]);
  if (method.toUpperCase() !== "POST" || !match) return NOT_HANDLED;
  if (!isMockSessionOpen()) {
    return {
      status: 409,
      data: { code: "no_project_open", message: "No project is open.", details: {}, missing_factors: [] },
    };
  }
  const id = decodeURIComponent(match[1]);
  const store = getMockStore();
  const s = store.structures.find((x) => x.id === id && x.kind === "sheet_pile") as SheetPileStructure | undefined;
  if (!s) return notFound("Structure");

  jobSeq += 1;
  const job_id = `mock-sp-${jobSeq}`;
  store.jobs.set(job_id, {
    job_id,
    kind: "sheet_pile",
    structure_id: id,
    startedAt: Date.now(),
    polls: 0,
    cancelled: false,
    result: syntheticResult(s),
    stepKeys: ["job.step.static_checks", "job.step.sizing"],
  });
  return { status: 202, data: { job_id } };
};

export const mock = { prefix: PREFIX, handle };
