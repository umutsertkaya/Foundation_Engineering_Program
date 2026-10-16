import { mockRequest } from "./mock";
import type {
  ActiveProfileUpdate,
  ApiErrorDTO,
  CPTProcessedDTO,
  DeletionResponse,
  DesignCodeSummary,
  FactorOverride,
  FactorRowDTO,
  HealthResponse,
  InvestigationsDTO,
  JobRef,
  JobState,
  Language,
  LayeringProposal,
  LayeringSettings,
  LiquefactionSettingsDTO,
  MissingFactorDTO,
  ProfileCreate,
  ProfileSummary,
  ProjectMeta,
  ProjectMetaPatch,
  ProjectNew,
  ProjectOpen,
  ProjectSave,
  ProjectSaved,
  ProjectSummary,
  SiteSeismic,
  SoilProfile,
  SPTProcessedDTO,
  Structure,
  StructureCreate,
  StructureSoilModel,
  StructureSummary,
} from "./types";

const BASE_URL = "/api";

let mockOverride: boolean | null = null;

export function setMockMode(enabled: boolean | null): void {
  mockOverride = enabled;
}

export function isMockMode(): boolean {
  if (mockOverride !== null) {
    return mockOverride;
  }
  return import.meta.env.VITE_API_MOCK === "1";
}

export class ApiError extends Error implements ApiErrorDTO {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly missing_factors: MissingFactorDTO[];

  constructor(status: number, payload: ApiErrorDTO) {
    super(payload.message);
    this.name = "ApiError";
    this.status = status;
    this.code = payload.code;
    this.details = payload.details ?? {};
    this.missing_factors = payload.missing_factors ?? [];
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

function fallbackCodeForStatus(status: number): string {
  if (status === 404) return "not_found";
  if (status === 409) return "stale_structure";
  if (status === 422) return "validation";
  if (status === 501) return "not_implemented";
  if (status >= 500) return "engine_error";
  return "validation";
}

export function parseApiError(status: number, body: unknown): ApiError {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const rec = body as Record<string, unknown>;
    const code =
      typeof rec.code === "string" && rec.code.length > 0
        ? rec.code
        : fallbackCodeForStatus(status);
    const message =
      typeof rec.message === "string" && rec.message.length > 0
        ? rec.message
        : `HTTP ${status}`;
    const details =
      rec.details && typeof rec.details === "object" && !Array.isArray(rec.details)
        ? (rec.details as Record<string, unknown>)
        : {};
    const missing_factors = Array.isArray(rec.missing_factors)
      ? (rec.missing_factors as MissingFactorDTO[])
      : [];
    return new ApiError(status, { code, message, details, missing_factors });
  }
  return new ApiError(status, {
    code: fallbackCodeForStatus(status),
    message: typeof body === "string" && body.length > 0 ? body : `HTTP ${status}`,
    details: {},
    missing_factors: [],
  });
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (isMockMode()) {
    const { status, data } = await mockRequest(method, path, body);
    if (status >= 400) {
      throw parseApiError(status, data);
    }
    return data as T;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers:
        body !== undefined
          ? { "Content-Type": "application/json", Accept: "application/json" }
          : { Accept: "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(0, {
      code: "network",
      message: err instanceof Error ? err.message : "Network request failed",
      details: {},
      missing_factors: [],
    });
  }

  let parsed: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    throw parseApiError(response.status, parsed);
  }

  return parsed as T;
}

export function get_health(): Promise<HealthResponse> {
  return request<HealthResponse>("GET", "/health");
}

export function get_i18n(lang: Language): Promise<Record<string, string>> {
  return request<Record<string, string>>("GET", `/i18n/${lang}`);
}

export function new_project(payload: ProjectNew): Promise<ProjectSummary> {
  return request<ProjectSummary>("POST", "/project/new", payload);
}

export function open_project(payload: ProjectOpen): Promise<ProjectSummary> {
  return request<ProjectSummary>("POST", "/project/open", payload);
}

export function save_project(payload: ProjectSave): Promise<ProjectSaved> {
  return request<ProjectSaved>("POST", "/project/save", payload);
}

export function get_project(): Promise<ProjectSummary> {
  return request<ProjectSummary>("GET", "/project");
}

export function update_project_meta(payload: ProjectMetaPatch): Promise<ProjectMeta> {
  return request<ProjectMeta>("PATCH", "/project/meta", payload);
}

export function set_project_site(payload: SiteSeismic): Promise<SiteSeismic> {
  return request<SiteSeismic>("PUT", "/project/site", payload);
}

export function set_active_profile(payload: ActiveProfileUpdate): Promise<ProjectSummary> {
  return request<ProjectSummary>("PUT", "/project/active-profile", payload);
}

export function list_investigations(): Promise<InvestigationsDTO> {
  return request<InvestigationsDTO>("GET", "/investigations");
}

export function get_processed_cpt(id: string): Promise<CPTProcessedDTO> {
  return request<CPTProcessedDTO>("GET", `/cpts/${encodeURIComponent(id)}/processed`);
}

export function get_processed_spt(id: string): Promise<SPTProcessedDTO> {
  return request<SPTProcessedDTO>("GET", `/boreholes/${encodeURIComponent(id)}/processed`);
}

export function propose_cpt_layers(cpt_id: string, payload: LayeringSettings): Promise<LayeringProposal> {
  return request<LayeringProposal>("POST", `/layering/cpt/${encodeURIComponent(cpt_id)}`, payload);
}

export function propose_spt_layers(borehole_id: string, payload: LayeringSettings): Promise<LayeringProposal> {
  return request<LayeringProposal>("POST", `/layering/spt/${encodeURIComponent(borehole_id)}`, payload);
}

export function list_profiles(): Promise<ProfileSummary[]> {
  return request<ProfileSummary[]>("GET", "/profiles");
}

export function create_profile(payload: ProfileCreate): Promise<SoilProfile> {
  return request<SoilProfile>("POST", "/profiles", payload);
}

export function get_profile(id: string): Promise<SoilProfile> {
  return request<SoilProfile>("GET", `/profiles/${encodeURIComponent(id)}`);
}

export function update_profile(id: string, payload: SoilProfile): Promise<SoilProfile> {
  return request<SoilProfile>("PUT", `/profiles/${encodeURIComponent(id)}`, payload);
}

export function delete_profile(id: string): Promise<DeletionResponse> {
  return request<DeletionResponse>("DELETE", `/profiles/${encodeURIComponent(id)}`);
}

export function list_structures(): Promise<StructureSummary[]> {
  return request<StructureSummary[]>("GET", "/structures");
}

export function create_structure(payload: StructureCreate): Promise<Structure> {
  return request<Structure>("POST", "/structures", payload);
}

export function get_structure(id: string): Promise<Structure> {
  return request<Structure>("GET", `/structures/${encodeURIComponent(id)}`);
}

export function update_structure(id: string, payload: Structure): Promise<Structure> {
  return request<Structure>("PUT", `/structures/${encodeURIComponent(id)}`, payload);
}

export function delete_structure(id: string): Promise<DeletionResponse> {
  return request<DeletionResponse>("DELETE", `/structures/${encodeURIComponent(id)}`);
}

export function set_structure_soil(id: string, payload: StructureSoilModel): Promise<Structure> {
  return request<Structure>("PUT", `/structures/${encodeURIComponent(id)}/soil`, payload);
}

export function resync_structure_soil(id: string): Promise<Structure> {
  return request<Structure>("POST", `/structures/${encodeURIComponent(id)}/soil/resync`);
}

export function get_structure_required_factors(id: string): Promise<MissingFactorDTO[]> {
  return request<MissingFactorDTO[]>("POST", `/structures/${encodeURIComponent(id)}/required-factors`);
}

export function size_wall(id: string): Promise<JobRef> {
  return request<JobRef>("POST", `/structures/${encodeURIComponent(id)}/size`);
}

export function check_wall(id: string): Promise<JobRef> {
  return request<JobRef>("POST", `/structures/${encodeURIComponent(id)}/check`);
}

export function get_job(job_id: string): Promise<JobState> {
  return request<JobState>("GET", `/jobs/${encodeURIComponent(job_id)}`);
}

export function cancel_job(job_id: string): Promise<JobState> {
  return request<JobState>("DELETE", `/jobs/${encodeURIComponent(job_id)}`);
}

export function design_sheet_pile(id: string): Promise<JobRef> {
  return request<JobRef>("POST", `/structures/${encodeURIComponent(id)}/design`);
}

export function run_liquefaction(payload: LiquefactionSettingsDTO): Promise<JobRef> {
  return request<JobRef>("POST", "/liquefaction", payload);
}

export function list_codes(): Promise<DesignCodeSummary[]> {
  return request<DesignCodeSummary[]>("GET", "/codes");
}

export function list_code_factors(code_id: string): Promise<FactorRowDTO[]> {
  return request<FactorRowDTO[]>("GET", `/codes/${encodeURIComponent(code_id)}/factors`);
}

export function get_code_required_factors(
  code_id: string,
  approach?: string | null,
  seismic = false,
): Promise<MissingFactorDTO[]> {
  const params = new URLSearchParams();
  if (approach) params.set("approach", approach);
  if (seismic) params.set("seismic", "true");
  const qs = params.toString() ? `?${params.toString()}` : "";
  return request<MissingFactorDTO[]>("GET", `/codes/${encodeURIComponent(code_id)}/required${qs}`);
}

export function set_design_overrides(
  code_id: string,
  payload: Record<string, FactorOverride>,
): Promise<Record<string, FactorOverride>> {
  return request<Record<string, FactorOverride>>(
    "PUT",
    `/project/design-overrides/${encodeURIComponent(code_id)}`,
    payload,
  );
}
