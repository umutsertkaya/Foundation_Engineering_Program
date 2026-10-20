import { NOT_HANDLED, type MockHandler } from "../../shared/api/mock/dispatcher";

const PREFIX = "/m/report";

const SECTIONS = [
  { id: "project", kind: "project", name: "Project", status: "ready" },
  { id: "wall-1", kind: "retaining_wall", name: "Wall 1", status: "ready" },
  { id: "sheet-1", kind: "sheet_pile", name: "Sheet pile 1", status: "stale" },
  { id: "liquefaction", kind: "liquefaction", name: "Liquefaction", status: "no_result" },
];

const handle: MockHandler = (method, path, body) => {
  const route = `${method.toUpperCase()} ${path.split("?")[0]}`;
  if (route === `GET ${PREFIX}/sections`) {
    return { status: 200, data: SECTIONS };
  }
  if (route === `POST ${PREFIX}/docx`) {
    const wanted = (body as { sections?: string[] | null } | undefined)?.sections ?? [];
    if (wanted.length === 0) {
      return {
        status: 422,
        data: { code: "empty_selection", message: "No section selected.", details: {}, missing_factors: [] },
      };
    }
    const bad = SECTIONS.filter((s) => wanted.includes(s.id) && s.status !== "ready");
    if (bad.length > 0) {
      return {
        status: 409,
        data: {
          code: bad[0].status === "stale" ? "stale_result" : "no_result",
          message: "Section result is not usable.",
          details: { sections: bad.map((s) => s.id) },
          missing_factors: [],
        },
      };
    }
    return { status: 200, data: "mock-docx" };
  }
  if (route === `POST ${PREFIX}/run`) {
    return {
      status: 501,
      data: {
        code: "not_implemented",
        message: "This operation is not implemented.",
        details: {},
        missing_factors: [],
      },
    };
  }
  return NOT_HANDLED;
};

export const mock = { prefix: PREFIX, handle };
