/**
 * Hand-written TypeScript mirror of `docs/contracts/openapi.json` (`components.schemas`).
 * Once `npm run gen:api` generates `src/api/schema.d.ts`, this file can re-export from it.
 */

export type Language = "tr" | "en";
export type WallType = "cantilever" | "gravity";

export interface WallTypeInfo {
  id: WallType;
  title_key: string;
}
export type StructureKind = "retaining_wall" | "sheet_pile";
export type ProfileOrigin = "cpt" | "spt" | "manual" | "mixed";
export type FactorStatus = "verified" | "secondary" | "unverified" | "not_in_source" | "user";
export type DesignKey = "phi_eff" | "c_eff" | "su" | "E" | "gamma" | "gamma_sat" | "delta_base";
export type SelectionMode = "correlation" | "statistic" | "manual";
export type Statistic = "mean" | "median" | "min" | "max" | "mean_minus_k_sd";
export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";
export type JobKind = "wall_size" | "wall_check" | "sheet_pile" | "liquefaction" | "layering";

export interface ActiveProfileUpdate {
  profile_id: string | null;
}

export interface MissingFactorDTO {
  path: string;
  status: FactorStatus;
  source: string;
  hint?: string;
}

export interface ApiErrorDTO {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  missing_factors?: MissingFactorDTO[];
}

export interface AssumptionDTO {
  text: string;
  source: string;
}

export interface BearingResultDTO {
  method: string;
  q_ult: number | null;
  Q_ult: number | null;
  B_eff: number | null;
  L_eff: number | null;
  factors: Record<string, number | null>;
  warnings: string[];
}

export interface SPTRecord {
  depth: number;
  n_field: number;
  refusal?: boolean;
  notes?: string;
}

export interface LabRecord {
  depth: number;
  w?: number | null;
  LL?: number | null;
  PL?: number | null;
  PI?: number | null;
  gravel?: number | null;
  FC?: number | null;
  D10?: number | null;
  D30?: number | null;
  D60?: number | null;
  gamma?: number | null;
  c_eff?: number | null;
  phi_eff?: number | null;
  su?: number | null;
}

export interface BoreholeLayer {
  top: number;
  bottom: number;
  description?: string;
  uscs?: string | null;
  notes?: string;
}

export interface Borehole {
  id: string;
  x?: number | null;
  y?: number | null;
  elevation?: number | null;
  gwt_depth?: number | null;
  energy_ratio?: number;
  borehole_diameter_mm?: number;
  sampler?: "standard" | "no_liner";
  spt?: SPTRecord[];
  lab?: LabRecord[];
  log?: BoreholeLayer[];
}

export interface CPTSounding {
  id: string;
  x?: number | null;
  y?: number | null;
  elevation?: number | null;
  gwt_depth?: number | null;
  area_ratio?: number;
  predrill_depth?: number;
  depth: number[];
  qc: number[];
  fs: number[];
  u2?: number[] | null;
}

export interface CantileverGeometry {
  stem_height: number;
  stem_top: number;
  stem_bottom: number;
  toe: number;
  heel: number;
  base_thickness: number;
  embedment?: number;
}

export interface GravityGeometry {
  height: number;
  base_width: number;
  top_width: number;
  back_offset?: number;
  embedment?: number;
}

export interface CheckDTO {
  case: string;
  name: string;
  value: number | null;
  required: number;
  passed: boolean;
  comparison: ">=" | "<=";
  utilisation: number | null;
  detail: string;
}

export interface DeletionResponse {
  id: string;
  deleted: true;
}

export interface ParameterStats {
  n: number;
  min: number;
  mean: number;
  max: number;
}

export interface DerivedParameter {
  value: number;
  unit: string;
  method_id: string;
  reference?: string;
  source: "SPT" | "CPT" | "lab" | "user" | "combined";
  inputs_used?: Record<string, number>;
  validity_ok?: boolean;
  warnings?: string[];
  reliability?: "A" | "B" | "C" | null;
  stats?: ParameterStats | null;
  user_override?: boolean;
}

export interface DesignCodeSummary {
  id: string;
  name: string;
  approach: "global_fs" | "partial_factors" | "lrfd";
  approaches: string[];
}

export interface DesignParameters {
  phi_eff?: number | null;
  c_eff?: number;
  su?: number | null;
  E?: number | null;
  delta_base?: number | null;
}

export interface FactorOverride {
  value: number;
  note?: string;
}

export interface FactorRowDTO {
  path: string;
  value: number | null;
  status: FactorStatus;
  source: string;
}

export interface ForceDTO {
  name: string;
  fx: number | null;
  fy: number | null;
  x: number | null;
  y: number | null;
  kind: string;
}

export interface GroundwaterCondition {
  depth_insitu: number;
  depth_design?: number | null;
  depth_seismic?: number | null;
}

export interface HealthResponse {
  status: "ok";
  version: string;
}

export interface JobRef {
  job_id: string;
}

export interface LayerMerge {
  layer_ids: [string, string] | string[];
}

export interface LayerSplit {
  depth: number;
}

export interface LayeringSettings {
  method: "cpt_ic" | "spt_log" | "spt_uscs_n";
  smoothing_window?: number;
  min_thickness?: number;
  merge_ic_tol?: number;
  n_change_ratio?: number;
}

export interface ProposedLayer {
  top: number;
  bottom: number;
  description: string;
  uscs: string | null;
  sbtn_zone: number | null;
  ic_mean: number | null;
  n60_mean: number | null;
  gamma_suggested: number | null;
  behaviour: "drained" | "undrained";
}

export interface LayeringProposal {
  source_id: string;
  settings: LayeringSettings;
  layers: ProposedLayer[];
  warnings: string[];
}

export interface LiquefactionSettingsDTO {
  profile_id?: string | null;
  method: "youd2001" | "bi2014";
  amax_g: number;
  mw: number;
  target_fs: number;
  gwt_seismic?: number | null;
  default_fc?: number | null;
  c_fc: number;
  ic_cutoff: number;
}

export interface SoundingLiquefactionDTO {
  depth: (number | null)[];
  CSR: (number | null)[];
  CRR: (number | null)[];
  FS: (number | null)[];
  status: (
    | "liquefiable"
    | "marginal"
    | "safe"
    | "above_gwt"
    | "clay_like"
    | "non_liquefiable_dense"
    | "excluded_by_user"
    | "beyond_method_depth"
    | "invalid"
  )[];
  warnings: string[];
}

export interface LiquefactionResultDTO {
  per_sounding: Record<string, SoundingLiquefactionDTO>;
  errors: Record<string, string>;
}

export interface ParameterApproval {
  keys: DesignKey[];
}

export interface ParameterSelection {
  parameter: DesignKey;
  candidates?: DerivedParameter[];
  suggested?: DerivedParameter | null;
  mode?: SelectionMode | null;
  method_id?: string | null;
  statistic?: Statistic | null;
  k_sd?: number | null;
  manual_value?: number | null;
  selected?: DerivedParameter | null;
  approved?: boolean;
  approved_at?: string | null;
  basis_hash?: string | null;
}

export interface PressureDiagramDTO {
  side: "retained" | "front";
  case: string;
  z: (number | null)[];
  sigma_h_eff: (number | null)[];
  u: (number | null)[];
  sigma_h: (number | null)[];
  force: number | null;
  z_resultant: number | null;
}

export interface SoilLayer {
  id: string;
  top: number;
  bottom: number;
  description?: string;
  uscs?: string | null;
  sbtn_zone?: number | null;
  behaviour?: "drained" | "undrained";
  gamma: number;
  gamma_sat?: number | null;
  params?: Record<string, DerivedParameter>;
  design?: DesignParameters;
  selections?: Record<string, ParameterSelection>;
  source_ids?: string[];
  liquefiable?: boolean | null;
  residual_su?: number | null;
}

export interface SoilProfile {
  id: string;
  name?: string;
  source_ids?: string[];
  origin?: ProfileOrigin;
  layering?: LayeringSettings | null;
  gwt: GroundwaterCondition;
  layers: SoilLayer[];
}

export interface ProfileSummary {
  id: string;
  name: string;
  origin: ProfileOrigin;
  source_ids: string[];
  gwt: GroundwaterCondition;
  layer_count: number;
}

export interface ProjectCounts {
  boreholes: number;
  cpts: number;
  profiles: number;
  structures: number;
}

export interface ProjectMeta {
  name: string;
  number?: string;
  engineer?: string;
  date?: string;
  schema_version?: string;
  language?: Language;
  design_code?: string;
  analysis_level?: "basic" | "advanced";
}

export interface ProjectMetaPatch {
  name?: string;
  number?: string;
  engineer?: string;
  date?: string;
  schema_version?: string;
  language?: Language;
  design_code?: string;
  analysis_level?: "basic" | "advanced";
}

export interface ProjectNew {
  name: string;
  language: Language;
}

export interface ProjectOpen {
  path: string;
}

export interface ProjectSave {
  path?: string | null;
}

export interface ProjectSaved {
  path: string;
}

export interface SiteSeismic {
  pga_g?: number | null;
  mw?: number | null;
  sds?: number | null;
  sd1?: number | null;
  site_class?: string | null;
  source?: "user" | "TBDY2018";
}

export interface StructureSummary {
  id: string;
  name: string;
  kind: StructureKind;
  wall_type: WallType | null;
  stale: boolean;
  has_result: boolean;
}

export interface ProjectSummary {
  meta: ProjectMeta;
  site: SiteSeismic;
  counts: ProjectCounts;
  active_profile_id: string | null;
  structures: StructureSummary[];
}

export interface StructureSoilModel {
  source_profile_id?: string | null;
  source_hash?: string | null;
  profile: SoilProfile;
  retained_fill?: SoilLayer[];
  gwt_retained?: GroundwaterCondition | null;
  gwt_front?: GroundwaterCondition | null;
}

export interface WallDesignInputs {
  surcharge?: number;
  surcharge_resists?: boolean;
  sds?: number | null;
  r?: number | null;
  gwt_case?: "insitu" | "design" | "seismic";
  include_global_stability?: boolean;
}

export interface WallSettings {
  design_code?: string;
  bearing_method?: "meyerhof" | "hansen" | "vesic";
  use_passive?: boolean;
  passive_reduction?: number;
  include_toe_soil?: boolean;
  concrete_unit_weight?: number;
  foundation_on?: "soil" | "rock";
  factor_overrides?: Record<string, FactorOverride>;
}

export interface RetainingWallCreate {
  kind: "retaining_wall";
  name: string;
  profile_id?: string | null;
  soil?: StructureSoilModel | null;
  wall_type: WallType;
  height: number;
  embedment?: number | null;
  backfill_slope?: number | null;
  geometry?: CantileverGeometry | GravityGeometry | null;
  inputs?: WallDesignInputs | null;
  settings?: WallSettings | null;
  analysis_level?: "basic" | "advanced" | null;
  approach?: string | null;
}

export interface SheetPileCreate {
  kind: "sheet_pile";
  name: string;
  profile_id?: string | null;
  soil?: StructureSoilModel | null;
  retained_height: number;
  support?: "cantilever" | "anchored" | null;
  anchor_depth?: number | null;
  surcharge?: number | null;
  sds?: number | null;
  design_code?: string | null;
  approach?: string | null;
  allowable_stress_mpa?: number | null;
  analysis_level?: "basic" | "advanced" | null;
}

export type StructureCreate = RetainingWallCreate | SheetPileCreate;

export interface RetainingWallStructure {
  kind?: "retaining_wall";
  id: string;
  name?: string;
  wall_type: WallType;
  height: number;
  embedment?: number | null;
  backfill_slope?: number;
  geometry?: CantileverGeometry | GravityGeometry | null;
  soil: StructureSoilModel;
  inputs?: WallDesignInputs;
  settings?: WallSettings;
  analysis_level?: "basic" | "advanced";
  approach?: string | null;
  result_hash?: string | null;
}

export interface SheetPileStructure {
  kind?: "sheet_pile";
  id: string;
  name?: string;
  support?: "cantilever" | "anchored";
  retained_height: number;
  anchor_depth?: number | null;
  soil: StructureSoilModel;
  surcharge?: number;
  sds?: number | null;
  design_code?: string;
  approach?: string | null;
  allowable_stress_mpa?: number | null;
  analysis_level?: "basic" | "advanced";
  result_hash?: string | null;
}

export type Structure = RetainingWallStructure | SheetPileStructure;

export interface SelectionUpdate {
  mode: SelectionMode;
  method_id?: string | null;
  statistic?: Statistic | null;
  k_sd?: number | null;
  manual_value?: number | null;
}

export interface SlipCircleDTO {
  case: string;
  xc: number | null;
  yc: number | null;
  radius: number | null;
  fs: number | null;
}

export interface UsedFactorDTO {
  path: string;
  value: number | null;
  source: string;
  status: FactorStatus;
}

export interface WallAnalysisDTO {
  case: string;
  width: number | null;
  forces: ForceDTO[];
  sum_v: number | null;
  sum_h: number | null;
  m_resisting: number | null;
  m_overturning: number | null;
  eccentricity: number | null;
  q_max: number | null;
  q_min: number | null;
  bearing: BearingResultDTO | null;
  checks: Record<string, CheckDTO>;
  warnings: string[];
  factors_used: UsedFactorDTO[];
}

export interface WallResultDTO {
  structure_id: string;
  geometry: CantileverGeometry | GravityGeometry;
  passed: boolean;
  governing: string;
  checks: CheckDTO[];
  forces: Record<string, ForceDTO[]>;
  pressures: PressureDiagramDTO[];
  slip_circles: SlipCircleDTO[];
  assumptions: AssumptionDTO[];
  factors_used: UsedFactorDTO[];
  warnings: string[];
  kh: number | null;
  kv: number | null;
  iterations: number;
  result_hash: string;
}

export interface SheetPileResultDTO {
  structure_id: string;
  support: string;
  H: number | null;
  D0: number | null;
  D: number | null;
  total_length: number | null;
  anchor_depth: number | null;
  anchor_force: number | null;
  toe_force: number | null;
  M_max: number | null;
  z_M_max: number | null;
  z: (number | null)[];
  shear: (number | null)[];
  moment: (number | null)[];
  net: (number | null)[];
  section_modulus_cm3: number | null;
  assumptions: AssumptionDTO[];
  warnings: string[];
}

export interface JobState {
  job_id: string;
  kind: JobKind;
  status: JobStatus;
  progress: number;
  message_key: string | null;
  result: WallResultDTO | SheetPileResultDTO | LiquefactionResultDTO | LayeringProposal | null;
  error: ApiErrorDTO | null;
}

// Module-owned schemas (e.g. CPTProcessedDTO, SPTProcessedDTO, InvestigationsDTO, ProfileCreate) are mirrored in web/src/modules/<id>/types.ts, not here.
export interface components {
  schemas: {
    ActiveProfileUpdate: ActiveProfileUpdate;
    ApiError: ApiErrorDTO;
    AssumptionDTO: AssumptionDTO;
    BearingResultDTO: BearingResultDTO;
    Borehole: Borehole;
    BoreholeLayer: BoreholeLayer;
    CPTSounding: CPTSounding;
    CantileverGeometry: CantileverGeometry;
    CheckDTO: CheckDTO;
    DeletionResponse: DeletionResponse;
    DerivedParameter: DerivedParameter;
    DesignCodeSummary: DesignCodeSummary;
    DesignParameters: DesignParameters;
    FactorOverride: FactorOverride;
    FactorRowDTO: FactorRowDTO;
    ForceDTO: ForceDTO;
    GravityGeometry: GravityGeometry;
    GroundwaterCondition: GroundwaterCondition;
    HealthResponse: HealthResponse;
    JobRef: JobRef;
    JobState: JobState;
    LabRecord: LabRecord;
    LayerMerge: LayerMerge;
    LayerSplit: LayerSplit;
    LayeringProposal: LayeringProposal;
    LayeringSettings: LayeringSettings;
    LiquefactionResultDTO: LiquefactionResultDTO;
    LiquefactionSettingsDTO: LiquefactionSettingsDTO;
    MissingFactorDTO: MissingFactorDTO;
    ParameterApproval: ParameterApproval;
    ParameterSelection: ParameterSelection;
    ParameterStats: ParameterStats;
    PressureDiagramDTO: PressureDiagramDTO;
    ProfileSummary: ProfileSummary;
    ProjectCounts: ProjectCounts;
    ProjectMeta: ProjectMeta;
    ProjectMetaPatch: ProjectMetaPatch;
    ProjectNew: ProjectNew;
    ProjectOpen: ProjectOpen;
    ProjectSave: ProjectSave;
    ProjectSaved: ProjectSaved;
    ProjectSummary: ProjectSummary;
    ProposedLayer: ProposedLayer;
    RetainingWallCreate: RetainingWallCreate;
    RetainingWallStructure: RetainingWallStructure;
    SPTRecord: SPTRecord;
    SelectionUpdate: SelectionUpdate;
    SheetPileCreate: SheetPileCreate;
    SheetPileResultDTO: SheetPileResultDTO;
    SheetPileStructure: SheetPileStructure;
    SiteSeismic: SiteSeismic;
    SlipCircleDTO: SlipCircleDTO;
    SoilLayer: SoilLayer;
    SoilProfile: SoilProfile;
    SoundingLiquefactionDTO: SoundingLiquefactionDTO;
    StructureSoilModel: StructureSoilModel;
    StructureSummary: StructureSummary;
    UsedFactorDTO: UsedFactorDTO;
    WallAnalysisDTO: WallAnalysisDTO;
    WallDesignInputs: WallDesignInputs;
    WallResultDTO: WallResultDTO;
    WallSettings: WallSettings;
  };
}

/** Core shell DTOs; see docs/contracts/CORE_SHELL_API.md. */
export interface LibraryEntry {
  file: string;
  name: string;
  number: string;
  engineer: string;
  modified: string;
  size: number;
  schema_version: string | null;
  error: string | null;
}

export interface AppSettings {
  library_dir: string;
  language: "tr" | "en";
  recent: string[];
}

export interface ModuleInfo {
  id: string;
  version: string;
  title_key: string;
  description_key: string;
  icon: string;
  order: number;
}

export interface SessionInfo {
  open: boolean;
  file: string | null;
  dirty: boolean;
}

export interface LibraryExportRequest {
  dest: string;
  /** Default false: an existing destination file is a 409 file_exists. */
  overwrite?: boolean;
}

export interface NewProjectRequest {
  name: string;
  number?: string;
  engineer?: string;
  language?: "tr" | "en";
  design_code?: string;
}
