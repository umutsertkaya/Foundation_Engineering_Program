import { request, request_upload } from "../../shared/api/http";
import type {
  DeletionResponse,
  Borehole,
  CPTSounding,
  DesignKey,
  LayeringProposal,
  LayeringSettings,
  ParameterSelection,
  ProfileSummary,
  SelectionUpdate,
  SoilLayer,
  SoilProfile,
} from "../../shared/api/types";
import type {
  BoreholeUSCSDTO,
  CPTProcessedDTO,
  ImportPlan,
  WorkbookImportResult,
  CPTSBTNDTO,
  InvestigationsDTO,
  ProfileCreate,
  SBTNReferenceDTO,
  SPTProcessedDTO,
  USCSClassifyRequest,
  USCSItemDTO,
  USCSReferenceDTO,
} from "./types";

export function list_investigations(): Promise<InvestigationsDTO> {
  return request<InvestigationsDTO>("GET", "/m/soil/investigations");
}

export function get_processed_cpt(id: string): Promise<CPTProcessedDTO> {
  return request<CPTProcessedDTO>("GET", `/m/soil/cpts/${encodeURIComponent(id)}/processed`);
}

export function get_processed_spt(id: string): Promise<SPTProcessedDTO> {
  return request<SPTProcessedDTO>("GET", `/m/soil/boreholes/${encodeURIComponent(id)}/processed`);
}

export function propose_cpt_layers(cpt_id: string, payload: LayeringSettings): Promise<LayeringProposal> {
  return request<LayeringProposal>("POST", `/m/soil/layering/cpt/${encodeURIComponent(cpt_id)}`, payload);
}

export function propose_spt_layers(borehole_id: string, payload: LayeringSettings): Promise<LayeringProposal> {
  return request<LayeringProposal>("POST", `/m/soil/layering/spt/${encodeURIComponent(borehole_id)}`, payload);
}

export function list_profiles(): Promise<ProfileSummary[]> {
  return request<ProfileSummary[]>("GET", "/m/soil/profiles");
}

export function create_profile(payload: ProfileCreate): Promise<SoilProfile> {
  return request<SoilProfile>("POST", "/m/soil/profiles", payload);
}

export function get_profile(id: string): Promise<SoilProfile> {
  return request<SoilProfile>("GET", `/m/soil/profiles/${encodeURIComponent(id)}`);
}

/**
 * The stored profile keeps `approved = true` after source data changed; the parameters endpoint
 * re-evaluates the basis hash. Overlay that live flag so the layer table and the parameters screen
 * agree (a stale approval must not look approved). Falls back to the stored flags on failure.
 */
export async function get_profile_with_live_approvals(id: string): Promise<SoilProfile> {
  const profile = await get_profile(id);
  try {
    const layers = await Promise.all(
      profile.layers.map(async (layer) => {
        if (!Object.values(layer.selections ?? {}).some((sel) => sel?.approved)) return layer;
        const live = await list_layer_parameters(id, layer.id);
        const selections = { ...(layer.selections ?? {}) };
        for (const item of live) {
          const stored = selections[item.parameter];
          if (stored?.approved && !item.approved) selections[item.parameter] = { ...stored, approved: false };
        }
        return { ...layer, selections };
      }),
    );
    return { ...profile, layers };
  } catch {
    return profile;
  }
}

export function update_profile(id: string, payload: SoilProfile): Promise<SoilProfile> {
  return request<SoilProfile>("PUT", `/m/soil/profiles/${encodeURIComponent(id)}`, payload);
}

export function delete_profile(id: string): Promise<DeletionResponse> {
  return request<DeletionResponse>("DELETE", `/m/soil/profiles/${encodeURIComponent(id)}`);
}

const layer_path = (profile_id: string, layer_id: string): string =>
  `/m/soil/profiles/${encodeURIComponent(profile_id)}/layers/${encodeURIComponent(layer_id)}`;

export function list_layer_parameters(profile_id: string, layer_id: string): Promise<ParameterSelection[]> {
  return request<ParameterSelection[]>("GET", `${layer_path(profile_id, layer_id)}/parameters`);
}

export function update_parameter_selection(
  profile_id: string,
  layer_id: string,
  key: DesignKey,
  payload: SelectionUpdate,
): Promise<ParameterSelection> {
  return request<ParameterSelection>("PUT", `${layer_path(profile_id, layer_id)}/parameters/${key}`, payload);
}

export function approve_parameters(profile_id: string, layer_id: string, keys: DesignKey[]): Promise<SoilLayer> {
  return request<SoilLayer>("POST", `${layer_path(profile_id, layer_id)}/parameters/approve`, { keys });
}

export function suggest_all_parameters(profile_id: string): Promise<SoilProfile> {
  return request<SoilProfile>("POST", `/m/soil/profiles/${encodeURIComponent(profile_id)}/parameters/suggest-all`);
}

export function get_sbtn_reference(): Promise<SBTNReferenceDTO> {
  return request<SBTNReferenceDTO>("GET", "/m/soil/classification/sbtn/reference");
}

export function get_cpt_sbtn(id: string): Promise<CPTSBTNDTO> {
  return request<CPTSBTNDTO>("GET", `/m/soil/cpts/${encodeURIComponent(id)}/sbtn`);
}

export function get_borehole_uscs(id: string): Promise<BoreholeUSCSDTO> {
  return request<BoreholeUSCSDTO>("GET", `/m/soil/boreholes/${encodeURIComponent(id)}/uscs`);
}

export function classify_uscs(payload: USCSClassifyRequest): Promise<USCSItemDTO> {
  return request<USCSItemDTO>("POST", "/m/soil/classification/uscs", payload);
}

export function get_uscs_reference(): Promise<USCSReferenceDTO> {
  return request<USCSReferenceDTO>("GET", "/m/soil/classification/uscs/reference");
}

export interface CptImportForm {
  file: File;
  sounding_id: string;
  qc_unit: "MPa" | "kPa";
  delimiter: string;
  decimal: string;
}

export function import_cpt(form: CptImportForm): Promise<InvestigationsDTO["cpts"][number]> {
  const body = new FormData();
  body.append("file", form.file, form.file.name);
  body.append("sounding_id", form.sounding_id);
  body.append("qc_unit", form.qc_unit);
  body.append("delimiter", form.delimiter);
  body.append("decimal", form.decimal);
  return request_upload("/m/soil/import/cpt", body);
}

export function import_spt(file: File, borehole_id: string): Promise<InvestigationsDTO["boreholes"][number]> {
  const body = new FormData();
  body.append("file", file, file.name);
  body.append("borehole_id", borehole_id);
  return request_upload("/m/soil/import/spt", body);
}

function workbook_form(file: File, plan?: ImportPlan): FormData {
  const body = new FormData();
  body.append("file", file, file.name);
  if (plan) body.append("plan", JSON.stringify(plan));
  return body;
}

export function analyze_workbook(file: File): Promise<ImportPlan> {
  return request_upload("/m/soil/import/workbook/analyze", workbook_form(file));
}

export function check_workbook(file: File, plan: ImportPlan): Promise<ImportPlan> {
  return request_upload("/m/soil/import/workbook/check", workbook_form(file, plan));
}

export function commit_workbook(file: File, plan: ImportPlan): Promise<WorkbookImportResult> {
  return request_upload("/m/soil/import/workbook/commit", workbook_form(file, plan));
}

export function delete_cpt(id: string): Promise<DeletionResponse> {
  return request<DeletionResponse>("DELETE", `/m/soil/cpts/${encodeURIComponent(id)}`);
}

export function delete_borehole(id: string): Promise<DeletionResponse> {
  return request<DeletionResponse>("DELETE", `/m/soil/boreholes/${encodeURIComponent(id)}`);
}

export function create_borehole(payload: Borehole): Promise<Borehole> {
  return request<Borehole>("POST", "/m/soil/boreholes", payload);
}

export function update_borehole(payload: Borehole): Promise<Borehole> {
  return request<Borehole>("PUT", `/m/soil/boreholes/${encodeURIComponent(payload.id)}`, payload);
}

export function update_cpt(payload: CPTSounding): Promise<CPTSounding> {
  return request<CPTSounding>("PUT", `/m/soil/cpts/${encodeURIComponent(payload.id)}`, payload);
}
