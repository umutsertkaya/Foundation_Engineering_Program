/**
 * Pure, immutable layer-list operations and client-side validation for soil layer editors.
 *
 * The validation mirrors the pydantic validators in `geotek/core/models/profile.py`
 * (`SoilLayer`, `DesignParameters`, `SoilProfile._contiguous`) and
 * `geotek/core/models/structures.py` (`StructureSoilModel._check_fill`,
 * `RetainingWallStructure._check`). It adds no engineering rules of its own; the server
 * remains the authority. Every function returns a new array and never mutates its input.
 */
import type { DesignKey, DesignParameters, GroundwaterCondition, ParameterSelection, SoilLayer } from "../api/types";

/** Same tolerance as `geotek.core.constants.DEPTH_TOL` [m]. */
export const DEPTH_TOL = 1e-6;

export type LayerField =
  | "id"
  | "top"
  | "bottom"
  | "gamma"
  | "gamma_sat"
  | "phi_eff"
  | "c_eff"
  | "su"
  | "E"
  | "delta_base";

export type DesignField = keyof DesignParameters;

export const LAYER_ERROR_CODES = [
  "empty",
  "first_top",
  "contiguity",
  "duplicate_id",
  "empty_id",
  "top_negative",
  "bottom_le_top",
  "gamma_range",
  "gamma_sat_range",
  "phi_range",
  "c_negative",
  "su_negative",
  "E_positive",
  "delta_range",
  "min_bottom",
  "fill_below_profile",
  "id_clash",
  "gwt_negative",
] as const;

export type LayerErrorCode = (typeof LAYER_ERROR_CODES)[number];

export interface LayerIssue {
  code: LayerErrorCode;
  /** Index of the offending layer in the list (undefined for list-level issues). */
  index?: number;
  field?: LayerField | "gwt";
  params?: Record<string, string | number>;
}

export function layerErrorKey(code: LayerErrorCode): string {
  return `web.soil.error.${code}`;
}

export interface ValidateOptions {
  /** First layer must start at z = 0 (profiles and retained fill). Default true. */
  mustStartAtZero?: boolean;
  /** The last layer bottom must lie strictly below this depth (e.g. the wall base). */
  minBottom?: number;
  /** An empty list is valid (retained fill). Default false. */
  allowEmpty?: boolean;
}

function isNum(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function present(v: number | null | undefined): boolean {
  return v !== null && v !== undefined;
}

/** Validates one list of layers; mirrors the Python model validators. */
export function validateLayers(layers: SoilLayer[], options: ValidateOptions = {}): LayerIssue[] {
  const { mustStartAtZero = true, minBottom, allowEmpty = false } = options;
  const issues: LayerIssue[] = [];
  if (layers.length === 0) {
    return allowEmpty ? issues : [{ code: "empty" }];
  }

  if (mustStartAtZero && !(isNum(layers[0].top) && Math.abs(layers[0].top) <= DEPTH_TOL)) {
    issues.push({ code: "first_top", index: 0, field: "top" });
  }

  const seen = new Set<string>();
  layers.forEach((layer, index) => {
    const id = (layer.id ?? "").trim();
    if (id.length === 0) {
      issues.push({ code: "empty_id", index, field: "id" });
    } else if (seen.has(id)) {
      issues.push({ code: "duplicate_id", index, field: "id", params: { id } });
    }
    seen.add(id);

    if (!isNum(layer.top) || layer.top < 0) {
      issues.push({ code: "top_negative", index, field: "top" });
    }
    if (!isNum(layer.bottom) || !isNum(layer.top) || layer.bottom <= layer.top) {
      issues.push({ code: "bottom_le_top", index, field: "bottom", params: { id } });
    }
    if (index > 0) {
      const upper = layers[index - 1];
      if (!(Math.abs(upper.bottom - layer.top) <= DEPTH_TOL)) {
        issues.push({ code: "contiguity", index, field: "top", params: { a: upper.id, b: id } });
      }
    }

    if (!isNum(layer.gamma) || layer.gamma <= 5 || layer.gamma >= 30) {
      issues.push({ code: "gamma_range", index, field: "gamma" });
    }
    if (present(layer.gamma_sat)) {
      const g = layer.gamma_sat as number;
      if (!isNum(g) || g <= 5 || g >= 30) {
        issues.push({ code: "gamma_sat_range", index, field: "gamma_sat" });
      }
    }

    const d = layer.design ?? {};
    if (present(d.phi_eff) && (!isNum(d.phi_eff) || d.phi_eff < 0 || d.phi_eff > 60)) {
      issues.push({ code: "phi_range", index, field: "phi_eff" });
    }
    if (present(d.c_eff) && (!isNum(d.c_eff) || d.c_eff < 0)) {
      issues.push({ code: "c_negative", index, field: "c_eff" });
    }
    if (present(d.su) && (!isNum(d.su) || d.su < 0)) {
      issues.push({ code: "su_negative", index, field: "su" });
    }
    if (present(d.E) && (!isNum(d.E) || d.E <= 0)) {
      issues.push({ code: "E_positive", index, field: "E" });
    }
    if (present(d.delta_base) && (!isNum(d.delta_base) || d.delta_base < 0 || d.delta_base > 60)) {
      issues.push({ code: "delta_range", index, field: "delta_base" });
    }
  });

  if (minBottom !== undefined) {
    const last = layers[layers.length - 1];
    if (!(isNum(last.bottom) && last.bottom > minBottom + DEPTH_TOL)) {
      issues.push({
        code: "min_bottom",
        index: layers.length - 1,
        field: "bottom",
        params: { z: minBottom.toFixed(2) },
      });
    }
  }
  return issues;
}

/** Groundwater depths must be >= 0 (design/seismic may be empty = in-situ). */
export function validateGwt(gwt: GroundwaterCondition | null | undefined): LayerIssue[] {
  if (!gwt) return [];
  const bad =
    !isNum(gwt.depth_insitu) ||
    gwt.depth_insitu < 0 ||
    (present(gwt.depth_design) && (!isNum(gwt.depth_design) || (gwt.depth_design as number) < 0)) ||
    (present(gwt.depth_seismic) && (!isNum(gwt.depth_seismic) || (gwt.depth_seismic as number) < 0));
  return bad ? [{ code: "gwt_negative", field: "gwt" }] : [];
}

export interface StructureSoilIssues {
  fill: LayerIssue[];
  profile: LayerIssue[];
}

/**
 * Structure soil checks: `StructureSoilModel._check_fill` plus the wall rule that the profile
 * extends below the base (z = height).
 */
export function validateStructureSoil(
  fill: SoilLayer[],
  profile: SoilLayer[],
  baseDepth: number,
): StructureSoilIssues {
  const profileIssues = validateLayers(profile, { mustStartAtZero: true, minBottom: baseDepth });
  const fillIssues = validateLayers(fill, { mustStartAtZero: true, allowEmpty: true });
  if (fill.length > 0 && profile.length > 0) {
    const fillBottom = fill[fill.length - 1].bottom;
    const profileBottom = profile[profile.length - 1].bottom;
    if (fillBottom > profileBottom + DEPTH_TOL) {
      fillIssues.push({
        code: "fill_below_profile",
        index: fill.length - 1,
        field: "bottom",
        params: { z: profileBottom.toFixed(2) },
      });
    }
    const profileIds = new Set(profile.map((l) => l.id.trim()));
    fill.forEach((layer, index) => {
      if (profileIds.has(layer.id.trim())) {
        fillIssues.push({ code: "id_clash", index, field: "id", params: { id: layer.id } });
      }
    });
  }
  return { fill: fillIssues, profile: profileIssues };
}

// ---------------------------------------------------------------------------------------------
// Ids
// ---------------------------------------------------------------------------------------------

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Alphabetic prefix of an id ("L3" -> "L", "BF-2" -> "BF-"); "L" when none. */
export function idPrefixOf(id: string | undefined): string {
  const p = (id ?? "").replace(/\d+$/, "");
  return p.length > 0 ? p : "L";
}

/** Next free id `prefix + n` (n = 1 + highest existing number), unique in layers and reserved. */
export function nextLayerId(
  layers: SoilLayer[],
  prefix = "L",
  reserved: Iterable<string> = [],
): string {
  const used = new Set<string>([...layers.map((l) => l.id), ...reserved]);
  const re = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`);
  let max = 0;
  for (const id of used) {
    const m = re.exec(id);
    if (m) max = Math.max(max, Number.parseInt(m[1], 10));
  }
  let n = max + 1;
  while (used.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

export interface NewLayerOptions {
  prefix?: string;
  reserved?: Iterable<string>;
}

/**
 * A fresh layer. Unit weights and behaviour are copied from `template` when given (never
 * invented); otherwise γ is NaN so the editor flags it until the engineer enters a value.
 */
export function blankLayer(id: string, top: number, bottom: number, template?: SoilLayer): SoilLayer {
  return {
    id,
    top,
    bottom,
    description: "",
    uscs: null,
    sbtn_zone: null,
    behaviour: template?.behaviour ?? "drained",
    gamma: template ? template.gamma : Number.NaN,
    gamma_sat: template ? template.gamma_sat ?? null : null,
    design: {},
    source_ids: [],
  };
}

// ---------------------------------------------------------------------------------------------
// Structural edits
// ---------------------------------------------------------------------------------------------

/** Splits layer i at `depth` (strictly inside it); the lower part gets a new id. */
export function splitLayer(
  layers: SoilLayer[],
  i: number,
  depth: number,
  options: NewLayerOptions = {},
): SoilLayer[] {
  const layer = layers[i];
  if (!layer || !isNum(depth)) return layers;
  if (!(depth > layer.top + DEPTH_TOL && depth < layer.bottom - DEPTH_TOL)) return layers;
  const id = nextLayerId(layers, options.prefix ?? idPrefixOf(layer.id), options.reserved);
  const upper: SoilLayer = { ...layer, bottom: depth };
  const lower: SoilLayer = { ...structuredClone(layer), id, top: depth };
  return [...layers.slice(0, i), upper, lower, ...layers.slice(i + 1)];
}

/**
 * Layer i absorbs layer i+1 (keeps i's id, takes i+1's bottom). Same rules as the server merge
 * (geotek/modules/soil/service.py `merge`):
 * - unit weights that differ become the thickness-weighted value; gamma_sat only when both layers have it,
 *   otherwise null (never falls back to gamma);
 * - design values that differ are cleared and their selection is reset (no choice, no approval);
 * - a conflicting c_eff cannot be cleared (the model needs a number): the layers are returned unchanged;
 * - every remaining selection loses its approval and candidates (the interval changed);
 * - legacy `params` are dropped.
 */
export function mergeWithNext(layers: SoilLayer[], i: number): SoilLayer[] {
  if (i < 0 || i >= layers.length - 1) return layers;
  const first = layers[i];
  const second = layers[i + 1];
  const designKeys = new Set([...Object.keys(first.design ?? {}), ...Object.keys(second.design ?? {})]) as Set<keyof DesignParameters>;
  const conflicts = [...designKeys].filter((key) => (first.design?.[key] ?? null) !== (second.design?.[key] ?? null));
  if (conflicts.includes("c_eff")) return layers;

  const selections: Record<string, ParameterSelection> = {};
  for (const [key, state] of Object.entries({ ...(second.selections ?? {}), ...(first.selections ?? {}) })) {
    selections[key] = { ...state, candidates: [], suggested: null, approved: false, approved_at: null, basis_hash: null };
  }
  const design: DesignParameters = { ...(first.design ?? {}) };
  for (const key of conflicts) {
    (design as Record<string, number | null>)[key] = null;
    selections[key] = { parameter: key as DesignKey, approved: false };
  }
  const weighted = (a: number | null | undefined, b: number | null | undefined): number | null => {
    if (a === b) return a ?? null;
    if (a === null || a === undefined || b === null || b === undefined) return null;
    const ta = first.bottom - first.top;
    const tb = second.bottom - second.top;
    return (a * ta + b * tb) / (ta + tb);
  };
  const merged: SoilLayer = {
    ...first,
    bottom: second.bottom,
    gamma: weighted(first.gamma, second.gamma) ?? first.gamma,
    gamma_sat: weighted(first.gamma_sat, second.gamma_sat),
    design,
    selections,
  };
  delete merged.params;
  return [...layers.slice(0, i), merged, ...layers.slice(i + 2)];
}

/**
 * Inserts a new layer below layer i. Inside the list the lower half of layer i becomes the new
 * layer; below the last layer a layer of `appendThickness` is appended (extends the list).
 * With an empty list (or i < 0 on an empty list) a first layer [0, appendThickness] is created.
 */
export function insertBelow(
  layers: SoilLayer[],
  i: number,
  options: NewLayerOptions & { appendThickness?: number } = {},
): SoilLayer[] {
  const thickness = options.appendThickness ?? 1.0;
  if (layers.length === 0) {
    const id = nextLayerId(layers, options.prefix ?? "L", options.reserved);
    return [blankLayer(id, 0, thickness)];
  }
  const layer = layers[i];
  if (!layer) return layers;
  const id = nextLayerId(layers, options.prefix ?? idPrefixOf(layer.id), options.reserved);
  if (i === layers.length - 1) {
    const top = layer.bottom;
    return [...layers, blankLayer(id, top, roundDepth(top + thickness), layer)];
  }
  const mid = roundDepth((layer.top + layer.bottom) / 2);
  if (!(mid > layer.top + DEPTH_TOL && mid < layer.bottom - DEPTH_TOL)) return layers;
  const upper: SoilLayer = { ...layer, bottom: mid };
  const fresh = blankLayer(id, mid, layer.bottom, layer);
  return [...layers.slice(0, i), upper, fresh, ...layers.slice(i + 1)];
}

/**
 * Removes layer i; a neighbour absorbs its interval so the list stays contiguous and keeps
 * its extent: the layer above extends down, or (for the first layer) the next one extends up.
 * The only remaining layer is removed only with `allowEmpty`.
 */
export function removeLayer(
  layers: SoilLayer[],
  i: number,
  options: { allowEmpty?: boolean } = {},
): SoilLayer[] {
  if (i < 0 || i >= layers.length) return layers;
  if (layers.length === 1) return options.allowEmpty ? [] : layers;
  const removed = layers[i];
  if (i === 0) {
    const next: SoilLayer = { ...layers[1], top: removed.top };
    return [next, ...layers.slice(2)];
  }
  const prev: SoilLayer = { ...layers[i - 1], bottom: removed.bottom };
  return [...layers.slice(0, i - 1), prev, ...layers.slice(i + 1)];
}

/**
 * Moves the boundary below layer i: bottom of i and top of i+1 change together. A move that
 * would make layer i or i+1 zero/negative thickness ("crossing") is rejected (input returned).
 * For the last layer only its bottom moves.
 */
export function setBoundary(layers: SoilLayer[], i: number, depth: number): SoilLayer[] {
  const layer = layers[i];
  if (!layer || !isNum(depth)) return layers;
  if (depth <= layer.top + DEPTH_TOL) return layers;
  if (i < layers.length - 1) {
    const next = layers[i + 1];
    if (depth >= next.bottom - DEPTH_TOL) return layers;
    const out = [...layers];
    out[i] = { ...layer, bottom: depth };
    out[i + 1] = { ...next, top: depth };
    return out;
  }
  const out = [...layers];
  out[i] = { ...layer, bottom: depth };
  return out;
}

export function renameLayer(layers: SoilLayer[], i: number, id: string): SoilLayer[] {
  if (!layers[i]) return layers;
  const out = [...layers];
  out[i] = { ...layers[i], id: id.trim() };
  return out;
}

export function updateLayer(layers: SoilLayer[], i: number, patch: Partial<SoilLayer>): SoilLayer[] {
  if (!layers[i]) return layers;
  const out = [...layers];
  out[i] = { ...layers[i], ...patch };
  return out;
}

export function updateDesign(
  layers: SoilLayer[],
  i: number,
  key: DesignField,
  value: number | null,
): SoilLayer[] {
  const layer = layers[i];
  if (!layer) return layers;
  const design: DesignParameters = { ...(layer.design ?? {}) };
  if (key === "c_eff") {
    // c_eff is non-nullable in the model (default 0); an empty field removes it.
    if (value === null) delete design.c_eff;
    else design.c_eff = value;
  } else {
    design[key] = value;
  }
  return updateLayer(layers, i, { design });
}

/** Rounds to 1e-6 m to avoid float noise such as 2.4000000000000004. */
export function roundDepth(z: number): number {
  return Math.round(z * 1e6) / 1e6;
}

/** Depth of the bottom of the list (0 when empty). */
export function listBottom(layers: SoilLayer[]): number {
  return layers.length > 0 ? layers[layers.length - 1].bottom : 0;
}
