import { request } from "../../shared/api/http";
import type { JobRef, LiquefactionSettingsDTO, StoredLiquefactionDTO } from "../../shared/api/types";

export type { LiquefactionSettingsDTO };

export function run_liquefaction(settings: LiquefactionSettingsDTO): Promise<JobRef> {
  return request<JobRef>("POST", "/m/liquefaction/run", settings);
}

/** Result saved in the open project (404 `not_found` when no analysis has completed). */
export function get_liquefaction_result(): Promise<StoredLiquefactionDTO> {
  return request<StoredLiquefactionDTO>("GET", "/m/liquefaction/result");
}
