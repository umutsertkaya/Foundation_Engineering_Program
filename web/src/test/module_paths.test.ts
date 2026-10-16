import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverModules } from "../app/moduleRegistry";
import { list_investigations, list_profiles, list_wall_types, setMockMode } from "../shared/api/client";
import { rewriteModulePath } from "../shared/api/mock/dispatcher";
import { mockRequest } from "../shared/api/mock";

beforeEach(() => setMockMode(true));
afterEach(() => setMockMode(null));

describe("module API paths in the mock", () => {
  it("rewrites module routes to the legacy paths", () => {
    expect(rewriteModulePath("/m/soil/profiles/p1")).toBe("/profiles/p1");
    expect(rewriteModulePath("/m/soil/investigations")).toBe("/investigations");
    expect(rewriteModulePath("/m/liquefaction/run")).toBe("/liquefaction");
    expect(rewriteModulePath("/m/walls/structures/s1/size")).toBe("/structures/s1/size");
    expect(rewriteModulePath("/m/sheet_pile/structures/s1/design")).toBe("/structures/s1/design");
    expect(rewriteModulePath("/structures/s1")).toBe("/structures/s1");
    expect(rewriteModulePath("/m/walls/wall-types")).toBe("/m/walls/wall-types");
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
