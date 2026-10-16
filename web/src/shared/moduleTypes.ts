import type { ComponentType } from "react";

export interface NavItem {
  /** Relative to /m/<id>; an empty path is the module index. */
  path: string;
  labelKey: string;
  icon?: ComponentType<{ size?: number | string }>;
  end?: boolean;
}

export interface WebModuleManifest {
  id: string;
  version: string;
  titleKey: string;
  descriptionKey: string;
  icon: ComponentType<{ size?: number | string }>;
  order: number;
  /** Contains the module's own relative Routes; React.lazy is supported. */
  Root: ComponentType;
  nav: NavItem[];
}
