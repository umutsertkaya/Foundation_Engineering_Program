import { buildMockWallResult, MOCK_MISSING_FACTORS } from "../../shared/api/mock/data";
import { NOT_HANDLED, type MockHandler } from "../../shared/api/mock/dispatcher";
import { getMockStore, notifyMockMutation } from "../../shared/api/mock/store";
import type {
  ApiErrorDTO,
  CheckDTO,
  GravityGeometry,
  JobRef,
  MissingFactorDTO,
  RetainingWallStructure,
  Structure,
  WallResultDTO,
} from "../../shared/api/types";
import { layersWithoutPermeability, optionsFromSettings } from "./settings";
import type { AtRestInputDTO, AtRestResultDTO } from "./types";

const PREFIX = "/m/walls";

const WALL_TYPES = [
  { id: "cantilever", title_key: "walls.type.cantilever" },
  { id: "gravity", title_key: "walls.type.gravity" },
];

function getMissingFactorsForStructure(s: Structure): MissingFactorDTO[] {
  if ((s.kind ?? "retaining_wall") === "retaining_wall") {
    const wall = s as RetainingWallStructure;
    const level = wall.analysis_level ?? "basic";
    const code = wall.settings?.design_code ?? "asd";
    if (level === "advanced" && code === "tbdy2018") {
      const overrides = wall.settings?.factor_overrides ?? {};
      return MOCK_MISSING_FACTORS.filter((mf) => !(mf.path in overrides));
    }
  }
  return [];
}

const KV_PREFIX: Record<"up" | "down", string> = { up: "kv yukarı: ", down: "kv aşağı: " };

/** Real-engine style case ids: `static` / `seismic` for ASD, `<state>:<combination>` otherwise. */
function caseIds(wall: RetainingWallStructure): { static: string; seismic: string } {
  const advanced = (wall.analysis_level ?? "basic") === "advanced";
  const code = wall.settings?.design_code ?? "asd";
  if (advanced && code === "tbdy2018") return { static: "static:TBDY-static", seismic: "seismic:TBDY-seismic" };
  if (advanced && code === "ec7") return { static: "static:DA2", seismic: "seismic:DA2" };
  return { static: "static", seismic: "seismic" };
}

/**
 * Shapes the shared synthetic result like the real service output for this structure: wall-type
 * geometry, code-specific case ids and factor paths, the kv-sign prefix of the envelope, the
 * submerged-permeability warning and a failing check for very large surcharges. Mock data only.
 */
export function shapeMockWallResult(
  base: WallResultDTO,
  wall: RetainingWallStructure,
  kind: "wall_size" | "wall_check",
): WallResultDTO {
  const ids = caseIds(wall);
  const options = optionsFromSettings(wall.settings);
  const seismic = wall.inputs?.sds !== null && wall.inputs?.sds !== undefined;
  const failing = (wall.inputs?.surcharge ?? 0) > 50;
  const envelope = seismic && options.kv_sign === "envelope";

  let geometry = base.geometry;
  if (wall.wall_type === "gravity") {
    const proposed: GravityGeometry = {
      height: wall.height,
      base_width: 3.1,
      top_width: 0.8,
      back_offset: 0.2,
      embedment: wall.embedment ?? 0.6,
    };
    geometry = kind === "wall_check" && wall.geometry && "base_width" in wall.geometry ? wall.geometry : proposed;
  } else if (kind === "wall_check" && wall.geometry && "stem_bottom" in wall.geometry) {
    geometry = wall.geometry;
  }

  const checks: CheckDTO[] = base.checks
    .filter((c) => seismic || c.case === "static")
    .map((c, i) => {
      let next: CheckDTO = { ...c, case: c.case === "static" ? ids.static : ids.seismic };
      if (seismic && c.case === "seismic") {
        // like the service: every seismic check carries the kv sign it was evaluated with; only the envelope
        // (several candidates) also prefixes the detail text
        const sign = envelope ? (i % 2 === 0 ? "down" : "up") : options.kv_sign === "up" ? "up" : "down";
        next = { ...next, kv_sign: sign, detail: envelope ? `${KV_PREFIX[sign]}${next.detail}` : next.detail };
      }
      if (failing && c.case === "seismic" && c.name === "sliding") {
        next = { ...next, value: 0.95, passed: false, utilisation: 1.16 };
      }
      return next;
    });

  const failed = checks.filter((c) => !c.passed).map((c) => `${c.case}:${c.name}`);
  const sdsCase = ids.seismic;
  const warnings: string[] = [...base.warnings];
  if (envelope) {
    warnings.push("Düşey deprem katsayısı ±kv zarfı uygulandı (TBDY 16.12.2.3); yöneten işaret kontrol bazında detayda belirtilmiştir.");
  }
  if (seismic && options.submerged_seismic === "by_permeability") {
    for (const id of layersWithoutPermeability(wall.soil)) {
      warnings.push(`Katman ${id}: permeabilite k girilmedi; su altı deprem hesabında envelope zarfı kullanıldı.`);
    }
  }
  const factors = ids.static === "static"
    ? [
        { path: "safety.overturning.static", value: 2.0, source: "ASD (Mock)", status: "verified" as const },
        { path: "safety.sliding.static", value: 1.5, source: "ASD (Mock)", status: "verified" as const },
        { path: "safety.bearing_capacity.static", value: 3.0, source: "ASD (Mock)", status: "verified" as const },
        { path: "eccentricity.soil.seismic", value: 0.25, source: "ASD (Mock)", status: "unverified" as const },
      ]
    : [
        { path: `${sdsCase.split(":")[1]}.resistance.bearing`, value: 1.4, source: "TBDY 2018 Tablo 16.2 (Mock)", status: "verified" as const },
        { path: `${sdsCase.split(":")[1]}.resistance.sliding`, value: 1.1, source: "TBDY 2018 Tablo 16.2 (Mock)", status: "verified" as const },
        { path: `${sdsCase.split(":")[1]}.load.G_fav`, value: 0.9, source: "TBDY 2018 Denk. 4.12 (Mock)", status: "verified" as const },
      ];

  // like the service: failing checks; after a passing size run the check that last set the width; none after a passing check
  const governingIds = failed.length > 0 ? failed : kind === "wall_size" ? [`${ids.seismic}:bearing`] : [];
  return {
    ...base,
    geometry,
    checks,
    governing: governingIds.join(", "),
    governing_check_ids: governingIds,
    minimum_width_governs: false,
    passed: failed.length === 0,
    warnings,
    factors_used: factors,
    kh: seismic ? base.kh : null,
    kv: seismic ? (options.kv_sign === "down" && base.kv !== null ? -Math.abs(base.kv) : base.kv) : null,
  };
}

function startWallJob(structureId: string, kind: "wall_size" | "wall_check"): { status: number; data: JobRef | ApiErrorDTO } {
  const store = getMockStore();
  const structure = store.structures.find((item) => item.id === structureId);
  if (!structure) {
    return {
      status: 404,
      data: {
        code: "not_found",
        message: `Structure '${structureId}' not found (Mock).`,
        details: { id: structureId },
        missing_factors: [],
      },
    };
  }

  const missing = getMissingFactorsForStructure(structure);
  if (missing.length > 0) {
    return {
      status: 422,
      data: {
        code: "missing_factors",
        message: "Selected design code has missing factors (Sentetik / Mock).",
        details: { structure_id: structureId, design_code: "tbdy2018" },
        missing_factors: missing,
      },
    };
  }

  store.jobSeq += 1;
  const job_id = `job-mock-${store.jobSeq}`;
  const result = shapeMockWallResult(
    buildMockWallResult(structureId),
    structure as RetainingWallStructure,
    kind,
  );
  store.jobs.set(job_id, {
    job_id,
    kind,
    structure_id: structureId,
    startedAt: Date.now(),
    polls: 0,
    cancelled: false,
    result,
  });

  return { status: 202, data: { job_id } };
}

type Reply = { status: number; data: unknown };

function notFoundStructure(): Reply {
  return {
    status: 404,
    data: { code: "not_found", message: "Structure not found (Mock).", details: {}, missing_factors: [] },
  };
}

const GAMMA_W = 9.81;

/** Mock of the at-rest service (same formulas, piecewise-linear nodes at layer boundaries and the water table). */
function mockAtRest(inp: AtRestInputDTO): Reply {
  const profile = getMockStore().profiles.find((p) => p.id === inp.profile_id);
  if (!profile) return notFoundStructure();
  const H = inp.height;
  const q = inp.surcharge ?? 0;
  const gwt = (profile.gwt as unknown as Record<string, number>)[`depth_${inp.gwt_case ?? "design"}`] ?? 1e9;
  const layers = profile.layers.filter((l) => l.top < H);
  const missing = layers.find((l) => l.design?.K0 == null);
  if (missing) {
    const err: ApiErrorDTO = {
      code: "engine_error",
      message: `Layer ${missing.top}-${missing.bottom} m: design K0 not set (Mock)`,
      details: { message_code: "layer_k0_missing", params: { top: missing.top, bottom: Math.min(missing.bottom, H) } },
      missing_factors: [],
    };
    return { status: 422, data: err };
  }
  const nodes: { z: number; k0: number; eff: number; u: number }[] = [];
  const sv = (z: number) => {
    let acc = 0;
    for (const l of profile.layers) {
      const a = l.top, b = Math.min(l.bottom, z);
      if (b <= a) continue;
      const dry = Math.max(0, Math.min(b, gwt) - a);
      const wet = b - a - dry;
      acc += dry * l.gamma + (wet > 0 ? wet * (l.gamma_sat as number) : 0); // no gamma_sat default
    }
    return acc;
  };
  for (const l of layers) {
    const top = l.top, bottom = Math.min(l.bottom, H);
    const cuts = [top, ...(gwt > top && gwt < bottom ? [gwt] : []), bottom];
    for (const z of cuts) {
      const u = GAMMA_W * Math.max(0, z - gwt);
      const eff = ((l.design?.K0 as number)) * (sv(z) - u + q);
      nodes.push({ z, k0: (l.design?.K0 as number), eff, u });
    }
  }
  const area = (f: (n: (typeof nodes)[number]) => number) => {
    let force = 0, moment = 0;
    for (let i = 0; i < nodes.length - 1; i += 1) {
      const a = nodes[i], b = nodes[i + 1];
      const dz = b.z - a.z;
      if (dz <= 0) continue;
      const pa = f(a), pb = f(b);
      force += ((pa + pb) * dz) / 2;
      moment += (dz / 6) * (pa * (2 * a.z + b.z) + pb * (a.z + 2 * b.z));
    }
    return { force, height: force > 0 ? H - moment / force : 0 };
  };
  const total = area((n) => n.eff + n.u);
  const water = area((n) => n.u);
  const components: AtRestResultDTO["components"] = [];
  if (q > 0) {
    const sur = area((n) => n.k0 * q);
    components.push({ name: "surcharge", force: sur.force, height: sur.height });
    const soilOnly = area((n) => n.eff - n.k0 * q);
    components.push({ name: "soil", force: soilOnly.force, height: soilOnly.height });
  } else {
    const soil = area((n) => n.eff);
    components.push({ name: "soil", force: soil.force, height: soil.height });
  }
  if (water.force > 1e-12) components.push({ name: "water", force: water.force, height: water.height });
  const data: AtRestResultDTO = {
    z: nodes.map((n) => n.z),
    sigma_h_eff: nodes.map((n) => n.eff),
    u: nodes.map((n) => n.u),
    sigma_h: nodes.map((n) => n.eff + n.u),
    layers: layers.map((l) => ({ layer_id: l.id, top: l.top, bottom: Math.min(l.bottom, H), K0: (l.design?.K0 as number) })),
    components,
    total_force: total.force,
    total_height: total.height,
    warnings: [],
  };
  return { status: 200, data };
}

const handle: MockHandler = (method, path, body) => {
  const verb = method.toUpperCase();
  const cleanPath = path.split("?")[0];
  if (verb === "GET" && cleanPath === `${PREFIX}/wall-types`) {
    return { status: 200, data: WALL_TYPES.map((type) => ({ ...type })) };
  }

  if (verb === "POST" && cleanPath === `${PREFIX}/at-rest`) return mockAtRest(body as AtRestInputDTO);

  const match = /^\/m\/walls\/structures\/([^/]+)\/(required-factors|size|check)$/.exec(cleanPath);
  if (verb !== "POST" || !match) return NOT_HANDLED;
  const id = decodeURIComponent(match[1]);
  let response: Reply;
  if (match[2] === "required-factors") {
    const structure = getMockStore().structures.find((s) => s.id === id);
    response = structure
      ? { status: 200, data: getMissingFactorsForStructure(structure) }
      : notFoundStructure();
  } else {
    response = startWallJob(id, match[2] === "size" ? "wall_size" : "wall_check");
  }
  // Same edit tracking as the shell-level structure routes (successful POSTs dirty the project).
  if (response.status < 400) notifyMockMutation(`/structures/${id}/${match[2]}`);
  return response;
};

export const mock = { prefix: PREFIX, handle };
