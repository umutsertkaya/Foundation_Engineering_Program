import { request } from "../../shared/api/http";
import type { JobRef, LiquefactionSettingsDTO } from "../../shared/api/types";

export type { LiquefactionSettingsDTO };

export function run_liquefaction(settings: LiquefactionSettingsDTO): Promise<JobRef> {
  return request<JobRef>("POST", "/m/liquefaction/run", settings);
}
