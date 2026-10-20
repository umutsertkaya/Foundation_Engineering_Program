import type {
  Borehole,
  CPTSounding,
  GroundwaterCondition,
  LayeringProposal,
  ProfileOrigin,
  SoilLayer,
} from "../../shared/api/types";

export interface CPTProcessedDTO {
  depth: (number | null)[];
  qc: (number | null)[];
  fs: (number | null)[];
  qt: (number | null)[];
  Rf: (number | null)[];
  Fr: (number | null)[];
  Bq: (number | null)[] | null;
  Qtn: (number | null)[];
  Ic: (number | null)[];
  zone: (number | null)[];
  fc: (number | null)[];
  sigma_v: (number | null)[];
  sigma_v_eff: (number | null)[];
  warnings: string[];
}

export interface SPTProcessedDTO {
  depth: (number | null)[];
  N_field: (number | null)[];
  N60: (number | null)[];
  N1_60: (number | null)[];
  warnings: string[];
}

export interface InvestigationsDTO {
  boreholes: Borehole[];
  cpts: CPTSounding[];
}

export interface ProfileCreate {
  name: string;
  origin: ProfileOrigin;
  source_ids: string[];
  gwt: GroundwaterCondition;
  layers?: SoilLayer[] | null;
  from_proposal?: LayeringProposal | null;
}

/** Chart coordinate: Fr in percent and dimensionless Qtn. */
export interface SBTNCoordinateDTO {
  Fr: number | null;
  Qtn: number | null;
}

export interface SBTNZoneDTO {
  zone: number;
  name_en: string;
  name_tr: string;
  ic_min: number | null;
  ic_max: number | null;
}

export interface SBTNContourDTO {
  Ic: number;
  points: SBTNCoordinateDTO[];
}

export interface AxisRangeDTO {
  min: number;
  max: number;
}

export interface SBTNReferenceDTO {
  zones: SBTNZoneDTO[];
  ic_bounds: number[];
  zone_1_boundary: SBTNCoordinateDTO[];
  ic_contours: SBTNContourDTO[];
  fr_range: AxisRangeDTO;
  qtn_range: AxisRangeDTO;
}

export interface SBTNPointDTO extends SBTNCoordinateDTO {
  depth: number | null;
  Ic: number | null;
  zone: number | null;
  zone_name_en: string | null;
  zone_name_tr: string | null;
}

export interface CPTSBTNDTO {
  points: SBTNPointDTO[];
  warnings: string[];
}

export interface USCSClassifyRequest {
  fines: number;
  gravel?: number | null;
  LL?: number | null;
  PI?: number | null;
  D10?: number | null;
  D30?: number | null;
  D60?: number | null;
}

export interface USCSSymbolDTO {
  symbol: string;
  group_name_en: string;
  group_name_tr: string;
  description: string;
}

/** Lab result; depth and PL are null for stateless classify() requests. */
export interface USCSItemDTO {
  depth: number | null;
  symbol: string | null;
  complete: boolean;
  notes: string[];
  FC: number | null;
  gravel: number | null;
  LL: number | null;
  PL: number | null;
  PI: number | null;
  D10: number | null;
  D30: number | null;
  D60: number | null;
  Cu: number | null;
  Cc: number | null;
  plastic_class: string | null;
  group_name_en: string | null;
  group_name_tr: string | null;
  description: string | null;
}

export interface BoreholeUSCSDTO {
  items: USCSItemDTO[];
}

export interface PlasticityPointDTO {
  LL: number;
  PI: number | null;
}

export interface USCSReferenceDTO {
  a_line: PlasticityPointDTO[];
  u_line: PlasticityPointDTO[];
  symbols: USCSSymbolDTO[];
}
