import type { ReactElement } from "react";
import { MantineProvider } from "@mantine/core";
import { render } from "@testing-library/react";
import "../../../app/i18n";
import { theme } from "../../../app/theme";
import type {
  CantileverGeometry,
  CheckDTO,
  GravityGeometry,
  SoilLayer,
  StructureSoilModel,
  WallResultDTO,
} from "../../../shared/api/types";

export function renderThemed(ui: ReactElement, colorScheme: "light" | "dark" = "light") {
  return render(
    <MantineProvider theme={theme} forceColorScheme={colorScheme}>
      {ui}
    </MantineProvider>,
  );
}

export const CANTILEVER: CantileverGeometry = {
  stem_height: 4.5,
  stem_top: 0.3,
  stem_bottom: 0.5,
  toe: 0.9,
  heel: 3.2,
  base_thickness: 0.5,
  embedment: 0.6,
};

export const GRAVITY: GravityGeometry = {
  height: 5,
  base_width: 3,
  top_width: 0.8,
  back_offset: 0.2,
  embedment: 0.6,
};

export function layer(id: string, top: number, bottom: number, extra: Partial<SoilLayer> = {}): SoilLayer {
  return {
    id,
    top,
    bottom,
    description: "",
    uscs: "SW",
    behaviour: "drained",
    gamma: 19,
    gamma_sat: 20,
    design: { phi_eff: 33, c_eff: 0 },
    ...extra,
  };
}

export function soilModel(opts: { gwt?: number; fill?: SoilLayer[]; layers?: SoilLayer[] } = {}): StructureSoilModel {
  const depth = opts.gwt ?? 99;
  return {
    profile: {
      id: "p1",
      gwt: { depth_insitu: depth, depth_design: depth, depth_seismic: depth },
      layers: opts.layers ?? [layer("L1", 0, 4), layer("L2", 4, 12, { uscs: "CL", behaviour: "undrained" })],
    },
    retained_fill: opts.fill ?? [],
    gwt_retained: null,
    gwt_front: null,
  };
}

export function check(
  caseId: string,
  name: string,
  value: number | null,
  required: number,
  comparison: ">=" | "<=" = ">=",
  detail = "",
): CheckDTO {
  const num = comparison === ">=" ? required : value;
  const den = comparison === ">=" ? value : required;
  const utilisation = num !== null && den !== null && den !== 0 ? num / den : null;
  return {
    case: caseId,
    name,
    value,
    required,
    passed: utilisation !== null && utilisation <= 1,
    comparison,
    utilisation,
    detail,
  };
}

export function result(overrides: Partial<WallResultDTO> = {}): WallResultDTO {
  return {
    structure_id: "w1",
    geometry: CANTILEVER,
    passed: true,
    governing: "",
    checks: [],
    forces: {},
    pressures: [],
    slip_circles: [],
    assumptions: [],
    factors_used: [],
    warnings: [],
    kh: null,
    kv: null,
    iterations: 0,
    result_hash: "h",
    ...overrides,
  };
}
