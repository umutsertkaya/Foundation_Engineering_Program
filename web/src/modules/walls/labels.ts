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
 * In envelope mode the engine also prefixes the detail text with the governing kv sign ("kv yukarı: " /
 * "kv aşağı: "). The sign itself comes from `CheckDTO.kv_sign`; the prefix is only stripped from the
 * displayed text, and only for the expected sign.
 */
const KV_PREFIX: Record<KvDirection, string> = { up: "kv yukarı: ", down: "kv aşağı: " };

export function stripKvPrefix(detail: string, sign: KvDirection | null | undefined): string {
  if (!sign) return detail;
  const prefix = KV_PREFIX[sign];
  return detail.startsWith(prefix) ? detail.slice(prefix.length) : detail;
}

export type GoverningKind = "failing" | "sizing" | "critical" | "minimum_width";

export interface GoverningInfo {
  kind: GoverningKind | null;
  /** Keys (`<case>:<name>`) of the cards to highlight. */
  keys: string[];
}

/** Larger = closer to / past the limit; a failing check with undefined utilisation is the worst. */
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
 * Governing checks come from the structured result fields: `governing_check_ids` (the failing checks, or
 * after a passing size run the check that last set the width) and `minimum_width_governs`. Only when the
 * result names none (a passing check run) is the highest-utilisation check shown, as "most critical".
 */
export function deriveGoverning(
  result: Pick<WallResultDTO, "passed" | "checks" | "governing_check_ids" | "minimum_width_governs">,
): GoverningInfo {
  const known = new Set(result.checks.map(checkKey));
  const ids = (result.governing_check_ids ?? []).filter((id) => known.has(id));
  if (ids.length > 0) return { kind: result.passed ? "sizing" : "failing", keys: result.passed ? [ids[0]] : ids };
  if (result.minimum_width_governs) return { kind: "minimum_width", keys: [] };
  const critical = criticalCheck(result.checks);
  return critical ? { kind: "critical", keys: [checkKey(critical)] } : { kind: null, keys: [] };
}

export function utilisationPercent(check: CheckDTO): number | null {
  return check.utilisation !== null && Number.isFinite(check.utilisation)
    ? Math.round(check.utilisation * 100)
    : null;
}
