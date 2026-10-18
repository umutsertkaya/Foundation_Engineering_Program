import { NOT_HANDLED, type MockHandler } from "../../shared/api/mock/dispatcher";
import { isMockSessionOpen } from "../../shared/api/mock/core";
import { getMockStore, notFound, validationError } from "../../shared/api/mock/store";

const PREFIX = "/m/liquefaction";
let jobSeq = 0;

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

const handle: MockHandler = (method, path, body) => {
  if (method.toUpperCase() !== "POST" || path.split("?")[0] !== `${PREFIX}/run`) return NOT_HANDLED;

  // Same error as the core mock when no project is open.
  if (!isMockSessionOpen()) {
    return {
      status: 409,
      data: { code: "no_project_open", message: "No project is open.", details: {}, missing_factors: [] },
    };
  }

  const s = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const store = getMockStore();
  if (s.profile_id == null) {
    if (!store.active_profile_id) {
      return {
        status: 409,
        data: { code: "no_soil_source", message: "No active soil profile (Mock).", details: {}, missing_factors: [] },
      };
    }
  } else if (!store.profiles.some((p) => p.id === s.profile_id)) {
    return notFound("Profile");
  }

  const bad: string[] = [];
  if (s.method !== "youd2001" && s.method !== "bi2014") bad.push("method");
  for (const key of ["amax_g", "mw", "target_fs", "c_fc", "ic_cutoff"]) {
    if (!isNum(s[key])) bad.push(key);
  }
  for (const key of ["gwt_seismic", "default_fc"]) {
    if (s[key] != null && !isNum(s[key])) bad.push(key);
  }
  if (bad.length > 0) return validationError("Invalid liquefaction settings", { fields: bad });

  jobSeq += 1;
  return { status: 202, data: { job_id: `mock-liq-${jobSeq}` } };
};

export const mock = { prefix: PREFIX, handle };
