import type {
  ActiveProfileUpdate,
  DeletionResponse,
  DesignCodeSummary,
  FactorOverride,
  FactorRowDTO,
  HealthResponse,
  JobRef,
  JobState,
  Language,
  LayeringProposal,
  LayeringSettings,
  LiquefactionSettingsDTO,
  MissingFactorDTO,
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
  Structure,
  StructureCreate,
  StructureSoilModel,
  StructureSummary,
  WallTypeInfo,
} from "./types";
import { request } from "./http";

export { ApiError, isMockMode, parseApiError, setMockMode } from "./http";

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

export function get_job(job_id: string): Promise<JobState> {
  return request<JobState>("GET", `/jobs/${encodeURIComponent(job_id)}`);
}

export function cancel_job(job_id: string): Promise<JobState> {
  return request<JobState>("DELETE", `/jobs/${encodeURIComponent(job_id)}`);
}

export function design_sheet_pile(id: string): Promise<JobRef> {
  return request<JobRef>("POST", `/m/sheet_pile/structures/${encodeURIComponent(id)}/design`);
}

export function run_liquefaction(payload: LiquefactionSettingsDTO): Promise<JobRef> {
  return request<JobRef>("POST", "/m/liquefaction/run", payload);
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
