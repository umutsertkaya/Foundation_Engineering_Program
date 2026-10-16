import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError, get_project, setMockMode, update_project_meta } from "../shared/api/client";
import {
  close_project,
  create_library_project,
  delete_library_project,
  duplicate_library_project,
  export_library_project,
  get_session,
  get_settings,
  import_library_project,
  list_library,
  list_modules,
  open_library_project,
  put_settings,
  rename_library_project,
  save_current_project,
} from "../shared/api/core";
import { request } from "../shared/api/http";
import { mockRequest, NOT_HANDLED, registerMockHandlers, resetCoreMock } from "../shared/api/mock";

beforeEach(() => {
  setMockMode(true);
  resetCoreMock();
});

afterEach(() => {
  resetCoreMock();
  setMockMode(null);
});

describe("core shell mock", () => {
  it("returns the four modules in order with contract metadata", async () => {
    const modules = await list_modules();
    expect(modules.map(({ id }) => id)).toEqual(["soil", "liquefaction", "walls", "sheet_pile"]);
    expect(modules.map(({ order }) => order)).toEqual([10, 20, 30, 40]);
    expect(modules.map(({ icon }) => icon)).toEqual(["layers", "waves", "wall", "columns"]);
    for (const module of modules) {
      expect(module).toMatchObject({
        version: "0.1.0", title_key: `${module.id}.title`, description_key: `${module.id}.description`,
      });
    }
  });

  it("starts with three entries and the legacy sample open", async () => {
    const entries = await list_library();
    expect(entries).toHaveLength(3);
    expect(entries.map(({ modified }) => modified)).toEqual(entries.map(({ modified }) => modified).sort().reverse());
    expect(await get_session()).toEqual({ open: true, file: "ornek-proje.gtk", dirty: false });
    const sample = entries.find(({ file }) => file === "ornek-proje.gtk")!;
    expect((await get_project()).meta).toMatchObject({ name: sample.name, number: sample.number, engineer: sample.engineer });
  });

  it("creates, transliterates and opens a project without losing sample data", async () => {
    const project = await create_library_project({ name: "İğdır Şev Çözümü", number: "W2-1", engineer: "Özgür", language: "en" });
    expect(project.file).toBe("igdir-sev-cozumu.gtk");
    expect(await list_library()).toContainEqual(project);
    expect(await get_session()).toEqual({ open: true, file: project.file, dirty: true });
    expect((await get_project()).meta).toMatchObject({ name: project.name, number: "W2-1", engineer: "Özgür", language: "en" });
    expect((await get_project()).counts.profiles).toBeGreaterThan(0);
    const second = await create_library_project({ name: "İğdır Şev Çözümü" });
    expect(second.file).not.toBe(project.file);
    expect(await list_library()).toHaveLength(5);
  });

  it("renames, duplicates and deletes while refusing to delete the open project", async () => {
    const project = await create_library_project({ name: "Deneme", number: "42", engineer: "Ece" });
    const renamed = await rename_library_project(project.file, "Yeni Ad");
    expect(renamed).toMatchObject({ file: project.file, name: "Yeni Ad", number: "42", engineer: "Ece" });
    expect((await get_project()).meta.name).toBe("Yeni Ad");
    const copy = await duplicate_library_project(project.file);
    expect(copy.file).not.toBe(project.file);
    expect(copy).toMatchObject({ number: "42", engineer: "Ece" });
    expect(await list_library()).toContainEqual(copy);
    expect((await get_session()).file).toBe(project.file);
    await expect(delete_library_project(project.file)).rejects.toMatchObject({ status: 409, code: "project_open" });
    expect((await delete_library_project(copy.file)).trash_path).toContain(`.trash/${copy.file}`);
    expect((await list_library()).some(({ file }) => file === copy.file)).toBe(false);
    await expect(open_library_project(copy.file)).rejects.toMatchObject({ status: 404, code: "not_found" });
  });

  it("rejects GET /project after close and restores metadata on reopen", async () => {
    const entries = await list_library();
    const other = entries.find(({ file }) => file !== "ornek-proje.gtk")!;
    expect(await close_project()).toEqual({ open: false, file: null, dirty: false });
    await expect(get_project()).rejects.toBeInstanceOf(ApiError);
    await expect(get_project()).rejects.toMatchObject({ status: 409, code: "no_project_open" });
    await expect(save_current_project()).rejects.toMatchObject({ status: 409, code: "no_project_open" });
    expect(await open_library_project(other.file)).toEqual({ open: true, file: other.file, dirty: false });
    expect((await get_project()).meta).toMatchObject({ name: other.name, number: other.number, engineer: other.engineer });
  });

  it("tracks legacy edits, saves their metadata and reopens the saved entry", async () => {
    await update_project_meta({ name: "Kaydedilen", engineer: "Yeni Mühendis" });
    expect((await get_session()).dirty).toBe(true);
    expect(await save_current_project()).toEqual({ open: true, file: "ornek-proje.gtk", dirty: false });
    await close_project();
    await open_library_project("caglayan-sev.gtk");
    await open_library_project("ornek-proje.gtk");
    expect((await get_project()).meta).toMatchObject({ name: "Kaydedilen", engineer: "Yeni Mühendis" });
    await expect(delete_library_project("ornek-proje.gtk")).rejects.toMatchObject({ code: "project_open" });
    expect((await get_session()).dirty).toBe(false);
  });

  it("round-trips settings, ignores supplied recent and caps deduplicated recent paths", async () => {
    const initial = await get_settings();
    const changed = await put_settings({ ...initial, library_dir: "C:/Projects", language: "en", recent: ["ignored"] });
    expect(changed).toEqual({ library_dir: "C:/Projects", language: "en", recent: initial.recent });
    expect(await get_settings()).toEqual(changed);
    for (let index = 0; index < 12; index += 1) await create_library_project({ name: `Recent ${index}` });
    await open_library_project("recent-10.gtk");
    const recent = (await get_settings()).recent;
    expect(recent).toHaveLength(10);
    expect(new Set(recent).size).toBe(10);
    expect(recent[0]).toBe("C:/Projects/recent-10.gtk");
  });

  it("exports and imports metadata and rejects invalid project paths", async () => {
    const project = await create_library_project({ name: "Aktarım", engineer: "Ece" });
    expect(await export_library_project(project.file, "C:/Export/aktarim.gtk")).toEqual({ path: "C:/Export/aktarim.gtk" });
    const imported = await import_library_project("C:/Export/aktarim.gtk");
    expect(imported).toMatchObject({ name: project.name, engineer: "Ece" });
    expect(imported.file).not.toBe(project.file);
    expect(await list_library()).toContainEqual(imported);
    expect((await get_session()).file).toBe(project.file);
    await expect(import_library_project("C:/Export/file.txt")).rejects.toMatchObject({ status: 422, code: "invalid_project_file" });
    await expect(open_library_project("../outside.gtk")).rejects.toMatchObject({ status: 400, code: "invalid_file_name" });
  });

  it("dispatches the longest prefix first, falls through and propagates handler errors", async () => {
    registerMockHandlers("/w2-test", () => ({ status: 200, data: "broad" }));
    registerMockHandlers("/w2-test/specific", (_method, path) => path.endsWith("/fallback")
      ? NOT_HANDLED : { status: 200, data: "specific" });
    expect(await request("GET", "/w2-test/specific")).toBe("specific");
    expect(await request("GET", "/w2-test/specific/fallback")).toBe("broad");
    registerMockHandlers("/w2-test/throw", () => {
      throw new ApiError(409, { code: "project_open", message: "Test error" });
    });
    await expect(request("GET", "/w2-test/throw")).rejects.toMatchObject({ status: 409, code: "project_open" });
    expect(await mockRequest("GET", "/health")).toMatchObject({ status: 200, data: { status: "ok" } });
  });
});
