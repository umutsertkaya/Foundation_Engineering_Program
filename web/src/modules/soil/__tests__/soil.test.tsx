import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import enCatalog from "../../../../../geotek/i18n/en.json";
import trCatalog from "../../../../../geotek/i18n/tr.json";
import {
  ApiError,
  get_structure,
  list_structures,
  resync_structure_soil,
  set_structure_soil,
  setMockMode,
} from "../../../shared/api/client";
import { get_profile, update_profile } from "../api";
import { resetMockState } from "../../../shared/api/mock";
import type { SoilLayer, StructureSoilModel } from "../../../shared/api/types";
import "../../../app/i18n";
import { ProfilesPage } from "../pages/ProfilesPage";
import { niceTicks, spreadLabels } from "../../../shared/soil/axis";
import {
  insertBelow,
  LAYER_ERROR_CODES,
  layerErrorKey,
  mergeWithNext,
  nextLayerId,
  removeLayer,
  renameLayer,
  setBoundary,
  splitLayer,
  validateGwt,
  validateLayers,
  validateStructureSoil,
  type LayerIssue,
} from "../../../shared/soil/layerOps";
import { layerParamStatus } from "../../../shared/soil/layerStatus";
import { familyStyle, SOIL_FAMILIES, SOIL_FAMILY_LABEL_KEY, soilFamily } from "../../../shared/soil/soilStyle";
import { computeZones, retainedLayers } from "../../../shared/soil/zones";
import { theme } from "../../../app/theme";

function layer(id: string, top: number, bottom: number, extra: Partial<SoilLayer> = {}): SoilLayer {
  return {
    id,
    top,
    bottom,
    description: "",
    uscs: null,
    behaviour: "drained",
    gamma: 18,
    gamma_sat: 19,
    design: { phi_eff: 30, c_eff: 0 },
    ...extra,
  };
}

const THREE = [layer("L1", 0, 2), layer("L2", 2, 5), layer("L3", 5, 10)];

function contiguous(layers: SoilLayer[]): boolean {
  return layers.every((l, i) => i === 0 || Math.abs(layers[i - 1].bottom - l.top) < 1e-9);
}

function codes(issues: LayerIssue[]): string[] {
  return issues.map((i) => i.code);
}

describe("layerOps — structural edits", () => {
  it("splitLayer splits strictly inside and keeps contiguity; rejects boundary depths", () => {
    const out = splitLayer(THREE, 1, 3.5);
    expect(out).toHaveLength(4);
    expect(out[1]).toMatchObject({ id: "L2", top: 2, bottom: 3.5 });
    expect(out[2]).toMatchObject({ id: "L4", top: 3.5, bottom: 5, gamma: 18 });
    expect(contiguous(out)).toBe(true);
    expect(THREE[1].bottom).toBe(5); // input untouched
    expect(splitLayer(THREE, 1, 2)).toBe(THREE);
    expect(splitLayer(THREE, 1, 5)).toBe(THREE);
    expect(splitLayer(THREE, 1, 7)).toBe(THREE);
  });

  it("mergeWithNext keeps the upper layer and takes the lower bottom", () => {
    const out = mergeWithNext(THREE, 0);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: "L1", top: 0, bottom: 5 });
    expect(contiguous(out)).toBe(true);
    expect(mergeWithNext(THREE, 2)).toBe(THREE);
  });

  it("insertBelow halves an inner layer, appends below the last, creates a first layer", () => {
    const inner = insertBelow(THREE, 0);
    expect(inner).toHaveLength(4);
    expect(inner[0]).toMatchObject({ id: "L1", bottom: 1 });
    expect(inner[1]).toMatchObject({ id: "L4", top: 1, bottom: 2, gamma: 18 });
    expect(inner[1].design?.phi_eff).toBeUndefined();
    expect(contiguous(inner)).toBe(true);

    const appended = insertBelow(THREE, 2);
    expect(appended[3]).toMatchObject({ top: 10, bottom: 11 });
    expect(contiguous(appended)).toBe(true);

    const first = insertBelow([], -1, { prefix: "F" });
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ id: "F1", top: 0, bottom: 1 });
    expect(Number.isNaN(first[0].gamma)).toBe(true);
  });

  it("removeLayer lets a neighbour absorb the interval", () => {
    const mid = removeLayer(THREE, 1);
    expect(mid.map((l) => l.id)).toEqual(["L1", "L3"]);
    expect(mid[0].bottom).toBe(5);
    expect(contiguous(mid)).toBe(true);

    const first = removeLayer(THREE, 0);
    expect(first[0]).toMatchObject({ id: "L2", top: 0, bottom: 5 });

    const last = removeLayer(THREE, 2);
    expect(last[1]).toMatchObject({ id: "L2", bottom: 10 });

    const single = [layer("F1", 0, 3)];
    expect(removeLayer(single, 0)).toBe(single);
    expect(removeLayer(single, 0, { allowEmpty: true })).toEqual([]);
  });

  it("setBoundary moves both sides together and refuses crossing", () => {
    const out = setBoundary(THREE, 0, 3);
    expect(out[0].bottom).toBe(3);
    expect(out[1].top).toBe(3);
    expect(contiguous(out)).toBe(true);
    expect(setBoundary(THREE, 0, 0)).toBe(THREE); // would invert layer 0
    expect(setBoundary(THREE, 0, 5)).toBe(THREE); // would eat layer 1
    expect(setBoundary(THREE, 0, 6)).toBe(THREE);
    expect(setBoundary(THREE, 2, 12)[2].bottom).toBe(12); // last layer: bottom only
    expect(setBoundary(THREE, 2, 4)).toBe(THREE);
  });

  it("renameLayer and nextLayerId avoid reserved ids", () => {
    expect(renameLayer(THREE, 0, " A1 ")[0].id).toBe("A1");
    expect(nextLayerId(THREE, "L")).toBe("L4");
    expect(nextLayerId(THREE, "F", ["F1", "F2"])).toBe("F3");
    expect(nextLayerId([], "BF-")).toBe("BF-1");
  });
});

describe("layerOps — validateLayers mirrors the Python validators", () => {
  it("accepts a valid list", () => {
    expect(validateLayers(THREE)).toEqual([]);
  });

  it("flags each error code", () => {
    expect(codes(validateLayers([]))).toEqual(["empty"]);
    expect(validateLayers([], { allowEmpty: true })).toEqual([]);
    expect(codes(validateLayers([layer("L1", 0.5, 2)]))).toContain("first_top");
    expect(validateLayers([layer("L1", 0.5, 2)], { mustStartAtZero: false })).toEqual([]);
    expect(codes(validateLayers([layer("L1", 0, 2), layer("L2", 2.1, 4)]))).toContain("contiguity");
    expect(codes(validateLayers([layer("L1", 0, 2), layer("L2", 2 + 5e-7, 4)]))).not.toContain("contiguity");
    expect(codes(validateLayers([layer("L1", 0, 2), layer("L1", 2, 4)]))).toContain("duplicate_id");
    expect(codes(validateLayers([layer(" ", 0, 2)]))).toContain("empty_id");
    expect(codes(validateLayers([layer("L1", 0, 2), layer("L2", 2, 2)]))).toContain("bottom_le_top");
    expect(codes(validateLayers([layer("L1", -1, 2)], { mustStartAtZero: false }))).toContain("top_negative");
    expect(codes(validateLayers([layer("L1", 0, 2, { gamma: 5 })]))).toContain("gamma_range");
    expect(codes(validateLayers([layer("L1", 0, 2, { gamma: 30 })]))).toContain("gamma_range");
    expect(codes(validateLayers([layer("L1", 0, 2, { gamma: Number.NaN })]))).toContain("gamma_range");
    expect(validateLayers([layer("L1", 0, 2, { gamma: 5.01, gamma_sat: 29.99 })])).toEqual([]);
    expect(codes(validateLayers([layer("L1", 0, 2, { gamma_sat: 31 })]))).toContain("gamma_sat_range");
    expect(validateLayers([layer("L1", 0, 2, { gamma_sat: null })])).toEqual([]);
    expect(codes(validateLayers([layer("L1", 0, 2, { design: { phi_eff: 61 } })]))).toContain("phi_range");
    expect(validateLayers([layer("L1", 0, 2, { design: { phi_eff: 60 } })])).toEqual([]);
    expect(validateLayers([layer("L1", 0, 2, { design: { phi_eff: 0 } })])).toEqual([]);
    expect(codes(validateLayers([layer("L1", 0, 2, { design: { c_eff: -1 } })]))).toContain("c_negative");
    expect(codes(validateLayers([layer("L1", 0, 2, { design: { su: -0.1 } })]))).toContain("su_negative");
    expect(codes(validateLayers([layer("L1", 0, 2, { design: { E: 0 } })]))).toContain("E_positive");
    expect(codes(validateLayers([layer("L1", 0, 2, { design: { delta_base: 61 } })]))).toContain("delta_range");
    expect(codes(validateLayers(THREE, { minBottom: 10 }))).toContain("min_bottom");
    expect(validateLayers(THREE, { minBottom: 9.5 })).toEqual([]);
  });

  it("validateStructureSoil checks fill start, profile depth, fill extent and id clashes", () => {
    const fill = [layer("F1", 0, 2.5), layer("F2", 2.5, 5)];
    expect(validateStructureSoil(fill, THREE, 5)).toEqual({ fill: [], profile: [] });
    expect(codes(validateStructureSoil([], [layer("L1", 0, 5)], 5).profile)).toContain("min_bottom");
    expect(codes(validateStructureSoil([layer("F1", 1, 2)], THREE, 5).fill)).toContain("first_top");
    expect(codes(validateStructureSoil([layer("F1", 0, 12)], THREE, 5).fill)).toContain("fill_below_profile");
    expect(codes(validateStructureSoil([layer("L1", 0, 1)], THREE, 5).fill)).toContain("id_clash");
  });

  it("validateGwt accepts empty design/seismic depths and rejects negative or missing ones", () => {
    expect(validateGwt({ depth_insitu: 3, depth_design: null, depth_seismic: null })).toEqual([]);
    expect(validateGwt({ depth_insitu: 0 })).toEqual([]);
    expect(validateGwt(null)).toEqual([]);
    expect(codes(validateGwt({ depth_insitu: -0.5 }))).toEqual(["gwt_negative"]);
    expect(codes(validateGwt({ depth_insitu: 3, depth_seismic: -1 }))).toEqual(["gwt_negative"]);
    expect(codes(validateGwt({ depth_insitu: Number.NaN }))).toEqual(["gwt_negative"]);
  });

  it("approved selections show as stale (suggested) after a bounds change", () => {
    const approved = layer("L1", 0, 2, {
      selections: {
        phi_eff: {
          parameter: "phi_eff",
          selected: { value: 30, unit: "deg", method_id: "user", source: "user" },
          approved: true,
          approved_at: "2026-10-10T00:00:00Z",
          basis_hash: "x",
        },
      },
    });
    expect(layerParamStatus(approved)).toBe("approved");
    expect(layerParamStatus(approved, { approvalsStale: true })).toBe("suggested");
  });

  it("every error code has a message in both catalogs", () => {
    for (const code of LAYER_ERROR_CODES) {
      const key = layerErrorKey(code);
      expect((trCatalog as Record<string, string>)[key], key).toBeTruthy();
      expect((enCatalog as Record<string, string>)[key], key).toBeTruthy();
    }
  });
});

describe("soilStyle", () => {
  it("maps USCS (dual = first symbol), then SBTn, then behaviour", () => {
    expect(soilFamily({ uscs: "SW" })).toBe("sand");
    expect(soilFamily({ uscs: "SP-SM" })).toBe("sand");
    expect(soilFamily({ uscs: "CL" })).toBe("clay");
    expect(soilFamily({ uscs: "CH" })).toBe("clay_high");
    expect(soilFamily({ uscs: "OH" })).toBe("organic");
    expect(soilFamily({ uscs: "PT" })).toBe("peat");
    expect(soilFamily({ uscs: "GW-GC" })).toBe("gravel");
    expect(soilFamily({ uscs: "gw-gm" })).toBe("gravel");
    expect(soilFamily({ uscs: null, sbtn_zone: 3 })).toBe("clay");
    expect(soilFamily({ uscs: null, sbtn_zone: 6 })).toBe("sand");
    expect(soilFamily({ uscs: null, sbtn_zone: null, behaviour: "undrained" })).toBe("clay");
    expect(soilFamily({ uscs: null })).toBe("fill");
  });

  it("has distinct light and dark palettes and labels in both catalogs", () => {
    for (const f of SOIL_FAMILIES) {
      const light = familyStyle(f, "light");
      const dark = familyStyle(f, "dark");
      expect(light.fill).not.toBe(dark.fill);
      expect(light.pattern).not.toBe(light.fill);
      expect((trCatalog as Record<string, string>)[SOIL_FAMILY_LABEL_KEY[f]]).toBeTruthy();
      expect((enCatalog as Record<string, string>)[SOIL_FAMILY_LABEL_KEY[f]]).toBeTruthy();
    }
    const fills = new Set(SOIL_FAMILIES.map((f) => familyStyle(f, "light").fill));
    expect(fills.size).toBe(SOIL_FAMILIES.length);
  });
});

describe("zones mirror StructureSoilModel.zones()", () => {
  const soil: StructureSoilModel = {
    profile: { id: "p", gwt: { depth_insitu: 3 }, layers: [layer("L1", 0, 1.5), layer("L2", 1.5, 4), layer("L3", 4, 7.5), layer("L4", 7.5, 25)] },
    retained_fill: [layer("F1", 0, 2.5)],
  };

  it("assembles the retained side as fill over the trimmed profile", () => {
    const r = retainedLayers(soil);
    expect(r.map((x) => [x.layer.id, x.layer.top, x.origin])).toEqual([
      ["F1", 0, "fill"],
      ["L2", 2.5, "profile"],
      ["L3", 4, "profile"],
      ["L4", 7.5, "profile"],
    ]);
  });

  it("cuts backfill [0, base], front [front, base], foundation [base, bottom]", () => {
    const z = computeZones(soil, 4.4, 5);
    expect(z.backfill.map((s) => [s.layer_id, s.top, s.bottom])).toEqual([
      ["F1", 0, 2.5],
      ["L2", 2.5, 4],
      ["L3", 4, 5],
    ]);
    expect(z.front.map((s) => [s.layer_id, s.top, s.bottom])).toEqual([["L3", 4.4, 5]]);
    expect(z.foundation.map((s) => [s.layer_id, s.top, s.bottom])).toEqual([
      ["L3", 5, 7.5],
      ["L4", 7.5, 25],
    ]);
    expect(z.warnings).toEqual([]);
    expect(computeZones(soil, 4.4, 25).warnings).toContain("profile_short");
  });
});

describe("axis helpers and status", () => {
  it("niceTicks and spreadLabels", () => {
    expect(niceTicks(0, 25, 6)).toEqual([0, 5, 10, 15, 20, 25]);
    expect(niceTicks(0, 7.5, 8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const ys = spreadLabels([10, 12, 14], 10, 0, 100);
    expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(10);
    expect(ys[2] - ys[1]).toBeGreaterThanOrEqual(10);
    const clamped = spreadLabels([95, 96], 10, 0, 100);
    expect(clamped[1]).toBeLessThanOrEqual(100);
  });

  it("parameter status: approved / suggested / missing", () => {
    expect(layerParamStatus(layer("L1", 0, 1))).toBe("approved");
    expect(layerParamStatus(layer("L1", 0, 1, { behaviour: "undrained" }))).toBe("missing");
    expect(layerParamStatus(layer("L1", 0, 1, { behaviour: "undrained", design: { su: 40 } }))).toBe("approved");
    expect(
      layerParamStatus(
        layer("L1", 0, 1, {
          design: {},
          selections: {
            phi_eff: {
              parameter: "phi_eff",
              suggested: { value: 30, unit: "deg", method_id: "x", source: "SPT" },
              approved: false,
            },
          },
        }),
      ),
    ).toBe("suggested");
  });
});

describe("mock soil endpoints", () => {
  beforeEach(() => {
    setMockMode(true);
    resetMockState();
  });
  afterEach(() => {
    setMockMode(null);
    resetMockState();
  });

  it("profile 1 has the 5 demo layers; D-1 fresh, D-2 stale", async () => {
    const p = await get_profile("prof-mock-1");
    expect(p.layers.map((l) => l.uscs)).toEqual(["GW-GM", "SM", "CL", "SP", "CH"]);
    expect(p.gwt).toEqual({ depth_insitu: 3.0, depth_design: 2.5, depth_seismic: 2.5 });
    const list = await list_structures();
    expect(list.find((s) => s.id === "wall-mock-1")?.stale).toBe(false);
    expect(list.find((s) => s.id === "wall-mock-tbdy")?.stale).toBe(true);
  });

  it("editing the project profile makes D-1 stale; resync clears it", async () => {
    const p = await get_profile("prof-mock-1");
    p.layers[1] = { ...p.layers[1], gamma: 18.5 };
    await update_profile(p.id, p);
    expect((await list_structures()).find((s) => s.id === "wall-mock-1")?.stale).toBe(true);
    const synced = await resync_structure_soil("wall-mock-1");
    expect(synced.soil.profile.layers[1].gamma).toBe(18.5);
    expect(synced.soil.retained_fill?.map((l) => l.id)).toEqual(["F1", "F2"]);
    expect((await list_structures()).find((s) => s.id === "wall-mock-1")?.stale).toBe(false);
  });

  it("PUT structure soil stores valid models and rejects invalid ones with 422", async () => {
    const s = await get_structure("wall-mock-1");
    const soil = structuredClone(s.soil);
    soil.retained_fill = [...(soil.retained_fill ?? []), layer("F3", 5, 6)];
    const saved = await set_structure_soil("wall-mock-1", soil);
    expect(saved.soil.retained_fill).toHaveLength(3);

    const bad = structuredClone(s.soil);
    bad.profile.layers = [layer("L1", 0, 4)]; // does not reach below the base (z = 5)
    await expect(set_structure_soil("wall-mock-1", bad)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("ProfilesPage (mock)", () => {
  beforeEach(() => {
    setMockMode(true);
    resetMockState();
  });
  afterEach(() => {
    setMockMode(null);
  });

  it("renders the master list, the soil column and the layer editor", async () => {
    render(
      <MantineProvider theme={theme}>
        <MemoryRouter>
          <ProfilesPage />
        </MemoryRouter>
      </MantineProvider>,
    );
    expect(await screen.findByTestId("profile-item-prof-mock-1")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Sentetik Profil 1 — CPT Kökenli (Mock)")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /5/ }).length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("L3")).toBeInTheDocument();
    // The profile is named in the header; its raw id is not shown.
    expect(screen.queryByText("prof-mock-1")).toBeNull();
  });

  it("discarding edits before another action returns to the saved profile (edits do not become the baseline)", async () => {
    render(
      <MantineProvider theme={theme}>
        <MemoryRouter>
          <ProfilesPage />
        </MemoryRouter>
      </MantineProvider>,
    );
    const id = await screen.findByDisplayValue("L3");
    fireEvent.change(id, { target: { value: "LX" } });
    fireEvent.blur(id);
    expect(await screen.findByText(trCatalog["web.soil.unsaved"])).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: trCatalog["web.soil.new_profile"] }));
    fireEvent.click(await screen.findByRole("menuitem", { name: trCatalog["web.soil.new.from_cpt"] }));
    const confirm = await screen.findByRole("dialog", { name: trCatalog["web.soil.discard_title"] });
    fireEvent.click(within(confirm).getByRole("button", { name: trCatalog["web.soil.discard"] }));
    expect(await screen.findByTestId("layering-propose")).toBeInTheDocument();

    // The layering dialog opened; the page behind it shows the saved profile again, not dirty.
    expect(await screen.findByDisplayValue("L3")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("LX")).toBeNull();
    expect(screen.queryByText(trCatalog["web.soil.unsaved"])).toBeNull();
  });
});
