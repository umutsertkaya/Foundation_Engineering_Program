import { IconStack2 } from "@tabler/icons-react";
import type { WebModuleManifest } from "../../shared/moduleTypes";
import Root from "./Root";

export const manifest: WebModuleManifest = {
  id: "soil",
  version: "0.1.0",
  titleKey: "soil.title",
  descriptionKey: "soil.description",
  icon: IconStack2,
  order: 10,
  Root,
  nav: [
    { path: "", labelKey: "soil.nav.site", end: true },
    { path: "profiles", labelKey: "soil.nav.profiles" },
    { path: "parameters", labelKey: "soil.nav.parameters" },
    { path: "classification", labelKey: "soil.nav.classification" },
  ],
};
