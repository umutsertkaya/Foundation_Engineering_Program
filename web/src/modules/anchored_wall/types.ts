import type { components } from "../../shared/api/schema";

type Schemas = components["schemas"];

export type StateResponse = Schemas["StateResponse"];
export type AnchoredWallState = Schemas["AnchoredWallState"];
export type AnalysisInputs = Schemas["AnchoredWallAnalysisInputs"];
export type AnalysisResult = Schemas["AnalysisResult"];
export type LevelResult = Schemas["LevelResult"];
export type AnchorDesignInputs = Schemas["AnchorDesignInputs"];
export type AnchorDesignResult = Schemas["AnchorDesignResult"];
export type AnchorDesignCommon = Schemas["AnchorDesignCommon"];
export type AnchorReference = Schemas["AnchorReference"];
export type AnchorCheck = Schemas["AnchorCheck"];
export type Notice = Schemas["Notice"];
export type StructureSoil = Schemas["StructureSoilModel"];
