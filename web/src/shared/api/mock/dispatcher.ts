import { mockRequest as legacyMockRequest } from "./legacy";

export const NOT_HANDLED = Symbol("NOT_HANDLED");
export type MockHandler = (method: string, path: string, body: unknown) => unknown | typeof NOT_HANDLED;

const handlers: Array<{ prefix: string; handler: MockHandler }> = [];
type MockResponse = Awaited<ReturnType<typeof legacyMockRequest>>;

export function registerMockHandlers(prefix: string, handler: MockHandler): void {
  handlers.push({ prefix, handler });
}

/** Handlers return the same {status, data} envelope as the legacy mock. */
export async function mockRequest(method: string, path: string, body?: unknown): Promise<MockResponse> {
  const matches = handlers.filter(({ prefix }) => path.startsWith(prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { handler } of matches) {
    const result = await handler(method, path, body);
    if (result !== NOT_HANDLED) return result as MockResponse;
  }
  return legacyMockRequest(method, path, body);
}
