import { lazy } from "react";
import { IconWaveSine } from "@tabler/icons-react";
import type { WebModuleManifest } from "../../shared/moduleTypes";
const Root = lazy(() => import("./Root"));

export const manifest: WebModuleManifest = {
  id: "liquefaction",
  version: "0.1.0",
  titleKey: "liquefaction.title",
  descriptionKey: "liquefaction.description",
  icon: IconWaveSine,
  order: 20,
  Root,
  nav: [
    { path: "", labelKey: "liquefaction.nav.analysis", end: true },
    { path: "results", labelKey: "liquefaction.nav.results" },
  ],
};
