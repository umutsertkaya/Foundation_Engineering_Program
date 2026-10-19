import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverModules } from "../app/moduleRegistry";
import { setMockMode } from "../shared/api/client";
import { run_liquefaction } from "../modules/liquefaction/api";
import { getMockStore } from "../shared/api/mock";
import type { Structure } from "../shared/api/types";
import { list_wall_types } from "../modules/walls/api";
import { list_investigations, list_profiles } from "../modules/soil/api";
import { mockRequest } from "../shared/api/mock";

beforeEach(() => setMockMode(true));
afterEach(() => setMockMode(null));

describe("module API paths in the mock", () => {
  it("serves walls and sheet_pile structure routes at their real module paths", async () => {
    const id = getMockStore().structures[0].id;
    expect((await mockRequest("POST", `/m/walls/structures/${id}/required-factors`)).status).toBe(200);
    expect((await mockRequest("POST", `/m/walls/structures/${id}/size`)).status).toBe(202);
    // The pre-modular structure action paths are gone.
    for (const action of ["size", "check", "required-factors", "design"]) {
      const response = await mockRequest("POST", `/structures/${id}/${action}`);
      expect(response.status, action).toBe(501);
      expect((response.data as { message: string }).message).toContain(`/structures/${id}/${action}`);
    }
    // Unknown module routes keep their own path in the 501.
    expect((await mockRequest("GET", "/m/walls/structures/s1/size")).status).toBe(501);
  });

  it("answers routes without a mock handler with a clear not_implemented 501", async () => {
    for (const [method, path] of [
      ["POST", "/m/soil/profiles/p1/layers/merge"],
      ["POST", "/m/soil/profiles/p1/layers/L1/split"],
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

  it("sheet_pile design: 501 not_implemented for a seeded sheet pile, 404 for an unknown id", async () => {
    const store = getMockStore();
    const base = structuredClone(store.structures[0]) as unknown as Record<string, unknown>;
    store.structures.push({ ...base, id: "sp-1", name: "Perde A", kind: "sheet_pile" } as unknown as Structure);
    const ok = await mockRequest("POST", "/m/sheet_pile/structures/sp-1/design");
    expect(ok.status).toBe(501);
    expect(ok.data).toMatchObject({ code: "not_implemented" });
    expect((await mockRequest("POST", "/m/sheet_pile/structures/nope/design")).status).toBe(404);
  });

  it("serves the client wrappers through the module paths", async () => {
    expect((await list_profiles()).length).toBeGreaterThan(0);
    expect(await list_investigations()).toBeTruthy();
    expect((await list_wall_types()).map(({ id }) => id)).toEqual(["cantilever", "gravity"]);
    expect((await mockRequest("POST", "/m/walls/structures/missing/size")).status).toBeGreaterThanOrEqual(400);
  });
});

describe("core structure routes in the mock", () => {
  it("answers 404 not_found for an unknown structure on GET, PUT and DELETE like the backend", async () => {
    for (const method of ["GET", "PUT", "DELETE"]) {
      const response = await mockRequest(method, "/structures/nope", method === "PUT" ? { id: "nope" } : undefined);
      expect(response.status, method).toBe(404);
      expect(response.data, method).toMatchObject({ code: "not_found" });
    }
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
