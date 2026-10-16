/**
 * Per-layer parameter status badge (display only).
 *
 * Required design keys depend on the drainage behaviour: drained layers need φ', undrained
 * layers need s_u. When the layer carries `selections`, a required key is "approved" when its
 * selection is approved, "suggested" when a proposal/candidates exist but are not approved;
 * otherwise (or without selections) the `design` value decides: design holds only confirmed
 * values (P1 contract §7), so a present value counts as approved.
 */
import type { DesignKey, SoilLayer } from "../api/types";

export type ParamStatus = "approved" | "suggested" | "missing";

export function requiredDesignKeys(layer: Pick<SoilLayer, "behaviour">): DesignKey[] {
  return layer.behaviour === "undrained" ? ["su"] : ["phi_eff"];
}

function designValue(layer: SoilLayer, key: DesignKey): number | null {
  const d = layer.design ?? {};
  let v: number | null | undefined;
  switch (key) {
    case "phi_eff":
      v = d.phi_eff;
      break;
    case "su":
      v = d.su;
      break;
    case "c_eff":
      v = d.c_eff;
      break;
    case "E":
      v = d.E;
      break;
    case "delta_base":
      v = d.delta_base;
      break;
    case "gamma":
      v = layer.gamma;
      break;
    case "gamma_sat":
      v = layer.gamma_sat;
      break;
    default:
      v = null;
  }
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function keyStatus(layer: SoilLayer, key: DesignKey, approvalsStale: boolean): ParamStatus {
  const sel = layer.selections?.[key];
  if (sel) {
    // An approval made for other layer bounds is stale (P1 contract §6): show it as a proposal.
    if (sel.approved) return approvalsStale ? "suggested" : "approved";
    if (sel.suggested || sel.selected || (sel.candidates?.length ?? 0) > 0) return "suggested";
  }
  return designValue(layer, key) !== null ? "approved" : "missing";
}

export interface StatusOptions {
  /** The layer bounds changed since the approvals were made (e.g. edited, not yet re-approved). */
  approvalsStale?: boolean;
}

export function layerParamStatus(layer: SoilLayer, options: StatusOptions = {}): ParamStatus {
  const stale = options.approvalsStale ?? false;
  const statuses = requiredDesignKeys(layer).map((k) => keyStatus(layer, k, stale));
  if (statuses.includes("missing")) return "missing";
  if (statuses.includes("suggested")) return "suggested";
  return "approved";
}

/** True when a required key carries an approved selection (used for the stale-approval hint). */
export function hasApprovedSelection(layer: SoilLayer): boolean {
  return requiredDesignKeys(layer).some((k) => Boolean(layer.selections?.[k]?.approved));
}

export const PARAM_STATUS_COLOR: Record<ParamStatus, string> = {
  approved: "green",
  suggested: "yellow",
  missing: "red",
};
