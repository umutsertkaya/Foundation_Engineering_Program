import { mockRequest as legacyMockRequest } from "./legacy";

export const NOT_HANDLED = Symbol("NOT_HANDLED");
export type MockHandler = (method: string, path: string, body: unknown) => unknown | typeof NOT_HANDLED;

const handlers: Array<{ prefix: string; handler: MockHandler }> = [];
type MockResponse = Awaited<ReturnType<typeof legacyMockRequest>>;

export function registerMockHandlers(prefix: string, handler: MockHandler): void {
  handlers.push({ prefix, handler });
}

/**
 * Module routes live under /api/m/<id>. The legacy mock still serves them from
 * the pre-modular paths, so module paths are rewritten before the fallback.
 */
export function rewriteModulePath(path: string): string {
  const match = /^\/m\/(soil|liquefaction|walls|sheet_pile)(\/.*)$/.exec(path);
  if (!match) return path;
  const [, moduleId, rest] = match;
  if (moduleId === "soil") return rest;
  if (moduleId === "liquefaction") return path.split("?")[0] === "/m/liquefaction/run" ? "/liquefaction" : path;
  return rest.startsWith("/structures/") ? rest : path;
}

const WALL_TYPES = [
  { id: "cantilever", title_key: "walls.type.cantilever" },
  { id: "gravity", title_key: "walls.type.gravity" },
];

/** Handlers return the same {status, data} envelope as the legacy mock. */
export async function mockRequest(method: string, path: string, body?: unknown): Promise<MockResponse> {
  if (method.toUpperCase() === "GET" && path.split("?")[0] === "/m/walls/wall-types") {
    return { status: 200, data: WALL_TYPES.map((type) => ({ ...type })) } as MockResponse;
  }
  const matches = handlers.filter(({ prefix }) => path.startsWith(prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { handler } of matches) {
    const result = await handler(method, path, body);
    if (result !== NOT_HANDLED) return result as MockResponse;
  }
  const rewritten = rewriteModulePath(path);
  const response = await legacyMockRequest(method, rewritten, body);
  if (response.status === 501 && rewritten !== path) {
    // The legacy mock has no handler for this module route: name the real path, not the rewritten one.
    return {
      status: 501,
      data: {
        code: "not_implemented",
        message: `Mock endpoint not implemented: ${method.toUpperCase()} ${path.split("?")[0]} (Mock)`,
        details: {},
        missing_factors: [],
      },
    };
  }
  return response;
}
