import type {
  ActiveProfileUpdate,
  ApiErrorDTO,
  DeletionResponse,
  HealthResponse,
  JobState,
  Language,
  ProjectMetaPatch,
  ProjectNew,
  ProjectSummary,
  RetainingWallStructure,
  SheetPileResultDTO,
  SheetPileStructure,
  SiteSeismic,
  Structure,
  StructureCreate,
  StructureSoilModel,
  StructureSummary,
  WallResultDTO,
} from "../types";
import { validateGwt, validateStructureSoil } from "../../soil/layerOps";
import { mockProfileHash } from "./hash";
import { MOCK_CANTILEVER_5M, MOCK_DESIGN_CODES, MOCK_INITIAL_STRUCTURES } from "./data";
import { NOT_HANDLED, type MockHandler } from "./dispatcher";
import {
  getMockCatalog,
  getMockStore,
  notFound,
  notifyMockMutation,
  resetMockState,
  validationError,
} from "./store";

function isStructureStale(s: Structure): boolean {
  const sourceStale = Boolean(s.soil.source_profile_id && (() => {
    const source = getMockStore().profiles.find((p) => p.id === s.soil.source_profile_id);
    return !source || mockProfileHash(source) !== s.soil.source_hash;
  })());
  if ((s.kind ?? "retaining_wall") === "sheet_pile") {
    const pile = s as SheetPileStructure & { mock_result_snapshot?: string };
    return sourceStale || Boolean(pile.result_hash && pile.mock_result_snapshot !== JSON.stringify({ ...pile, result_hash: undefined, mock_result_snapshot: undefined }));
  }
  return sourceStale;
}

function structureBaseDepth(s: Structure): number {
  return (s.kind ?? "retaining_wall") === "retaining_wall"
    ? (s as RetainingWallStructure).height
    : (s as SheetPileStructure).retained_height;
}

function toStructureSummary(s: Structure): StructureSummary {
  const isWall = (s.kind ?? "retaining_wall") === "retaining_wall";
  const wall = isWall ? (s as RetainingWallStructure) : null;
  const stale = isStructureStale(s);
  return {
    id: s.id,
    name: s.name ?? s.id,
    kind: (s.kind ?? "retaining_wall") as "retaining_wall" | "sheet_pile",
    wall_type: wall ? wall.wall_type : null,
    stale,
    has_result: Boolean(s.result_hash),
  };
}

function buildProjectSummary(): ProjectSummary {
  const store = getMockStore();
  return {
    meta: { ...store.meta },
    site: { ...store.site },
    counts: {
      boreholes: store.boreholes.length,
      cpts: store.cpts.length,
      profiles: store.profiles.length,
      structures: store.structures.length,
    },
    active_profile_id: store.active_profile_id,
    structures: store.structures.map(toStructureSummary),
  };
}

const WALL_STEP_KEYS: [string, string] = ["job.step.earth_pressure", "job.step.stability_checks"];

function pollJobState(jobId: string): { status: number; data: JobState | ApiErrorDTO } {
  const store = getMockStore();
  const job = store.jobs.get(jobId);
  if (!job) {
    return {
      status: 404,
      data: {
        code: "not_found",
        message: `Job '${jobId}' not found (Mock).`,
        details: { job_id: jobId },
        missing_factors: [],
      },
    };
  }

  if (job.cancelled) {
    return {
      status: 200,
      data: {
        job_id: job.job_id,
        kind: job.kind,
        status: "cancelled",
        progress: 0,
        message_key: null,
        result: null,
        error: null,
      },
    };
  }

  job.polls += 1;
  const elapsedMs = Date.now() - job.startedAt;

  // Transition queued -> running -> done over ~1.5 s (or across 4 polls in fast unit tests)
  if (elapsedMs < 350 && job.polls === 1) {
    return {
      status: 200,
      data: {
        job_id: job.job_id,
        kind: job.kind,
        status: "queued",
        progress: 0.1,
        message_key: "job.step.queued",
        result: null,
        error: null,
      },
    };
  }

  if (elapsedMs < 900 && job.polls <= 2) {
    return {
      status: 200,
      data: {
        job_id: job.job_id,
        kind: job.kind,
        status: "running",
        progress: 0.45,
        message_key: (job.stepKeys ?? WALL_STEP_KEYS)[0],
        result: null,
        error: null,
      },
    };
  }

  if (elapsedMs < 1450 && job.polls <= 3) {
    return {
      status: 200,
      data: {
        job_id: job.job_id,
        kind: job.kind,
        status: "running",
        progress: 0.8,
        message_key: (job.stepKeys ?? WALL_STEP_KEYS)[1],
        result: null,
        error: null,
      },
    };
  }

  if (job.error) {
    return {
      status: 200,
      data: {
        job_id: job.job_id,
        kind: job.kind,
        status: "failed",
        progress: 0.8,
        message_key: null,
        result: null,
        error: job.error,
      },
    };
  }

  // Done: update geometry and record the result snapshot used by mock summaries.
  const target = job.structure_id ? store.structures.find((s) => s.id === job.structure_id) : undefined;
  if (target && (target.kind ?? "retaining_wall") === "retaining_wall") {
    const wall = target as RetainingWallStructure;
    if (job.kind === "wall_size") {
      wall.geometry = { ...MOCK_CANTILEVER_5M };
    }
    wall.result_hash = (job.result as WallResultDTO).result_hash;
  } else if (target?.kind === "sheet_pile") {
    const pile = target as SheetPileStructure & { mock_result_snapshot?: string };
    pile.result = structuredClone(job.result as SheetPileResultDTO);
    // Re-polls of a finished job must not re-baseline the snapshot (would hide later edits).
    if (pile.result_hash !== `mock-${job.job_id}`) {
    pile.result_hash = `mock-${job.job_id}`;
    pile.mock_result_snapshot = JSON.stringify({ ...pile, result_hash: undefined, mock_result_snapshot: undefined });
    }
  }

  return {
    status: 200,
    data: {
      job_id: job.job_id,
      kind: job.kind,
      status: "done",
      progress: 1.0,
      message_key: "job.step.done",
      result: job.result,
      error: null,
    },
  };
}

function handleCoreRoutes(
  method: string,
  path: string,
  body?: unknown,
): { status: number; data: unknown } | typeof NOT_HANDLED {
  const store = getMockStore();
  const cleanPath = path.split("?")[0];
  const upperMethod = method.toUpperCase();

  // GET /health
  if (upperMethod === "GET" && cleanPath === "/health") {
    const res: HealthResponse = { status: "ok", version: "0.2.0" };
    return { status: 200, data: res };
  }

  // GET /i18n/{lang}
  const i18nMatch = /^\/i18n\/(tr|en)$/.exec(cleanPath);
  if (upperMethod === "GET" && i18nMatch) {
    const lang = i18nMatch[1] as Language;
    return { status: 200, data: getMockCatalog(lang) };
  }

  // GET /project
  if (upperMethod === "GET" && cleanPath === "/project") {
    return { status: 200, data: buildProjectSummary() };
  }

  // POST /project/new
  if (upperMethod === "POST" && cleanPath === "/project/new") {
    const payload = body as ProjectNew;
    resetMockState();
    const fresh = getMockStore();
    fresh.meta.name = payload.name;
    fresh.meta.language = payload.language;
    return { status: 200, data: buildProjectSummary() };
  }

  // PATCH /project/meta
  if (upperMethod === "PATCH" && cleanPath === "/project/meta") {
    const patch = Object.fromEntries(
      Object.entries(body as ProjectMetaPatch).filter(([, value]) => value !== undefined),
    ) as ProjectMetaPatch;
    store.meta = { ...store.meta, ...patch };
    return { status: 200, data: { ...store.meta } };
  }

  // PUT /project/site
  if (upperMethod === "PUT" && cleanPath === "/project/site") {
    const site = body as SiteSeismic;
    store.site = { ...site };
    return { status: 200, data: { ...store.site } };
  }

  // PUT /project/active-profile
  if (upperMethod === "PUT" && cleanPath === "/project/active-profile") {
    const payload = body as ActiveProfileUpdate;
    store.active_profile_id = payload.profile_id;
    return { status: 200, data: buildProjectSummary() };
  }

  // PUT /structures/{id}/soil
  const soilMatch = /^\/structures\/([^/]+)\/soil$/.exec(cleanPath);
  if (upperMethod === "PUT" && soilMatch) {
    const structId = decodeURIComponent(soilMatch[1]);
    const target = store.structures.find((s) => s.id === structId);
    if (!target) return notFound("Structure");
    const soil = structuredClone(body as StructureSoilModel);
    const base = structureBaseDepth(target);
    const checks = validateStructureSoil(soil.retained_fill ?? [], soil.profile?.layers ?? [], base);
    const gwtIssues = [
      ...validateGwt(soil.profile?.gwt),
      ...validateGwt(soil.gwt_retained),
      ...validateGwt(soil.gwt_front),
    ];
    if (checks.fill.length + checks.profile.length + gwtIssues.length > 0) {
      return validationError("Invalid structure soil model", {
        fill: checks.fill,
        profile: checks.profile,
        gwt: gwtIssues,
      });
    }
    target.soil = soil;
    return { status: 200, data: structuredClone(target) };
  }

  // POST /structures/{id}/soil/resync
  const resyncMatch = /^\/structures\/([^/]+)\/soil\/resync$/.exec(cleanPath);
  if (upperMethod === "POST" && resyncMatch) {
    const structId = decodeURIComponent(resyncMatch[1]);
    const target = store.structures.find((s) => s.id === structId);
    if (!target) return notFound("Structure");
    const source = store.profiles.find((p) => p.id === target.soil.source_profile_id);
    if (!source) return notFound("Source profile");
    target.soil = {
      ...target.soil,
      profile: structuredClone(source),
      source_hash: mockProfileHash(source),
    };
    return { status: 200, data: structuredClone(target) };
  }

  // GET /structures
  if (upperMethod === "GET" && cleanPath === "/structures") {
    return { status: 200, data: store.structures.map(toStructureSummary) };
  }

  // POST /structures
  if (upperMethod === "POST" && cleanPath === "/structures") {
    const payload = body as StructureCreate;
    const id = `wall-mock-${store.structures.length + 1}`;
    let sourceProfile: (typeof store.profiles)[number] | undefined;
    if (!payload.soil) {
      if (payload.profile_id) {
        sourceProfile = store.profiles.find((p) => p.id === payload.profile_id);
        if (!sourceProfile) {
          return {
            status: 404,
            data: { code: "not_found", message: "Profile not found (Mock).", details: {}, missing_factors: [] },
          };
        }
      } else {
        sourceProfile = store.profiles.find((p) => p.id === store.active_profile_id);
      }
    }
    if (!payload.soil && !sourceProfile) {
      return {
        status: 409,
        data: {
          code: "no_soil_source",
          message: "The project has no soil profile (Mock).",
          details: {},
          missing_factors: [],
        },
      };
    }

    if (payload.kind === "retaining_wall") {
      const created: RetainingWallStructure = {
        kind: "retaining_wall",
        id,
        name: payload.name,
        wall_type: payload.wall_type,
        height: payload.height,
        embedment: payload.embedment ?? 0.6,
        backfill_slope: payload.backfill_slope ?? 0.0,
        geometry: payload.geometry ?? { ...MOCK_CANTILEVER_5M },
        soil: payload.soil ?? {
          source_profile_id: sourceProfile!.id,
          source_hash: mockProfileHash(sourceProfile!),
          profile: structuredClone(sourceProfile!),
          retained_fill: structuredClone(MOCK_INITIAL_STRUCTURES[0].soil.retained_fill ?? []),
          gwt_retained: null,
          gwt_front: null,
        },
        inputs: payload.inputs ?? {
          surcharge: 10.0,
          surcharge_resists: false,
          sds: 0.5,
          r: 1.5,
          gwt_case: "design",
          include_global_stability: true,
        },
        settings: payload.settings ?? {
          design_code: "asd",
          bearing_method: "vesic",
          use_passive: false,
          passive_reduction: 0.5,
          include_toe_soil: false,
          concrete_unit_weight: 24.0,
          foundation_on: "soil",
          factor_overrides: {},
        },
        analysis_level: payload.analysis_level ?? "basic",
        approach: payload.approach ?? null,
        result_hash: null,
      };
      store.structures.push(created);
      return { status: 200, data: structuredClone(created) };
    }

    if (payload.kind === "sheet_pile") {
      const created: SheetPileStructure = {
        kind: "sheet_pile",
        id: `pile-mock-${store.structures.length + 1}`,
        name: payload.name,
        support: payload.support ?? "cantilever",
        retained_height: payload.retained_height,
        anchor_depth: payload.anchor_depth ?? null,
        depth_increase: payload.depth_increase ?? null,
        anchor_spacing: payload.support === "anchored" ? payload.anchor_spacing ?? 1 : null,
        anchor_inclination: payload.support === "anchored" ? payload.anchor_inclination ?? 0 : null,
        front_water_depth: payload.front_water_depth ?? null,
        soil: payload.soil ?? {
          source_profile_id: sourceProfile!.id,
          source_hash: mockProfileHash(sourceProfile!),
          profile: structuredClone(sourceProfile!),
          retained_fill: [],
          gwt_retained: null,
          gwt_front: null,
        },
        surcharge: payload.surcharge ?? 0,
        sds: payload.sds ?? null,
        design_code: payload.design_code ?? "asd",
        approach: payload.approach ?? null,
        allowable_stress_mpa: payload.allowable_stress_mpa ?? null,
        analysis_level: payload.analysis_level ?? "basic",
        result_hash: null,
      };
      store.structures.push(created);
      return { status: 200, data: structuredClone(created) };
    }
  }

  // GET / PUT / DELETE /structures/{id}
  const structMatch = /^\/structures\/([^/]+)$/.exec(cleanPath);
  if (structMatch) {
    const structId = decodeURIComponent(structMatch[1]);
    const index = store.structures.findIndex((s) => s.id === structId);
    // Like the backend, an unknown id is 404 for every method (no upsert, no silent delete).
    if (["GET", "PUT", "DELETE"].includes(upperMethod) && index < 0) {
      return {
        status: 404,
        data: { code: "not_found", message: "Structure not found (Mock).", details: {}, missing_factors: [] },
      };
    }
    if (upperMethod === "GET") {
      return { status: 200, data: structuredClone(store.structures[index]) };
    }
    if (upperMethod === "PUT") {
      const updated = body as Structure;
      const saved = structuredClone(updated);
      const current = store.structures[index];
      if (saved.kind === "sheet_pile" && current.kind === "sheet_pile") {
        const savedPile = saved as SheetPileStructure & { mock_result_snapshot?: string };
        const currentPile = current as SheetPileStructure & { mock_result_snapshot?: string };
        // The mock-only result baseline is not part of the API structure type. Keep it
        // when a client PUT omits it so changed inputs remain detectable as stale.
        // Like the real API, a PUT never drops the stored result (result_hash).
        if (savedPile.mock_result_snapshot === undefined) {
          savedPile.mock_result_snapshot = currentPile.mock_result_snapshot;
        }
        if (savedPile.result_hash == null) {
          savedPile.result_hash = currentPile.result_hash;
        }
        if (savedPile.result == null) {
          savedPile.result = currentPile.result;
        }
      }
      store.structures[index] = saved;
      return { status: 200, data: structuredClone(saved) };
    }
    if (upperMethod === "DELETE") {
      store.structures.splice(index, 1);
      const res: DeletionResponse = { id: structId, deleted: true };
      return { status: 200, data: res };
    }
  }

  // GET / DELETE /jobs/{job_id}
  const jobMatch = /^\/jobs\/([^/]+)$/.exec(cleanPath);
  if (jobMatch) {
    const jobId = decodeURIComponent(jobMatch[1]);
    if (upperMethod === "GET") {
      return pollJobState(jobId);
    }
    if (upperMethod === "DELETE") {
      const job = store.jobs.get(jobId);
      if (!job) {
        return {
          status: 404,
          data: { code: "not_found", message: "Job not found (Mock).", details: {}, missing_factors: [] },
        };
      }
      job.cancelled = true;
      return pollJobState(jobId);
    }
  }

  // GET /codes
  if (upperMethod === "GET" && cleanPath === "/codes") {
    return { status: 200, data: structuredClone(MOCK_DESIGN_CODES) };
  }

  return NOT_HANDLED;
}

/**
 * Project, structure CRUD, job polling, codes, health and i18n routes. Like the backend,
 * PATCH meta / PUT site only count as edits when a value actually changes.
 */
export const coreRoutesHandler: MockHandler = (method, path, body) => {
  const cleanPath = path.split("?")[0];
  const store = getMockStore();
  const trackChange = cleanPath === "/project/meta" || cleanPath === "/project/site";
  const before = trackChange ? JSON.stringify([store.meta, store.site]) : "";
  const response = handleCoreRoutes(method, path, body);
  if (response === NOT_HANDLED) return NOT_HANDLED;
  const after = getMockStore();
  const changed = !trackChange || JSON.stringify([after.meta, after.site]) !== before;
  if (response.status < 400 && changed && ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())
    && /^\/(project|structures)(\/|$)/.test(cleanPath)) {
    notifyMockMutation(cleanPath);
  }
  return response;
};
