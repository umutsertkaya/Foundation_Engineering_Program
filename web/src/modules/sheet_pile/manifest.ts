import { IconColumns } from "@tabler/icons-react";
import type { WebModuleManifest } from "../../shared/moduleTypes";
import Root from "./Root";

export const manifest: WebModuleManifest = {
  id: "sheet_pile",
  version: "0.1.0",
  titleKey: "sheet_pile.title",
  descriptionKey: "sheet_pile.description",
  icon: IconColumns,
  order: 40,
  Root,
  nav: [
    { path: "", labelKey: "sheet_pile.nav.list", end: true, matchPrefixes: ["s/", "new"] },
  ],
};
