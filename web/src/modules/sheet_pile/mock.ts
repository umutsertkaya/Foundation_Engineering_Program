import { NOT_HANDLED, type MockHandler } from "../../shared/api/mock/dispatcher";
import { isMockSessionOpen } from "../../shared/api/mock/core";
import { getMockStore, notFound } from "../../shared/api/mock/legacy";

const PREFIX = "/m/sheet_pile";

// Design is not available yet; everything else falls through to the dispatcher/legacy mock.
const handle: MockHandler = (method, path) => {
  const match = /^\/m\/sheet_pile\/structures\/([^/]+)\/design$/.exec(path.split("?")[0]);
  if (method.toUpperCase() !== "POST" || !match) return NOT_HANDLED;
  if (!isMockSessionOpen()) {
    return {
      status: 409,
      data: { code: "no_project_open", message: "No project is open.", details: {}, missing_factors: [] },
    };
  }
  const id = decodeURIComponent(match[1]);
  const exists = getMockStore().structures.some((s) => s.id === id && s.kind === "sheet_pile");
  if (!exists) return notFound("Structure");
  return {
    status: 501,
    data: {
      code: "not_implemented",
      message: "Sheet pile design is not implemented yet (Mock).",
      details: {},
      missing_factors: [],
    },
  };
};

export const mock = { prefix: PREFIX, handle };
