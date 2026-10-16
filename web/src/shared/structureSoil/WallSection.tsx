import type { CantileverGeometry, GravityGeometry, StructureSoilModel, WallType } from "../api/types";
import { StructureSoilSection, type StructureSoilSectionProps } from "./StructureSoilSection";

export interface WallSectionProps {
  wallType: WallType;
  geometry: CantileverGeometry | GravityGeometry;
  height?: number;
  backfillSlope?: number;
  /** When given, the section shows the structure's layers, zones and water tables. */
  soil?: StructureSoilModel | null;
  gwtCase?: StructureSoilSectionProps["gwtCase"];
  maxHeight?: number;
}

/**
 * To-scale wall section. Thin wrapper over `StructureSoilSection` (kept for existing callers);
 * labels are drawn outside the wall with leader lines and the drawing adapts to the width.
 */
export function WallSection(props: WallSectionProps) {
  return <StructureSoilSection {...props} />;
}
