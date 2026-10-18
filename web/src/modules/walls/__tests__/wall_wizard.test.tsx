import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import trCatalog from "../../../../../geotek/i18n/tr.json";
import { setMockMode } from "../../../shared/api/client";
import { resetMockState } from "../../../shared/api/mock";
import "../../../app/i18n";
import { theme } from "../../../app/theme";
import { list_wall_types } from "../api";
import { mockRequest } from "../../../shared/api/mock";
import { mock } from "../mock";
import { NOT_HANDLED } from "../../../shared/api/mock/dispatcher";
import { WallWizardPage } from "../pages/WallWizardPage";

describe("WallWizardPage soil step (mock)", () => {
  beforeEach(() => {
    setMockMode(true);
    resetMockState();
  });
  afterEach(() => {
    setMockMode(null);
  });

  it("shows the fill editor, structure profile tab and the layered cross-section", async () => {
    render(
      <MantineProvider theme={theme}>
        <MemoryRouter initialEntries={["/m/walls/s/wall-mock-1"]}>
          <Routes>
            <Route path="/m/walls/s/:sid/*" element={<WallWizardPage />} />
          </Routes>
        </MemoryRouter>
      </MantineProvider>,
    );
    const soilStep = await screen.findByRole("button", { name: new RegExp(trCatalog["web.wizard.step.soil"]) });
    fireEvent.click(soilStep);
    expect(await screen.findByDisplayValue("F2")).toBeInTheDocument();
    expect(screen.getByText(trCatalog["web.wizard.tab.profile"])).toBeInTheDocument();
    expect(document.querySelectorAll('[data-layer-id="F1"]').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('[data-layer-id="L4"]').length).toBeGreaterThan(0);
  });
});

describe("walls module mock", () => {
  beforeEach(() => setMockMode(true));
  afterEach(() => setMockMode(null));

  it("serves GET /m/walls/wall-types itself and leaves other routes to the legacy fallback", async () => {
    expect(mock.handle("GET", "/m/walls/wall-types", undefined)).toMatchObject({ status: 200 });
    expect(mock.handle("POST", "/m/walls/structures/s1/size", undefined)).toBe(NOT_HANDLED);
    expect((await mockRequest("GET", "/m/walls/wall-types")).status).toBe(200);
    expect((await list_wall_types()).map(({ id }) => id)).toEqual(["cantilever", "gravity"]);
  });
});
