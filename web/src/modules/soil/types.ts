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
