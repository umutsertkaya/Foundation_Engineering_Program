import { NOT_HANDLED, type MockHandler } from "../../shared/api/mock/dispatcher";
import { isMockSessionOpen } from "../../shared/api/mock/core";
import { mockProfileHash } from "../../shared/api/mock/hash";
import { getMockStore, notFound } from "../../shared/api/mock/store";
import type { SoilProfile } from "../../shared/api/types";
import type {
  AnalysisInputs,
  AnalysisResult,
  AnchorDesignInputs,
  AnchorDesignResult,
  AnchorReference,
  AnchoredWallState,
} from "./types";

const PREFIX = "/m/anchored_wall";
const MOCK_NOTICE = { code: "mock_result", params: {} };

let state: AnchoredWallState = { anchor: null, analysis: null };

export function resetAnchoredWallMock(): void {
  state = { anchor: null, analysis: null };
}

const hashOf = (inputs: unknown): string => JSON.stringify(inputs);

const error = (status: number, code: string, message: string, details: Record<string, unknown> = {}) => ({
  status,
  data: { code, message: `${message} (Mock)`, details, missing_factors: [] },
});

const REFERENCE: AnchorReference = {
  tendons: [
    { id: "strand_15mm_gr270", type: "strand", label: "15 mm Gr 270 strand", smts_kn: 261, area_mm2: 140, source: "Mock table" },
    { id: "bar_150_32", type: "bar", label: "32 mm Gr 150 bar", smts_kn: 1206, area_mm2: 804, source: "Mock table" },
  ],
  transfer_loads: [
    { id: "mock_sand_dense", ground: "sand", condition: "dense (mock row)", q_u_kn_per_m: 250, source: "Mock table" },
  ],
  safety_factor_guidance: [{ ground: "soil", value: 2, source: "Mock table" }],
  defaults: {
    min_free_length_strand: 4.5,
    min_free_length_bar: 3,
    min_free_length_source: "Mock",
    test_factor: 1.33,
    design_limit: 0.6,
    lock_off_limit: 0.7,
    test_limit: 0.8,
    min_overburden: 4.5,
    beyond_wedge_rule: "max(1.5 m, 0.2 H)",
    source: "Mock",
  },
};

function missingAnchorInputs(c: {
  safety_factor?: number | null;
  ultimate_transfer_load?: number | null;
  ultimate_bond_stress?: number | null;
  hole_diameter?: number | null;
  lock_off_ratio?: number | null;
}): string[] {
  const out: string[] = [];
  if (c.safety_factor == null) out.push("safety_factor");
  if (c.ultimate_transfer_load == null && c.ultimate_bond_stress == null) out.push("ultimate_transfer_load|ultimate_bond_stress");
  if (c.ultimate_bond_stress != null && c.hole_diameter == null) out.push("hole_diameter");
  if (c.lock_off_ratio == null) out.push("lock_off_ratio");
  return out;
}

/** Synthetic numbers on the real result shape; NOT a calculation (flagged by a warning code). */
function syntheticDesign(common: Partial<AnchorDesignInputs>, load: number, headDepth: number, height: number): AnchorDesignResult {
  const free = Math.max(4.5, height * 0.8);
  const bond = 8;
  const count = Math.max(1, Math.ceil(load / (0.6 * 261)));
  return {
    load_source: "axial",
    horizontal_load_per_anchor: load,
    design_load: load,
    vertical_load_per_anchor: 0,
    vertical_load_per_m: null,
    lock_off_load: load * (common.lock_off_ratio ?? 1),
    test_load: load * 1.33,
    wedge_angle_deg: 60,
    wedge_distance: 3,
    wedge_length: free,
    beyond_wedge: 1.5,
    free_length_required: free,
    free_length_minimum: 4.5,
    free_length: free,
    free_length_governing: "wedge",
    transfer_load: common.ultimate_transfer_load ?? 100,
    transfer_load_source: "direct",
    safety_factor: common.safety_factor ?? 2,
    bond_length_calculated: bond,
    bond_length: bond,
    bond_length_governing: "calculated",
    transfer_load_ref: common.transfer_load_ref ?? null,
    bond_capacity: load,
    total_length: free + bond,
    bond_centre_depth: headDepth + 5,
    tendon: {
      type: "strand",
      label: "15 mm Gr 270 strand",
      source: "Mock table",
      count,
      smts_each: 261,
      smts_total: 261 * count,
      area_total_mm2: 140 * count,
      design_utilisation: load / (261 * count),
      lock_off_utilisation: 0.6,
      test_utilisation: 0.7,
      count_governing: "design",
    },
    checks: [{ id: "tendon_design", demand: load, limit: 0.6 * 261 * count, ok: true }],
    warnings: [MOCK_NOTICE],
    assumptions: [],
    sources: ["Mock"],
  };
}

function syntheticAnalysis(inputs: AnalysisInputs): AnalysisResult {
  const H = inputs.excavation_height;
  const D = H * 0.4;
  const z = [0, H / 2, H, H + D / 2, H + D];
  const levels = inputs.levels.map((lv) => {
    const t = 100;
    const axial = (t * lv.spacing) / Math.cos(((lv.inclination_deg ?? 0) * Math.PI) / 180);
    const common = inputs.anchor_design;
    const missing = common ? missingAnchorInputs(common) : [];
    return {
      depth: lv.depth,
      inclination_deg: lv.inclination_deg ?? 0,
      spacing: lv.spacing,
      horizontal_load_per_m: t,
      horizontal_load_per_anchor: t * lv.spacing,
      axial_load_per_anchor: axial,
      vertical_load_per_m: 0,
      design: common && missing.length === 0 ? syntheticDesign(common, axial, lv.depth, H) : null,
      design_missing: missing,
      design_error: null,
    };
  });
  return {
    method: inputs.levels.length === 1 ? "free_earth_single" : inputs.load_method === "hinge" ? "apparent_hinge" : "apparent_tributary",
    wall_type: inputs.wall_type,
    excavation_height: H,
    embedment_theoretical: D,
    embedment: D * 1.2,
    wall_length: H + D * 1.2,
    base_reaction: inputs.levels.length > 1 ? 60 : null,
    envelope: null,
    levels,
    m_max: 180,
    z_m_max: H * 0.6,
    v_max: 90,
    member_spacing: inputs.pile_spacing ?? 1,
    m_max_member: 180 * (inputs.pile_spacing ?? 1),
    v_max_member: 90 * (inputs.pile_spacing ?? 1),
    required_section_modulus_cm3: inputs.section?.allowable_stress_mpa ? (180 / inputs.section.allowable_stress_mpa) * 1000 : null,
    checks: [],
    z,
    shear: [0, 40, -50, -20, 0],
    moment: [0, 120, 180, 60, 0],
    warnings: [MOCK_NOTICE],
    assumptions: [],
    sources: ["Mock"],
  };
}

const handle: MockHandler = (method, path, body) => {
  const verb = method.toUpperCase();
  const [clean, query = ""] = path.split("?");
  const route = clean.slice(PREFIX.length);
  const save = query.split("&").includes("save=true");
  const noProject = () => error(409, "no_project_open", "No project is open.");

  if (verb === "GET" && route === "/anchor/reference") return { status: 200, data: REFERENCE };
  if (verb === "GET" && route === "/state") {
    if (!isMockSessionOpen()) return noProject();
    return { status: 200, data: { state: state, anchor_result_stale: false, analysis_result_stale: false, analysis_soil_stale: false } };
  }
  const soil = /^\/soil\/([^/]+)$/.exec(route);
  if (verb === "GET" && soil) {
    if (!isMockSessionOpen()) return noProject();
    const profile = getMockStore().profiles.find((p) => p.id === decodeURIComponent(soil[1])) as SoilProfile | undefined;
    if (!profile) return notFound("Profile");
    return {
      status: 200,
      data: { source_profile_id: profile.id, source_hash: mockProfileHash(profile), profile: structuredClone(profile) },
    };
  }
  if (verb === "POST" && route === "/anchor/design") {
    const inputs = body as AnchorDesignInputs;
    const missing = missingAnchorInputs(inputs);
    if (missing.length > 0) return error(422, "missing_inputs", `Missing anchor design inputs: ${missing.join(", ")}`, { missing });
    if (save && !isMockSessionOpen()) return noProject();
    const load = inputs.axial_load ?? (inputs.horizontal_load_per_m ?? 0) * (inputs.spacing ?? 1);
    const result = syntheticDesign(inputs, load, inputs.head_depth, inputs.excavation_height);
    if (save) state = { ...state, anchor: { inputs, result, result_hash: hashOf(inputs) } };
    return { status: 200, data: result };
  }
  if (verb === "POST" && route === "/analysis/run") {
    const inputs = body as AnalysisInputs;
    if (inputs.levels.length > 1 && inputs.backfill_slope > 0) {
      return error(422, "calculation_stopped", "The apparent pressure envelope is for level ground.", { stop_code: "envelope_sloping_ground", params: {} });
    }
    if (save && !isMockSessionOpen()) return noProject();
    const result = syntheticAnalysis(inputs);
    if (save) state = { ...state, analysis: { inputs, result, result_hash: hashOf(inputs) } };
    return { status: 200, data: result };
  }
  return NOT_HANDLED;
};

export const mock = { prefix: PREFIX, handle };
