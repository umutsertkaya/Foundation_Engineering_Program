import type { ComponentType } from "react";
import {
  BearEccentricWidth, BearFactorTables, BearFactorTrend, BearWaterCases, BearZones, ClassFcFromIc, ClassIcChart, ClassUscsPlasticity,
  ClsGradingCurve, LiqCsrCrr, LiqFsProfile, LiqLpiWeight, LiqMechanism, LiqMsfCurve, LiqRdDepth, LiqSptCorrelation,
} from "./bearDraw";
import {
  EpActivePassive, EpCohesiveCrack, EpCoulombWedge, EpKaPhi, EpLayeredWater, EpMohrRankine, EpRankineDiagram, EpSeismicWedge,
  EpStatesMovement, EpWallForces, WallStabilityChecks,
} from "./epDraw";
import {
  AnchorBondFreeLength, AnchoredWallEnvelopes, AnchoredWallHeave, AnchorTieForce, GanTendonLimits, ShearKeyPlanes, SlopeBishopSlice,
  SlopeSearchDomain, SlopeSurchargeWedge, SpAnchoredMoment, SpCantilever, SpNetDiagram, SpPassiveFactor, SpwWallTypes,
} from "./spDraw";

/** Static (non-animated) figures keyed by the ids used in content blocks. */
export const FIGURES: Record<string, ComponentType> = {
  // liquefaction
  "liq-mechanism": LiqMechanism, "liq-csr-crr": LiqCsrCrr, "liq-rd-depth": LiqRdDepth, "liq-fs-profile": LiqFsProfile,
  "liq-spt-correlation": LiqSptCorrelation, "liq-msf-curve": LiqMsfCurve, "liq-lpi-weight": LiqLpiWeight,
  // classification
  "class-uscs-plasticity": ClassUscsPlasticity, "class-ic-chart": ClassIcChart, "class-fc-from-ic": ClassFcFromIc,
  "cls-grading-curve": ClsGradingCurve, "cls-plasticity-chart": ClassUscsPlasticity, "cls-robertson-chart": ClassIcChart,
  // bearing capacity
  "bear-failure-wedge": BearZones, "bear-terzaghi-zones": BearZones, "bear-factor-trend": BearFactorTrend,
  "bear-factor-tables": BearFactorTables, "bear-eccentric-width": BearEccentricWidth, "bear-water-cases": BearWaterCases,
  // earth pressure and walls
  "ep-active-passive": EpActivePassive, "ep-states-movement": EpStatesMovement, "ep-ka-phi": EpKaPhi, "ep-mohr-rankine": EpMohrRankine,
  "ep-rankine-diagram": EpRankineDiagram, "ep-cohesive-crack": EpCohesiveCrack, "ep-layered-water": EpLayeredWater,
  "ep-coulomb-wedge": EpCoulombWedge, "ep-seismic-wedge": EpSeismicWedge, "ep-wall-forces": EpWallForces,
  "wall-stability-checks": WallStabilityChecks,
  // sheet pile and anchored systems
  "sp-cantilever": SpCantilever, "sp-net-diagram": SpNetDiagram, "sp-passive-factor": SpPassiveFactor, "spw-wall-types": SpwWallTypes,
  "spw-moment-diagram": SpNetDiagram, "spw-method-compare": SpCantilever, "sp-anchored-moment": SpAnchoredMoment,
  "anchor-tie-force": AnchorTieForce, "anc-free-support": AnchorTieForce, "anc-free-vs-fixed": SpAnchoredMoment,
  "anchor-bond-free-length": AnchorBondFreeLength, "gan-wedge-geometry": AnchorBondFreeLength, "gan-free-bond-zones": AnchorBondFreeLength,
  "gan-tendon-limits": GanTendonLimits, "anchored-wall-envelopes": AnchoredWallEnvelopes, "awl-sand-envelope": AnchoredWallEnvelopes,
  "awl-clay-envelopes": AnchoredWallEnvelopes, "anchored-wall-heave": AnchoredWallHeave, "awl-basal-heave": AnchoredWallHeave,
  // slope, surcharge, shear key
  "slope-bishop-slice": SlopeBishopSlice, "slp-slip-circle": SlopeBishopSlice, "slp-bishop-slice": SlopeBishopSlice,
  "slope-search-domain": SlopeSearchDomain, "slp-search-results": SlopeSearchDomain, "slope-surcharge-wedge": SlopeSurchargeWedge,
  "sur-beta-wedge": SlopeSurchargeWedge, "sur-surcharge-basis": EpRankineDiagram, "sur-sheet-moment": SpNetDiagram,
  "shear-key-planes": ShearKeyPlanes, "key-geometry": ShearKeyPlanes, "key-tip-plane": ShearKeyPlanes, "key-passive-diagram": EpActivePassive,
};
