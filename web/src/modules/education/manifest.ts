import { IconSchool } from "@tabler/icons-react";
import type { WebModuleManifest } from "../../shared/moduleTypes";
import Root from "./Root";

export const manifest: WebModuleManifest = {
  id: "education",
  version: "0.1.0",
  titleKey: "education.title",
  descriptionKey: "education.description",
  icon: IconSchool,
  order: 90,
  Root,
  nav: [{ path: "", labelKey: "education.nav.home", end: true }],
};
