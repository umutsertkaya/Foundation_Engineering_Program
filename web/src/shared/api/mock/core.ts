import type { AppSettings, LibraryEntry, ModuleInfo, NewProjectRequest, ProjectMeta, SessionInfo } from "../types";
import { MOCK_DEFAULT_META } from "./data";
import { NOT_HANDLED, type MockHandler } from "./dispatcher";
import { getMockProjectMeta, getMockStore, toProfileSummary, resetMockState, resetMockStateEmptyProject, setMockMutationListener, setMockProjectMeta } from "./legacy";

interface LibraryRecord {
  entry: LibraryEntry;
  meta: ProjectMeta;
}

const modules: ModuleInfo[] = [
  { id: "soil", order: 10, icon: "layers" },
  { id: "liquefaction", order: 20, icon: "waves" },
  { id: "walls", order: 30, icon: "wall" },
  { id: "sheet_pile", order: 40, icon: "columns" },
].map((module) => ({
  ...module, version: "0.1.0", title_key: `${module.id}.title`, description_key: `${module.id}.description`,
}));

let library: Map<string, LibraryRecord>;
let settings: AppSettings;
let session: SessionInfo;
let exportsByPath: Map<string, ProjectMeta>;
let lastModified = 0;

function modified(): string {
  lastModified = Math.max(Date.now(), lastModified + 1);
  return new Date(lastModified).toISOString();
}

function makeRecord(file: string, meta: ProjectMeta): LibraryRecord {
  return {
    meta: { ...meta },
    entry: {
      file, name: meta.name, number: meta.number ?? "", engineer: meta.engineer ?? "",
      modified: modified(), size: new TextEncoder().encode(JSON.stringify(meta)).length,
      schema_version: meta.schema_version ?? "1.3", error: null,
    },
  };
}

export function resetCoreMock(): void {
  lastModified = 0;
  library = new Map([
    ["ornek-proje.gtk", makeRecord("ornek-proje.gtk", MOCK_DEFAULT_META)],
    ["caglayan-sev.gtk", makeRecord("caglayan-sev.gtk", {
      ...MOCK_DEFAULT_META, name: "Çağlayan Şev", number: "GTK-002", engineer: "Ayşe Yılmaz",
    })],
    ["kiyi-iksa.gtk", makeRecord("kiyi-iksa.gtk", {
      ...MOCK_DEFAULT_META, name: "Kıyı İksa", number: "GTK-003", engineer: "Can Demir",
    })],
  ]);
  settings = { library_dir: "C:/Users/Mock/Documents/GeoTek Projeleri", language: "tr", recent: [] };
  session = { open: true, file: "ornek-proje.gtk", dirty: false };
  exportsByPath = new Map();
  resetMockState();
}

resetCoreMock();
setMockMutationListener((path) => {
  if (path === "/project/new" || path === "/project/open") {
    // Path-based compatibility routes open a project outside the library; opening is never an edit.
    session = { open: true, file: null, dirty: false };
  } else if (session.open) {
    session.dirty = true;
  }
});

function ok(data: unknown): { status: number; data: unknown } {
  return { status: 200, data: structuredClone(data) };
}

// Match legacy's error envelope; http.request converts it into an ApiError.
function error(status: number, code: string, message: string): { status: number; data: unknown } {
  return { status, data: { code, message: `${message} (Mock)`, details: {}, missing_factors: [] } };
}

function slug(name: string): string {
  const transliteration: Record<string, string> = {
    ı: "i", İ: "i", ş: "s", Ş: "s", ğ: "g", Ğ: "g", ü: "u", Ü: "u", ö: "o", Ö: "o", ç: "c", Ç: "c",
  };
  return name.replace(/[ıİşŞğĞüÜöÖçÇ]/g, (letter) => transliteration[letter])
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "proje";
}

function uniqueFile(stem: string): string {
  let file = `${stem}.gtk`;
  for (let suffix = 2; library.has(file); suffix += 1) file = `${stem}-${suffix}.gtk`;
  return file;
}

function validFile(file: string): boolean {
  return file.length > 4 && file.endsWith(".gtk") && !/[\\/:<>"|?*\u0000-\u001f]/.test(file)
    && file !== ".gtk" && !file.startsWith(".");
}

function libraryPath(file: string): string {
  return `${settings.library_dir.replace(/[\\/]+$/, "")}/${file}`;
}

/** A suffix-less destination gets .gtk appended; any other suffix is rejected, never replaced. */
function exportDestination(dest: string): string | null {
  const name = dest.split(/[\\/]/).pop() ?? "";
  if (!name) return null;
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return `${dest}.gtk`;
  return name.slice(dot).toLowerCase() === ".gtk" ? dest : null;
}

function openRecord(record: LibraryRecord): void {
  session = { open: true, file: record.entry.file, dirty: false };
  setMockProjectMeta(record.meta);
  const path = libraryPath(record.entry.file);
  settings.recent = [path, ...settings.recent.filter((recent) => recent !== path)].slice(0, 10);
}

export const coreMockHandler: MockHandler = (method, path, body) => {
  const verb = method.toUpperCase();
  const cleanPath = path.split("?")[0];
  const payload = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  if (verb === "GET" && cleanPath === "/modules") return ok([...modules].sort((a, b) => a.order - b.order));
  if (verb === "GET" && cleanPath === "/settings") return ok(settings);
  if (verb === "PUT" && cleanPath === "/settings") {
    settings = { ...settings, library_dir: payload.library_dir as string, language: payload.language as "tr" | "en" };
    return ok(settings);
  }
  if (verb === "GET" && cleanPath === "/session") return ok(session);
  if (verb === "GET" && cleanPath === "/data/profiles") return ok(getMockStore().profiles.map(toProfileSummary));
  if (verb === "GET" && cleanPath === "/project") {
    return session.open ? NOT_HANDLED : error(409, "no_project_open", "No project is open.");
  }
  if (verb === "POST" && cleanPath === "/project/close") {
    session = { open: false, file: null, dirty: false };
    return ok(session);
  }
  if (verb === "POST" && cleanPath === "/project/save") {
    if (!session.open) return error(409, "no_project_open", "No project is open.");
    if (session.file) library.set(session.file, makeRecord(session.file, getMockProjectMeta()));
    session.dirty = false;
    return ok(session);
  }
  if (verb === "GET" && cleanPath === "/library") {
    return ok([...library.values()].map(({ entry }) => entry).sort((a, b) => b.modified.localeCompare(a.modified)));
  }
  if (verb === "POST" && cleanPath === "/library") {
    const project = payload as unknown as NewProjectRequest;
    if (typeof project.name !== "string" || !project.name.trim()) {
      return error(400, "invalid_file_name", "Project name is required.");
    }
    const file = uniqueFile(slug(project.name));
    const record = makeRecord(file, {
      ...MOCK_DEFAULT_META, ...project, number: project.number ?? "", engineer: project.engineer ?? "",
      language: project.language ?? settings.language,
    });
    library.set(file, record);
    resetMockStateEmptyProject();
    openRecord(record);
    return ok(record.entry);
  }
  if (verb === "POST" && cleanPath === "/library/import") {
    const source = typeof payload.path === "string" ? payload.path : "";
    const name = source.split(/[\\/]/).pop() ?? "";
    if (!validFile(name)) return error(422, "invalid_project_file", "Expected a .gtk project file.");
    // A mock has no filesystem: known exports retain metadata, other .gtk paths are synthetic imports.
    const meta = exportsByPath.get(source) ?? {
      ...MOCK_DEFAULT_META, name: name.slice(0, -4).replace(/-/g, " "), number: "", engineer: "",
    };
    const file = uniqueFile(name.slice(0, -4));
    const record = makeRecord(file, meta);
    library.set(file, record);
    return ok(record.entry);
  }

  const match = /^\/library\/([^/]+)(?:\/(open|duplicate|rename|export))?$/.exec(cleanPath);
  if (!match || !((verb === "POST" && match[2]) || (verb === "DELETE" && !match[2]))) return NOT_HANDLED;
  let file: string;
  try {
    file = decodeURIComponent(match[1]);
  } catch {
    return error(400, "invalid_file_name", "Invalid file name.");
  }
  if (!validFile(file)) return error(400, "invalid_file_name", "Only bare .gtk file names are allowed.");
  const record = library.get(file);
  if (!record) return error(404, "not_found", "Project was not found.");

  if (verb === "DELETE") {
    if (session.open && session.file === file) return error(409, "project_open", "The project is open.");
    library.delete(file);
    return ok({ trash_path: libraryPath(`.trash/${file}`) });
  }
  if (match[2] === "open") {
    openRecord(record);
    return ok(session);
  }
  if (match[2] === "duplicate") {
    const copyFile = uniqueFile(`${file.slice(0, -4)}-copy`);
    const copy = makeRecord(copyFile, { ...record.meta, name: `${record.meta.name} (Kopya)` });
    library.set(copyFile, copy);
    return ok(copy.entry);
  }
  if (match[2] === "rename") {
    if (typeof payload.name !== "string" || !payload.name.trim()) {
      return error(400, "invalid_file_name", "Project name is required.");
    }
    // Like the backend: the file follows the new name and an open session follows the file.
    const stem = slug(payload.name);
    library.delete(file);
    const renamedFile = stem === file.slice(0, -4) ? file : uniqueFile(stem);
    const renamed = makeRecord(renamedFile, { ...record.meta, name: payload.name });
    library.set(renamedFile, renamed);
    if (session.open && session.file === file) {
      session = { ...session, file: renamedFile };
      setMockProjectMeta({ name: payload.name });
    }
    if (renamedFile !== file) {
      const oldPath = libraryPath(file);
      const newPath = libraryPath(renamedFile);
      settings.recent = settings.recent.map((recent) => (recent === oldPath ? newPath : recent));
    }
    return ok(renamed.entry);
  }
  if (match[2] === "export") {
    if (typeof payload.dest !== "string" || !payload.dest) {
      return error(400, "invalid_file_name", "Export destination is required.");
    }
    const dest = exportDestination(payload.dest);
    if (!dest) return error(400, "invalid_path", "Export destination must be a .gtk file path.");
    if (exportsByPath.has(dest) && payload.overwrite !== true) {
      return error(409, "file_exists", "The destination file already exists.");
    }
    exportsByPath.set(dest, { ...record.meta });
    return ok({ path: dest });
  }
  return NOT_HANDLED;
};
