import { request } from "../../shared/api/http";
import type { JobRef, MissingFactorDTO, WallTypeInfo } from "../../shared/api/types";

export function list_wall_types(): Promise<WallTypeInfo[]> {
  return request<WallTypeInfo[]>("GET", "/m/walls/wall-types");
}

export function get_structure_required_factors(id: string): Promise<MissingFactorDTO[]> {
  return request<MissingFactorDTO[]>("POST", `/m/walls/structures/${encodeURIComponent(id)}/required-factors`);
}

export function size_wall(id: string): Promise<JobRef> {
  return request<JobRef>("POST", `/m/walls/structures/${encodeURIComponent(id)}/size`);
}

export function check_wall(id: string): Promise<JobRef> {
  return request<JobRef>("POST", `/m/walls/structures/${encodeURIComponent(id)}/check`);
}
