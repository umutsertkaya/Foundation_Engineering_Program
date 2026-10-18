import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import trCatalog from "../../../../../geotek/i18n/tr.json";
import enModule from "../../../../../geotek/modules/liquefaction/i18n/en.json";
import trModule from "../../../../../geotek/modules/liquefaction/i18n/tr.json";
import * as client from "../../../shared/api/client";
import { setMockMode } from "../../../shared/api/client";
import { mockRequest, resetMockState, resetMockStateEmptyProject } from "../../../shared/api/mock";
import { resetCoreMock } from "../../../shared/api/mock/core";
import "../../../app/i18n";
import { theme } from "../../../app/theme";
import * as api from "../api";
import { AnalysisPage } from "../pages/AnalysisPage";
import Root from "../Root";

const tr = trModule as Record<string, string>;

function Loc() {
  return <div data-testid="loc">{useLocation().pathname}</div>;
}

function renderPage() {
  return render(
    <MantineProvider theme={theme}>
      <MemoryRouter initialEntries={["/m/liquefaction"]}>
        <Loc />
        <Routes>
          <Route path="/m/liquefaction/*" element={<Root />} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

const runButton = () => screen.getByRole("button", { name: tr["liquefaction.run"] });

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });
}

async function chooseMethod(label: string) {
  fireEvent.click(await screen.findByRole("textbox", { name: tr["liquefaction.field.method"] }));
  fireEvent.click(await screen.findByRole("option", { name: label }));
}

async function fillValid() {
  await chooseMethod(tr["liquefaction.method.bi2014"]);
  fill(tr["liquefaction.field.target_fs"], "1.2");
  fill(tr["liquefaction.field.c_fc"], "0.5");
  fill(tr["liquefaction.field.ic_cutoff"], "2.6");
}

describe("liquefaction analysis page (mock)", () => {
  beforeEach(() => {
    setMockMode(true);
    resetCoreMock();
    resetMockState();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setMockMode(null);
  });

  it("defaults the profile picker to the active profile", async () => {
    const project = await client.get_project();
    const activeId = project.active_profile_id as string;
    renderPage();
    const select = (await screen.findByRole("textbox", { name: tr["liquefaction.profile.label"] })) as HTMLInputElement;
    expect(select.value).toContain(`(${tr["liquefaction.profile.active"]})`);
    expect(activeId).toBeTruthy();
  });

  it("without profiles shows the info alert and keeps Run disabled", async () => {
    resetMockStateEmptyProject();
    renderPage();
    expect(await screen.findByText(tr["liquefaction.profile.none"])).toBeInTheDocument();
    await fillValid();
    expect(runButton()).toBeDisabled();
  });

  it("prefills a_max and Mw from site data with a note, and nothing else", async () => {
    renderPage();
    await screen.findByRole("textbox", { name: tr["liquefaction.field.method"] });
    expect(screen.getByLabelText(tr["liquefaction.field.amax_g"])).toHaveValue("0.25");
    expect(screen.getByLabelText(tr["liquefaction.field.mw"])).toHaveValue("7.2");
    expect(screen.getAllByText(tr["liquefaction.site_note"])).toHaveLength(2);
    for (const key of ["target_fs", "c_fc", "ic_cutoff", "default_fc", "gwt_seismic"]) {
      expect(screen.getByLabelText(tr[`liquefaction.field.${key}`], { exact: false })).toHaveValue("");
    }
    expect(screen.getByRole("textbox", { name: tr["liquefaction.field.method"] })).toHaveValue("");
  });

  it("keeps Run disabled while coefficients are empty or out of range", async () => {
    renderPage();
    await screen.findByRole("textbox", { name: tr["liquefaction.field.method"] });
    expect(runButton()).toBeDisabled();
    await fillValid();
    await waitFor(() => expect(runButton()).toBeEnabled());
    fill(tr["liquefaction.field.target_fs"], "0.9");
    await waitFor(() => expect(runButton()).toBeDisabled());
    expect(screen.getByText(tr["liquefaction.error.target_fs_min"])).toBeInTheDocument();
  });

  it("a valid run navigates to the results placeholder, which links back", async () => {
    const spy = vi.spyOn(api, "run_liquefaction");
    renderPage();
    await fillValid();
    await waitFor(() => expect(runButton()).toBeEnabled());
    fireEvent.click(runButton());
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/m/liquefaction/results"));
    const sent = spy.mock.calls[0][0];
    expect(sent).toMatchObject({ method: "bi2014", amax_g: 0.25, mw: 7.2, target_fs: 1.2, c_fc: 0.5, ic_cutoff: 2.6, default_fc: null, gwt_seismic: null });
    expect(typeof sent.profile_id).toBe("string");
    expect(screen.getByText(tr["liquefaction.results.pending"])).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: tr["liquefaction.results.back"] }));
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/m/liquefaction"));
  });

  it("shows the soil-module message for 409 no_soil_source", async () => {
    vi.spyOn(api, "run_liquefaction").mockRejectedValue(
      new client.ApiError(409, { code: "no_soil_source", message: "none", details: {}, missing_factors: [] }),
    );
    renderPage();
    await fillValid();
    await waitFor(() => expect(runButton()).toBeEnabled());
    fireEvent.click(runButton());
    expect(await screen.findByText(tr["liquefaction.error.no_soil_source"])).toBeInTheDocument();
    expect(screen.getByTestId("loc").textContent).toBe("/m/liquefaction");
  });

  it("other run errors go to the error alert", async () => {
    vi.spyOn(api, "run_liquefaction").mockRejectedValue(
      new client.ApiError(500, { code: "engine_error", message: "boom", details: {}, missing_factors: [] }),
    );
    renderPage();
    await fillValid();
    await waitFor(() => expect(runButton()).toBeEnabled());
    fireEvent.click(runButton());
    expect(await screen.findByText(trCatalog["error.engine_error"])).toBeInTheDocument();
  });

  it("a load error shows the error alert with retry", async () => {
    vi.spyOn(client, "get_project").mockRejectedValueOnce(
      new client.ApiError(500, { code: "engine_error", message: "boom", details: {}, missing_factors: [] }),
    );
    render(
      <MantineProvider theme={theme}>
        <MemoryRouter>
          <AnalysisPage />
        </MemoryRouter>
      </MantineProvider>,
    );
    expect(await screen.findByText(trCatalog["error.engine_error"])).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: trCatalog["web.common.retry"] }));
    expect(await screen.findByRole("textbox", { name: tr["liquefaction.field.method"] })).toBeInTheDocument();
  });
});

describe("liquefaction mock rules", () => {
  const valid = { method: "bi2014", amax_g: 0.3, mw: 7, target_fs: 1.2, c_fc: 0.5, ic_cutoff: 2.6 };

  beforeEach(() => {
    resetCoreMock();
    resetMockState();
  });

  it("returns 202 with a job ref for a valid request", async () => {
    const res = await mockRequest("POST", "/m/liquefaction/run", { ...valid, profile_id: null });
    expect(res.status).toBe(202);
    expect((res.data as { job_id: string }).job_id).toMatch(/^mock-liq-\d+$/);
  });

  it("409 no_project_open without a session, as the core mock", async () => {
    await mockRequest("POST", "/project/close");
    const res = await mockRequest("POST", "/m/liquefaction/run", valid);
    expect(res.status).toBe(409);
    expect((res.data as { code: string }).code).toBe("no_project_open");
  });

  it("409 no_soil_source for a null profile without an active profile", async () => {
    resetMockStateEmptyProject();
    const res = await mockRequest("POST", "/m/liquefaction/run", { ...valid, profile_id: null });
    expect(res.status).toBe(409);
    expect((res.data as { code: string }).code).toBe("no_soil_source");
  });

  it("404 not_found for an unknown profile", async () => {
    const res = await mockRequest("POST", "/m/liquefaction/run", { ...valid, profile_id: "nope" });
    expect(res.status).toBe(404);
    expect((res.data as { code: string }).code).toBe("not_found");
  });

  it("422 for missing or non-finite required fields", async () => {
    const { c_fc: _omit, ...rest } = valid;
    void _omit;
    for (const body of [rest, { ...valid, mw: Number.NaN }, { ...valid, method: "x" }, { ...valid, ic_cutoff: null }]) {
      const res = await mockRequest("POST", "/m/liquefaction/run", body);
      expect(res.status).toBe(422);
    }
  });
});

describe("liquefaction i18n", () => {
  it("tr and en have the same keys and the placeholder is gone", () => {
    expect(Object.keys(enModule).sort()).toEqual(Object.keys(trModule).sort());
    expect(Object.keys(trModule)).not.toContain("liquefaction.placeholder");
  });
});
