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
  surcharge: Num;
  sds: Num;
  allowable_stress_mpa: Num;
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
  surcharge: "",
  sds: "",
  allowable_stress_mpa: "",
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
  if (has(inp.surcharge) && inp.surcharge < 0) out.push("range:surcharge");
  if (has(inp.sds) && !(inp.sds > 0 && inp.sds < 3)) out.push("range:sds");
  if (has(inp.allowable_stress_mpa) && inp.allowable_stress_mpa <= 0) out.push("range:allowable_stress_mpa");
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
    surcharge: orNull(inp.surcharge),
    sds: orNull(inp.sds),
    allowable_stress_mpa: orNull(inp.allowable_stress_mpa),
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
    surcharge: s.surcharge ?? 0,
    sds: s.sds ?? "",
    allowable_stress_mpa: s.allowable_stress_mpa ?? "",
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
    surcharge: has(inp.surcharge) ? inp.surcharge : 0,
    sds: orNull(inp.sds),
    allowable_stress_mpa: orNull(inp.allowable_stress_mpa),
  };
}
