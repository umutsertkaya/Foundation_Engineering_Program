import { request } from "../../shared/api/http";
import type { JobRef } from "../../shared/api/types";

export function design_sheet_pile(id: string): Promise<JobRef> {
  return request<JobRef>("POST", `/m/sheet_pile/structures/${encodeURIComponent(id)}/design`);
}
