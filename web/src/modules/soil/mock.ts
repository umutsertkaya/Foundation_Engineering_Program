import {
  getMockStore,
  notFound,
  notifyMockMutation,
  toProfileSummary,
  validationError,
} from "../../shared/api/mock/store";
import { MOCK_PROFILES } from "../../shared/api/mock/data";
import { NOT_HANDLED, type MockHandler } from "../../shared/api/mock/dispatcher";
import { validateGwt, validateLayers } from "../../shared/soil/layerOps";
import type {
  Borehole,
  CPTSounding,
  DeletionResponse,
  DerivedParameter,
  DesignKey,
  LayeringProposal,
  LayeringSettings,
  ParameterSelection,
  ProposedLayer,
  SelectionUpdate,
  SoilLayer,
  SoilProfile,
  Statistic,
} from "../../shared/api/types";
import type {
  BoreholeUSCSDTO,
  CPTProcessedDTO,
  CPTSBTNDTO,
  InvestigationsDTO,
  ProfileCreate,
  SBTNReferenceDTO,
  SPTProcessedDTO,
  USCSClassifyRequest,
  USCSItemDTO,
  USCSReferenceDTO,
} from "./types";

const PREFIX = "/m/soil";

type Reply = { status: number; data: unknown };

// ---------------------------------------------------------------------------------------------
// DEMO DATA ONLY. Everything in this section fabricates plausible-looking numbers so the soil UI
// can be exercised end to end in `npm run dev:mock`. None of it is an engineering result,
// correlation or design coefficient; the real engine lives in the Python backend.
// ---------------------------------------------------------------------------------------------

const MOCK_TAG = "(Mock)";
const DESIGN_KEYS: DesignKey[] = ["phi_eff", "c_eff", "su", "E", "gamma", "gamma_sat", "delta_base"];
const KEY_UNIT: Record<DesignKey, string> = {
  phi_eff: "deg",
  c_eff: "kPa",
  su: "kPa",
  E: "kPa",
  gamma: "kN/m3",
  gamma_sat: "kN/m3",
  delta_base: "deg",
};
const STATISTICS: Statistic[] = ["mean", "median", "min", "max", "mean_minus_k_sd"];

function bad(message: string, details: Record<string, unknown> = {}): Reply {
  return validationError(message, details);
}

/** Same wire format as the backend: `code` or `code: key=<json> key2=<json>`. */
function mockWarning(code: string, params: Record<string, unknown> = {}): string {
  const context = Object.entries(params)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(" ");
  return context ? `${code}: ${context}` : code;
}

function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function populationSd(values: number[]): number {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

function effectiveSettings(settings: LayeringSettings): LayeringSettings {
  // Demo defaults; the real server fills in its own LayeringSettings defaults.
  return { smoothing_window: 0.5, min_thickness: 0.5, merge_ic_tol: 0.15, n_change_ratio: 0.5, ...settings };
}

function settingsIssue(settings: LayeringSettings, allowed: LayeringSettings["method"][]): Reply | null {
  if (!settings || !allowed.includes(settings.method)) {
    return bad("Layering method does not fit this source", { allowed });
  }
  for (const key of ["smoothing_window", "min_thickness", "n_change_ratio"] as const) {
    const value = settings[key];
    if (value !== undefined && !(value > 0)) return bad(`${key} must be positive`, { key });
  }
  if (settings.merge_ic_tol !== undefined && !(settings.merge_ic_tol >= 0)) {
    return bad("merge_ic_tol must not be negative", { key: "merge_ic_tol" });
  }
  return null;
}

function sptOf(bh: Borehole): NonNullable<Borehole["spt"]> {
  return bh.spt ?? [];
}

/** Energy ratio in percent; 60 (the N60 reference) when the borehole does not record one. */
function energyOf(bh: Borehole): number {
  return bh.energy_ratio ?? 60;
}

function mockProposalCpt(cpt: CPTSounding, settings: LayeringSettings): LayeringProposal {
  const bottom = Math.max(...cpt.depth);
  const cuts = [0, round(bottom * 0.3, 1), round(bottom * 0.65, 1), bottom];
  const demo: Pick<ProposedLayer, "description" | "uscs" | "sbtn_zone" | "ic_mean" | "gamma_suggested" | "behaviour">[] = [
    { description: `Sentetik siltli kum ${MOCK_TAG}`, uscs: "SM", sbtn_zone: 5, ic_mean: 2.1, gamma_suggested: 18.2, behaviour: "drained" },
    { description: `Sentetik kil ${MOCK_TAG}`, uscs: "CL", sbtn_zone: 3, ic_mean: 2.9, gamma_suggested: 17.4, behaviour: "undrained" },
    { description: `Sentetik sıkı kum ${MOCK_TAG}`, uscs: "SP", sbtn_zone: 6, ic_mean: 1.8, gamma_suggested: 19.6, behaviour: "drained" },
  ];
  return {
    source_id: cpt.id,
    settings: effectiveSettings(settings),
    layers: demo.map((d, i) => ({ ...d, top: cuts[i], bottom: cuts[i + 1], n60_mean: null })),
    warnings: [
      mockWarning("layering.warning.drainage_ic_based", { message: "Demo (Mock): confirm drainage for the loading case" }),
      mockWarning("layering.warning.similar_merged"),
    ],
  };
}

function mockProposalSpt(bh: Borehole, settings: LayeringSettings): LayeringProposal {
  const last = Math.max(0, ...sptOf(bh).map((r) => r.depth));
  const log = [...(bh.log ?? [])].sort((a, b) => a.top - b.top);
  const warnings = [mockWarning("layering.warning.gamma_unavailable"), mockWarning("layering.warning.behaviour_assumed")];
  const intervals =
    settings.method === "spt_log" && log.length > 0
      ? log.map((l) => ({ top: l.top, bottom: l.bottom, uscs: l.uscs ?? null, description: l.description ?? "" }))
      : [{ top: 0, bottom: Math.max(last, 1), uscs: null as string | null, description: `Sentetik tek katman ${MOCK_TAG}` }];
  if (settings.method === "spt_log" && log.length === 0) warnings.push(mockWarning("layering.warning.log_missing"));
  intervals[0].top = 0;
  const logBottom = intervals[intervals.length - 1].bottom;
  if (last > logBottom) warnings.push(mockWarning("layering.warning.tests_outside_log", { top: logBottom, bottom: last }));
  const layers: ProposedLayer[] = intervals.map((iv) => {
    const tests = sptOf(bh).filter((r) => r.depth >= iv.top && r.depth < iv.bottom).map((r) => r.n_field);
    const granular = iv.uscs?.startsWith("G") || iv.uscs?.startsWith("S");
    return {
      top: iv.top,
      bottom: iv.bottom,
      description: iv.description,
      uscs: iv.uscs,
      sbtn_zone: null,
      ic_mean: null,
      // Demo: field N scaled by the energy ratio only (no other corrections).
      n60_mean: tests.length ? round((mean(tests) * energyOf(bh)) / 60, 1) : null,
      // Like the real SPT engine: no reliable unit-weight formula, the engineer supplies it.
      gamma_suggested: null,
      behaviour: granular ? "drained" : "undrained",
    };
  });
  return { source_id: bh.id, settings: effectiveSettings(settings), layers, warnings };
}

function mockProcessedCpt(cpt: CPTSounding): CPTProcessedDTO {
  const rf = cpt.depth.map((_, i) => (cpt.fs && cpt.qc[i] > 0 ? (cpt.fs[i] / cpt.qc[i]) * 100 : null));
  const sigma = cpt.depth.map((z) => round(18 * z, 1));
  const u0 = cpt.depth.map((z) => round(9.81 * Math.max(0, z - (cpt.gwt_depth ?? Infinity)), 1));
  // Demo Ic: a monotone stand-in of Rf, NOT Robertson's Ic.
  const ic = rf.map((r) => (r === null ? null : round(1.2 + 0.8 * r, 2)));
  return {
    depth: [...cpt.depth],
    qc: [...cpt.qc],
    fs: cpt.depth.map((_, i) => cpt.fs?.[i] ?? null),
    qt: [...cpt.qc],
    Rf: rf.map((r) => (r === null ? null : round(r, 2))),
    Fr: rf.map((r) => (r === null ? null : round(r, 2))),
    Bq: null,
    Qtn: cpt.qc.map((q) => round(q / 100, 1)),
    Ic: ic,
    zone: ic.map((v) => (v === null ? null : v < 2.6 ? 6 : 3)),
    fc: ic.map((v) => (v === null ? null : round(Math.min(100, Math.max(0, v * 25 - 30)), 0))),
    sigma_v: sigma,
    sigma_v_eff: sigma.map((s, i) => round(s - u0[i], 1)),
    warnings: ["Mock demo values: not produced by the processing engine."],
  };
}

function mockProcessedSpt(bh: Borehole): SPTProcessedDTO {
  const n60 = sptOf(bh).map((r) => round((r.n_field * energyOf(bh)) / 60, 1));
  return {
    depth: sptOf(bh).map((r) => r.depth),
    N_field: sptOf(bh).map((r) => r.n_field),
    N60: n60,
    // Demo: no overburden correction applied.
    N1_60: [...n60],
    warnings: ["Mock demo values: only the energy ratio is applied."],
  };
}

/** Demo stand-in for the backend basis hash: changes when the layer bounds change. */
const BASIS_PREFIX = "mock-basis:";
function basisOf(layer: SoilLayer): string {
  return `${BASIS_PREFIX}${layer.top}-${layer.bottom}`;
}

/** Fake candidates and suggestion for one key of one layer (demo numbers, deterministic per layer). */
function mockCandidates(
  layer: SoilLayer,
  key: DesignKey,
): { candidates: DerivedParameter[]; suggested: DerivedParameter | null } {
  const unit = KEY_UNIT[key];
  const idx = Math.round(layer.top * 3) % 4;
  const make = (suffix: string, value: number, extra: Partial<DerivedParameter> = {}): DerivedParameter => ({
    value: round(value, 2),
    unit,
    method_id: `mock_${key}_${suffix}`,
    reference: `Sentetik korelasyon ${suffix.toUpperCase()} ${MOCK_TAG}`,
    source: layer.behaviour === "undrained" ? "CPT" : "SPT",
    reliability: "B",
    stats: { n: 4 + idx, min: round(value * 0.9, 2), mean: round(value, 2), max: round(value * 1.1, 2) },
    validity_ok: true,
    ...extra,
  });
  const suggest = (from: DerivedParameter): DerivedParameter => ({
    ...from,
    method_id: "mock_suggestion",
    reference: `Sentetik öneri ${MOCK_TAG}`,
  });
  switch (key) {
    case "phi_eff": {
      const base = 28 + idx * 2;
      const candidates = [
        make("a", base),
        make("b", base + 3, { reliability: "C" }),
        make("c", base + 7, {
          validity_ok: false,
          warnings: [mockWarning("parameters.warning.value_not_computable", { method_id: "mock_phi_eff_c" })],
        }),
      ];
      return { candidates, suggested: suggest(candidates[0]) };
    }
    case "c_eff": {
      const granular = layer.behaviour !== "undrained";
      return {
        candidates: [],
        suggested: granular
          ? { value: 0, unit, method_id: "mock_c_eff_granular", source: "combined", reference: `Sentetik kural: granüler zeminde c' = 0 ${MOCK_TAG}` }
          : null,
      };
    }
    case "su": {
      if (layer.behaviour !== "undrained") return { candidates: [], suggested: null };
      const base = 40 + idx * 10;
      const candidates = [make("a", base), make("b", base * 1.3)];
      return { candidates, suggested: suggest(candidates[0]) };
    }
    case "E": {
      const base = 15000 + idx * 5000;
      const candidates = [make("a", base, { reliability: "C" }), make("b", base * 1.4, { reliability: "C" })];
      return { candidates, suggested: suggest(candidates[0]) };
    }
    case "gamma":
    case "gamma_sat": {
      // No derived gamma_sat: a candidate exists only when the layer already carries a value.
      const base = key === "gamma" ? layer.gamma : layer.gamma_sat;
      if (base === undefined || base === null) return { candidates: [], suggested: null };
      const candidates = [make("rc", base, { source: "combined" })];
      return { candidates, suggested: suggest(candidates[0]) };
    }
    case "delta_base": {
      const phi = layer.design?.phi_eff ?? layer.selections?.phi_eff?.suggested?.value;
      if (phi === undefined || phi === null) return { candidates: [], suggested: null };
      const value = (Math.atan(Math.min(Math.tan((phi * Math.PI) / 180), 0.6)) * 180) / Math.PI;
      return {
        candidates: [],
        suggested: {
          value: round(value, 2),
          unit,
          method_id: "mock_delta_base",
          source: "combined",
          reference: `Sentetik etiket: delta = atan(min(tan phi, 0.6)) ${MOCK_TAG}`,
          inputs_used: { phi_eff: phi },
          warnings: [mockWarning("parameters.warning.phi_cv_assumed_equal_phi_eff", { phi_eff: phi })],
        },
      };
    }
  }
}

/** Refresh candidates/suggestion; an approval whose basis no longer matches becomes stale (approved=false, trace kept). */
function refreshedSelection(layer: SoilLayer, key: DesignKey): ParameterSelection {
  const stored = layer.selections?.[key];
  const { candidates, suggested } = mockCandidates(layer, key);
  const sel: ParameterSelection = stored ? structuredClone(stored) : { parameter: key, mode: null, approved: false };
  sel.candidates = candidates;
  sel.suggested = suggested;
  // Seed approvals carry an opaque hash that is not ours; only approvals made through this mock can go stale.
  if (sel.approved && sel.basis_hash?.startsWith(BASIS_PREFIX) && sel.basis_hash !== basisOf(layer)) sel.approved = false;
  return sel;
}

/** Resolve an explicit choice (no mode is an error; resolving revokes any approval). */
function resolveSelection(sel: ParameterSelection): { selection: ParameterSelection } | { error: string } {
  const unit = KEY_UNIT[sel.parameter];
  let selected: DerivedParameter;
  if (sel.mode === "manual") {
    if (sel.manual_value === null || sel.manual_value === undefined || !Number.isFinite(sel.manual_value)) {
      return { error: "Manual selection needs a finite manual_value" };
    }
    selected = {
      value: sel.manual_value,
      unit,
      method_id: "user",
      source: "user",
      reference: "User-entered value",
      user_override: true,
    };
  } else if (sel.mode === "correlation") {
    const pool = [...(sel.candidates ?? []), ...(sel.suggested ? [sel.suggested] : [])];
    const found = pool.find((c) => c.method_id === sel.method_id);
    if (!found) return { error: `Chosen method ${String(sel.method_id)} is unavailable` };
    selected = structuredClone(found);
  } else if (sel.mode === "statistic") {
    const pool = (sel.candidates ?? []).filter((c) => c.validity_ok !== false && Number.isFinite(c.value));
    if (pool.length === 0) return { error: "Statistic selection needs valid candidates" };
    if (!sel.statistic || !STATISTICS.includes(sel.statistic)) return { error: "Statistic selection needs a statistic" };
    const values = pool.map((c) => c.value);
    const sorted = [...values].sort((a, b) => a - b);
    let value: number;
    if (sel.statistic === "mean") value = mean(values);
    else if (sel.statistic === "median") {
      const mid = Math.floor(sorted.length / 2);
      value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    } else if (sel.statistic === "min") value = sorted[0];
    else if (sel.statistic === "max") value = sorted[sorted.length - 1];
    else {
      if (sel.k_sd === null || sel.k_sd === undefined || sel.k_sd < 0) {
        return { error: "mean_minus_k_sd needs a user-entered k_sd" };
      }
      value = mean(values) - sel.k_sd * populationSd(values);
    }
    selected = {
      value: round(value, 4),
      unit,
      method_id: `statistic:${sel.statistic}`,
      source: "combined",
      reference: pool.map((c) => c.reference ?? c.method_id).join("; "),
      inputs_used: sel.k_sd !== null && sel.k_sd !== undefined ? { k_sd: sel.k_sd } : {},
      stats: { n: values.length, min: sorted[0], mean: mean(values), max: sorted[sorted.length - 1] },
    };
  } else {
    return { error: "Selection needs an explicit mode" };
  }
  return { selection: { ...sel, selected, approved: false, approved_at: null, basis_hash: null } };
}

function findLayer(profileId: string, layerId: string): { profile: SoilProfile; layer: SoilLayer } | Reply {
  const profile = getMockStore().profiles.find((p) => p.id === profileId);
  if (!profile) return notFound("Profile");
  const layer = profile.layers.find((l) => l.id === layerId);
  if (!layer) return notFound("Layer");
  return { profile, layer };
}

function isReply(value: unknown): value is Reply {
  return typeof value === "object" && value !== null && "status" in value;
}

function handleLayeringAndParameters(method: string, cleanPath: string, body: unknown): Reply | typeof NOT_HANDLED {
  const store = getMockStore();
  const id = (segment: string) => decodeURIComponent(segment);

  let m = /^\/cpts\/([^/]+)\/processed$/.exec(cleanPath);
  if (method === "GET" && m) {
    const cpt = store.cpts.find((c) => c.id === id(m![1]));
    return cpt ? { status: 200, data: mockProcessedCpt(cpt) } : notFound("CPT");
  }
  m = /^\/boreholes\/([^/]+)\/processed$/.exec(cleanPath);
  if (method === "GET" && m) {
    const bh = store.boreholes.find((b) => b.id === id(m![1]));
    if (!bh) return notFound("Borehole");
    return sptOf(bh).length > 0 ? { status: 200, data: mockProcessedSpt(bh) } : bad("Borehole has no SPT records.");
  }

  m = /^\/layering\/cpt\/([^/]+)$/.exec(cleanPath);
  if (method === "POST" && m) {
    const cpt = store.cpts.find((c) => c.id === id(m![1]));
    if (!cpt) return notFound("CPT");
    const settings = body as LayeringSettings;
    return settingsIssue(settings, ["cpt_ic"]) ?? { status: 200, data: mockProposalCpt(cpt, settings) };
  }
  m = /^\/layering\/spt\/([^/]+)$/.exec(cleanPath);
  if (method === "POST" && m) {
    const bh = store.boreholes.find((b) => b.id === id(m![1]));
    if (!bh) return notFound("Borehole");
    const settings = body as LayeringSettings;
    return settingsIssue(settings, ["spt_log", "spt_uscs_n"]) ?? { status: 200, data: mockProposalSpt(bh, settings) };
  }

  m = /^\/profiles\/([^/]+)\/layers\/([^/]+)\/parameters$/.exec(cleanPath);
  if (method === "GET" && m) {
    const found = findLayer(id(m[1]), id(m[2]));
    if (isReply(found)) return found;
    return { status: 200, data: DESIGN_KEYS.map((key) => refreshedSelection(found.layer, key)) };
  }

  m = /^\/profiles\/([^/]+)\/layers\/([^/]+)\/parameters\/approve$/.exec(cleanPath);
  if (method === "POST" && m) {
    const found = findLayer(id(m[1]), id(m[2]));
    if (isReply(found)) return found;
    const keys = (body as { keys?: DesignKey[] } | undefined)?.keys ?? [];
    if (keys.length === 0 || keys.some((k) => !DESIGN_KEYS.includes(k))) return bad("Approval needs known design keys", { keys });
    const next = structuredClone(found.layer);
    next.selections = { ...(next.selections ?? {}) };
    next.design = { ...(next.design ?? {}) };
    for (const key of keys) {
      // Like the backend: re-resolve the stored choice against the fresh candidates, so the approved value and
      // the basis describe the same inputs (a previously shown `selected` may be out of date).
      const fresh = refreshedSelection(next, key);
      if (!fresh.mode) return bad(`No selection to approve for ${key}`, { key });
      const resolved = resolveSelection(fresh);
      if ("error" in resolved) return bad(resolved.error, { key });
      const sel = resolved.selection;
      next.selections[key] = { ...sel, approved: true, approved_at: new Date().toISOString(), basis_hash: basisOf(next) };
      const value = (sel.selected as DerivedParameter).value;
      if (key === "gamma") next.gamma = value;
      else if (key === "gamma_sat") next.gamma_sat = value;
      else next.design[key] = value;
    }
    found.profile.layers = found.profile.layers.map((l) => (l.id === next.id ? next : l));
    return { status: 200, data: structuredClone(next) };
  }

  m = /^\/profiles\/([^/]+)\/layers\/([^/]+)\/parameters\/([^/]+)$/.exec(cleanPath);
  if (method === "PUT" && m) {
    const found = findLayer(id(m[1]), id(m[2]));
    if (isReply(found)) return found;
    const key = id(m[3]) as DesignKey;
    if (!DESIGN_KEYS.includes(key)) return notFound("Parameter");
    const update = body as SelectionUpdate;
    const resolved = resolveSelection({
      ...refreshedSelection(found.layer, key),
      mode: update.mode,
      method_id: update.method_id ?? null,
      statistic: update.statistic ?? null,
      k_sd: update.k_sd ?? null,
      manual_value: update.manual_value ?? null,
    });
    if ("error" in resolved) return bad(resolved.error, { key });
    found.layer.selections = { ...(found.layer.selections ?? {}), [key]: resolved.selection };
    return { status: 200, data: structuredClone(resolved.selection) };
  }

  m = /^\/profiles\/([^/]+)\/parameters\/suggest-all$/.exec(cleanPath);
  if (method === "POST" && m) {
    const profile = store.profiles.find((p) => p.id === id(m![1]));
    if (!profile) return notFound("Profile");
    for (const layer of profile.layers) {
      layer.selections = Object.fromEntries(DESIGN_KEYS.map((key) => [key, refreshedSelection(layer, key)]));
    }
    return { status: 200, data: structuredClone(profile) };
  }

  return NOT_HANDLED;
}

/** POST /profiles with `from_proposal`: intervals are copied, nothing is approved, unit weight must be supplied. */
function createFromProposal(payload: ProfileCreate): Reply {
  const store = getMockStore();
  const proposal = payload.from_proposal;
  if (!proposal) return bad("Supply exactly one of layers or from_proposal");
  if (payload.layers) return bad("Omit the unused layer source");
  if (!payload.source_ids.includes(proposal.source_id)) return bad("Proposal source must be included in source_ids.");
  if (proposal.layers.some((l) => l.gamma_suggested === null || l.gamma_suggested === undefined)) {
    return bad("Proposal needs a supplied unit weight for every layer.");
  }
  const layers: SoilLayer[] = proposal.layers.map((l, i) => ({
    id: `L${i + 1}`,
    top: l.top,
    bottom: l.bottom,
    description: l.description,
    uscs: l.uscs,
    sbtn_zone: l.sbtn_zone,
    behaviour: l.behaviour,
    gamma: l.gamma_suggested as number,
    source_ids: [proposal.source_id],
  }));
  const issues = [...validateLayers(layers, { mustStartAtZero: true }), ...validateGwt(payload.gwt)];
  if (issues.length > 0) return bad("Invalid soil profile", { issues });
  let seq = store.profileSeq + 1;
  while (store.profiles.some((p) => p.id === `prof-mock-${seq}`)) seq += 1;
  store.profileSeq = seq;
  const created: SoilProfile = {
    id: `prof-mock-${seq}`,
    name: payload.name,
    origin: payload.origin,
    source_ids: [...payload.source_ids],
    layering: structuredClone(proposal.settings),
    gwt: { ...payload.gwt },
    layers,
  };
  store.profiles.push(created);
  return { status: 200, data: structuredClone(created) };
}

// ---------------------------------------------------------------------------------------------
// DEMO classification data (same disclaimer as above): geometry follows the published Robertson
// Ic formula so the chart looks right, but zones, Fr/Qtn and USCS symbols are NOT engine results.
// ---------------------------------------------------------------------------------------------

const MOCK_IC_BOUNDS = [1.31, 2.05, 2.6, 2.95, 3.6];
const MOCK_ZONES: [number, string, string][] = [
  [1, "Sensitive, fine grained", "Hassas, ince daneli"],
  [2, "Organic soils - clay", "Organik zemin - kil"],
  [3, "Clays - silty clay to clay", "Kil - siltli kil ile kil"],
  [4, "Silt mixtures - clayey silt to silty clay", "Silt karışımı - killi silt ile siltli kil"],
  [5, "Sand mixtures - silty sand to sandy silt", "Kum karışımı - siltli kum ile kumlu silt"],
  [6, "Sands - clean sand to silty sand", "Kum - temiz kum ile siltli kum"],
  [7, "Gravelly sand to dense sand", "Çakıllı kum ile sıkı kum"],
];

function mockZoneOfIc(ic: number): number {
  const i = MOCK_IC_BOUNDS.findIndex((b) => ic < b);
  return i < 0 ? 2 : 7 - i;
}

function mockSbtnReference(): SBTNReferenceDTO {
  const fr = Array.from({ length: 101 }, (_, i) => 10 ** (-1 + (2 * i) / 100));
  const inRange = (q: number) => Number.isFinite(q) && q >= 1 && q <= 1000;
  return {
    zones: MOCK_ZONES.map(([zone, name_en, name_tr]) => ({
      zone,
      name_en,
      name_tr,
      ic_min: zone === 1 ? null : zone === 7 ? null : MOCK_IC_BOUNDS[6 - zone] ?? null,
      ic_max: zone === 1 ? null : MOCK_IC_BOUNDS[7 - zone] ?? null,
    })),
    ic_bounds: MOCK_IC_BOUNDS,
    zone_1_boundary: fr.map((f) => ({ Fr: f, Qtn: 12 * Math.exp(-1.4 * f) })),
    ic_contours: MOCK_IC_BOUNDS.map((ic) => ({
      Ic: ic,
      points: fr.flatMap((f) => {
        const q = 10 ** (3.47 - Math.sqrt(ic ** 2 - (Math.log10(f) + 1.22) ** 2));
        return inRange(q) ? [{ Fr: f, Qtn: q }] : [];
      }),
    })),
    fr_range: { min: 0.1, max: 10 },
    qtn_range: { min: 1, max: 1000 },
  };
}

function mockCptSbtn(cpt: CPTSounding): CPTSBTNDTO {
  const points = cpt.depth.map((depth, i) => {
    const Fr = round(((cpt.fs?.[i] ?? 0) / cpt.qc[i]) * 100, 2);
    const Qtn = round(cpt.qc[i] / 60, 1);
    const Ic = round(Math.sqrt((3.47 - Math.log10(Qtn)) ** 2 + (Math.log10(Fr) + 1.22) ** 2), 2);
    const zone = mockZoneOfIc(Ic);
    const named = MOCK_ZONES.find(([z]) => z === zone);
    return { depth, Fr, Qtn, Ic, zone, zone_name_en: named?.[1] ?? null, zone_name_tr: named?.[2] ?? null };
  });
  return { points, warnings: [mockWarning("classification.mock_demo", { message: `Demo ${MOCK_TAG}: not engine output` })] };
}

function mockUscsItem(lab: Partial<USCSClassifyRequest> & { depth?: number | null; PL?: number | null; FC?: number | null }, symbol: string | null): USCSItemDTO {
  const named = symbol ? MOCK_USCS_NAMES[symbol] : undefined;
  return {
    depth: lab.depth ?? null,
    symbol,
    complete: false,
    notes: [`Demo ${MOCK_TAG}: symbol taken from the borehole log, not classified`],
    FC: lab.FC ?? lab.fines ?? null,
    gravel: lab.gravel ?? null,
    LL: lab.LL ?? null,
    PL: lab.PL ?? null,
    PI: lab.PI ?? null,
    D10: lab.D10 ?? null,
    D30: lab.D30 ?? null,
    D60: lab.D60 ?? null,
    Cu: null,
    Cc: null,
    plastic_class: null,
    group_name_en: named?.[0] ?? null,
    group_name_tr: named?.[1] ?? null,
    description: null,
  };
}

const MOCK_USCS_NAMES: Record<string, [string, string]> = {
  SW: ["Well-graded sand", "İyi derecelenmiş kum"],
  SM: ["Silty sand", "Siltli kum"],
  CL: ["Lean clay", "Düşük plastisiteli kil"],
};

function mockUscsReference(): USCSReferenceDTO {
  const ll = Array.from({ length: 101 }, (_, i) => i);
  return {
    a_line: ll.map((x) => ({ LL: x, PI: 0.73 * (x - 20) })),
    u_line: ll.map((x) => ({ LL: x, PI: 0.9 * (x - 8) })),
    symbols: Object.entries(MOCK_USCS_NAMES).map(([symbol, [group_name_en, group_name_tr]]) => ({
      symbol,
      group_name_en,
      group_name_tr,
      description: `Demo ${MOCK_TAG}`,
    })),
  };
}

function handleClassification(method: string, cleanPath: string, body: unknown): Reply | typeof NOT_HANDLED {
  const store = getMockStore();
  if (method === "GET" && cleanPath === "/classification/sbtn/reference") return { status: 200, data: mockSbtnReference() };
  if (method === "GET" && cleanPath === "/classification/uscs/reference") return { status: 200, data: mockUscsReference() };
  if (method === "POST" && cleanPath === "/classification/uscs") {
    const payload = body as USCSClassifyRequest;
    if (typeof payload?.fines !== "number" || payload.fines < 0 || payload.fines > 100) {
      return bad("fines must be a number from 0 to 100", { key: "fines" });
    }
    return { status: 200, data: mockUscsItem(payload, null) };
  }
  const cpt = /^\/cpts\/([^/]+)\/sbtn$/.exec(cleanPath);
  if (method === "GET" && cpt) {
    const found = store.cpts.find((c) => c.id === decodeURIComponent(cpt[1]));
    return found ? { status: 200, data: mockCptSbtn(found) } : notFound("CPT");
  }
  const bh = /^\/boreholes\/([^/]+)\/uscs$/.exec(cleanPath);
  if (method === "GET" && bh) {
    const found = store.boreholes.find((b) => b.id === decodeURIComponent(bh[1]));
    if (!found) return notFound("Borehole");
    const data: BoreholeUSCSDTO = {
      items: (found.lab ?? []).map((lab) => {
        const interval = (found.log ?? []).find((l) => lab.depth >= l.top && lab.depth < l.bottom);
        return mockUscsItem(lab, interval?.uscs ?? null);
      }),
    };
    return { status: 200, data };
  }
  return NOT_HANDLED;
}

function handleSoil(method: string, path: string, body: unknown): Reply | typeof NOT_HANDLED {
  const store = getMockStore();
  const cleanPath = path.split("?")[0].slice(PREFIX.length);
  const upperMethod = method.toUpperCase();

  const extra = handleLayeringAndParameters(upperMethod, cleanPath, body);
  if (extra !== NOT_HANDLED) return extra;
  const classification = handleClassification(upperMethod, cleanPath, body);
  if (classification !== NOT_HANDLED) return classification;

  // GET /investigations
  if (upperMethod === "GET" && cleanPath === "/investigations") {
    const res: InvestigationsDTO = {
      boreholes: structuredClone(store.boreholes),
      cpts: structuredClone(store.cpts),
    };
    return { status: 200, data: res };
  }

  // GET /profiles
  if (upperMethod === "GET" && cleanPath === "/profiles") {
    return { status: 200, data: store.profiles.map(toProfileSummary) };
  }

  // POST /profiles
  if (upperMethod === "POST" && cleanPath === "/profiles") {
    const payload = body as ProfileCreate;
    if (payload.from_proposal) return createFromProposal(payload);
    const layers = structuredClone(payload.layers ?? MOCK_PROFILES[0].layers);
    const issues = [...validateLayers(layers, { mustStartAtZero: true }), ...validateGwt(payload.gwt)];
    if (issues.length > 0) {
      return validationError("Invalid soil profile", { issues });
    }
    let seq = store.profileSeq + 1;
    while (store.profiles.some((p) => p.id === `prof-mock-${seq}`)) seq += 1;
    store.profileSeq = seq;
    const newProfile: SoilProfile = {
      id: `prof-mock-${seq}`,
      name: payload.name,
      origin: payload.origin,
      source_ids: [...payload.source_ids],
      layering: null,
      gwt: { ...payload.gwt },
      layers,
    };
    store.profiles.push(newProfile);
    return { status: 200, data: structuredClone(newProfile) };
  }

  // GET / PUT / DELETE /profiles/{id}
  const profileMatch = /^\/profiles\/([^/]+)$/.exec(cleanPath);
  if (profileMatch) {
    const profileId = decodeURIComponent(profileMatch[1]);
    const index = store.profiles.findIndex((p) => p.id === profileId);
    if (index < 0) return notFound("Profile");
    if (upperMethod === "GET") {
      return { status: 200, data: structuredClone(store.profiles[index]) };
    }
    if (upperMethod === "PUT") {
      const updated = structuredClone(body as SoilProfile);
      const issues = [...validateLayers(updated.layers ?? [], { mustStartAtZero: true }), ...validateGwt(updated.gwt)];
      if (issues.length > 0) {
        return validationError("Invalid soil profile", { issues });
      }
      updated.id = profileId;
      store.profiles[index] = updated;
      return { status: 200, data: structuredClone(updated) };
    }
    if (upperMethod === "DELETE") {
      store.profiles.splice(index, 1);
      if (store.active_profile_id === profileId) store.active_profile_id = store.profiles[0]?.id ?? null;
      const res: DeletionResponse = { id: profileId, deleted: true };
      return { status: 200, data: res };
    }
  }

  return NOT_HANDLED;
}

const handle: MockHandler = (method, path, body) => {
  const result = handleSoil(method, path, body);
  if (result === NOT_HANDLED) return NOT_HANDLED;
  const shellPath = path.split("?")[0].slice(PREFIX.length);
  if (
    result.status < 400
    && ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())
    && /^\/profiles(\/|$)/.test(shellPath)
  ) {
    // Same edit tracking as the shell-level /profiles routes (read-only POSTs never dirty the project).
    notifyMockMutation(shellPath);
  }
  return result;
};

export const mock = { prefix: PREFIX, handle };
