import { createContext, useContext } from "react";
import type { WebModuleManifest } from "../shared/moduleTypes";

export function sortManifests(manifests: readonly WebModuleManifest[]): WebModuleManifest[] {
  return [...manifests].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function discoverModules(): WebModuleManifest[] {
  const files = import.meta.glob<{ manifest: WebModuleManifest }>(
    "../modules/*/manifest.ts",
    { eager: true },
  );
  const manifests: WebModuleManifest[] = [];
  for (const [path, exports] of Object.entries(files)) {
    const folder = path.split("/").at(-2);
    if (!exports.manifest || exports.manifest.id !== folder) {
      console.error(`Skipping module ${path}: manifest.id must match folder ${folder}`);
      continue;
    }
    manifests.push(exports.manifest);
  }
  return sortManifests(manifests);
}

export const ModuleRegistryContext = createContext<WebModuleManifest[]>(discoverModules());

export function useModules(): WebModuleManifest[] {
  return useContext(ModuleRegistryContext);
}
