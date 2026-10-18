import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import trCatalog from "../../../../../geotek/i18n/tr.json";
import { setMockMode } from "../../../shared/api/client";
import * as client from "../../../shared/api/client";
import { resetMockState } from "../../../shared/api/mock";
import "../../../app/i18n";
import { theme } from "../../../app/theme";
import { WallListPage } from "../pages/WallListPage";
import { WallTypePicker } from "../pages/WallTypePicker";
import { WallWizardPage } from "../pages/WallWizardPage";
import { manifest } from "../manifest";

function Loc() {
  return <div data-testid="loc">{useLocation().pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <MantineProvider theme={theme}>
      <MemoryRouter initialEntries={[path]}>
        <Loc />
        <Routes>
          <Route path="/m/walls" element={<WallListPage />} />
          <Route path="/m/walls/new" element={<WallTypePicker />} />
          <Route path="/m/walls/s/:sid/*" element={<WallWizardPage />} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe("walls pages (mock)", () => {
  beforeEach(() => {
    setMockMode(true);
    resetMockState();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setMockMode(null);
  });

  it("picker preselects cantilever and Create navigates to the new structure", async () => {
    renderAt("/m/walls/new");
    const radios = await screen.findAllByRole("radio");
    expect(radios.length).toBeGreaterThan(1);
    expect(radios.filter((r) => r.getAttribute("aria-checked") === "true")).toHaveLength(1);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    const create = screen.getByRole("button", { name: "Oluştur" });
    expect(create).toBeEnabled();
    fireEvent.click(create);
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toMatch(/^\/m\/walls\/s\/.+/));
  });

  it("picker shows an error alert when create fails", async () => {
    vi.spyOn(client, "create_structure").mockRejectedValue(new client.ApiError(500, { code: "engine_error", message: "boom" } as never));
    renderAt("/m/walls/new");
    await screen.findAllByRole("radio");
    fireEvent.click(screen.getByRole("button", { name: "Oluştur" }));
    expect(await screen.findByText(trCatalog["error.engine_error"])).toBeInTheDocument();
    expect(screen.getByTestId("loc").textContent).toBe("/m/walls/new");
  });

  it("list shows only retaining_wall structures", async () => {
    vi.spyOn(client, "list_structures").mockResolvedValue([
      { id: "w1", name: "Wall One", kind: "retaining_wall", wall_type: "cantilever", stale: false, has_result: false },
      { id: "p1", name: "Sheet Pile One", kind: "sheet_pile", wall_type: null, stale: false, has_result: false },
    ] as never);
    renderAt("/m/walls");
    expect(await screen.findByText("Wall One")).toBeInTheDocument();
    expect(screen.queryByText("Sheet Pile One")).toBeNull();
  });

  it("wizard back button goes to /m/walls", async () => {
    renderAt("/m/walls/s/wall-mock-1");
    fireEvent.click(await screen.findByRole("button", { name: trCatalog["web.common.back_to_list"] }));
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/m/walls"));
  });

  it("list nav item declares the structure subtree prefix", () => {
    expect(manifest.nav[0].matchPrefixes).toEqual(["s/"]);
  });
});
