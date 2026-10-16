import trCatalog from "../../../../geotek/i18n/tr.json";
import enCatalog from "../../../../geotek/i18n/en.json";
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
  SiteSeismic,
  SoilProfile,
  Structure,
  StructureCreate,
  StructureSummary,
  WallResultDTO,
} from "../types";
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
}

function createInitialStore(): MockStore {
  return {
    meta: { ...MOCK_DEFAULT_META },
    site: { ...MOCK_DEFAULT_SITE },
    active_profile_id: MOCK_PROFILES[0].id,
    boreholes: [structuredClone(MOCK_BOREHOLE)],
    cpts: [structuredClone(MOCK_CPT)],
    profiles: structuredClone(MOCK_PROFILES),
    structures: structuredClone(MOCK_INITIAL_STRUCTURES),
    jobs: new Map<string, MockJobInternal>(),
    jobSeq: 0,
  };
}

let store: MockStore = createInitialStore();

export function resetMockState(): void {
  store = createInitialStore();
}

export function getMockCatalog(lang: Language): Record<string, string> {
  return lang === "en" ? { ...enCatalog } : { ...trCatalog };
}

function toStructureSummary(s: Structure): StructureSummary {
  const isWall = (s.kind ?? "retaining_wall") === "retaining_wall";
  const wall = isWall ? (s as RetainingWallStructure) : null;
  const stale = s.soil.source_hash === "stale-hash-mock";
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
    const newProfile: SoilProfile = {
      id: `prof-mock-${store.profiles.length + 1}`,
      name: payload.name,
      origin: payload.origin,
      source_ids: payload.source_ids,
      gwt: payload.gwt,
      layers: payload.layers ?? MOCK_PROFILES[0].layers,
    };
    store.profiles.push(newProfile);
    return { status: 200, data: structuredClone(newProfile) };
  }

  // GET /profiles/{id}
  const profileMatch = /^\/profiles\/([^/]+)$/.exec(cleanPath);
  if (upperMethod === "GET" && profileMatch) {
    const prof = store.profiles.find((p) => p.id === profileMatch[1]);
    if (!prof) {
      return {
        status: 404,
        data: { code: "not_found", message: "Profile not found (Mock).", details: {}, missing_factors: [] },
      };
    }
    return { status: 200, data: structuredClone(prof) };
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
          source_hash: "mock-profile-hash-1",
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
