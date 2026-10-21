import type {
  AnalysisInputs,
  AnchorDesignCommon,
  AnchorDesignInputs,
  StructureSoil,
} from "./types";

/** Form values: a number, or "" while the field is empty. */
export type Num = number | "";

export const num = (v: number | string | null | undefined): Num => (typeof v === "number" && Number.isFinite(v) ? v : "");
const has = (v: Num): v is number => typeof v === "number";
const opt = (v: Num): number | null => (has(v) ? v : null);

/** Anchor design fields shared by the single-anchor page and the wall analysis (every level). */
export interface CommonForm {
  safety_factor: Num;
  transfer_mode: "q_u" | "tau";
  ultimate_transfer_load: Num;
  ultimate_bond_stress: Num;
  hole_diameter: Num;
  lock_off_ratio: Num;
  tendon_type: "strand" | "bar";
  tendon_library_id: string | null;
  strand_count: Num;
  min_bond_length: Num;
  max_bond_length: Num;
  min_free_length: Num;
  beyond_wedge: Num;
  wedge_origin_below_base: Num;
  test_factor: Num;
  design_limit: Num;
  lock_off_limit: Num;
  test_limit: Num;
  min_overburden: Num;
  ground: "soil" | "rock";
  transfer_load_ref: string;
}

/** Defaults here are the engine's own GEC-4 defaults (shown to the user); engineering inputs start empty. */
export const EMPTY_COMMON: CommonForm = {
  safety_factor: "",
  transfer_mode: "q_u",
  ultimate_transfer_load: "",
  ultimate_bond_stress: "",
  hole_diameter: "",
  lock_off_ratio: "",
  tendon_type: "strand",
  tendon_library_id: null,
  strand_count: "",
  min_bond_length: "",
  max_bond_length: "",
  min_free_length: "",
  beyond_wedge: "",
  wedge_origin_below_base: 0,
  test_factor: 1.33,
  design_limit: 0.6,
  lock_off_limit: 0.7,
  test_limit: 0.8,
  min_overburden: 4.5,
  ground: "soil",
  transfer_load_ref: "",
};

export function commonPayload(c: CommonForm): AnchorDesignCommon {
  const strand = c.tendon_type === "strand";
  return {
    safety_factor: opt(c.safety_factor),
    ultimate_transfer_load: c.transfer_mode === "q_u" ? opt(c.ultimate_transfer_load) : null,
    ultimate_bond_stress: c.transfer_mode === "tau" ? opt(c.ultimate_bond_stress) : null,
    hole_diameter: c.transfer_mode === "tau" ? opt(c.hole_diameter) : null,
    lock_off_ratio: opt(c.lock_off_ratio),
    tendon: {
      type: c.tendon_type,
      library_id: c.tendon_library_id,
      count: strand ? opt(c.strand_count) : null,
    },
    min_bond_length: opt(c.min_bond_length),
    max_bond_length: opt(c.max_bond_length),
    min_free_length: opt(c.min_free_length),
    beyond_wedge: opt(c.beyond_wedge),
    wedge_origin_below_base: has(c.wedge_origin_below_base) ? c.wedge_origin_below_base : 0,
    test_factor: has(c.test_factor) ? c.test_factor : 1.33,
    design_limit: has(c.design_limit) ? c.design_limit : 0.6,
    lock_off_limit: has(c.lock_off_limit) ? c.lock_off_limit : 0.7,
    test_limit: has(c.test_limit) ? c.test_limit : 0.8,
    min_overburden: has(c.min_overburden) ? c.min_overburden : 4.5,
    ground: c.ground,
    transfer_load_ref: c.transfer_load_ref.trim() || null,
  };
}

export function commonFromPayload(p: AnchorDesignCommon): CommonForm {
  const tau = p.ultimate_bond_stress != null;
  return {
    safety_factor: num(p.safety_factor),
    transfer_mode: tau ? "tau" : "q_u",
    ultimate_transfer_load: num(p.ultimate_transfer_load),
    ultimate_bond_stress: num(p.ultimate_bond_stress),
    hole_diameter: num(p.hole_diameter),
    lock_off_ratio: num(p.lock_off_ratio),
    tendon_type: p.tendon.type,
    tendon_library_id: p.tendon.library_id ?? null,
    strand_count: num(p.tendon.count),
    min_bond_length: num(p.min_bond_length),
    max_bond_length: num(p.max_bond_length),
    min_free_length: num(p.min_free_length),
    beyond_wedge: num(p.beyond_wedge),
    wedge_origin_below_base: p.wedge_origin_below_base,
    test_factor: p.test_factor,
    design_limit: p.design_limit,
    lock_off_limit: p.lock_off_limit,
    test_limit: p.test_limit,
    min_overburden: p.min_overburden,
    ground: p.ground,
    transfer_load_ref: p.transfer_load_ref ?? "",
  };
}

/** Required engineering inputs of the anchor design (mirrors the engine's missing_inputs). */
export function commonMissing(c: CommonForm): string[] {
  const out: string[] = [];
  if (!has(c.safety_factor)) out.push("safety_factor");
  if (c.transfer_mode === "q_u") {
    if (!has(c.ultimate_transfer_load)) out.push("ultimate_transfer_load");
  } else {
    if (!has(c.ultimate_bond_stress)) out.push("ultimate_bond_stress");
    if (!has(c.hole_diameter)) out.push("hole_diameter");
  }
  if (!has(c.lock_off_ratio)) out.push("lock_off_ratio");
  return out;
}

// ---- single anchor ----------------------------------------------------------------------------

export interface AnchorForm {
  excavation_height: Num;
  head_depth: Num;
  inclination_deg: Num;
  phi_deg: Num;
  load_mode: "horizontal" | "axial";
  horizontal_load_per_m: Num;
  spacing: Num;
  axial_load: Num;
  common: CommonForm;
}

export const EMPTY_ANCHOR: AnchorForm = {
  excavation_height: "",
  head_depth: "",
  inclination_deg: 15,
  phi_deg: "",
  load_mode: "horizontal",
  horizontal_load_per_m: "",
  spacing: "",
  axial_load: "",
  common: EMPTY_COMMON,
};

export function anchorMissing(f: AnchorForm): string[] {
  const out: string[] = [];
  if (!has(f.excavation_height) || f.excavation_height <= 0) out.push("excavation_height");
  if (!has(f.head_depth)) out.push("head_depth");
  else if (has(f.excavation_height) && f.head_depth >= f.excavation_height) out.push("head_depth_range");
  if (!has(f.inclination_deg)) out.push("inclination_deg");
  if (!has(f.phi_deg)) out.push("phi_deg");
  if (f.load_mode === "horizontal") {
    if (!has(f.horizontal_load_per_m) || f.horizontal_load_per_m <= 0) out.push("horizontal_load_per_m");
    if (!has(f.spacing) || f.spacing <= 0) out.push("spacing");
  } else if (!has(f.axial_load) || f.axial_load <= 0) out.push("axial_load");
  return [...out, ...commonMissing(f.common)];
}

export function anchorPayload(f: AnchorForm): AnchorDesignInputs {
  const horizontal = f.load_mode === "horizontal";
  return {
    ...commonPayload(f.common),
    excavation_height: f.excavation_height as number,
    head_depth: f.head_depth as number,
    inclination_deg: f.inclination_deg as number,
    phi_deg: f.phi_deg as number,
    horizontal_load_per_m: horizontal ? opt(f.horizontal_load_per_m) : null,
    spacing: horizontal ? opt(f.spacing) : null,
    axial_load: horizontal ? null : opt(f.axial_load),
  };
}

export function anchorFromPayload(p: AnchorDesignInputs): AnchorForm {
  const horizontal = p.horizontal_load_per_m != null;
  return {
    excavation_height: p.excavation_height,
    head_depth: p.head_depth,
    inclination_deg: p.inclination_deg,
    phi_deg: p.phi_deg,
    load_mode: horizontal ? "horizontal" : "axial",
    horizontal_load_per_m: num(p.horizontal_load_per_m),
    spacing: num(p.spacing),
    axial_load: num(p.axial_load),
    common: commonFromPayload(p as AnchorDesignCommon),
  };
}

// ---- anchored wall ----------------------------------------------------------------------------

export interface LevelForm {
  depth: Num;
  spacing: Num;
  inclination_deg: Num;
}

export interface AnalysisForm {
  wall_type: "sheet_pile" | "soldier_pile";
  excavation_height: Num;
  drainage: "drained" | "undrained";
  backfill_slope: Num;
  surcharge: Num;
  surcharge_basis: "horizontal" | "inclined";
  passive_factor: Num;
  depth_increase: Num;
  load_method: "hinge" | "tributary";
  stiff_clay_coefficient: Num;
  pile_spacing: Num;
  passive_width: Num;
  w_cm3: Num;
  allowable_stress_mpa: Num;
  ei_knm2: Num;
  levels: LevelForm[];
  soil: StructureSoil | null;
  design_anchors: boolean;
  common: CommonForm;
}

export const EMPTY_LEVEL: LevelForm = { depth: "", spacing: "", inclination_deg: 0 };

export const EMPTY_ANALYSIS: AnalysisForm = {
  wall_type: "sheet_pile",
  excavation_height: "",
  drainage: "drained",
  backfill_slope: 0,
  surcharge: 0,
  surcharge_basis: "horizontal",
  passive_factor: 1,
  depth_increase: "",
  load_method: "hinge",
  stiff_clay_coefficient: 0.3,
  pile_spacing: "",
  passive_width: "",
  w_cm3: "",
  allowable_stress_mpa: "",
  ei_knm2: "",
  levels: [{ ...EMPTY_LEVEL }],
  soil: null,
  design_anchors: false,
  common: EMPTY_COMMON,
};

const prevDepth = (f: AnalysisForm, i: number): number | null => {
  const d = f.levels[i - 1].depth;
  return has(d) ? d : null;
};

export function analysisMissing(f: AnalysisForm): string[] {
  const out: string[] = [];
  if (!f.soil) out.push("soil");
  if (!has(f.excavation_height) || f.excavation_height <= 0.5) out.push("excavation_height");
  f.levels.forEach((lv, i) => {
    if (!has(lv.depth)) out.push(`level_${i}_depth`);
    else if (has(f.excavation_height) && lv.depth >= f.excavation_height) out.push(`level_${i}_depth_range`);
    else if (i > 0 && prevDepth(f, i) !== null && lv.depth <= (prevDepth(f, i) as number)) out.push(`level_${i}_order`);
    if (!has(lv.spacing) || lv.spacing <= 0) out.push(`level_${i}_spacing`);
    if (!has(lv.inclination_deg)) out.push(`level_${i}_inclination`);
  });
  if (f.wall_type === "soldier_pile") {
    if (!has(f.pile_spacing)) out.push("pile_spacing");
    if (!has(f.passive_width)) out.push("passive_width");
  }
  if (f.design_anchors) out.push(...commonMissing(f.common).map((k) => `design_${k}`));
  return out;
}

/** Engineering inputs the user may leave out of the analysis itself (the anchor design is optional). */
export function analysisPayload(f: AnalysisForm): AnalysisInputs {
  const soldier = f.wall_type === "soldier_pile";
  return {
    wall_type: f.wall_type,
    excavation_height: f.excavation_height as number,
    soil: f.soil as StructureSoil,
    levels: f.levels.map((lv) => ({
      depth: lv.depth as number,
      spacing: lv.spacing as number,
      inclination_deg: has(lv.inclination_deg) ? lv.inclination_deg : 0,
    })),
    drainage: f.drainage,
    backfill_slope: has(f.backfill_slope) ? f.backfill_slope : 0,
    surcharge: has(f.surcharge) ? f.surcharge : 0,
    surcharge_basis: f.surcharge_basis,
    passive_factor: has(f.passive_factor) ? f.passive_factor : 1,
    depth_increase: opt(f.depth_increase),
    load_method: f.load_method,
    stiff_clay_coefficient: has(f.stiff_clay_coefficient) ? f.stiff_clay_coefficient : 0.3,
    pile_spacing: soldier ? opt(f.pile_spacing) : null,
    passive_width: soldier ? opt(f.passive_width) : null,
    section: { w_cm3: opt(f.w_cm3), allowable_stress_mpa: opt(f.allowable_stress_mpa), ei_knm2: opt(f.ei_knm2) },
    anchor_design: f.design_anchors ? commonPayload(f.common) : null,
  };
}

export function analysisFromPayload(p: AnalysisInputs): AnalysisForm {
  return {
    wall_type: p.wall_type,
    excavation_height: p.excavation_height,
    drainage: p.drainage,
    backfill_slope: p.backfill_slope,
    surcharge: p.surcharge,
    surcharge_basis: p.surcharge_basis,
    passive_factor: p.passive_factor,
    depth_increase: num(p.depth_increase),
    load_method: p.load_method,
    stiff_clay_coefficient: p.stiff_clay_coefficient,
    pile_spacing: num(p.pile_spacing),
    passive_width: num(p.passive_width),
    w_cm3: num(p.section?.w_cm3),
    allowable_stress_mpa: num(p.section?.allowable_stress_mpa),
    ei_knm2: num(p.section?.ei_knm2),
    levels: p.levels.map((lv) => ({ depth: lv.depth, spacing: lv.spacing, inclination_deg: lv.inclination_deg ?? 0 })),
    soil: p.soil,
    design_anchors: p.anchor_design != null,
    common: p.anchor_design ? commonFromPayload(p.anchor_design) : EMPTY_COMMON,
  };
}

/** Same JSON with the keys the form does not edit removed: dirty checks compare payloads. */
export const sameInputs = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Layers that lack the design value the analysis needs over the excavation depth. */
export function soilGaps(soil: StructureSoil | null, drainage: "drained" | "undrained", height: Num): string[] {
  if (!soil) return [];
  const key = drainage === "drained" ? "phi_eff" : "su";
  return soil.profile.layers
    .filter((l) => (!has(height) || l.top < height) && (l.design?.[key] ?? null) == null)
    .map((l) => l.id);
}
