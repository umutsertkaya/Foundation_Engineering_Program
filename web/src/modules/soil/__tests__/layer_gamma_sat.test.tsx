import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n from "../../../app/i18n";
import { theme } from "../../../app/theme";
import type { SoilLayer } from "../../../shared/api/types";
import { LayerEditor } from "../../../shared/soil/LayerEditor";

const layers: SoilLayer[] = [
  { id: "L1", top: 0, bottom: 2, gamma: 18, gamma_sat: null },
  { id: "L2", top: 2, bottom: 6, gamma: 18, gamma_sat: null },
  { id: "L3", top: 6, bottom: 9, gamma: 18, gamma_sat: 20 },
];

beforeEach(async () => {
  await i18n.changeLanguage("en");
});
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("tr");
});

const editor = (gwtDepth: number | null) => (
  <MantineProvider theme={theme}>
    <LayerEditor layers={layers} onChange={() => undefined} issues={[]} gwtDepth={gwtDepth} />
  </MantineProvider>
);

describe("LayerEditor gamma_sat cell", () => {
  it("warns on an empty gamma_sat only for layers that reach below the water table", () => {
    render(editor(3));
    expect(screen.queryByTestId("layer-gamma-sat-missing-L1")).toBeNull();
    expect(screen.getByTestId("layer-gamma-sat-missing-L2")).toHaveTextContent("γsat missing below the water table");
    expect(screen.queryByTestId("layer-gamma-sat-missing-L3")).toBeNull();
  });

  it("does not warn without a groundwater depth, and does not prefill gamma as a placeholder", () => {
    render(editor(null));
    expect(screen.queryByTestId("layer-gamma-sat-missing-L2")).toBeNull();
    const input = screen.getByLabelText(`${i18n.t("ui.layer.gamma_sat")} L2`);
    expect(input).not.toHaveAttribute("placeholder");
  });
});
