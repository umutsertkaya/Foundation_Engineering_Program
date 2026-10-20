import type {
  SheetPileCreate,
  SheetPileStructure,
  SoilLayer,
  StructureSoilModel,
} from "../../shared/api/types";

/** Number field value: a number, or "" while empty (so missing inputs stay visible). */
export type Num = number | "";

export interface ManualLayer {
  top: Num;
  bottom: Num;
  gamma: Num;
  phi: Num;
  c: Num;
}

export interface PileInputs {
  name: string;
  retained_height: Num;
  support: "cantilever" | "anchored";
  anchor_depth: Num;
  backfill_slope: Num;
  surcharge: Num;
  surcharge_basis: "horizontal" | "inclined";
  sds: Num;
  allowable_stress_mpa: Num;
  design_code: string;
  approach: string | null;
  analysis_level: "basic" | "advanced";
  depth_increase: Num;
  anchor_spacing: Num;
  anchor_inclination: Num;
  front_water_depth: Num;
}

export interface SoilSource {
  mode: "profile" | "manual";
  profile_id: string | null;
  gwt: Num;
  layers: ManualLayer[];
}

export const EMPTY_LAYER: ManualLayer = { top: "", bottom: "", gamma: "", phi: "", c: 0 };

export const DEFAULT_INPUTS: PileInputs = {
  name: "",
  retained_height: "",
  support: "cantilever",
  anchor_depth: "",
  backfill_slope: "",
  surcharge: "",
  surcharge_basis: "horizontal",
  sds: "",
  allowable_stress_mpa: "",
  design_code: "asd",
  approach: null,
  analysis_level: "basic",
  depth_increase: "",
  anchor_spacing: 1,
  anchor_inclination: 0,
  front_water_depth: "",
};

export const DEFAULT_SOIL: SoilSource = {
  mode: "profile",
  profile_id: null,
  gwt: "",
  layers: [{ ...EMPTY_LAYER, top: 0 }],
};

const has = (v: Num | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);
const orNull = (v: Num): number | null => (has(v) ? v : null);

/** Keys of required inputs that are not entered yet (rendered as explicit "missing" items). */
export function missingInputs(inp: PileInputs, soil: SoilSource | null): string[] {
  const out: string[] = [];
  if (!inp.name.trim()) out.push("name");
  if (!has(inp.retained_height)) out.push("retained_height");
  if (has(inp.retained_height) && !(inp.retained_height > 0.5 && inp.retained_height <= 12)) out.push("range:retained_height");
  if (inp.support === "anchored" && !has(inp.anchor_depth)) out.push("anchor_depth");
  if (inp.support === "anchored" && has(inp.anchor_depth) && (!has(inp.retained_height) || inp.anchor_depth < 0 || inp.anchor_depth >= inp.retained_height)) out.push("range:anchor_depth");
  if (has(inp.backfill_slope) && !(inp.backfill_slope >= 0 && inp.backfill_slope < 45)) out.push("range:backfill_slope");
  if (has(inp.surcharge) && inp.surcharge < 0) out.push("range:surcharge");
  if (has(inp.sds) && !(inp.sds > 0 && inp.sds < 3)) out.push("range:sds");
  if (has(inp.allowable_stress_mpa) && inp.allowable_stress_mpa <= 0) out.push("range:allowable_stress_mpa");
  if (has(inp.depth_increase) && inp.depth_increase < 0) out.push("range:depth_increase");
  if (inp.support === "anchored" && has(inp.anchor_spacing) && inp.anchor_spacing <= 0) out.push("range:anchor_spacing");
  if (inp.support === "anchored" && has(inp.anchor_inclination) && !(inp.anchor_inclination >= 0 && inp.anchor_inclination < 90)) out.push("range:anchor_inclination");
  if (has(inp.front_water_depth) && inp.front_water_depth < 0) out.push("range:front_water_depth");
  if (soil) {
    if (soil.mode === "profile") {
      if (!soil.profile_id) out.push("profile");
    } else {
      if (!has(soil.gwt)) out.push("gwt");
      if (has(soil.gwt) && soil.gwt < 0) out.push("range:gwt");
      if (soil.layers.length === 0) out.push("layers");
      soil.layers.forEach((l, i) => {
        if (!has(l.top) || !has(l.bottom) || !has(l.gamma)) out.push(`layer_${i}_geometry`);
        if (has(l.top) && has(l.bottom) && (l.bottom <= l.top || (i === 0 ? l.top !== 0 : !has(soil.layers[i - 1].bottom) || Math.abs(l.top - (soil.layers[i - 1].bottom as number)) > 1e-3))) out.push(`range:layer_${i}_geometry`);
        if (has(l.gamma) && !(l.gamma > 5 && l.gamma < 30)) out.push(`range:layer_${i}_gamma`);
        if (!has(l.phi)) out.push(`layer_${i}_phi`);
      });
      if (has(inp.retained_height) && soil.layers.length > 0) {
        const deepest = soil.layers[soil.layers.length - 1].bottom;
        if (has(deepest) && deepest <= inp.retained_height) out.push("range:depth");
      }
    }
  }
  return out;
}

/** Soil gaps of a stored structure copy: missing design phi per layer, profile not below the dredge line. */
export function missingSoilInputs(layers: SoilLayer[], height: number, gwt?: number): string[] {
  const out: string[] = [];
  layers.forEach((l) => {
    if (l.design?.phi_eff == null) out.push(`phi:${l.id}`);
  });
  const bottom = layers.length ? Math.max(...layers.map((l) => l.bottom)) : 0;
  if (bottom <= height) out.push("depth");
  if (gwt != null && gwt < 0) out.push("range:gwt");
  layers.forEach((l, i) => {
    if (l.bottom <= l.top || (i === 0 ? l.top !== 0 : Math.abs(l.top - layers[i - 1].bottom) > 1e-3)) out.push(`range:layer_${i}_geometry`);
    if (!(l.gamma > 5 && l.gamma < 30)) out.push(`range:layer_${i}_gamma`);
  });
  return out;
}

export function manualSoil(soil: SoilSource, name: string): StructureSoilModel {
  return {
    source_profile_id: null,
    source_hash: null,
    profile: {
      id: "manual",
      name,
      origin: "manual",
      gwt: { depth_insitu: soil.gwt as number },
      layers: soil.layers.map((l, i) => ({
        id: `L${i + 1}`,
        top: l.top as number,
        bottom: l.bottom as number,
        behaviour: "drained",
        gamma: l.gamma as number,
        design: { phi_eff: l.phi as number, c_eff: has(l.c) ? l.c : 0 },
      })),
    },
  };
}

export function toCreatePayload(inp: PileInputs, soil: SoilSource): SheetPileCreate {
  const payload: SheetPileCreate = {
    kind: "sheet_pile",
    name: inp.name.trim(),
    retained_height: inp.retained_height as number,
    support: inp.support,
    anchor_depth: inp.support === "anchored" ? orNull(inp.anchor_depth) : null,
    backfill_slope: has(inp.backfill_slope) ? inp.backfill_slope : null,
    surcharge: orNull(inp.surcharge),
    surcharge_basis: inp.surcharge_basis,
    sds: orNull(inp.sds),
    allowable_stress_mpa: orNull(inp.allowable_stress_mpa),
    design_code: inp.design_code,
    approach: inp.approach,
    analysis_level: inp.analysis_level,
    depth_increase: has(inp.depth_increase) ? inp.depth_increase : null,
    anchor_spacing: inp.support === "anchored" ? orNull(inp.anchor_spacing) : null,
    anchor_inclination: inp.support === "anchored" ? orNull(inp.anchor_inclination) : null,
    front_water_depth: orNull(inp.front_water_depth),
  };
  if (soil.mode === "profile") payload.profile_id = soil.profile_id;
  else payload.soil = manualSoil(soil, inp.name.trim());
  return payload;
}

export function fromStructure(s: SheetPileStructure): PileInputs {
  return {
    name: s.name ?? "",
    retained_height: s.retained_height,
    support: s.support ?? "cantilever",
    anchor_depth: s.anchor_depth ?? "",
    backfill_slope: s.backfill_slope ?? 0,
    surcharge: s.surcharge ?? 0,
    surcharge_basis: s.surcharge_basis ?? "horizontal",
    sds: s.sds ?? "",
    allowable_stress_mpa: s.allowable_stress_mpa ?? "",
    design_code: s.design_code ?? "asd",
    approach: s.approach ?? null,
    analysis_level: s.analysis_level ?? "basic",
    depth_increase: s.depth_increase ?? "",
    anchor_spacing: s.anchor_spacing ?? 1,
    anchor_inclination: s.anchor_inclination ?? 0,
    front_water_depth: s.front_water_depth ?? "",
  };
}

/** Merge edited inputs into the stored structure; soil (and its source link) is left untouched. */
export function applyInputs(s: SheetPileStructure, inp: PileInputs): SheetPileStructure {
  return {
    ...s,
    name: inp.name.trim(),
    retained_height: inp.retained_height as number,
    support: inp.support,
    anchor_depth: inp.support === "anchored" ? orNull(inp.anchor_depth) : null,
    backfill_slope: has(inp.backfill_slope) ? inp.backfill_slope : 0,
    surcharge: has(inp.surcharge) ? inp.surcharge : 0,
    surcharge_basis: inp.surcharge_basis,
    sds: orNull(inp.sds),
    allowable_stress_mpa: orNull(inp.allowable_stress_mpa),
    design_code: inp.design_code,
    approach: inp.approach,
    analysis_level: inp.analysis_level,
    depth_increase: has(inp.depth_increase) ? inp.depth_increase : null,
    anchor_spacing: inp.support === "anchored" ? orNull(inp.anchor_spacing) : null,
    anchor_inclination: inp.support === "anchored" ? orNull(inp.anchor_inclination) : null,
    front_water_depth: orNull(inp.front_water_depth),
  };
}
