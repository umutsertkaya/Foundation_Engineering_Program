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
