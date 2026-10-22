import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import trCatalog from "../../../../../geotek/i18n/tr.json";
import wallsTr from "../../../../../geotek/modules/walls/i18n/tr.json";
import "../../../app/i18n";
import { theme } from "../../../app/theme";
import { setMockMode } from "../../../shared/api/client";
import { onMutation } from "../../../shared/api/http";
import { resetMockState } from "../../../shared/api/mock";
import { getMockStore } from "../../../shared/api/mock/store";
import type { RetainingWallStructure } from "../../../shared/api/types";
import { runPreSaveHooks } from "../../../shared/hooks/usePreSaveHook";
import { WallWizardPage } from "../pages/WallWizardPage";

const tr = { ...trCatalog, ...wallsTr } as Record<string, string>;
const JOB_TIMEOUT = 8000;

function renderWizard() {
  return render(
    <MantineProvider theme={theme}>
      <MemoryRouter initialEntries={["/m/walls/s/wall-mock-1"]}>
        <Routes>
          <Route path="/m/walls/s/:sid/*" element={<WallWizardPage />} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

const step = (name: string) => screen.findByRole("button", { name: new RegExp(name) });
const storedWall = () => getMockStore().structures.find((s) => s.id === "wall-mock-1") as RetainingWallStructure;

async function runCheck() {
  fireEvent.click(await step(tr["web.wizard.step.run"]));
  fireEvent.click(await screen.findByRole("button", { name: tr["ui.wall.check"] }));
  await screen.findAllByTestId("check-card", undefined, { timeout: JOB_TIMEOUT });
  await waitFor(() => expect(screen.getByRole("button", { name: tr["ui.wall.check"] })).toBeEnabled());
}

describe("walls wizard: seismic inputs, design codes, save errors and stored results", () => {
  beforeEach(() => {
    setMockMode(true);
    resetMockState();
    // jsdom lacks scrollIntoView, which the Mantine combobox calls.
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => setMockMode(null));

  it("sends an emptied S_DS and r as null (no seismic case / by wall type) instead of a default", async () => {
    renderWizard();
    fireEvent.click(await step(tr["web.wizard.step.loads"]));
    const sds = await screen.findByLabelText(new RegExp(tr["web.project.sds"]));
    expect(sds).toHaveValue("0.5");
    fireEvent.change(sds, { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/^r/), { target: { value: "" } });
    expect(screen.getByText(tr["walls.loads.sds_hint"])).toBeInTheDocument();
    await runCheck();
    expect(storedWall().inputs).toMatchObject({ sds: null, r: null });
  }, 20000);

  it("shows the backend range for r and S_DS and blocks the run while one is out of range", async () => {
    renderWizard();
    fireEvent.click(await step(tr["web.wizard.step.loads"]));
    fireEvent.change(await screen.findByLabelText(/^r/), { target: { value: "2.5" } });
    expect(await screen.findByText(tr["walls.loads.r_range"])).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(new RegExp(tr["web.project.sds"])), { target: { value: "3" } });
    expect(await screen.findByText(tr["walls.loads.sds_range"])).toBeInTheDocument();
    fireEvent.click(await step(tr["web.wizard.step.run"]));
    expect(await screen.findByTestId("seismic-run-blocked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: tr["ui.wall.check"] })).toBeDisabled();
    expect(screen.getByRole("button", { name: tr["ui.wall.suggest"] })).toBeDisabled();
  });

  it("offers the design codes from the codes API (AASHTO is aashto_lrfd) and stores the chosen id", async () => {
    renderWizard();
    fireEvent.click(await step(tr["web.wizard.step.loads"]));
    fireEvent.click(await screen.findByRole("textbox", { name: tr["ui.code.code"] }));
    fireEvent.click(await screen.findByRole("option", { name: "AASHTO LRFD" }));
    expect(await screen.findByRole("option", { name: "TBDY 2018 Bölüm 16", hidden: true })).toBeInTheDocument();
    await runCheck();
    expect(storedWall().settings?.design_code).toBe("aashto_lrfd");
  }, 20000);

  it("shows a failed save and starts no job; a double click starts only one job", async () => {
    const posts: string[] = [];
    const stop = onMutation((method, path) => {
      if (method === "POST") posts.push(path);
    });
    try {
      const view = renderWizard();
      fireEvent.click(await step(tr["web.wizard.step.run"]));
      const check = await screen.findByRole("button", { name: tr["ui.wall.check"] });
      fireEvent.click(check);
      fireEvent.click(check);
      await screen.findAllByTestId("check-card", undefined, { timeout: JOB_TIMEOUT });
      expect(posts.filter((p) => p.endsWith("/check"))).toHaveLength(1);
      view.unmount();

      renderWizard();
      fireEvent.click(await step(tr["web.wizard.step.run"]));
      const again = await screen.findByRole("button", { name: tr["ui.wall.check"] });
      // The structure disappears behind the page's back: the save (PUT) fails with 404.
      const store = getMockStore();
      store.structures = store.structures.filter((s) => s.id !== "wall-mock-1");
      posts.length = 0;
      fireEvent.click(again);
      expect(await screen.findByText(tr["error.not_found"])).toBeInTheDocument();
      expect(posts).toHaveLength(0);
      await waitFor(() => expect(screen.getByRole("button", { name: tr["ui.wall.check"] })).toBeEnabled());
    } finally {
      stop();
    }
  }, 30000);

  it("saves entered missing factors with the form and re-runs the calculation", async () => {
    const wall = storedWall();
    wall.analysis_level = "advanced";
    wall.settings = { ...wall.settings, design_code: "tbdy2018" };
    renderWizard();
    fireEvent.click(await step(tr["web.wizard.step.run"]));
    fireEvent.click(await screen.findByRole("button", { name: tr["ui.wall.check"] }));
    const save = await screen.findByRole("button", { name: tr["ui.missing.save"] });
    // No factor is pre-filled: saving stays disabled until the user enters every value.
    expect(save).toBeDisabled();
    for (const input of screen.getAllByTestId("missing-factor-input")) {
      expect((input as HTMLInputElement).value).toBe("");
      fireEvent.change(input, { target: { value: "1" } });
    }
    fireEvent.click(save);
    await screen.findAllByTestId("check-card", undefined, { timeout: JOB_TIMEOUT });
    expect(screen.queryByRole("button", { name: tr["ui.missing.save"] })).toBeNull();
    expect(Object.keys(storedWall().settings?.factor_overrides ?? {})).toContain("TBDY-seismic.material.tan_phi");
    expect(storedWall().settings?.design_code).toBe("tbdy2018");
  }, 30000);

  it("top project Save persists a surcharge draft that was never run", async () => {
    renderWizard();
    fireEvent.click(await step(tr["web.wizard.step.loads"]));
    const field = await screen.findByRole("textbox", { name: tr["ui.wall.surcharge"] });
    const before = storedWall().inputs?.surcharge ?? 0;
    fireEvent.change(field, { target: { value: String(before + 7) } });
    await runPreSaveHooks();
    expect(storedWall().inputs?.surcharge).toBe(before + 7);
  });

  it("shows the backend default surcharge (0 kPa) for a stored wall without one", async () => {
    const wall = storedWall();
    const { surcharge: _drop, ...rest } = wall.inputs ?? {};
    wall.inputs = rest as typeof wall.inputs;
    renderWizard();
    fireEvent.click(await step(tr["web.wizard.step.loads"]));
    const field = await screen.findByRole("textbox", { name: tr["ui.wall.surcharge"] });
    expect((field as HTMLInputElement).value).toBe("0");
  });

  it("shows the stored result when the wizard is reopened, marked stale when the summary is stale", async () => {
    const first = renderWizard();
    await runCheck();
    const runHash = storedWall().result_hash;
    expect(storedWall().result).toBeTruthy();
    first.unmount();

    const second = renderWizard();
    fireEvent.click(await step(tr["web.wizard.step.result"]));
    expect(await screen.findByTestId("result-verdict")).toBeInTheDocument();
    expect(screen.queryByTestId("result-stale")).toBeNull();
    second.unmount();

    // The soil source profile changed after the run: the project summary reports the structure stale.
    storedWall().soil.source_hash = "changed-source";
    renderWizard();
    fireEvent.click(await step(tr["web.wizard.step.result"]));
    expect(await screen.findByTestId("result-stale")).toHaveTextContent(tr["walls.result.stale_inputs"]);
    expect(storedWall().result_hash).toBe(runHash);
  }, 30000);

  it("names the soil source profile (or a deleted one) in the soil step, never by its id", async () => {
    const profile = getMockStore().profiles.find((p) => p.id === "prof-mock-1")!;
    expect(profile.name).toBeTruthy();
    const first = renderWizard();
    fireEvent.click(await step(tr["web.wizard.step.soil"]));
    await waitFor(() => expect(screen.getByTestId("soil-source-name")).toHaveTextContent(profile.name ?? ""));
    expect(document.body.textContent).not.toContain("prof-mock-1");
    first.unmount();

    storedWall().soil.source_profile_id = "0123456789abcdef0123456789abcdef";
    renderWizard();
    fireEvent.click(await step(tr["web.wizard.step.soil"]));
    await waitFor(() => expect(screen.getByTestId("soil-source-name")).toHaveTextContent(tr["web.common.deleted_profile"]));
    expect(document.body.textContent).not.toContain("0123456789abcdef");
  });

  it("does not write the previous result back when saving after a finished run", async () => {
    storedWall().result_hash = "before-the-run";
    renderWizard();
    await runCheck();
    const runHash = storedWall().result_hash;
    expect(runHash).not.toBe("before-the-run");
    // The next run saves the structure (PUT replaces it whole) and is cancelled before it finishes.
    fireEvent.click(screen.getByRole("button", { name: tr["ui.wall.suggest"] }));
    fireEvent.click(await screen.findByRole("button", { name: tr["web.wizard.cancel_job"] }));
    expect(await screen.findByTestId("job-cancelled")).toBeInTheDocument();
    expect(storedWall().result_hash).toBe(runHash);
    expect(storedWall().result?.result_hash).toBe(runHash);
  }, 30000);
});
