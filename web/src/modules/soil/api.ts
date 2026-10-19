import { request } from "../../shared/api/http";
import type {
  DeletionResponse,
  DesignKey,
  LayeringProposal,
  LayeringSettings,
  ParameterSelection,
  ProfileSummary,
  SelectionUpdate,
  SoilLayer,
  SoilProfile,
} from "../../shared/api/types";
import type { CPTProcessedDTO, InvestigationsDTO, ProfileCreate, SPTProcessedDTO } from "./types";

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
