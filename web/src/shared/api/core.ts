import { isMockMode, request, request_upload } from "./http";
import type {
  AppSettings, LibraryEntry, LibraryExportRequest, ModuleInfo, NewProjectRequest, ProfileSummary,
  SessionInfo,
} from "./types";

export function list_modules(): Promise<ModuleInfo[]> {
  return request<ModuleInfo[]>("GET", "/modules");
}

export function get_settings(): Promise<AppSettings> {
  return request<AppSettings>("GET", "/settings");
}

export function put_settings(payload: AppSettings): Promise<AppSettings> {
  return request<AppSettings>("PUT", "/settings", payload);
}

export function list_library(): Promise<LibraryEntry[]> {
  return request<LibraryEntry[]>("GET", "/library");
}

export function create_library_project(payload: NewProjectRequest): Promise<LibraryEntry> {
  return request<LibraryEntry>("POST", "/library", payload);
}

export function open_library_project(file: string): Promise<SessionInfo> {
  return request<SessionInfo>("POST", `/library/${encodeURIComponent(file)}/open`);
}

export function duplicate_library_project(file: string): Promise<LibraryEntry> {
  return request<LibraryEntry>("POST", `/library/${encodeURIComponent(file)}/duplicate`);
}

export function rename_library_project(file: string, name: string): Promise<LibraryEntry> {
  return request<LibraryEntry>("POST", `/library/${encodeURIComponent(file)}/rename`, { name });
}

export function export_library_project(
  file: string,
  dest: string,
  overwrite = false,
): Promise<{ path: string }> {
  const payload: LibraryExportRequest = { dest, overwrite };
  return request<{ path: string }>("POST", `/library/${encodeURIComponent(file)}/export`, payload);
}

export function delete_library_project(file: string): Promise<{ trash_path: string }> {
  return request<{ trash_path: string }>("DELETE", `/library/${encodeURIComponent(file)}`);
}

export function import_library_project(path: string): Promise<LibraryEntry> {
  return request<LibraryEntry>("POST", "/library/import", { path });
}

/** Import a project file chosen in the browser's file dialog (the file is sent, no server path is needed). */
export async function upload_library_project(file: File): Promise<LibraryEntry> {
  if (isMockMode()) return import_library_project(file.name);
  return request_upload<LibraryEntry>(
    `/library/upload?name=${encodeURIComponent(file.name)}`, file, { "Content-Type": "application/octet-stream" },
  );
}

/** URL the browser downloads the stored project file from. */
export function library_download_url(file: string): string {
  return `/api/library/${encodeURIComponent(file)}/download`;
}

export function get_session(): Promise<SessionInfo> {
  return request<SessionInfo>("GET", "/session");
}

export function save_current_project(): Promise<SessionInfo> {
  return request<SessionInfo>("POST", "/project/save");
}

export function open_project_at(path: string): Promise<unknown> {
  return request<unknown>("POST", "/project/open", { path });
}

export function save_project_as(path: string): Promise<SessionInfo> {
  return request<SessionInfo>("POST", "/project/save", { path });
}

export function close_project(): Promise<SessionInfo> {
  return request<SessionInfo>("POST", "/project/close");
}

/** Read-only list of the open project's soil profiles (core, so other modules need not import soil). */
export function list_project_profiles(): Promise<ProfileSummary[]> {
  return request<ProfileSummary[]>("GET", "/data/profiles");
}
