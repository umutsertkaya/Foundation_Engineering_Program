import { registerMockHandlers, type MockHandler } from "./dispatcher";
import { coreMockHandler } from "./core";

export * from "./legacy";
// Explicit export resolves the name also exposed by legacy.
export { mockRequest, NOT_HANDLED, registerMockHandlers } from "./dispatcher";
export type { MockHandler } from "./dispatcher";
export { resetCoreMock, isMockSessionOpen } from "./core";

for (const prefix of ["/modules", "/settings", "/library", "/session", "/project", "/data"]) {
  registerMockHandlers(prefix, coreMockHandler);
}

// The one sanctioned shared -> modules link: module mocks are discovered by glob.
// Mock-only: this file is reached solely through http.ts's dynamic import, so production code never loads it.
const moduleMocks = import.meta.glob<{ mock: { prefix: string; handle: MockHandler } }>(
  "../../../modules/*/mock.ts",
  { eager: true },
);
for (const mod of Object.values(moduleMocks)) {
  registerMockHandlers(mod.mock.prefix, mod.mock.handle);
}
