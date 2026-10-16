import { request } from "./http";
import type { AppSettings, LibraryEntry, ModuleInfo, NewProjectRequest, SessionInfo } from "./types";

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

export function export_library_project(file: string, dest: string): Promise<{ path: string }> {
  return request<{ path: string }>("POST", `/library/${encodeURIComponent(file)}/export`, { dest });
}

export function delete_library_project(file: string): Promise<{ trash_path: string }> {
  return request<{ trash_path: string }>("DELETE", `/library/${encodeURIComponent(file)}`);
}

export function import_library_project(path: string): Promise<LibraryEntry> {
  return request<LibraryEntry>("POST", "/library/import", { path });
}

export function get_session(): Promise<SessionInfo> {
  return request<SessionInfo>("GET", "/session");
}

export function save_current_project(): Promise<SessionInfo> {
  return request<SessionInfo>("POST", "/project/save");
}

export function close_project(): Promise<SessionInfo> {
  return request<SessionInfo>("POST", "/project/close");
}
