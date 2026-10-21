import type { ComponentType } from "react";
import {
  BearFactorTrend, ClassFcFromIc, ClassIcChart, ClassUscsPlasticity, LiqCsrCrr, LiqFsProfile, LiqRdDepth,
} from "./dataFigures";
import {
  AnchorTieForce, BearFailureWedge, EpActivePassive, SlopeBishopSlice, SlopeSearchDomain, SpAnchoredMoment,
  SpCantilever, SpNetDiagram, SpPassiveFactor, WallStabilityChecks,
} from "./schematicFigures";

/** Static (non-animated) figures keyed by the ids used in content blocks. */
export const FIGURES: Record<string, ComponentType> = {
  "liq-csr-crr": LiqCsrCrr,
  "liq-rd-depth": LiqRdDepth,
  "liq-fs-profile": LiqFsProfile,
  "class-uscs-plasticity": ClassUscsPlasticity,
  "class-ic-chart": ClassIcChart,
  "class-fc-from-ic": ClassFcFromIc,
  "bear-failure-wedge": BearFailureWedge,
  "bear-factor-trend": BearFactorTrend,
  "ep-active-passive": EpActivePassive,
  "wall-stability-checks": WallStabilityChecks,
  "sp-cantilever": SpCantilever,
  "sp-net-diagram": SpNetDiagram,
  "sp-passive-factor": SpPassiveFactor,
  "slope-bishop-slice": SlopeBishopSlice,
  "slope-search-domain": SlopeSearchDomain,
  "anchor-tie-force": AnchorTieForce,
  "sp-anchored-moment": SpAnchoredMoment,
};
