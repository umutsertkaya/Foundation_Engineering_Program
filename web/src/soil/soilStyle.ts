/**
 * Shared soil visual language: maps a layer to a colour family + hatch pattern.
 *
 * Purely presentational. The family is chosen from the USCS group symbol (dual symbols use
 * the first symbol), else from the Robertson SBTn zone, else from the drainage behaviour.
 * It is never used for any engineering decision.
 */
import type { SoilLayer } from "../api/types";
import { normaliseUscs } from "./uscs";

export type SoilFamily =
  | "gravel"
  | "sand"
  | "silt"
  | "clay"
  | "clay_high"
  | "organic"
  | "peat"
  | "fill";

export type SoilScheme = "light" | "dark";

export const SOIL_FAMILIES: readonly SoilFamily[] = [
  "gravel",
  "sand",
  "silt",
  "clay",
  "clay_high",
  "organic",
  "peat",
  "fill",
];

export interface SoilStyle {
  family: SoilFamily;
  /** Background fill colour of the layer band. */
  fill: string;
  /** Outline colour of the band. */
  stroke: string;
  /** Colour of the hatch pattern strokes/dots. */
  pattern: string;
  /** Text colour that is legible when drawn on top of `fill`. */
  ink: string;
  /** i18n key of the family name. */
  labelKey: string;
}

type Palette = Omit<SoilStyle, "family" | "labelKey">;

/**
 * Palette. Neighbouring families differ in hue AND lightness so they stay distinguishable
 * for colour-vision deficiencies; every family also has its own hatch pattern.
 */
const PALETTE: Record<SoilScheme, Record<SoilFamily, Palette>> = {
  light: {
    gravel: { fill: "#E3B26A", stroke: "#8F5F17", pattern: "#7A4E0F", ink: "#3D2705" },
    sand: { fill: "#F5E3A3", stroke: "#B39535", pattern: "#8C7424", ink: "#3B3108" },
    silt: { fill: "#C6C78A", stroke: "#73753A", pattern: "#55572A", ink: "#2A2B12" },
    clay: { fill: "#A9BDD2", stroke: "#4A6684", pattern: "#3A546F", ink: "#15222F" },
    clay_high: { fill: "#8CC6BD", stroke: "#2B776D", pattern: "#1C5A52", ink: "#0B2925" },
    organic: { fill: "#8B6A4E", stroke: "#4B3322", pattern: "#EEDCC8", ink: "#FFF8F0" },
    peat: { fill: "#5F5236", stroke: "#2E2716", pattern: "#D8CC98", ink: "#FBF6E2" },
    fill: { fill: "#D2D4D7", stroke: "#6B6F75", pattern: "#4F5359", ink: "#1F2226" },
  },
  dark: {
    gravel: { fill: "#8C6226", stroke: "#E0AE62", pattern: "#F5D29A", ink: "#FFF4E2" },
    sand: { fill: "#7C6C2E", stroke: "#E6CF7A", pattern: "#F7E9B5", ink: "#FFFBEA" },
    silt: { fill: "#5B5E32", stroke: "#C2C487", pattern: "#E0E2AE", ink: "#F7F8E6" },
    clay: { fill: "#3C5268", stroke: "#9AB5CF", pattern: "#CADAEA", ink: "#F0F6FC" },
    clay_high: { fill: "#235A54", stroke: "#7FCDC2", pattern: "#B6E8E0", ink: "#EFFFFC" },
    organic: { fill: "#4C3627", stroke: "#B88E6B", pattern: "#DDC2A6", ink: "#FFF4EA" },
    peat: { fill: "#36301F", stroke: "#A89C6A", pattern: "#C9BD86", ink: "#FBF6E2" },
    fill: { fill: "#4A4E54", stroke: "#A9AEB5", pattern: "#CDD1D6", ink: "#F4F5F7" },
  },
};

export const SOIL_FAMILY_LABEL_KEY: Record<SoilFamily, string> = {
  gravel: "web.soil.family.gravel",
  sand: "web.soil.family.sand",
  silt: "web.soil.family.silt",
  clay: "web.soil.family.clay",
  clay_high: "web.soil.family.clay_high",
  organic: "web.soil.family.organic",
  peat: "web.soil.family.peat",
  fill: "web.soil.family.fill",
};

/** Family from a USCS group symbol; dual symbols (e.g. "GW-GM") use the first symbol. */
export function familyFromUscs(uscs: string | null | undefined): SoilFamily | null {
  const s = normaliseUscs(uscs);
  if (!s) return null;
  const first = s.split("-")[0];
  switch (first) {
    case "GW":
    case "GP":
    case "GM":
    case "GC":
      return "gravel";
    case "SW":
    case "SP":
    case "SM":
    case "SC":
      return "sand";
    case "ML":
    case "MH":
      return "silt";
    case "CL":
      return "clay";
    case "CH":
      return "clay_high";
    case "OL":
    case "OH":
      return "organic";
    case "PT":
      return "peat";
    default:
      return null;
  }
}

/**
 * Family from a Robertson SBTn zone (1-9). Display grouping only:
 * 1 sensitive fine-grained, 2 organic, 3 clay, 4 silt mixtures, 5-6 sands,
 * 7 gravelly sand, 8 very stiff sand, 9 very stiff fine-grained.
 */
export function familyFromSbtn(zone: number | null | undefined): SoilFamily | null {
  if (zone === null || zone === undefined || !Number.isFinite(zone)) return null;
  switch (Math.round(zone)) {
    case 1:
      return "clay";
    case 2:
      return "organic";
    case 3:
      return "clay";
    case 4:
      return "silt";
    case 5:
    case 6:
      return "sand";
    case 7:
      return "gravel";
    case 8:
      return "sand";
    case 9:
      return "clay";
    default:
      return null;
  }
}

export function familyFromBehaviour(
  behaviour: SoilLayer["behaviour"] | null | undefined,
): SoilFamily | null {
  if (behaviour === "undrained") return "clay";
  if (behaviour === "drained") return "sand";
  return null;
}

export type SoilLayerLike = Pick<SoilLayer, "uscs" | "sbtn_zone" | "behaviour">;

export function soilFamily(layer: SoilLayerLike): SoilFamily {
  return (
    familyFromUscs(layer.uscs) ??
    familyFromSbtn(layer.sbtn_zone) ??
    familyFromBehaviour(layer.behaviour) ??
    "fill"
  );
}

export function familyStyle(family: SoilFamily, scheme: SoilScheme): SoilStyle {
  return { family, labelKey: SOIL_FAMILY_LABEL_KEY[family], ...PALETTE[scheme][family] };
}

export function soilStyle(layer: SoilLayerLike, scheme: SoilScheme): SoilStyle {
  return familyStyle(soilFamily(layer), scheme);
}

/** SVG id of a family pattern inside one SVG (uid must be unique per SVG element). */
export function soilPatternId(uid: string, family: SoilFamily): string {
  return `${uid}-pat-${family}`;
}

export function soilPatternUrl(uid: string, family: SoilFamily): string {
  return `url(#${soilPatternId(uid, family)})`;
}
