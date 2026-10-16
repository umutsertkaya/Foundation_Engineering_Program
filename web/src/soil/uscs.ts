/**
 * ASTM D2487 group symbols, including dual symbols.
 * Mirrors `USCS_SYMBOLS` in `geotek/core/models/investigations.py` (same members; ordered for display).
 */
export const USCS_SYMBOLS: readonly string[] = [
  "GW",
  "GP",
  "GM",
  "GC",
  "GW-GM",
  "GW-GC",
  "GP-GM",
  "GP-GC",
  "GC-GM",
  "SW",
  "SP",
  "SM",
  "SC",
  "SW-SM",
  "SW-SC",
  "SP-SM",
  "SP-SC",
  "SC-SM",
  "ML",
  "CL",
  "CL-ML",
  "OL",
  "MH",
  "CH",
  "OH",
  "PT",
];

const USCS_SET = new Set(USCS_SYMBOLS);

export function normaliseUscs(symbol: string | null | undefined): string | null {
  if (symbol === null || symbol === undefined) return null;
  const s = symbol.trim().toUpperCase();
  return s.length > 0 ? s : null;
}

export function isUscsSymbol(symbol: string | null | undefined): boolean {
  const s = normaliseUscs(symbol);
  return s !== null && USCS_SET.has(s);
}
