/**
 * Pure geometry for the wall cross-section: structure geometry + soil model -> pixel coordinates of
 * a fixed-width viewBox. No React, no measuring, no i18n; the SVG component only draws the result.
 *
 * World frame: x to the right from the toe front edge [m], y up from the underside of the base [m].
 * The structure frame of the soil model is z down from the retained ground surface, so the retained
 * surface is y = H, the base is z = H and the front ground is z = H - D (y = D). The retained side
 * is on the right, the front (toe) side on the left. Neither wall model has a shear key, so none is drawn.
 */
import type {
  CantileverGeometry,
  GravityGeometry,
  SoilLayer,
  StructureSoilModel,
  WallType,
} from "../../../shared/api/types";
import {
  computeZones,
  frontGwt,
  gwtDepth,
  retainedGwt,
  type GwtCase,
  type LayerOrigin,
} from "../../../shared/soil/zones";

export type Pt = [number, number];
export type BandSide = "backfill" | "front" | "foundation";

export interface SectionInput {
  wallType: WallType;
  geometry: CantileverGeometry | GravityGeometry;
  /** Structure height H; defaults to the geometry's own height. */
  height?: number;
  /** Backfill slope beta [deg]. */
  backfillSlope?: number;
  soil?: StructureSoilModel | null;
  gwtCase?: GwtCase;
}

export interface SectionBand {
  key: string;
  layerId: string;
  layer: SoilLayer;
  origin: LayerOrigin;
  side: BandSide;
  /** Depth range in the structure frame [m]. */
  top: number;
  bottom: number;
  /** Pixel rectangle (the retained / front clip polygon trims it to the soil region). */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  clip: "retained" | "front" | null;
}

export interface SectionWater {
  side: "retained" | "front";
  /** Depth below the retained ground surface [m]. */
  z: number;
  inherited: boolean;
  /** False when the table lies below the drawn foundation depth. */
  visible: boolean;
  y: number;
  x0: number;
  x1: number;
}

export interface SectionLayout {
  width: number;
  height: number;
  /** Pixels per metre. */
  scale: number;
  B: number;
  H: number;
  D: number;
  /** Base slab thickness (cantilever only). */
  baseThickness: number | null;
  toeWidth: number | null;
  heelWidth: number | null;
  wall: Pt[][];
  retained: Pt[];
  front: Pt[];
  /** Ground surface polylines (the retained side rises with the slope). */
  groundRetained: Pt[];
  groundFront: Pt[];
  baseY: number;
  plot: { x0: number; x1: number; y0: number; y1: number };
  bands: SectionBand[];
  water: SectionWater[];
  anchors: { stem: Pt | null; base: Pt | null; wall: Pt | null; toe: Pt | null; heel: Pt | null };
  dims: {
    B: { x0: number; x1: number; y: number };
    H: { x: number; y0: number; y1: number };
    D: { x: number; y0: number; y1: number };
  };
  warnings: ("profile_short" | "front_depth")[];
  /** True when a soil model was given (bands and water are meaningful). */
  hasSoil: boolean;
}

const VIEW_W = 640;
const PAD_L = 6;
const PAD_T = 22;
const PAD_B = 30;
const GUTTER_R = 116;
const MAX_PLOT_H = 400;
const MAX_SLOPE_DEG = 35;

function isCantilever(
  wallType: WallType,
  geometry: CantileverGeometry | GravityGeometry,
): geometry is CantileverGeometry {
  return wallType === "cantilever" && "stem_bottom" in geometry;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function buildSectionLayout(input: SectionInput): SectionLayout {
  const { wallType, geometry, soil = null, gwtCase = "design" } = input;
  const slope = (Math.max(0, Math.min(MAX_SLOPE_DEG, input.backfillSlope ?? 0)) * Math.PI) / 180;

  let B: number;
  let H: number;
  let D: number;
  let wall: Pt[][];
  /** Retained-side wall boundary from the wall top down to the heel's back corner. */
  let backFace: Pt[];
  /** From the base's front corner up to the front ground level. */
  let frontFace: (d: number) => Pt[];
  let frontAt: (y: number) => number;
  let backAt: (y: number) => number;
  let backTopX: number;
  let baseThickness: number | null = null;
  let toeWidth: number | null = null;
  let heelWidth: number | null = null;
  let stemCentre: Pt | null = null;
  let wallCentre: Pt | null = null;

  if (isCantilever(wallType, geometry)) {
    const toe = Math.max(0, geometry.toe);
    const stemBottom = Math.max(0.1, geometry.stem_bottom);
    const stemTop = Math.max(0.1, Math.min(stemBottom, geometry.stem_top));
    const heel = Math.max(0, geometry.heel);
    const tb = Math.max(0.1, geometry.base_thickness);
    B = toe + stemBottom + heel;
    H = Math.max(tb + 0.2, input.height ?? tb + geometry.stem_height);
    D = Math.max(0, Math.min(H - 0.05, geometry.embedment ?? 0.6));
    const xBack = toe + stemBottom;
    const xFrontTop = xBack - stemTop;
    wall = [
      [[0, 0], [B, 0], [B, tb], [0, tb]],
      [[toe, tb], [xBack, tb], [xBack, H], [xFrontTop, H]],
    ];
    backFace = [[xBack, H], [xBack, tb], [B, tb], [B, 0]];
    frontAt = (y) => (y <= tb ? 0 : toe + ((y - tb) / (H - tb)) * (xFrontTop - toe));
    frontFace = (d) => {
      const pts: Pt[] = [[0, 0], [0, Math.min(tb, d)]];
      if (d > tb) pts.push([toe, tb], [frontAt(d), d]);
      return pts;
    };
    backAt = (y) => (y >= tb ? xBack : B);
    backTopX = xBack;
    baseThickness = tb;
    toeWidth = toe;
    heelWidth = heel;
    stemCentre = [(xFrontTop + xBack) / 2, tb + (H - tb) / 2];
  } else {
    const grav = geometry as GravityGeometry;
    B = Math.max(0.2, grav.base_width);
    H = Math.max(0.5, input.height ?? grav.height);
    const topW = Math.max(0.1, Math.min(B, grav.top_width));
    const backOffset = Math.max(0, Math.min(B - topW, grav.back_offset ?? 0));
    D = Math.max(0, Math.min(H - 0.05, grav.embedment ?? 0.6));
    const xBackTop = B - backOffset;
    const xFrontTop = xBackTop - topW;
    wall = [[[0, 0], [B, 0], [xBackTop, H], [xFrontTop, H]]];
    backFace = [[xBackTop, H], [B, 0]];
    frontAt = (y) => (y / H) * xFrontTop;
    frontFace = (d) => [[0, 0], [frontAt(d), d]];
    backAt = (y) => B + ((xBackTop - B) * y) / H;
    backTopX = xBackTop;
    wallCentre = [(xFrontTop + xBackTop + B) / 3, H / 2];
  }

  const margin = Math.max(1.2, 0.45 * B);
  const xMin = -margin;
  const xMax = B + Math.max(1.5, 0.6 * B);
  const rise = (xMax - backTopX) * Math.tan(slope);
  const yTop = H + rise;

  const zones = soil ? computeZones(soil, H - D, H) : null;
  const profileBottom =
    soil && soil.profile.layers.length > 0 ? soil.profile.layers[soil.profile.layers.length - 1].bottom : H;
  const below = soil ? Math.max(1.0, Math.min(Math.max(0, profileBottom - H), Math.max(1.5, 0.5 * H))) : 0.8;
  const zViewBottom = H + below;

  const worldW = xMax - xMin;
  const worldH = yTop + below;
  const scale = Math.min((VIEW_W - PAD_L - GUTTER_R) / worldW, MAX_PLOT_H / worldH);
  const width = PAD_L + worldW * scale + GUTTER_R;
  const height = PAD_T + worldH * scale + PAD_B;
  const sx = (x: number) => r2(PAD_L + (x - xMin) * scale);
  const sy = (y: number) => r2(PAD_T + (yTop - y) * scale);
  const zy = (z: number) => sy(H - z);
  const pts = (list: Pt[]): Pt[] => list.map(([x, y]) => [sx(x), sy(y)]);

  const retained = pts([...backFace, [xMax, 0], [xMax, yTop]]);
  const frontTopX = frontAt(D);
  const front = pts([[xMin, 0], ...frontFace(D), [xMin, D]]);
  const plot = { x0: sx(xMin), x1: sx(xMax), y0: sy(yTop), y1: sy(-below) };

  const bands: SectionBand[] = [];
  if (zones) {
    zones.backfill.forEach((s, i) =>
      bands.push({
        key: `b-${i}-${s.layer_id}`, layerId: s.layer_id, layer: s.layer, origin: s.origin, side: "backfill",
        top: s.top, bottom: s.bottom, x0: plot.x0, x1: plot.x1,
        y0: i === 0 ? plot.y0 : zy(s.top), y1: zy(s.bottom), clip: "retained",
      }),
    );
    zones.front.forEach((s, i) =>
      bands.push({
        key: `f-${i}-${s.layer_id}`, layerId: s.layer_id, layer: s.layer, origin: s.origin, side: "front",
        top: s.top, bottom: s.bottom, x0: plot.x0, x1: sx(Math.max(frontTopX, toeWidth ?? 0)) + 1,
        y0: zy(s.top), y1: zy(s.bottom), clip: "front",
      }),
    );
    zones.foundation.forEach((s, i) => {
      if (s.top >= zViewBottom) return;
      bands.push({
        key: `d-${i}-${s.layer_id}`, layerId: s.layer_id, layer: s.layer, origin: s.origin, side: "foundation",
        top: s.top, bottom: s.bottom, x0: plot.x0, x1: plot.x1,
        y0: zy(s.top), y1: zy(Math.min(s.bottom, zViewBottom)), clip: null,
      });
    });
  }

  const water: SectionWater[] = [];
  if (soil) {
    const sides = [
      { side: "retained" as const, eff: retainedGwt(soil) },
      { side: "front" as const, eff: frontGwt(soil) },
    ];
    for (const { side, eff } of sides) {
      const z = gwtDepth(eff.gwt, gwtCase);
      const y = H - z;
      const underBase = y < 0;
      let x0: number;
      let x1: number;
      if (side === "retained") {
        x0 = underBase ? B / 2 : backAt(y);
        x1 = xMax;
      } else {
        x0 = xMin;
        x1 = underBase ? B / 2 : frontAt(Math.max(0, y));
      }
      water.push({
        side, z, inherited: eff.inherited, visible: z <= zViewBottom + 1e-9,
        y: sy(y), x0: sx(x0), x1: sx(x1),
      });
    }
  }

  return {
    width: r2(width), height: r2(height), scale: r2(scale), B, H, D,
    baseThickness, toeWidth, heelWidth,
    wall: wall.map(pts), retained, front,
    groundRetained: pts([[backTopX, H], [xMax, yTop]]),
    groundFront: pts([[xMin, D], [frontTopX, D]]),
    baseY: sy(0), plot, bands, water,
    anchors: {
      stem: stemCentre ? [sx(stemCentre[0]), sy(stemCentre[1])] : null,
      base: baseThickness !== null ? [sx(B / 2), sy(baseThickness / 2)] : null,
      wall: wallCentre ? [sx(wallCentre[0]), sy(wallCentre[1])] : null,
      toe: toeWidth !== null && toeWidth > 0 ? [sx(toeWidth / 2), sy(0)] : null,
      heel: heelWidth !== null && heelWidth > 0 ? [sx(B - heelWidth / 2), sy(0)] : null,
    },
    dims: {
      B: { x0: sx(0), x1: sx(B), y: sy(-below * 0.4) },
      H: { x: sx(-0.7 * margin), y0: sy(0), y1: sy(H) },
      D: { x: sx(-0.3 * margin), y0: sy(0), y1: sy(D) },
    },
    warnings: zones ? zones.warnings : [],
    hasSoil: soil !== null,
  };
}
