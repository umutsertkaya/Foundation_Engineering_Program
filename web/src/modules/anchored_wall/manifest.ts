import { IconAnchor } from "@tabler/icons-react";
import type { WebModuleManifest } from "../../shared/moduleTypes";
import Root from "./Root";

export const manifest: WebModuleManifest = {
  id: "anchored_wall",
  version: "0.1.0",
  titleKey: "anchored_wall.title",
  descriptionKey: "anchored_wall.description",
  icon: IconAnchor,
  order: 45,
  Root,
  nav: [{ path: "", labelKey: "anchored_wall.nav.home", end: true }],
};
