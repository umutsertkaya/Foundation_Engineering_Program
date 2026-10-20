import trCatalog from "../../../../../geotek/i18n/tr.json";
import enCatalog from "../../../../../geotek/i18n/en.json";
import type {
  ApiErrorDTO,
  Borehole,
  CPTSounding,
  JobKind,
  JobState,
  Language,
  ProfileSummary,
  ProjectMeta,
  SiteSeismic,
  SoilProfile,
  Structure,
} from "../types";
import { mockProfileHash } from "./hash";
import {
  MOCK_BOREHOLE,
  MOCK_CPT,
  MOCK_DEFAULT_META,
  MOCK_DEFAULT_SITE,
  MOCK_INITIAL_STRUCTURES,
  MOCK_PROFILES,
} from "./data";

export interface MockJobInternal {
  job_id: string;
  kind: JobKind;
  /** Wall jobs only; other job kinds have no structure. */
  structure_id: string | null;
  startedAt: number;
  polls: number;
  cancelled: boolean;
  result: NonNullable<JobState["result"]>;
  /** When set the job ends `failed` with this error instead of `done`. */
  error?: ApiErrorDTO;
  /** Progress message keys for the two running steps; wall keys when omitted. */
  stepKeys?: [string, string];
}

export interface MockStore {
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

let mutationListener: ((path: string) => void) | undefined;

/** Let the shell track successful edits without coupling the mock routes to it. */
export function setMockMutationListener(listener: (path: string) => void): void {
  mutationListener = listener;
}

/** Live accessor: the store object is replaced on reset, so never cache the result across requests. */
export function getMockStore(): MockStore {
  return store;
}

/** Mocks report successful edits with the shell-level path (/profiles/..., /structures/..., /project/...). */
export function notifyMockMutation(path: string): void {
  mutationListener?.(path);
}

export function setMockProjectMeta(partial: Partial<ProjectMeta>): void {
  store.meta = { ...store.meta, ...partial };
}

export function getMockProjectMeta(): ProjectMeta {
  return { ...store.meta };
}

/** A brand-new project: no seed profiles/structures; investigations stay (site data). */
export function resetMockStateEmptyProject(): void {
  const fresh = createInitialStore();
  fresh.profiles = [];
  fresh.structures = [];
  fresh.active_profile_id = null;
  fresh.profileSeq = 0;
  store = fresh;
}

export function resetMockState(): void {
  store = createInitialStore();
}

export function getMockCatalog(lang: Language): Record<string, string> {
  return lang === "en" ? { ...enCatalog } : { ...trCatalog };
}

export function validationError(message: string, details: Record<string, unknown>): { status: number; data: ApiErrorDTO } {
  return {
    status: 422,
    data: { code: "validation", message: `${message} (Mock)`, details, missing_factors: [] },
  };
}

export function notFound(what: string): { status: number; data: ApiErrorDTO } {
  return {
    status: 404,
    data: { code: "not_found", message: `${what} not found (Mock).`, details: {}, missing_factors: [] },
  };
}

export function toProfileSummary(p: SoilProfile): ProfileSummary {
  return {
    id: p.id,
    name: p.name ?? p.id,
    origin: p.origin ?? "manual",
    source_ids: [...(p.source_ids ?? [])],
    gwt: { ...p.gwt },
    layer_count: p.layers.length,
  };
}
