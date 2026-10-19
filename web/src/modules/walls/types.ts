import type { components } from "../../shared/api/schema";
import type { SoilLayer, WallSettings as SharedWallSettings } from "../../shared/api/types";

/**
 * The hand-written shared `WallSettings` mirror lacks the analysis options added in P1; the
 * generated contract is the authority, so the wizard types them from `schema.d.ts`.
 */
export type WallSettingsDTO = components["schemas"]["WallSettings"];

export type KvSign = WallSettingsDTO["kv_sign"];
export type SubmergedSeismic = WallSettingsDTO["submerged_seismic"];
export type UpliftMoment = WallSettingsDTO["uplift_moment"];

/** Options edited by the wizard; every other `WallSettings` field is passed through untouched. */
export interface AnalysisOptions {
  kv_sign: KvSign;
  submerged_seismic: SubmergedSeismic;
  uplift_moment: UpliftMoment;
  gwt_bearing_correction: boolean;
  use_passive: boolean;
  passive_reduction: number;
}

/** Shared settings mirror widened with the contract fields the wizard writes. */
export type WallSettingsPayload = SharedWallSettings &
  Partial<Pick<WallSettingsDTO, "kv_sign" | "submerged_seismic" | "uplift_moment" | "gwt_bearing_correction">>;

/** Shared layer mirror widened with the hydraulic conductivity k [m/s] (`SoilLayer.permeability`). */
export type SoilLayerK = SoilLayer & { permeability?: number | null };
