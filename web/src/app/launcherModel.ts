import type { ProjectSummary, StructureSummary } from "../shared/api/types";
import type { StatusTone } from "../shared/components/StatusChip";

export type LauncherGroup = "soil" | "analysis" | "output";

export const LAUNCHER_GROUPS: readonly LauncherGroup[] = ["soil", "analysis", "output"];

const GROUP_BY_MODULE: Record<string, LauncherGroup> = {
  soil: "soil",
  liquefaction: "analysis",
  walls: "analysis",
  sheet_pile: "analysis",
  anchored_wall: "analysis",
  report: "output",
  education: "output",
};

/** Launcher group of a module id; unknown modules fall back to the analyses group. */
export function groupOfModule(moduleId: string): LauncherGroup {
  return GROUP_BY_MODULE[moduleId] ?? "analysis";
}

/** A translatable fragment: i18n key plus interpolation values. */
export interface StatusPart {
  key: string;
  values?: Record<string, number>;
}

export interface ModuleStatus {
  /** Colour of the dot in front of the status line. */
  tone: StatusTone;
  parts: StatusPart[];
  /** Optional chip on the right of the status line. */
  chip?: { tone: StatusTone; key: string };
}

export interface NextStep {
  kind: "profile" | "rerun";
  moduleId: string;
  titleKey: string;
  textKey: string;
  textValues?: Record<string, number>;
  actionKey: string;
}

const KIND_MODULE: Record<StructureSummary["kind"], string> = {
  retaining_wall: "walls",
  sheet_pile: "sheet_pile",
};

function structureLine(items: StructureSummary[]): ModuleStatus {
  if (items.length === 0) return { tone: "neutral", parts: [{ key: "launcher.status.none" }] };
  const withResult = items.filter((item) => item.has_result);
  const stale = withResult.filter((item) => item.stale).length;
  const current = withResult.length - stale;
  const missing = items.length - withResult.length;
  const parts: StatusPart[] = [{ key: "launcher.status.records", values: { count: items.length } }];
  if (current > 0) parts.push({ key: "launcher.status.results_current", values: { count: current } });
  if (stale > 0) parts.push({ key: "launcher.status.results_stale", values: { count: stale } });
  if (missing > 0) parts.push({ key: "launcher.status.results_none", values: { count: missing } });
  if (stale > 0) return { tone: "stale", parts, chip: { tone: "stale", key: "launcher.chip.rerun" } };
  if (missing === 0) return { tone: "current", parts, chip: { tone: "current", key: "launcher.chip.current" } };
  return { tone: "neutral", parts };
}

/** Status line of a module card, built only from the project summary the launcher already holds. */
export function moduleStatus(moduleId: string, project: ProjectSummary | null): ModuleStatus {
  const counts = project?.counts;
  const structures = project?.structures ?? [];
  switch (moduleId) {
    case "soil":
      return {
        tone: (counts?.profiles ?? 0) === 0 ? "missing" : "neutral",
        parts: [{
          key: "launcher.status.soil_counts",
          values: { boreholes: counts?.boreholes ?? 0, cpts: counts?.cpts ?? 0, profiles: counts?.profiles ?? 0 },
        }],
        chip: (counts?.profiles ?? 0) === 0 ? { tone: "missing", key: "launcher.chip.no_profile" } : undefined,
      };
    case "walls":
      return structureLine(structures.filter((item) => item.kind === "retaining_wall"));
    case "sheet_pile":
      return structureLine(structures.filter((item) => item.kind === "sheet_pile"));
    case "report": {
      const withResult = structures.filter((item) => item.has_result);
      const stale = withResult.filter((item) => item.stale).length;
      const ready = withResult.length - stale;
      if (withResult.length === 0) return { tone: "neutral", parts: [{ key: "launcher.status.report_none" }] };
      const parts: StatusPart[] = [{ key: "launcher.status.report_ready", values: { count: ready } }];
      if (stale > 0) parts.push({ key: "launcher.status.results_stale", values: { count: stale } });
      return { tone: stale > 0 ? "stale" : "current", parts };
    }
    case "education":
      return { tone: "neutral", parts: [{ key: "launcher.status.independent" }] };
    default:
      // liquefaction, anchored_wall and unknown modules: no per-module state is readable here, so show the profile count only.
      return (counts?.profiles ?? 0) === 0
        ? { tone: "missing", parts: [{ key: "launcher.status.profile_needed" }] }
        : { tone: "neutral", parts: [{ key: "launcher.status.profiles_available", values: { count: counts?.profiles ?? 0 } }] };
  }
}

/** The one next step that can be read from the project data, or null when none is certain. */
export function nextStep(project: ProjectSummary | null): NextStep | null {
  if (!project) return null;
  if (project.counts.profiles === 0) {
    const noData = project.counts.boreholes + project.counts.cpts === 0;
    return {
      kind: "profile",
      moduleId: "soil",
      titleKey: "launcher.next.profile.title",
      textKey: noData ? "launcher.next.profile.text_no_data" : "launcher.next.profile.text",
      actionKey: "launcher.next.profile.action",
    };
  }
  const stale = project.structures.filter((item) => item.has_result && item.stale);
  if (stale.length > 0) {
    return {
      kind: "rerun",
      moduleId: KIND_MODULE[stale[0].kind],
      titleKey: "launcher.next.rerun.title",
      textKey: "launcher.next.rerun.text",
      textValues: { count: stale.length },
      actionKey: "launcher.next.rerun.action",
    };
  }
  return null;
}
