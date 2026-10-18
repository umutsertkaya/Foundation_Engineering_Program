import {
  getMockStore,
  notFound,
  notifyMockMutation,
  toProfileSummary,
  validationError,
} from "../../shared/api/mock/legacy";
import { MOCK_PROFILES } from "../../shared/api/mock/data";
import { NOT_HANDLED, type MockHandler } from "../../shared/api/mock/dispatcher";
import { validateGwt, validateLayers } from "../../shared/soil/layerOps";
import type { DeletionResponse, SoilProfile } from "../../shared/api/types";
import type { InvestigationsDTO, ProfileCreate } from "./types";

const PREFIX = "/m/soil";

type Reply = { status: number; data: unknown };

function handleSoil(method: string, path: string, body: unknown): Reply | typeof NOT_HANDLED {
  const store = getMockStore();
  const cleanPath = path.split("?")[0].slice(PREFIX.length);
  const upperMethod = method.toUpperCase();

  // GET /investigations
  if (upperMethod === "GET" && cleanPath === "/investigations") {
    const res: InvestigationsDTO = {
      boreholes: structuredClone(store.boreholes),
      cpts: structuredClone(store.cpts),
    };
    return { status: 200, data: res };
  }

  // GET /profiles
  if (upperMethod === "GET" && cleanPath === "/profiles") {
    return { status: 200, data: store.profiles.map(toProfileSummary) };
  }

  // POST /profiles
  if (upperMethod === "POST" && cleanPath === "/profiles") {
    const payload = body as ProfileCreate;
    const layers = structuredClone(payload.layers ?? MOCK_PROFILES[0].layers);
    const issues = [...validateLayers(layers, { mustStartAtZero: true }), ...validateGwt(payload.gwt)];
    if (issues.length > 0) {
      return validationError("Invalid soil profile", { issues });
    }
    let seq = store.profileSeq + 1;
    while (store.profiles.some((p) => p.id === `prof-mock-${seq}`)) seq += 1;
    store.profileSeq = seq;
    const newProfile: SoilProfile = {
      id: `prof-mock-${seq}`,
      name: payload.name,
      origin: payload.origin,
      source_ids: [...payload.source_ids],
      layering: null,
      gwt: { ...payload.gwt },
      layers,
    };
    store.profiles.push(newProfile);
    return { status: 200, data: structuredClone(newProfile) };
  }

  // GET / PUT / DELETE /profiles/{id}
  const profileMatch = /^\/profiles\/([^/]+)$/.exec(cleanPath);
  if (profileMatch) {
    const profileId = decodeURIComponent(profileMatch[1]);
    const index = store.profiles.findIndex((p) => p.id === profileId);
    if (index < 0) return notFound("Profile");
    if (upperMethod === "GET") {
      return { status: 200, data: structuredClone(store.profiles[index]) };
    }
    if (upperMethod === "PUT") {
      const updated = structuredClone(body as SoilProfile);
      const issues = [...validateLayers(updated.layers ?? [], { mustStartAtZero: true }), ...validateGwt(updated.gwt)];
      if (issues.length > 0) {
        return validationError("Invalid soil profile", { issues });
      }
      updated.id = profileId;
      store.profiles[index] = updated;
      return { status: 200, data: structuredClone(updated) };
    }
    if (upperMethod === "DELETE") {
      store.profiles.splice(index, 1);
      if (store.active_profile_id === profileId) store.active_profile_id = store.profiles[0]?.id ?? null;
      const res: DeletionResponse = { id: profileId, deleted: true };
      return { status: 200, data: res };
    }
  }

  return NOT_HANDLED;
}

const handle: MockHandler = (method, path, body) => {
  const result = handleSoil(method, path, body);
  if (result === NOT_HANDLED) return NOT_HANDLED;
  const legacyPath = path.split("?")[0].slice(PREFIX.length);
  if (
    result.status < 400
    && ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())
    && /^\/profiles(\/|$)/.test(legacyPath)
  ) {
    // Same edit tracking the legacy mock did for /profiles routes (read-only POSTs never dirty the project).
    notifyMockMutation(legacyPath);
  }
  return result;
};

export const mock = { prefix: PREFIX, handle };
