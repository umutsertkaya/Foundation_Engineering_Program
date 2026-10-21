import type { ComponentType } from "react";
import {
  BearFactorTrend, LiqSptCorrelation, LiqMsfCurve, LiqLpiWeight, ClassFcFromIc, ClassIcChart, ClassUscsPlasticity, LiqCsrCrr, LiqFsProfile, LiqRdDepth,
} from "./dataFigures";
import { BearEccentricWidth, BearFactorTables, BearTerzaghiZones, BearWaterCases } from "./bearingFigures";
import {
  EpCohesiveCrack, EpCoulombWedge, EpKaPhi, EpLayeredWater, EpMohrRankine, EpRankineDiagram, EpSeismicWedge,
  EpStatesMovement, EpWallForces,
} from "./epFigures";
import {
  LiqMechanism, AnchorTieForce, BearFailureWedge, AnchorBondFreeLength, AnchoredWallEnvelopes, AnchoredWallHeave, ShearKeyPlanes, SlopeSurchargeWedge, EpActivePassive, SlopeBishopSlice, SlopeSearchDomain, SpAnchoredMoment,
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
  "shear-key-planes": ShearKeyPlanes,
  "slope-surcharge-wedge": SlopeSurchargeWedge,
  "anchor-bond-free-length": AnchorBondFreeLength,
  "anchored-wall-envelopes": AnchoredWallEnvelopes,
  "anchored-wall-heave": AnchoredWallHeave,
  "ep-states-movement": EpStatesMovement,
  "ep-mohr-rankine": EpMohrRankine,
  "ep-rankine-diagram": EpRankineDiagram,
  "ep-cohesive-crack": EpCohesiveCrack,
  "ep-layered-water": EpLayeredWater,
  "ep-coulomb-wedge": EpCoulombWedge,
  "ep-ka-phi": EpKaPhi,
  "ep-seismic-wedge": EpSeismicWedge,
  "ep-wall-forces": EpWallForces,
  "bear-terzaghi-zones": BearTerzaghiZones,
  "bear-eccentric-width": BearEccentricWidth,
  "bear-water-cases": BearWaterCases,
  "bear-factor-tables": BearFactorTables,
  "liq-mechanism": LiqMechanism,
  "liq-spt-correlation": LiqSptCorrelation,
  "liq-msf-curve": LiqMsfCurve,
  "liq-lpi-weight": LiqLpiWeight,
  "anchor-tie-force": AnchorTieForce,
  "sp-anchored-moment": SpAnchoredMoment,
};
