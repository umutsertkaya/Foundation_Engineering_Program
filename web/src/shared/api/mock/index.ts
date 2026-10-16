import trCatalog from "../../../../../geotek/i18n/tr.json";
import enCatalog from "../../../../../geotek/i18n/en.json";
import type {
  ActiveProfileUpdate,
  ApiErrorDTO,
  Borehole,
  CPTSounding,
  DeletionResponse,
  HealthResponse,
  InvestigationsDTO,
  JobKind,
  JobRef,
  JobState,
  Language,
  MissingFactorDTO,
  ProfileCreate,
  ProfileSummary,
  ProjectMeta,
  ProjectMetaPatch,
  ProjectNew,
  ProjectSummary,
  RetainingWallStructure,
  SheetPileStructure,
  SiteSeismic,
  SoilProfile,
  Structure,
  StructureCreate,
  StructureSoilModel,
  StructureSummary,
  WallResultDTO,
} from "../types";
import { validateGwt, validateLayers, validateStructureSoil } from "../../soil/layerOps";
import { mockProfileHash } from "./hash";
import {
  buildMockWallResult,
  MOCK_BOREHOLE,
  MOCK_CANTILEVER_5M,
  MOCK_CPT,
  MOCK_DEFAULT_META,
  MOCK_DEFAULT_SITE,
  MOCK_DESIGN_CODES,
  MOCK_INITIAL_STRUCTURES,
  MOCK_MISSING_FACTORS,
  MOCK_PROFILES,
} from "./data";

interface MockJobInternal {
  job_id: string;
  kind: JobKind;
  structure_id: string;
  startedAt: number;
  polls: number;
  cancelled: boolean;
  result: WallResultDTO;
}

interface MockStore {
  meta: ProjectMeta;
  site: SiteSeismic;
  active_profile_id: string | null;
  boreholes: Borehole[];
  cpts: CPTSounding[];
  profiles: SoilProfile[];
  structures: Structure[];
  jobs: Map<string, MockJobInternal>;
  jobSeq: number;
  profileSeq: number;
}

function createInitialStore(): MockStore {
  const profiles = structuredClone(MOCK_PROFILES);
  const structures: Structure[] = structuredClone(MOCK_INITIAL_STRUCTURES);
  // D-1 starts up to date with its source profile; D-2 keeps its mismatching (stale) hash.
  for (const s of structures) {
    if (s.soil.source_hash === null || s.soil.source_hash === undefined) {
      const src = profiles.find((p) => p.id === s.soil.source_profile_id);
      s.soil.source_hash = src ? mockProfileHash(src) : null;
    }
  }
  return {
    meta: { ...MOCK_DEFAULT_META },
    site: { ...MOCK_DEFAULT_SITE },
    active_profile_id: MOCK_PROFILES[0].id,
    boreholes: [structuredClone(MOCK_BOREHOLE)],
    cpts: [structuredClone(MOCK_CPT)],
    profiles,
    structures,
    jobs: new Map<string, MockJobInternal>(),
    jobSeq: 0,
    profileSeq: profiles.length,
  };
}

let store: MockStore = createInitialStore();

export function resetMockState(): void {
  store = createInitialStore();
}

export function getMockCatalog(lang: Language): Record<string, string> {
  return lang === "en" ? { ...enCatalog } : { ...trCatalog };
}

function isStructureStale(s: Structure): boolean {
  if (!s.soil.source_profile_id) return false;
  const source = store.profiles.find((p) => p.id === s.soil.source_profile_id);
  return !source || mockProfileHash(source) !== s.soil.source_hash;
}

function validationError(message: string, details: Record<string, unknown>): { status: number; data: ApiErrorDTO } {
  return {
    status: 422,
    data: { code: "validation", message: `${message} (Mock)`, details, missing_factors: [] },
  };
}

function notFound(what: string): { status: number; data: ApiErrorDTO } {
  return {
    status: 404,
    data: { code: "not_found", message: `${what} not found (Mock).`, details: {}, missing_factors: [] },
  };
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

function toProfileSummary(p: SoilProfile): ProfileSummary {
  return {
    id: p.id,
    name: p.name ?? p.id,
    origin: p.origin ?? "manual",
    source_ids: [...(p.source_ids ?? [])],
    gwt: { ...p.gwt },
    layer_count: p.layers.length,
  };
}

function getMissingFactorsForStructure(s: Structure): MissingFactorDTO[] {
  if ((s.kind ?? "retaining_wall") === "retaining_wall") {
    const wall = s as RetainingWallStructure;
    const level = wall.analysis_level ?? "basic";
    const code = wall.settings?.design_code ?? "asd";
    if (level === "advanced" && code === "tbdy2018") {
      const overrides = wall.settings?.factor_overrides ?? {};
      return MOCK_MISSING_FACTORS.filter((mf) => !(mf.path in overrides));
    }
  }
  return [];
}

function startWallJob(structureId: string, kind: "wall_size" | "wall_check"): { status: number; data: JobRef | ApiErrorDTO } {
  const structure = store.structures.find((item) => item.id === structureId);
  if (!structure) {
    return {
      status: 404,
      data: {
        code: "not_found",
        message: `Structure '${structureId}' not found (Mock).`,
        details: { id: structureId },
        missing_factors: [],
      },
    };
  }

  const missing = getMissingFactorsForStructure(structure);
  if (missing.length > 0) {
    return {
      status: 422,
      data: {
        code: "missing_factors",
        message: "Selected design code has missing factors (Sentetik / Mock).",
        details: { structure_id: structureId, design_code: "tbdy2018" },
        missing_factors: missing,
      },
    };
  }

  store.jobSeq += 1;
  const job_id = `job-mock-${store.jobSeq}`;
  const result = buildMockWallResult(structureId);
  store.jobs.set(job_id, {
    job_id,
    kind,
    structure_id: structureId,
    startedAt: Date.now(),
    polls: 0,
    cancelled: false,
    result,
  });

  return { status: 202, data: { job_id } };
}

function pollJobState(jobId: string): { status: number; data: JobState | ApiErrorDTO } {
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
        message_key: "job.step.earth_pressure",
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
        message_key: "job.step.stability_checks",
        result: null,
        error: null,
      },
    };
  }

  // Done: update structure geometry if wall_size, and mark result_hash
  const target = store.structures.find((s) => s.id === job.structure_id);
  if (target && (target.kind ?? "retaining_wall") === "retaining_wall") {
    const wall = target as RetainingWallStructure;
    if (job.kind === "wall_size") {
      wall.geometry = { ...MOCK_CANTILEVER_5M };
    }
    wall.result_hash = job.result.result_hash;
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

export async function mockRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
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
    store = createInitialStore();
    store.meta.name = payload.name;
    store.meta.language = payload.language;
    return { status: 200, data: buildProjectSummary() };
  }

  // PATCH /project/meta
  if (upperMethod === "PATCH" && cleanPath === "/project/meta") {
    const patch = body as ProjectMetaPatch;
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
    const sourceProfile =
      store.profiles.find((p) => p.id === payload.profile_id) ?? store.profiles[0];

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
          source_profile_id: sourceProfile.id,
          source_hash: mockProfileHash(sourceProfile),
          profile: structuredClone(sourceProfile),
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
  }

  // GET / PUT / DELETE /structures/{id}
  const structMatch = /^\/structures\/([^/]+)$/.exec(cleanPath);
  if (structMatch) {
    const structId = decodeURIComponent(structMatch[1]);
    const index = store.structures.findIndex((s) => s.id === structId);
    if (upperMethod === "GET") {
      if (index < 0) {
        return {
          status: 404,
          data: { code: "not_found", message: "Structure not found (Mock).", details: {}, missing_factors: [] },
        };
      }
      return { status: 200, data: structuredClone(store.structures[index]) };
    }
    if (upperMethod === "PUT") {
      const updated = body as Structure;
      if (index < 0) {
        store.structures.push(structuredClone(updated));
      } else {
        store.structures[index] = structuredClone(updated);
      }
      return { status: 200, data: structuredClone(updated) };
    }
    if (upperMethod === "DELETE") {
      if (index >= 0) {
        store.structures.splice(index, 1);
      }
      const res: DeletionResponse = { id: structId, deleted: true };
      return { status: 200, data: res };
    }
  }

  // POST /structures/{id}/required-factors
  const reqFactorsMatch = /^\/structures\/([^/]+)\/required-factors$/.exec(cleanPath);
  if (upperMethod === "POST" && reqFactorsMatch) {
    const structId = decodeURIComponent(reqFactorsMatch[1]);
    const structure = store.structures.find((s) => s.id === structId);
    if (!structure) {
      return {
        status: 404,
        data: { code: "not_found", message: "Structure not found (Mock).", details: {}, missing_factors: [] },
      };
    }
    return { status: 200, data: getMissingFactorsForStructure(structure) };
  }

  // POST /structures/{id}/size
  const sizeMatch = /^\/structures\/([^/]+)\/size$/.exec(cleanPath);
  if (upperMethod === "POST" && sizeMatch) {
    return startWallJob(decodeURIComponent(sizeMatch[1]), "wall_size");
  }

  // POST /structures/{id}/check
  const checkMatch = /^\/structures\/([^/]+)\/check$/.exec(cleanPath);
  if (upperMethod === "POST" && checkMatch) {
    return startWallJob(decodeURIComponent(checkMatch[1]), "wall_check");
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

  return {
    status: 501,
    data: {
      code: "not_implemented",
      message: `Mock endpoint not implemented: ${upperMethod} ${cleanPath}`,
      details: {},
      missing_factors: [],
    },
  };
}
