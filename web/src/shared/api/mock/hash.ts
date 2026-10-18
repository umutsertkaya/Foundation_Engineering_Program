import type { SoilProfile } from "../types";

/** JSON with sorted keys; `undefined` members are dropped (like JSON.stringify). */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const rec = value as Record<string, unknown>;
  const keys = Object.keys(rec)
    .filter((k) => rec[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(rec[k])}`).join(",")}}`;
}

function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Mock stand-in for `SoilProfile.content_hash()`: engineering content only, i.e. without the
 * correlation candidates (`params`) and selection bookkeeping (`selections`) of each layer.
 */
export function mockProfileHash(profile: SoilProfile): string {
  const content = {
    ...profile,
    layers: profile.layers.map((layer) => {
      const { params: _params, selections: _selections, ...rest } = layer;
      return rest;
    }),
  };
  return `mock-${fnv1a(stableStringify(content))}`;
}
