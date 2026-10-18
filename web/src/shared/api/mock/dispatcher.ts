export const NOT_HANDLED = Symbol("NOT_HANDLED");
export type MockResponse = { status: number; data: unknown };
export type MockHandler = (method: string, path: string, body: unknown) => unknown | typeof NOT_HANDLED;

const handlers: Array<{ prefix: string; handler: MockHandler }> = [];

export function registerMockHandlers(prefix: string, handler: MockHandler): void {
  handlers.push({ prefix, handler });
}

/** Handlers return a {status, data} envelope; the longest matching prefix is tried first. */
export async function mockRequest(method: string, path: string, body?: unknown): Promise<MockResponse> {
  const matches = handlers.filter(({ prefix }) => path.startsWith(prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { handler } of matches) {
    const result = await handler(method, path, body);
    if (result !== NOT_HANDLED) return result as MockResponse;
  }
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
