import { request } from "../../shared/api/http";
import type { JobRef } from "../../shared/api/types";

export function run_report(): Promise<JobRef> {
  return request<JobRef>("POST", "/m/report/run");
}
