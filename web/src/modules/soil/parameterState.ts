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
