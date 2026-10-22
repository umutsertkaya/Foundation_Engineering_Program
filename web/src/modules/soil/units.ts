import type { DesignKey } from "../../shared/api/types";

const REPLACEMENTS: [RegExp, string][] = [
  [/\bdeg\b/g, "\u00b0"],
  [/m3\b/g, "m\u00b3"],
  [/m2\b/g, "m\u00b2"],
];

/** Display form of a unit string coming from the API (kN/m3 -> kN/m³, deg -> °). */
export function displayUnit(unit: string | null | undefined): string {
  if (!unit) return "";
  return REPLACEMENTS.reduce((s, [re, to]) => s.replace(re, to), unit);
}

/** Unit of each design key (mirrors the backend key definition), independent of any candidate. */
export const KEY_UNITS: Record<DesignKey, string> = {
  phi_eff: "deg",
  c_eff: "kPa",
  su: "kPa",
  E: "kPa",
  gamma: "kN/m3",
  gamma_sat: "kN/m3",
  delta_base: "deg",
};
