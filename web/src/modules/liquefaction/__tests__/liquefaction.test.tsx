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
import { isMockSessionOpen, resetCoreMock } from "../../../shared/api/mock/core";
import "../../../app/i18n";
import { theme } from "../../../app/theme";
import * as core from "../../../shared/api/core";
import { getMockStore } from "../../../shared/api/mock/store";
import type { JobState, LiquefactionResultDTO } from "../../../shared/api/types";
import * as api from "../api";
import { AnalysisPage } from "../pages/AnalysisPage";
import Root from "../Root";

const tr = trModule as Record<string, string>;

function Loc() {
  return <div data-testid="loc">{useLocation().pathname}</div>;
}

function renderPage(entry = "/m/liquefaction") {
  return render(
    <MantineProvider theme={theme}>
      <MemoryRouter initialEntries={[entry]}>
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
  fireEvent.click(await screen.findByText(label));
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
    await screen.findByText(tr["liquefaction.section.method"]);
    expect(screen.getByLabelText(tr["liquefaction.field.amax_g"])).toHaveValue("0.25");
    expect(screen.getByLabelText(tr["liquefaction.field.mw"])).toHaveValue("7.2");
    expect(screen.getAllByText(/^Proje ekranından/)).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: tr["liquefaction.site_change"] })).toHaveLength(2);
    for (const key of ["target_fs", "c_fc", "ic_cutoff", "default_fc", "gwt_seismic"]) {
      expect(screen.getByLabelText(tr[`liquefaction.field.${key}`], { exact: false })).toHaveValue("");
    }
    expect(screen.queryAllByRole("radio", { checked: true })).toHaveLength(0);
  });

  it("keeps Run disabled while coefficients are empty or out of range", async () => {
    renderPage();
    await screen.findByText(tr["liquefaction.section.method"]);
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
    expect(await screen.findByText(tr["liquefaction.results.min_fs"], {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getAllByText("0.75").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: tr["liquefaction.results.back"] }));
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/m/liquefaction"));
  });

  it("results without a job id show the no-job state", async () => {
    renderPage("/m/liquefaction/results");
    expect(await screen.findByText(tr["liquefaction.results.no_job"])).toBeInTheDocument();
  });

  it("results for an unknown job say the result is unavailable", async () => {
    renderPage("/m/liquefaction/results?job=expired-1");
    expect(await screen.findByText(tr["liquefaction.results.unavailable"])).toBeInTheDocument();
  });

  it("a cancelled job shows no result", async () => {
    const res = await mockRequest("POST", "/m/liquefaction/run", {
      profile_id: null, method: "bi2014", amax_g: 0.3, mw: 7, target_fs: 1.2, c_fc: 0.5, ic_cutoff: 2.6,
    });
    const id = (res.data as { job_id: string }).job_id;
    await mockRequest("DELETE", `/jobs/${id}`);
    renderPage(`/m/liquefaction/results?job=${id}`);
    expect(await screen.findByText(tr["liquefaction.results.cancelled"])).toBeInTheDocument();
    expect(screen.queryByText(tr["liquefaction.results.min_fs"])).toBeNull();
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

  it("a deleted profile (404 not_found) shows the profile_missing message, retry reloads profiles", async () => {
    vi.spyOn(api, "run_liquefaction").mockRejectedValue(
      new client.ApiError(404, { code: "not_found", message: "gone", details: {}, missing_factors: [] }),
    );
    const listSpy = vi.spyOn(core, "list_project_profiles");
    renderPage();
    await fillValid();
    await waitFor(() => expect(runButton()).toBeEnabled());
    const callsBefore = listSpy.mock.calls.length;
    fireEvent.click(runButton());
    expect(await screen.findByText(tr["liquefaction.error.profile_missing"])).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: trCatalog["web.common.retry"] }));
    await waitFor(() => expect(listSpy.mock.calls.length).toBeGreaterThan(callsBefore));
    await waitFor(() => expect(screen.queryByText(tr["liquefaction.error.profile_missing"])).not.toBeInTheDocument());
  });

  it("marks each missing required field under the field and counts them in the action bar", async () => {
    renderPage();
    await screen.findByText(tr["liquefaction.section.method"]);
    // Method, target FS, C_FC and Ic are empty; a_max and Mw come from the project.
    expect(screen.getAllByText(tr["liquefaction.required"])).toHaveLength(4);
    expect(screen.getByText(tr["liquefaction.bar.missing"].replace("{count}", "4"))).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: tr["liquefaction.check.go"] })).toHaveLength(4);
    await fillValid();
    await waitFor(() => expect(screen.queryByText(tr["liquefaction.required"])).not.toBeInTheDocument());
    expect(screen.getByText(tr["liquefaction.bar.hint_ready"])).toBeInTheDocument();
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
    expect(await screen.findByText(tr["liquefaction.section.method"])).toBeInTheDocument();
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

  async function startJob(): Promise<string> {
    const res = await mockRequest("POST", "/m/liquefaction/run", { ...valid, profile_id: null });
    return (res.data as { job_id: string }).job_id;
  }

  const poll = async (id: string) => (await mockRequest("GET", `/jobs/${id}`)).data as JobState;

  it("job runs queued -> running -> done with the liquefaction result and no wall side effects", async () => {
    const id = await startJob();
    const seen: string[] = [];
    let state = await poll(id);
    for (let i = 0; i < 8 && state.status !== "done"; i += 1) {
      seen.push(state.status);
      state = await poll(id);
    }
    expect(seen[0]).toBe("queued");
    expect(seen).toContain("running");
    expect(state.status).toBe("done");
    expect(state.kind).toBe("liquefaction");
    const result = state.result as LiquefactionResultDTO;
    expect(Object.keys(result.per_sounding).length).toBeGreaterThan(0);
    expect(result.errors).toEqual({});
  });

  it("cancelled job reports cancelled without a result", async () => {
    const id = await startJob();
    await mockRequest("DELETE", `/jobs/${id}`);
    const state = await poll(id);
    expect(state.status).toBe("cancelled");
    expect(state.result).toBeNull();
  });

  it("failed job reports the error and no result", async () => {
    const id = await startJob();
    getMockStore().jobs.get(id)!.error = {
      code: "engine_error",
      message: "boom",
      details: {},
      missing_factors: [],
    };
    let state = await poll(id);
    for (let i = 0; i < 8 && state.status !== "failed"; i += 1) state = await poll(id);
    expect(state.status).toBe("failed");
    expect(state.result).toBeNull();
    expect(state.error?.code).toBe("engine_error");
  });

  it("unknown job id is 404", async () => {
    expect((await mockRequest("GET", "/jobs/nope")).status).toBe(404);
  });

  it("409 no_project_open without a session, as the core mock", async () => {
    await mockRequest("POST", "/project/close");
    const res = await mockRequest("POST", "/m/liquefaction/run", valid);
    expect(res.status).toBe(409);
    expect((res.data as { code: string }).code).toBe("no_project_open");
  });

  it("409 no_project_open once the session is closed (isMockSessionOpen)", async () => {
    expect(isMockSessionOpen()).toBe(true);
    await mockRequest("POST", "/project/close");
    expect(isMockSessionOpen()).toBe(false);
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
    for (const catalog of [trModule, enModule] as Array<Record<string, string>>) {
      for (const value of Object.values(catalog)) expect(value).not.toContain("{{");
    }
    expect(Object.keys(trModule)).not.toContain("liquefaction.placeholder");
  });
});
