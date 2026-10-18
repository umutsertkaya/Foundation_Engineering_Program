import { registerMockHandlers, type MockHandler } from "./dispatcher";
import { coreMockHandler } from "./core";
import { coreRoutesHandler } from "./coreRoutes";

export * from "./store";
export { mockRequest, NOT_HANDLED, registerMockHandlers } from "./dispatcher";
export type { MockHandler } from "./dispatcher";
export { resetCoreMock, isMockSessionOpen } from "./core";

for (const prefix of ["/modules", "/settings", "/library", "/session", "/project", "/data"]) {
  registerMockHandlers(prefix, coreMockHandler);
}
// Registered after the core handler: it falls through (NOT_HANDLED) to these routes on shared prefixes like /project.
for (const prefix of ["/health", "/i18n", "/project", "/structures", "/jobs", "/codes"]) {
  registerMockHandlers(prefix, coreRoutesHandler);
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
