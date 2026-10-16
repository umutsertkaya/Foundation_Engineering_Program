import { registerMockHandlers } from "./dispatcher";
import { coreMockHandler } from "./core";

export * from "./legacy";
// Explicit export resolves the name also exposed by legacy.
export { mockRequest, NOT_HANDLED, registerMockHandlers } from "./dispatcher";
export type { MockHandler } from "./dispatcher";
export { resetCoreMock } from "./core";

for (const prefix of ["/modules", "/settings", "/library", "/session", "/project"]) {
  registerMockHandlers(prefix, coreMockHandler);
}
