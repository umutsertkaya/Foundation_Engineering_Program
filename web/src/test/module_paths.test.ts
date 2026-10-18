import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverModules } from "../app/moduleRegistry";
import { run_liquefaction, setMockMode } from "../shared/api/client";
import { list_wall_types } from "../modules/walls/api";
import { list_investigations, list_profiles } from "../modules/soil/api";
import { rewriteModulePath } from "../shared/api/mock/dispatcher";
import { mockRequest } from "../shared/api/mock";

beforeEach(() => setMockMode(true));
afterEach(() => setMockMode(null));

describe("module API paths in the mock", () => {
  it("rewrites module routes to the legacy paths", () => {
    // Soil is served by its own module mock, so its paths are no longer rewritten.
    expect(rewriteModulePath("/m/soil/profiles/p1")).toBe("/m/soil/profiles/p1");
    expect(rewriteModulePath("/m/soil/investigations")).toBe("/m/soil/investigations");
    expect(rewriteModulePath("/m/liquefaction/run")).toBe("/liquefaction");
    expect(rewriteModulePath("/m/walls/structures/s1/size")).toBe("/structures/s1/size");
    expect(rewriteModulePath("/m/sheet_pile/structures/s1/design")).toBe("/structures/s1/design");
    expect(rewriteModulePath("/structures/s1")).toBe("/structures/s1");
    expect(rewriteModulePath("/m/walls/wall-types")).toBe("/m/walls/wall-types");
    // Only the exact run route is rewritten, never a prefix match.
    expect(rewriteModulePath("/m/liquefaction/runs")).toBe("/m/liquefaction/runs");
    expect(rewriteModulePath("/m/liquefaction/run/extra")).toBe("/m/liquefaction/run/extra");
  });

  it("answers routes without a legacy handler with a clear not_implemented 501", async () => {
    for (const [method, path] of [
      ["GET", "/m/soil/cpts/c1/processed"],
      ["POST", "/m/soil/layering/cpt/c1"],
      ["GET", "/m/liquefaction/runs"],
    ]) {
      const response = await mockRequest(method, path);
      expect(response.status, path).toBe(501);
      expect(response.data, path).toMatchObject({ code: "not_implemented" });
      expect((response.data as { message: string }).message).toContain(path);
    }
    // /m/liquefaction/run now has a module mock: an empty payload is rejected, not left unimplemented.
    await expect(run_liquefaction({} as never)).rejects.toMatchObject({ status: 422 });
  });

  it("serves the client wrappers through the module paths", async () => {
    expect((await list_profiles()).length).toBeGreaterThan(0);
    expect(await list_investigations()).toBeTruthy();
    expect((await list_wall_types()).map(({ id }) => id)).toEqual(["cantilever", "gravity"]);
    expect((await mockRequest("POST", "/m/walls/structures/missing/size")).status).toBeGreaterThanOrEqual(400);
  });
});

describe("web module manifests", () => {
  it("discovers the four modules with matching ids, order and nav keys", () => {
    const modules = discoverModules();
    expect(modules.map(({ id }) => id)).toEqual(["soil", "liquefaction", "walls", "sheet_pile"]);
    expect(modules.map(({ order }) => order)).toEqual([10, 20, 30, 40]);
    for (const module of modules) {
      expect(module.titleKey).toBe(`${module.id}.title`);
      expect(module.nav.length).toBeGreaterThan(0);
      for (const item of module.nav) expect(item.labelKey.startsWith(`${module.id}.nav.`)).toBe(true);
    }
  });
});
