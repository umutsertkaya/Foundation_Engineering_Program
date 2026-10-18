import { NOT_HANDLED, type MockHandler } from "../../shared/api/mock/dispatcher";

const PREFIX = "/m/walls";

const WALL_TYPES = [
  { id: "cantilever", title_key: "walls.type.cantilever" },
  { id: "gravity", title_key: "walls.type.gravity" },
];

// Structure routes under /m/walls/structures/* are rewritten to the legacy mock by the dispatcher.
const handle: MockHandler = (method, path) => {
  if (method.toUpperCase() === "GET" && path.split("?")[0] === `${PREFIX}/wall-types`) {
    return { status: 200, data: WALL_TYPES.map((type) => ({ ...type })) };
  }
  return NOT_HANDLED;
};

export const mock = { prefix: PREFIX, handle };
