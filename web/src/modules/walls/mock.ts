import { buildMockWallResult, MOCK_MISSING_FACTORS } from "../../shared/api/mock/data";
import { NOT_HANDLED, type MockHandler } from "../../shared/api/mock/dispatcher";
import { getMockStore, notifyMockMutation } from "../../shared/api/mock/store";
import type {
  ApiErrorDTO,
  JobRef,
  MissingFactorDTO,
  RetainingWallStructure,
  Structure,
} from "../../shared/api/types";

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
  const result = buildMockWallResult(structureId);
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

const handle: MockHandler = (method, path) => {
  const verb = method.toUpperCase();
  const cleanPath = path.split("?")[0];
  if (verb === "GET" && cleanPath === `${PREFIX}/wall-types`) {
    return { status: 200, data: WALL_TYPES.map((type) => ({ ...type })) };
  }

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
