import { describe, expect, it } from "vitest";

// Every source file under src/, keyed like "../modules/soil/api.ts".
const sources = import.meta.glob("../**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const files = Object.entries(sources).map(([key, text]) => ({
  path: key.replace(/^\.\.\//, ""), // relative to src/, posix
  text,
}));

/** Static, re-export and dynamic import specifiers; string-literal import.meta.glob patterns are not imports. */
export function importSpecifiers(text: string): string[] {
  const noComments = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const found: string[] = [];
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[\w*${}\s,]+?\s+from\s+)?["']([^"']+)["']/g, // import x from "y" / import "y"
    /\bexport\s+(?:type\s+)?(?:[\w*${}\s,]+?\s+)from\s+["']([^"']+)["']/g, // export ... from "y"
    /\bimport\(\s*["']([^"']+)["']\s*\)/g, // dynamic import("y")
  ];
  for (const re of patterns) for (const m of noComments.matchAll(re)) found.push(m[1]);
  return found;
}

/** Resolve a relative specifier against the importing file; returns a path relative to src/ or null for packages. */
export function resolveSpecifier(from: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const parts = from.split("/").slice(0, -1);
  for (const seg of spec.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

const moduleOf = (path: string) => /^modules\/([^/]+)\//.exec(path)?.[1] ?? null;
const imports = (file: { path: string; text: string }) =>
  importSpecifiers(file.text)
    .map((spec) => resolveSpecifier(file.path, spec))
    .filter((p): p is string => p !== null);

const isTest = (path: string) =>
  /(^|\/)__tests__\//.test(path) || /\.test\.tsx?$/.test(path) || path.startsWith("test/");

// Production files allowed to import shared/api/mock/**, besides files inside the mock directory itself
// and modules/<id>/mock.ts. http.ts is the mock-mode switch (lazy `await import("./mock/index")`).
const MOCK_IMPORTER_ALLOWLIST = new Set(["shared/api/http.ts"]);

function mockViolation(path: string, targets: string[]): boolean {
  if (path.startsWith("shared/api/mock/") || /^modules\/[^/]+\/mock\.ts$/.test(path)) return false;
  if (isTest(path) || MOCK_IMPORTER_ALLOWLIST.has(path)) return false;
  return targets.some((t) => t === "shared/api/mock" || t.startsWith("shared/api/mock/"));
}

function crossModule(path: string, targets: string[]): string[] {
  const own = moduleOf(path);
  return own ? targets.filter((t) => moduleOf(t) !== null && moduleOf(t) !== own) : [];
}

function reachesModules(path: string, targets: string[]): string[] {
  if (!(path.startsWith("shared/") || path.startsWith("app/"))) return [];
  return targets.filter((t) => t === "modules" || t.startsWith("modules/"));
}

describe("import parsing", () => {
  it("handles static, type, re-export and dynamic imports and ignores glob strings", () => {
    const text = [
      'import a from "../x";',
      'import type { B } from "../y";',
      'import "./side";',
      'import { c,\n  d } from "./z";',
      'export * from "./r1";',
      'export { e } from "./r2";',
      'const m = await import("./lazy");',
      'const g = import.meta.glob("../modules/*/mock.ts");',
      '// import nope from "./commented";',
    ].join("\n");
    expect(importSpecifiers(text).sort()).toEqual(
      ["../x", "../y", "./side", "./z", "./r1", "./r2", "./lazy"].sort(),
    );
    expect(resolveSpecifier("modules/a/p/q.ts", "../../b/x")).toBe("modules/b/x");
  });

  it("rules bite on synthetic violations", () => {
    expect(crossModule("modules/a/x.ts", ["modules/b/y"])).toEqual(["modules/b/y"]);
    expect(crossModule("modules/a/x.ts", ["modules/a/y", "shared/z"])).toEqual([]);
    expect(reachesModules("shared/x.ts", ["modules/a/y"])).toHaveLength(1);
    expect(reachesModules("app/x.ts", ["modules/a/y"])).toHaveLength(1);
    expect(mockViolation("pages/P.tsx", ["shared/api/mock/data"])).toBe(true);
    expect(mockViolation("modules/a/pages/P.tsx", ["shared/api/mock/index"])).toBe(true);
    expect(mockViolation("modules/a/mock.ts", ["shared/api/mock/store"])).toBe(false);
    expect(mockViolation("shared/api/http.ts", ["shared/api/mock/index"])).toBe(false);
    expect(mockViolation("modules/a/__tests__/t.test.tsx", ["shared/api/mock/index"])).toBe(false);
  });
});

describe("architecture boundaries", () => {
  it("scans a plausible number of files", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((f) => f.path === "shared/api/http.ts")).toBe(true);
  });

  it("modules do not import other modules", () => {
    const bad = files.flatMap((f) => crossModule(f.path, imports(f)).map((t) => `${f.path} -> ${t}`));
    expect(bad).toEqual([]);
  });

  it("shared/ and app/ do not import from modules/", () => {
    const bad = files.flatMap((f) => reachesModules(f.path, imports(f)).map((t) => `${f.path} -> ${t}`));
    expect(bad).toEqual([]);
  });

  it("production code does not import shared/api/mock outside the allowlist", () => {
    const bad = files.filter((f) => mockViolation(f.path, imports(f))).map((f) => f.path);
    expect(bad).toEqual([]);
  });

  it("the mock allowlist has no stale entries", () => {
    for (const path of MOCK_IMPORTER_ALLOWLIST) {
      const file = files.find((f) => f.path === path);
      expect(file, path).toBeDefined();
      expect(imports(file!).some((t) => t.startsWith("shared/api/mock")), path).toBe(true);
    }
  });

  it("every module manifest id equals its folder and titleKey is <id>.title", () => {
    const manifests = files.filter((f) => /^modules\/[^/]+\/manifest\.ts$/.test(f.path));
    expect(manifests.length).toBeGreaterThan(0);
    for (const f of manifests) {
      const folder = moduleOf(f.path)!;
      expect(/\bid:\s*["']([^"']+)["']/.exec(f.text)?.[1], f.path).toBe(folder);
      expect(/\btitleKey:\s*["']([^"']+)["']/.exec(f.text)?.[1], f.path).toBe(`${folder}.title`);
    }
  });
});
