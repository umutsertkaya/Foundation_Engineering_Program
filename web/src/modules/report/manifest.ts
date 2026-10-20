import { IconFileText } from "@tabler/icons-react";
import type { WebModuleManifest } from "../../shared/moduleTypes";
import Root from "./Root";

export const manifest: WebModuleManifest = {
  id: "report",
  version: "0.1.0",
  titleKey: "report.title",
  descriptionKey: "report.description",
  icon: IconFileText,
  order: 50,
  Root,
  nav: [{ path: "", labelKey: "report.nav.home", end: true }],
};
