import { request, request_blob } from "../../shared/api/http";
import type { BlobResult } from "../../shared/api/http";
import type { components } from "../../shared/api/schema";
import type { JobRef, Language } from "../../shared/api/types";

export type ReportSection = components["schemas"]["ReportSectionDTO"];

export function run_report(): Promise<JobRef> {
  return request<JobRef>("POST", "/m/report/run");
}

export function list_report_sections(): Promise<ReportSection[]> {
  return request<ReportSection[]>("GET", "/m/report/sections");
}

export function build_report_docx(sections: string[], language: Language): Promise<BlobResult> {
  return request_blob("POST", "/m/report/docx", { sections, language });
}
