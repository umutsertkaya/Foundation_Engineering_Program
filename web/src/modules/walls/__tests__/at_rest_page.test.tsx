import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setMockMode } from "../../../shared/api/client";
import { resetMockState } from "../../../shared/api/mock";
import { getMockStore } from "../../../shared/api/mock/store";
import "../../../app/i18n";
import { theme } from "../../../app/theme";
import { AtRestPage } from "../pages/AtRestPage";

function renderPage() {
  return render(
    <MantineProvider theme={theme}>
      <MemoryRouter>
        <AtRestPage />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe("AtRestPage (mock)", () => {
  beforeEach(() => {
    setMockMode(true);
    resetMockState();
  });
  afterEach(() => setMockMode(null));

  it("shows the K0-approval message when a layer has no approved K0", async () => {
    for (const layer of getMockStore().profiles[0].layers) layer.design = { ...layer.design, K0: undefined };
    renderPage();
    const run = await screen.findByRole("button", { name: "Hesapla" });
    await waitFor(() => expect(run).not.toBeDisabled());
    fireEvent.click(run);
    expect(await screen.findByText(/K0 onaylanmalı/)).toBeTruthy();
  });

  it("renders the diagram, K0 table and resultants once K0 is approved", async () => {
    const layers = getMockStore().profiles[0].layers;
    for (const layer of layers) layer.design = { ...layer.design, K0: 0.5 };
    renderPage();
    const run = await screen.findByRole("button", { name: "Hesapla" });
    await waitFor(() => expect(run).not.toBeDisabled());
    fireEvent.click(run);
    expect(await screen.findByTestId("at-rest-result")).toBeTruthy();
    expect(screen.getByTestId("at-rest-diagram")).toBeTruthy();
    expect(screen.getAllByTestId("at-rest-layers")[0].querySelectorAll("tbody tr").length).toBeGreaterThan(0);
    expect(Number(screen.getByTestId("at-rest-total-force").textContent)).toBeGreaterThan(0);
  });
});
