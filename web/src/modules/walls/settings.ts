import type { AnalysisOptions, SoilLayerK, WallSettingsPayload } from "./types";
import type { SoilLayer, StructureSoilModel } from "../../shared/api/types";
import { retainedLayers } from "../../shared/soil/zones";

/** Model defaults of `WallSettings` in `geotek/core/models/walls.py` (mirrored by the OpenAPI `@default`s). */
export const ANALYSIS_DEFAULTS: AnalysisOptions = {
  kv_sign: "envelope",
  submerged_seismic: "envelope",
  uplift_moment: "overturning",
  gwt_bearing_correction: true,
  use_passive: false,
  passive_reduction: 0.5,
};

export const KV_SIGNS = ["envelope", "up", "down"] as const;
export const SUBMERGED_MODES = ["envelope", "impervious", "pervious", "by_permeability"] as const;
export const UPLIFT_MODES = ["overturning", "resisting"] as const;

export function optionsFromSettings(settings: WallSettingsPayload | null | undefined): AnalysisOptions {
  return {
    kv_sign: settings?.kv_sign ?? ANALYSIS_DEFAULTS.kv_sign,
    submerged_seismic: settings?.submerged_seismic ?? ANALYSIS_DEFAULTS.submerged_seismic,
    uplift_moment: settings?.uplift_moment ?? ANALYSIS_DEFAULTS.uplift_moment,
    gwt_bearing_correction: settings?.gwt_bearing_correction ?? ANALYSIS_DEFAULTS.gwt_bearing_correction,
    use_passive: settings?.use_passive ?? ANALYSIS_DEFAULTS.use_passive,
    passive_reduction: settings?.passive_reduction ?? ANALYSIS_DEFAULTS.passive_reduction,
  };
}

export function applyOptions(settings: WallSettingsPayload | null | undefined, options: AnalysisOptions): WallSettingsPayload {
  return { ...(settings ?? {}), ...options };
}

export function layerPermeability(layer: SoilLayer): number | null {
  const k = (layer as SoilLayerK).permeability;
  return typeof k === "number" && Number.isFinite(k) ? k : null;
}

export function withPermeability(layer: SoilLayer, k: number | null): SoilLayer {
  return { ...layer, permeability: k } as SoilLayerK;
}

/** Hydraulic conductivity text: empty -> null (not entered); otherwise a finite number > 0 (backend `gt=0`). */
export type PermeabilityParse = { ok: true; value: number | null } | { ok: false };

export function parsePermeability(text: string): PermeabilityParse {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return { ok: true, value: null };
  if (!/^[+]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(trimmed)) return { ok: false };
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 ? { ok: true, value } : { ok: false };
}

export function formatPermeability(k: number | null): string {
  return k === null ? "" : k.toExponential().replace("e+", "e");
}

/**
 * Conservative hint for the "by permeability" mode: every retained-side layer (fill, then the profile
 * below it) that has no k. Which layers the engine finally classifies depends on its own geometry and
 * water-table handling, so this is a reminder that k is needed, not a computed verdict; the engine
 * reports the layers it actually could not classify in the result warnings.
 */
export function layersWithoutPermeability(soil: StructureSoilModel | null): string[] {
  if (!soil) return [];
  return retainedLayers(soil)
    .map((item) => item.layer)
    .filter((layer) => layerPermeability(layer) === null)
    .map((layer) => layer.id);
}
