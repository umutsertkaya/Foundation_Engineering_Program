import type { DerivedParameter, ParameterSelection, SelectionUpdate, Statistic } from "../../shared/api/types";

/**
 * The DTO has no `stale` flag. After a refresh, a selection whose approval no longer holds keeps its
 * trace (`selected`, `approved_at`, `basis_hash`) with `approved = false` (see refresh_profile in
 * geotek/services/parameters.py); an engineer edit (PUT) clears the trace. So: stale means
 * "not approved but an approval timestamp is still on record".
 */
export type ApprovalState = "approved" | "stale" | "unapproved";

export function approvalState(selection: ParameterSelection): ApprovalState {
  if (selection.approved) return "approved";
  if (selection.approved_at) return "stale";
  return "unapproved";
}

/** There is no "suggested" mode on the wire: it is the correlation mode with the suggestion's method id. */
export type PickMode = "suggested" | "method" | "statistic" | "manual";

export const STATISTICS: Statistic[] = ["mean", "median", "min", "max", "mean_minus_k_sd"];

export interface SelectionDraft {
  pick: PickMode | null;
  method_id: string;
  statistic: Statistic;
  /** User-entered; never defaulted by the program. "" means not entered. */
  k_sd: number | "";
  manual_value: number | "";
}

export function validCandidates(selection: ParameterSelection): DerivedParameter[] {
  return (selection.candidates ?? []).filter((c) => c.validity_ok !== false && Number.isFinite(c.value));
}

export function draftFromSelection(selection: ParameterSelection): SelectionDraft {
  const draft: SelectionDraft = {
    pick: null,
    method_id: selection.candidates?.[0]?.method_id ?? "",
    statistic: "mean",
    k_sd: "",
    manual_value: "",
  };
  if (selection.mode === "correlation") {
    const suggestedId = selection.suggested?.method_id;
    draft.pick = suggestedId !== undefined && selection.method_id === suggestedId ? "suggested" : "method";
    if (selection.method_id) draft.method_id = selection.method_id;
  } else if (selection.mode === "statistic") {
    draft.pick = "statistic";
    draft.statistic = selection.statistic ?? "mean";
    draft.k_sd = selection.k_sd ?? "";
  } else if (selection.mode === "manual") {
    draft.pick = "manual";
    draft.manual_value = selection.manual_value ?? "";
  }
  return draft;
}

/** The PUT body for a draft, or null while the draft is incomplete or invalid. */
export function buildUpdate(draft: SelectionDraft, selection: ParameterSelection): SelectionUpdate | null {
  switch (draft.pick) {
    case "suggested":
      return selection.suggested ? { mode: "correlation", method_id: selection.suggested.method_id } : null;
    case "method":
      return draft.method_id ? { mode: "correlation", method_id: draft.method_id } : null;
    case "statistic":
      if (validCandidates(selection).length === 0) return null;
      if (draft.statistic === "mean_minus_k_sd") {
        return draft.k_sd === "" || !(draft.k_sd >= 0)
          ? null
          : { mode: "statistic", statistic: draft.statistic, k_sd: draft.k_sd };
      }
      return { mode: "statistic", statistic: draft.statistic };
    case "manual":
      return draft.manual_value === "" || !Number.isFinite(draft.manual_value)
        ? null
        : { mode: "manual", manual_value: draft.manual_value };
    default:
      return null;
  }
}

function sameNumber(a: number | "" | null | undefined, b: number | "" | null | undefined): boolean {
  return (a === "" || a === null || a === undefined ? null : a) === (b === "" || b === null || b === undefined ? null : b);
}

/** True when the draft differs from what the server has stored (so it still needs "Apply"). */
export function isDirty(draft: SelectionDraft, selection: ParameterSelection): boolean {
  const stored = draftFromSelection(selection);
  if (draft.pick !== stored.pick) return true;
  switch (draft.pick) {
    case "method":
      return draft.method_id !== stored.method_id;
    case "statistic":
      return draft.statistic !== stored.statistic || (draft.statistic === "mean_minus_k_sd" && !sameNumber(draft.k_sd, stored.k_sd));
    case "manual":
      return !sameNumber(draft.manual_value, stored.manual_value);
    default:
      return false;
  }
}

export function formatValue(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return String(Number(value.toPrecision(5)));
}

/**
 * The value the server would approve for this selection: the explicit choice re-resolved against the
 * candidates it just returned (same rules as `resolve` in geotek/services/parameters.py: statistics
 * over valid finite candidates, population SD). Null when the choice cannot be resolved.
 */
export function previewValue(selection: ParameterSelection): number | null {
  switch (selection.mode) {
    case "manual":
      return selection.manual_value !== null && selection.manual_value !== undefined && Number.isFinite(selection.manual_value)
        ? selection.manual_value
        : null;
    case "correlation": {
      const pool = [...(selection.candidates ?? []), ...(selection.suggested ? [selection.suggested] : [])];
      return pool.find((c) => c.method_id === selection.method_id)?.value ?? null;
    }
    case "statistic": {
      const values = validCandidates(selection).map((c) => c.value);
      if (values.length === 0) return null;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const sorted = [...values].sort((a, b) => a - b);
      switch (selection.statistic) {
        case "mean":
          return mean;
        case "median": {
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        }
        case "min":
          return sorted[0];
        case "max":
          return sorted[sorted.length - 1];
        case "mean_minus_k_sd": {
          if (selection.k_sd === null || selection.k_sd === undefined) return null;
          const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
          return mean - selection.k_sd * sd;
        }
        default:
          return null;
      }
    }
    default:
      return null;
  }
}

/**
 * Whether the stored selection may be approved as shown.
 * - `ready`: not approved, a selection is applied, and its value equals what the server would approve;
 * - `stale`: the old approval no longer holds, so the choice must be applied again (PUT) first;
 * - `outdated`: candidates changed after the choice was applied, so the shown value is not what would be approved;
 * - `no_selection`: nothing applied yet; `approved`: nothing to do.
 */
export type Readiness = "ready" | "stale" | "outdated" | "no_selection" | "approved";

export function readiness(selection: ParameterSelection): Readiness {
  const state = approvalState(selection);
  if (state === "approved") return "approved";
  if (state === "stale") return "stale";
  if (!selection.selected || !selection.mode) return "no_selection";
  const preview = previewValue(selection);
  if (preview === null) return "outdated";
  const shown = selection.selected.value;
  const tolerance = 1e-9 * Math.max(1, Math.abs(shown), Math.abs(preview));
  return Math.abs(preview - shown) <= tolerance ? "ready" : "outdated";
}

/** Unit weights come first: every stress-dependent correlation rests on them. Other keys keep their order. */
const UNIT_WEIGHT_KEYS: readonly string[] = ["gamma", "gamma_sat"];

export function orderSelections(selections: ParameterSelection[]): ParameterSelection[] {
  const rank = (s: ParameterSelection) => {
    const i = UNIT_WEIGHT_KEYS.indexOf(s.parameter);
    return i < 0 ? UNIT_WEIGHT_KEYS.length : i;
  };
  return selections
    .map((selection, index) => ({ selection, index }))
    .sort((a, b) => rank(a.selection) - rank(b.selection) || a.index - b.index)
    .map((e) => e.selection);
}

/** The i18n key explaining a withdrawn approval; null when the approval is not withdrawn. */
export function staleReasonKey(selection: ParameterSelection): string | null {
  if (approvalState(selection) !== "stale") return null;
  return `soil.params.stale_reason.${selection.stale_reason ?? "data_changed"}`;
}

export interface RefreshedDiff {
  oldValue: number;
  newValue: number;
  unit: string;
  diff: number;
  /** Percent of the old value; null when the old value is zero. */
  percent: number | null;
}

/** Approved (old) value against the value the current inputs give; null unless the approval is withdrawn and a new value exists. */
export function refreshedDiff(selection: ParameterSelection): RefreshedDiff | null {
  if (approvalState(selection) !== "stale") return null;
  const refreshed = selection.refreshed;
  const old = selection.selected;
  if (!refreshed || !old || !Number.isFinite(refreshed.value) || !Number.isFinite(old.value)) return null;
  const diff = refreshed.value - old.value;
  return {
    oldValue: old.value,
    newValue: refreshed.value,
    unit: refreshed.unit || old.unit,
    diff,
    percent: old.value === 0 ? null : (diff / Math.abs(old.value)) * 100,
  };
}

export function formatPercent(percent: number | null): string {
  if (percent === null || !Number.isFinite(percent)) return "-";
  const rounded = Math.round(percent * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)} %`;
}

export function formatDiff(diff: number): string {
  return `${diff > 0 ? "+" : ""}${formatValue(diff)}`;
}
