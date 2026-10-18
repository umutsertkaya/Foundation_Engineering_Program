import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import trCatalog from "../../../../../geotek/i18n/tr.json";
import { setMockMode } from "../../../shared/api/client";
import * as client from "../../../shared/api/client";
import { resetMockState, resetMockStateEmptyProject } from "../../../shared/api/mock";
import { getMockStore } from "../../../shared/api/mock/legacy";
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

  function fill(label: string, value: string) {
    const input = screen.getByLabelText(label);
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
  }

  it("empty project forces manual soil entry; Create needs gamma and GWT, then stores a manual profile", async () => {
    resetMockStateEmptyProject();
    renderAt("/m/walls/new");
    await screen.findAllByRole("radio");
    expect(screen.getByText("Projede zemin profili yok; duvarın zeminini elle girin.")).toBeInTheDocument();
    const create = screen.getByRole("button", { name: "Oluştur" });
    expect(create).toBeDisabled();
    fill(`${trCatalog["ui.layer.gamma"]} L1`, "18");
    expect(create).toBeDisabled();
    fill(`${trCatalog["ui.layer.phi_eff"]} L1`, "30");
    expect(create).toBeDisabled();
    fill("YASS derinliği (m)", "3");
    await waitFor(() => expect(create).toBeEnabled());
    fireEvent.click(create);
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toMatch(/^\/m\/walls\/s\/.+/));
    const made = getMockStore().structures.at(-1) as { soil: { source_profile_id: string | null; profile: { gwt: { depth_insitu: number }; layers: { gamma: number }[] } } };
    expect(made.soil.source_profile_id).toBeNull();
    expect(made.soil.profile.gwt.depth_insitu).toBe(3);
    expect(made.soil.profile.layers[0].gamma).toBe(18);
  });

  it("project with profiles defaults to copy mode and sends a profile_id", async () => {
    const spy = vi.spyOn(client, "create_structure");
    renderAt("/m/walls/new");
    await screen.findAllByRole("radio");
    expect(screen.getByRole("radio", { name: "Proje profilinden kopyala" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Oluştur" }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const payload = spy.mock.calls[0][0] as { profile_id?: string; soil?: unknown };
    expect(typeof payload.profile_id).toBe("string");
    expect(payload.soil).toBeUndefined();
  });

  it("picker shows an error alert when create fails", async () => {
    vi.spyOn(client, "create_structure").mockRejectedValue(new client.ApiError(500, { code: "engine_error", message: "boom" } as never));
    renderAt("/m/walls/new");
    await screen.findAllByRole("radio");
    fireEvent.click(screen.getByRole("button", { name: "Oluştur" }));
    expect(await screen.findByText(trCatalog["error.engine_error"])).toBeInTheDocument();
    expect(screen.getByTestId("loc").textContent).toBe("/m/walls/new");
  });

  it("get_project failure shows the error with retry instead of preselecting a profile", async () => {
    vi.spyOn(client, "get_project").mockRejectedValueOnce(new client.ApiError(500, { code: "engine_error", message: "boom" } as never));
    renderAt("/m/walls/new");
    expect(await screen.findByText(trCatalog["error.engine_error"])).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: trCatalog["web.common.retry"] }));
    expect((await screen.findAllByRole("radio")).length).toBeGreaterThan(1);
  });

  it("manual soil issues are listed once", async () => {
    resetMockStateEmptyProject();
    renderAt("/m/walls/new");
    await screen.findAllByRole("radio");
    fill(`${trCatalog["ui.layer.gamma"]} L1`, "50");
    expect(await screen.findAllByText(trCatalog["web.soil.error.gamma_range"])).toHaveLength(1);
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
