import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import trCatalog from "../../../../../geotek/i18n/tr.json";
import wallsTr from "../../../../../geotek/modules/walls/i18n/tr.json";
import "../../../app/i18n";
import { theme } from "../../../app/theme";
import { setMockMode } from "../../../shared/api/client";
import { resetMockState } from "../../../shared/api/mock";
import { getMockStore } from "../../../shared/api/mock/store";
import type { RetainingWallStructure } from "../../../shared/api/types";
import { WallWizardPage } from "../pages/WallWizardPage";
import type { WallSettingsPayload } from "../types";

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

function storedSettings(): WallSettingsPayload | undefined {
  const wall = getMockStore().structures.find((s) => s.id === "wall-mock-1") as RetainingWallStructure;
  return wall.settings;
}

describe("walls wizard: options, jobs and results (mock API)", () => {
  beforeEach(() => {
    setMockMode(true);
    resetMockState();
  });
  afterEach(() => setMockMode(null));

  it("runs a check through the job API with progress, shows labelled cards with the governing kv sign", async () => {
    renderWizard();
    fireEvent.click(await step(tr["web.wizard.step.run"]));
    fireEvent.click(await screen.findByRole("button", { name: tr["ui.wall.check"] }));

    // progress text and bar appear while the job runs, and a cancel button is offered
    expect(await screen.findByText(new RegExp(tr["web.wizard.job_progress"]))).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: tr["web.wizard.cancel_job"] })).toBeInTheDocument();

    const cards = await screen.findAllByTestId("check-card", undefined, { timeout: JOB_TIMEOUT });
    expect(cards.length).toBeGreaterThan(5);
    expect(screen.queryByRole("button", { name: tr["web.wizard.cancel_job"] })).toBeNull();
    // default kv sign = envelope: seismic cards carry the governing sign, static ones do not
    expect(document.querySelectorAll("[data-kv-sign]").length).toBeGreaterThan(0);
    expect(screen.getByTestId("kv-envelope-note")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/seismic:|static:|walls\.[a-z_]+\./);
    expect(screen.getByTestId("governing-summary")).toBeInTheDocument();
  }, 20000);

  it("saves the analysis options with the run and a single kv sign removes the envelope badges", async () => {
    renderWizard();
    fireEvent.click(await step(tr["web.wizard.step.loads"]));
    fireEvent.click(await screen.findByRole("radio", { name: tr["walls.options.kv.down"] }));
    fireEvent.click(screen.getByRole("radio", { name: tr["walls.options.submerged.by_permeability"] }));
    fireEvent.click(screen.getByRole("radio", { name: tr["walls.options.uplift.resisting"] }));
    // basic level: passive controls are disabled
    expect(screen.getByTestId("passive-reduction")).toBeDisabled();

    fireEvent.click(await step(tr["web.wizard.step.run"]));
    fireEvent.click(await screen.findByRole("button", { name: tr["ui.wall.check"] }));
    await screen.findAllByTestId("check-card", undefined, { timeout: JOB_TIMEOUT });

    expect(storedSettings()).toMatchObject({
      kv_sign: "down",
      submerged_seismic: "by_permeability",
      uplift_moment: "resisting",
      gwt_bearing_correction: true,
    });
    expect(document.querySelectorAll("[data-kv-sign]")).toHaveLength(0);
    expect(screen.queryByTestId("kv-envelope-note")).toBeNull();
  }, 20000);

  it("edits layer permeability in the soil step and carries it into the saved structure", async () => {
    renderWizard();
    fireEvent.click(await step(tr["web.wizard.step.soil"]));
    const editor = await screen.findByTestId("permeability-editor");
    const input = within(editor).getByLabelText(tr["walls.perm.input_label"].replace("{id}", "F1"));
    fireEvent.change(input, { target: { value: "2e-6" } });
    fireEvent.blur(input);
    expect(within(editor).getAllByText(tr["walls.perm.class.impervious"]).length).toBeGreaterThan(0);

    fireEvent.click(await step(tr["web.wizard.step.run"]));
    fireEvent.click(await screen.findByRole("button", { name: tr["ui.wall.check"] }));
    await screen.findAllByTestId("check-card", undefined, { timeout: JOB_TIMEOUT });
    const wall = getMockStore().structures.find((s) => s.id === "wall-mock-1") as RetainingWallStructure;
    expect((wall.soil.retained_fill?.[0] as { permeability?: number }).permeability).toBe(2e-6);
  }, 20000);

  it("cancels a running size job and shows no result", async () => {
    renderWizard();
    fireEvent.click(await step(tr["web.wizard.step.run"]));
    fireEvent.click(await screen.findByRole("button", { name: tr["ui.wall.suggest"] }));
    fireEvent.click(await screen.findByRole("button", { name: tr["web.wizard.cancel_job"] }));
    expect(await screen.findByTestId("job-cancelled")).toHaveTextContent(tr["walls.run.cancelled"]);
    await waitFor(() => expect(screen.queryByRole("button", { name: tr["web.wizard.cancel_job"] })).toBeNull());
    expect(screen.queryAllByTestId("check-card")).toHaveLength(0);
    // the progress line shows a translated status, never the raw enum value
    expect(document.body.textContent).toContain(`${tr["web.wizard.job_progress"]}: ${tr["walls.job.status.cancelled"]}`);
    expect(document.body.textContent).not.toMatch(/(cancelled|failed|running|queued)/);
  }, 20000);

  it("shows the result step with the section and the labelled factor table", async () => {
    renderWizard();
    fireEvent.click(await step(tr["web.wizard.step.run"]));
    fireEvent.click(await screen.findByRole("button", { name: tr["ui.wall.check"] }));
    await screen.findAllByTestId("check-card", undefined, { timeout: JOB_TIMEOUT });
    fireEvent.click(await step(tr["web.wizard.step.result"]));
    expect(await screen.findByTestId("result-verdict")).toBeInTheDocument();
    expect(screen.getByTestId("wall-section")).toBeInTheDocument();
    expect(document.body.textContent).toContain("Güvenlik sayıları › Devrilme › Statik");
    expect(document.body.textContent).not.toMatch(/safety\.overturning|ASD-static\./);
  }, 20000);
});
