import type { SoilLayer } from "../api/types";

export function fmt(v: number | null | undefined, digits = 1): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "—";
}

/** Human label of a layer: its depth range (m) and USCS symbol; layer ids are internal and may be UUIDs. */
export function layerLabel(layer: Pick<SoilLayer, "top" | "bottom" | "uscs">): string {
  const range = `${fmt(layer.top, 2)}–${fmt(layer.bottom, 2)} m`;
  return layer.uscs ? `${range} · ${layer.uscs}` : range;
}

/** Compact strength summary for labels: φ' for drained, s_u for undrained layers. */
export function strengthText(layer: SoilLayer): string {
  const d = layer.design ?? {};
  if (layer.behaviour === "undrained") {
    return typeof d.su === "number" ? `sᵤ ${fmt(d.su, 0)} kPa` : "sᵤ —";
  }
  const phi = typeof d.phi_eff === "number" ? `φ' ${fmt(d.phi_eff, 0)}°` : "φ' —";
  const c = typeof d.c_eff === "number" && d.c_eff > 0 ? ` c' ${fmt(d.c_eff, 0)}` : "";
  return `${phi}${c}`;
}

export function truncate(text: string, maxChars: number): string {
  if (maxChars <= 1) return "";
  return text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 1))}…` : text;
}
