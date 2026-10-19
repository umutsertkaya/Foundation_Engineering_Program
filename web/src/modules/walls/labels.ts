import type { CheckDTO, WallResultDTO } from "../../shared/api/types";

/** Translator signature used by the pure helpers (compatible with i18next `t`). */
export type Translate = (key: string, options?: Record<string, unknown>) => string;

export interface CaseParts {
  /** `static` or `seismic`. */
  state: string;
  /** Design-code combination (`TBDY-seismic`, `DA1-C1`, `EQU`, `Strength I`) when the code has one. */
  combo: string | null;
}

/**
 * `CheckDTO.case` is `<state>` for global-FS codes (ASD) and `<state>:<combination>` for
 * partial-factor / LRFD codes (`_case_key` in `geotek/services/structures.py`).
 */
export function splitCase(caseId: string): CaseParts {
  const i = caseId.indexOf(":");
  return i < 0 ? { state: caseId, combo: null } : { state: caseId.slice(0, i), combo: caseId.slice(i + 1) };
}

export function checkKey(check: Pick<CheckDTO, "case" | "name">): string {
  return `${check.case}:${check.name}`;
}

/** Splits a `<case>:<name>` key on its LAST colon (the case itself may contain one). */
export function splitCheckKey(key: string): { case: string; name: string } | null {
  const i = key.lastIndexOf(":");
  return i <= 0 ? null : { case: key.slice(0, i), name: key.slice(i + 1) };
}

export function stateLabel(state: string, t: Translate): string {
  return t(`case.${state}`, { defaultValue: state });
}

export function comboLabel(combo: string, t: Translate): string {
  return t(`walls.term.${combo}`, { defaultValue: combo });
}

export function checkNameLabel(name: string, t: Translate): string {
  return t(`check.${name}`, { defaultValue: name });
}

/** Full readable case label: "Deprem · TBDY depremli durum". */
export function caseLabel(caseId: string, t: Translate): string {
  const { state, combo } = splitCase(caseId);
  const s = stateLabel(state, t);
  return combo === null ? s : `${s} · ${comboLabel(combo, t)}`;
}

/** Readable `<case>:<name>` key ("Deprem · Taşıma gücü"); unknown keys are returned as given. */
export function checkKeyLabel(key: string, t: Translate): string {
  const parts = splitCheckKey(key);
  return parts === null ? key : `${caseLabel(parts.case, t)} · ${checkNameLabel(parts.name, t)}`;
}

/** Readable factor path (`TBDY-seismic.material.tan_phi`); the raw path stays available as a tooltip. */
export function factorPathLabel(path: string, t: Translate): string {
  return path
    .split(".")
    .map((segment) => t(`walls.term.${segment}`, { defaultValue: segment }))
    .join(" › ");
}

export type KvDirection = "up" | "down";

/**
 * In envelope mode the engine prefixes the check detail with the governing kv sign
 * (`_kv_detail`: "kv yukarı: " / "kv aşağı: "). The prefix is stripped here and shown as a badge.
 */
const KV_PREFIX = /^kv (yukarı|aşağı): /;

export function parseKvSign(detail: string): { direction: KvDirection | null; text: string } {
  const m = KV_PREFIX.exec(detail);
  if (!m) return { direction: null, text: detail };
  return { direction: m[1] === "yukarı" ? "up" : "down", text: detail.slice(m[0].length) };
}

export type GoverningKind = "failing" | "sizing" | "critical" | "minimum_width";

export interface GoverningInfo {
  kind: GoverningKind | null;
  /** Keys (`<case>:<name>`) of the cards to highlight. */
  keys: string[];
}

/**
 * Larger = closer to / past the limit. `utilisation` is null when undefined; a failing check
 * with undefined utilisation is treated as the worst.
 */
function severity(check: CheckDTO): number {
  if (check.utilisation !== null && Number.isFinite(check.utilisation)) return check.utilisation;
  return check.passed ? -1 : Number.POSITIVE_INFINITY;
}

export function criticalCheck(checks: CheckDTO[]): CheckDTO | null {
  let best: CheckDTO | null = null;
  for (const check of checks) {
    if (best === null || severity(check) > severity(best)) best = check;
  }
  return best;
}

/**
 * `WallResultDTO.governing` is free text: a comma list of failing `<case>:<name>` keys, the check
 * that last forced a width increase when sizing, "minimum width", or empty when a check passes.
 * Resolve it against the checks and fall back to the highest-utilisation check.
 */
export function deriveGoverning(
  result: Pick<WallResultDTO, "governing" | "passed" | "checks">,
  mode: "suggest" | "check",
): GoverningInfo {
  const known = new Set(result.checks.map(checkKey));
  const tokens = result.governing
    .split(",")
    .map((s) => s.trim())
    .filter((s) => known.has(s));
  if (!result.passed && tokens.length > 0) return { kind: "failing", keys: tokens };
  if (result.passed && mode === "suggest" && tokens.length > 0) return { kind: "sizing", keys: [tokens[0]] };
  const critical = criticalCheck(result.checks);
  if (!critical) return { kind: null, keys: [] };
  const minimumWidth = result.passed && mode === "suggest" && result.governing.trim() === "minimum width";
  return { kind: minimumWidth ? "minimum_width" : "critical", keys: [checkKey(critical)] };
}

export function utilisationPercent(check: CheckDTO): number | null {
  return check.utilisation !== null && Number.isFinite(check.utilisation)
    ? Math.round(check.utilisation * 100)
    : null;
}
