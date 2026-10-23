import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../app/i18n";
import { theme } from "../../../app/theme";
import { LayerInventoryPanel } from "../components/LayerInventoryPanel";
import type { LayerInventory } from "../types";

const inventory = vi.hoisted(() => ({ value: null as unknown }));

vi.mock("../api", () => ({ get_layer_inventory: async () => inventory.value }));

const base: LayerInventory = {
  layer_id: "L1",
  point_count: 4,
  inputs: { N60: 4 },
  keys: [
    {
      parameter: "phi_eff",
      methods: [
        { id: "m_uscs", reference: "r", source: "SPT", inputs: ["N60"], ready_points: 0, missing_inputs: ["uscs"] },
        { id: "m_phi", reference: "r", source: "CPT", inputs: ["phi"], ready_points: 0, missing_inputs: ["phi_approved"] },
        { id: "m_ocr", reference: "r", source: "CPT", inputs: ["ocr"], ready_points: 0, missing_inputs: ["ocr_approved"] },
      ],
    },
  ],
  stress_issue: "gamma_sat_missing",
  spt_class: "sand.medium_dense",
};

beforeEach(async () => {
  inventory.value = base;
  await i18n.changeLanguage("en");
});
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("tr");
});

const panel = () => (
  <MantineProvider theme={theme}>
    <LayerInventoryPanel profileId="p" layerId="L1" />
  </MantineProvider>
);

describe("LayerInventoryPanel", () => {
  it("shows the missing gamma_sat warning at the top and names missing inputs in words", async () => {
    render(panel());
    expect(await screen.findByTestId("inventory-gamma-sat-missing")).toHaveTextContent("γsat is not entered");
    fireEvent.click(screen.getByText(/Layer data inventory/));
    const text = (await screen.findByTestId("layer-inventory")).textContent ?? "";
    expect(text).toContain("The layer USCS class is required");
    expect(text).toContain("φ′ must be approved first");
    expect(text).toContain("OCR must be approved first");
    expect(screen.getByTestId("inventory-spt-class")).toHaveTextContent("From SPT: medium dense (Clayton 1993)");
  });

  it("speaks Turkish for the new missing inputs", async () => {
    await i18n.changeLanguage("tr");
    render(panel());
    fireEvent.click(await screen.findByText(/Katman veri envanteri/));
    const text = screen.getByTestId("layer-inventory").textContent ?? "";
    expect(text).toContain("Önce φ′ onaylanmalı");
    expect(text).toContain("Önce OCR onaylanmalı");
    expect(text).toContain("Katman USCS sınıfı gerekli");
  });

  it("shows no warning without a stress issue", async () => {
    inventory.value = { ...base, stress_issue: null, spt_class: null };
    render(panel());
    await screen.findByTestId("layer-inventory");
    expect(screen.queryByTestId("inventory-gamma-sat-missing")).toBeNull();
  });
});
