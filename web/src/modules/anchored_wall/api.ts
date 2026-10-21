import { request } from "../../shared/api/http";
import type {
  AnalysisInputs,
  AnalysisResult,
  AnchorDesignInputs,
  AnchorDesignResult,
  AnchorReference,
  StateResponse,
  StructureSoil,
} from "./types";

const BASE = "/m/anchored_wall";

export function get_state(): Promise<StateResponse> {
  return request<StateResponse>("GET", `${BASE}/state`);
}

/** Analyse the wall and store inputs and result in the open project. */
export function run_analysis(inputs: AnalysisInputs): Promise<AnalysisResult> {
  return request<AnalysisResult>("POST", `${BASE}/analysis/run?save=true`, inputs);
}

/** Design one anchor and store inputs and result in the open project. */
export function design_anchor(inputs: AnchorDesignInputs): Promise<AnchorDesignResult> {
  return request<AnchorDesignResult>("POST", `${BASE}/anchor/design?save=true`, inputs);
}

export function get_reference(): Promise<AnchorReference> {
  return request<AnchorReference>("GET", `${BASE}/anchor/reference`);
}

/** Structure copy of a project soil profile (with source id and hash). */
export function get_soil(profileId: string): Promise<StructureSoil> {
  return request<StructureSoil>("GET", `${BASE}/soil/${encodeURIComponent(profileId)}`);
}
