import { IconWall } from "@tabler/icons-react";
import type { WebModuleManifest } from "../../shared/moduleTypes";
import Root from "./Root";

export const manifest: WebModuleManifest = {
  id: "walls",
  version: "0.1.0",
  titleKey: "walls.title",
  descriptionKey: "walls.description",
  icon: IconWall,
  order: 30,
  Root,
  nav: [
    { path: "", labelKey: "walls.nav.list", end: true, matchPrefixes: ["s/"] },
    { path: "new", labelKey: "walls.nav.new" },
  ],
};
