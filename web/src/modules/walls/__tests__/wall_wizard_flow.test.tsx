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
    // a single sign: the service still reports it per seismic check, but the detail carries no prefix
    const badges = Array.from(document.querySelectorAll("[data-kv-sign]"));
    expect(badges.length).toBeGreaterThan(0);
    expect(badges.every((b) => b.getAttribute("data-kv-sign") === "down")).toBe(true);
    expect(document.body.textContent).not.toMatch(/kv (yukarı|aşağı):/);
  }, 20000);

  it("edits layer permeability in the soil step and carries it into the saved structure", async () => {
    renderWizard();
    fireEvent.click(await step(tr["web.wizard.step.soil"]));
    const editor = await screen.findByTestId("permeability-editor");
    const input = within(editor).getByLabelText(tr["walls.perm.input_label"].replace("{id}", "F1"));
    fireEvent.change(input, { target: { value: "2e-6" } });
    fireEvent.blur(input);
    expect(input).toHaveValue("2e-6");

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

  describe("passive reduction confirmation", () => {
    function savePassive(level: "basic" | "advanced") {
      const wall = getMockStore().structures.find((x) => x.id === "wall-mock-1") as RetainingWallStructure;
      wall.analysis_level = level;
      wall.settings = { ...wall.settings, use_passive: true, passive_reduction: 0.5 };
    }

    it("blocks Suggest and Check until the saved passive reduction is confirmed in this session", async () => {
      savePassive("advanced");
      renderWizard();
      fireEvent.click(await step(tr["web.wizard.step.run"]));
      const check = await screen.findByRole("button", { name: tr["ui.wall.check"] });
      const suggest = screen.getByRole("button", { name: tr["ui.wall.suggest"] });
      expect(check).toBeDisabled();
      expect(suggest).toBeDisabled();
      expect(screen.getByTestId("passive-run-blocked")).toHaveTextContent("0.50");

      // the reason links to the confirmation, which unblocks both buttons
      fireEvent.click(within(screen.getByTestId("passive-run-blocked")).getByRole("button"));
      fireEvent.click(await screen.findByRole("checkbox", { name: new RegExp(tr["walls.options.passive.confirm"].replace("{value}", "0.50")) }));
      fireEvent.click(await step(tr["web.wizard.step.run"]));
      expect(await screen.findByRole("button", { name: tr["ui.wall.check"] })).toBeEnabled();
      expect(screen.getByRole("button", { name: tr["ui.wall.suggest"] })).toBeEnabled();
      expect(screen.queryByTestId("passive-run-blocked")).toBeNull();
    }, 20000);

    it("asks again after a reload (confirmation is not persisted) and re-blocks when the value is edited", async () => {
      savePassive("advanced");
      const first = renderWizard();
      fireEvent.click(await step(tr["web.wizard.step.loads"]));
      fireEvent.click(await screen.findByRole("checkbox", { name: new RegExp(tr["walls.options.passive.confirm"].replace("{value}", "0.50")) }));
      fireEvent.change(screen.getByTestId("passive-reduction"), { target: { value: "0.4" } });
      fireEvent.click(await step(tr["web.wizard.step.run"]));
      expect(await screen.findByRole("button", { name: tr["ui.wall.check"] })).toBeDisabled();
      first.unmount();

      renderWizard();
      fireEvent.click(await step(tr["web.wizard.step.run"]));
      expect(await screen.findByRole("button", { name: tr["ui.wall.check"] })).toBeDisabled();
    }, 20000);

    it("does not block at the basic level, where the service ignores passive resistance", async () => {
      savePassive("basic");
      renderWizard();
      fireEvent.click(await step(tr["web.wizard.step.run"]));
      expect(await screen.findByRole("button", { name: tr["ui.wall.check"] })).toBeEnabled();
      expect(screen.queryByTestId("passive-run-blocked")).toBeNull();
    }, 20000);
  });

  describe("stale results", () => {
    async function runCheck() {
      fireEvent.click(await step(tr["web.wizard.step.run"]));
      fireEvent.click(await screen.findByRole("button", { name: tr["ui.wall.check"] }));
      await screen.findAllByTestId("check-card", undefined, { timeout: JOB_TIMEOUT });
    }

    it("shows a fresh result without a stale notice, marks it stale after an option edit, and clears it on re-run", async () => {
      renderWizard();
      await runCheck();
      await waitFor(() => expect(screen.queryByTestId("result-stale")).toBeNull());

      fireEvent.click(await step(tr["web.wizard.step.loads"]));
      fireEvent.click(await screen.findByRole("radio", { name: tr["walls.options.uplift.resisting"] }));
      fireEvent.click(await step(tr["web.wizard.step.result"]));
      expect(await screen.findByTestId("result-stale")).toHaveTextContent(tr["walls.result.stale_inputs"]);
      expect(document.querySelector('[data-stale="true"]')).not.toBeNull();

      fireEvent.click(await step(tr["web.wizard.step.run"]));
      fireEvent.click(await screen.findByRole("button", { name: tr["ui.wall.check"] }));
      await waitFor(() => expect(screen.getByRole("button", { name: tr["ui.wall.check"] })).toBeEnabled());
      await screen.findAllByTestId("check-card");
      await waitFor(() => expect(screen.queryByTestId("result-stale")).toBeNull(), { timeout: JOB_TIMEOUT });
    }, 30000);

    it("marks the old result stale after a geometry edit", async () => {
      renderWizard();
      await runCheck();
      fireEvent.click(await step(tr["web.wizard.step.geometry"]));
      const heel = await screen.findByLabelText(tr["ui.geo.heel"]);
      fireEvent.change(heel, { target: { value: "3.5" } });
      fireEvent.click(await step(tr["web.wizard.step.result"]));
      expect(await screen.findByTestId("result-stale")).toBeInTheDocument();
    }, 20000);

    it("marks the old result stale when the next job is cancelled", async () => {
      renderWizard();
      await runCheck();
      fireEvent.click(await screen.findByRole("button", { name: tr["ui.wall.suggest"] }));
      fireEvent.click(await screen.findByRole("button", { name: tr["web.wizard.cancel_job"] }));
      expect(await screen.findByTestId("job-cancelled")).toBeInTheDocument();
      expect(screen.getByTestId("result-stale")).toHaveTextContent(tr["walls.result.stale_job"]);
    }, 30000);
  });

  it("the result step draws geometry only, even when the draft soil has layers", async () => {
    renderWizard();
    fireEvent.click(await step(tr["web.wizard.step.run"]));
    fireEvent.click(await screen.findByRole("button", { name: tr["ui.wall.check"] }));
    await screen.findAllByTestId("check-card", undefined, { timeout: JOB_TIMEOUT });
    fireEvent.click(await step(tr["web.wizard.step.result"]));
    await screen.findByTestId("result-verdict");
    const svg = screen.getByTestId("wall-section").querySelector("svg")!;
    expect(svg.querySelectorAll('[data-part="band"]')).toHaveLength(0);
    expect(svg.querySelector('[data-part="stem"]')).not.toBeNull();
  }, 20000);
});
