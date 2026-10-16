/**
 * Client mirror of `StructureSoilModel.retained_profile()` / `zones()` in
 * `geotek/core/models/structures.py`, used only to draw the structure cross-section.
 * Depths are in the structure frame (z down from the retained ground surface).
 * Unlike the Python version it never throws: inconsistent states (mid-edit) give warnings.
 */
import type { GroundwaterCondition, SoilLayer, StructureSoilModel } from "../api/types";
import { DEPTH_TOL } from "./layerOps";

export type GwtCase = "insitu" | "design" | "seismic";
export type LayerOrigin = "fill" | "profile";

export interface OriginLayer {
  layer: SoilLayer;
  origin: LayerOrigin;
}

export interface ZoneSlice {
  layer_id: string;
  top: number;
  bottom: number;
  layer: SoilLayer;
  origin: LayerOrigin;
}

export interface ZonesResult {
  backfill: ZoneSlice[];
  front: ZoneSlice[];
  foundation: ZoneSlice[];
  warnings: ("front_depth" | "profile_short")[];
}

type SoilLike = Pick<StructureSoilModel, "profile" | "retained_fill">;

/** Layers seen by the retained side: fill over the remaining profile layers (top trimmed). */
export function retainedLayers(soil: SoilLike): OriginLayer[] {
  const fill = soil.retained_fill ?? [];
  const profile = soil.profile.layers;
  if (fill.length === 0) return profile.map((layer) => ({ layer, origin: "profile" }));
  const zFill = fill[fill.length - 1].bottom;
  const below: OriginLayer[] = [];
  for (const layer of profile) {
    if (layer.bottom <= zFill + DEPTH_TOL) continue;
    below.push({
      layer: layer.top >= zFill - DEPTH_TOL ? layer : { ...layer, top: zFill },
      origin: "profile",
    });
  }
  return [...fill.map((layer) => ({ layer, origin: "fill" as const })), ...below];
}

function cut(layers: OriginLayer[], a: number, b: number): ZoneSlice[] {
  const out: ZoneSlice[] = [];
  for (const { layer, origin } of layers) {
    const top = Math.max(layer.top, a);
    const bottom = Math.min(layer.bottom, b);
    if (bottom - top > DEPTH_TOL) {
      out.push({ layer_id: layer.id, top, bottom, layer, origin });
    }
  }
  return out;
}

export function computeZones(soil: SoilLike, frontDepth: number, baseDepth: number): ZonesResult {
  const warnings: ZonesResult["warnings"] = [];
  if (!(frontDepth >= 0 && frontDepth <= baseDepth)) warnings.push("front_depth");
  const profile = soil.profile.layers.map((layer) => ({ layer, origin: "profile" as const }));
  const profileBottom = profile.length > 0 ? profile[profile.length - 1].layer.bottom : 0;
  if (baseDepth >= profileBottom - DEPTH_TOL) warnings.push("profile_short");
  return {
    backfill: cut(retainedLayers(soil), 0, baseDepth),
    front: cut(profile, Math.max(0, frontDepth), baseDepth),
    foundation: cut(profile, baseDepth, profileBottom),
    warnings,
  };
}

export function gwtDepth(gwt: GroundwaterCondition, gwtCase: GwtCase): number {
  if (gwtCase === "design") return gwt.depth_design ?? gwt.depth_insitu;
  if (gwtCase === "seismic") return gwt.depth_seismic ?? gwt.depth_insitu;
  return gwt.depth_insitu;
}

export interface EffectiveGwt {
  gwt: GroundwaterCondition;
  /** True when the side falls back to `profile.gwt`. */
  inherited: boolean;
}

export function retainedGwt(soil: Pick<StructureSoilModel, "profile" | "gwt_retained">): EffectiveGwt {
  return soil.gwt_retained
    ? { gwt: soil.gwt_retained, inherited: false }
    : { gwt: soil.profile.gwt, inherited: true };
}

export function frontGwt(soil: Pick<StructureSoilModel, "profile" | "gwt_front">): EffectiveGwt {
  return soil.gwt_front
    ? { gwt: soil.gwt_front, inherited: false }
    : { gwt: soil.profile.gwt, inherited: true };
}
