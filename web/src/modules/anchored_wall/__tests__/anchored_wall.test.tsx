import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../app/i18n";
import { setMockMode } from "../../../shared/api/client";
import { mockRequest, resetMockState } from "../../../shared/api/mock";
import { resetCoreMock } from "../../../shared/api/mock/core";
import { AnalysisPage } from "../pages/AnalysisPage";
import { AnchorPage } from "../pages/AnchorPage";
import { resetAnchoredWallMock } from "../mock";

beforeAll(() => {
  // jsdom lacks scrollIntoView, which the Mantine combobox calls.
  Element.prototype.scrollIntoView = vi.fn();
});
beforeEach(async () => {
  setMockMode(true);
  resetCoreMock();
  resetMockState();
  resetAnchoredWallMock();
  await i18n.changeLanguage("en");
});
afterEach(() => {
  cleanup();
  setMockMode(null);
});

const renderPage = (page: JSX.Element) =>
  render(<MantineProvider><MemoryRouter>{page}</MemoryRouter></MantineProvider>);

describe("anchored wall analysis page", () => {
  it("starts empty: no result badge, run disabled, missing inputs listed", async () => {
    renderPage(<AnalysisPage />);
    expect(await screen.findByTestId("aw-status")).toHaveTextContent(i18n.t("anchored_wall.status.no_result"));
    expect(screen.getByRole("button", { name: i18n.t("anchored_wall.action.run") })).toBeDisabled();
    expect(screen.getByTestId("aw-missing")).toHaveTextContent(i18n.t("anchored_wall.missing.soil"));
    // no default factor of safety on the passive resistance (GEC-4 1.5 is only a suggestion)
    expect(screen.getByTestId("aw-missing")).toHaveTextContent(i18n.t("anchored_wall.missing.passive_factor"));
    expect(screen.getByLabelText(i18n.t("anchored_wall.input.passive_factor"))).toHaveValue("");
  });

  it("asks for the basal heave inputs when the analysis is undrained", async () => {
    renderPage(<AnalysisPage />);
    await screen.findByTestId("aw-status");
    fireEvent.click(screen.getByRole("textbox", { name: i18n.t("anchored_wall.input.drainage") }));
    fireEvent.click(await screen.findByRole("option", { name: i18n.t("anchored_wall.drainage.undrained") }));
    const missing = await screen.findByTestId("aw-missing");
    await waitFor(() => expect(missing).toHaveTextContent(i18n.t("anchored_wall.missing.excavation_width")));
    expect(missing).toHaveTextContent(i18n.t("anchored_wall.missing.service"));
  });

  it("loads a project profile, runs the analysis and shows result, section and a translated warning", async () => {
    renderPage(<AnalysisPage />);
    await screen.findByTestId("aw-status");
    fireEvent.change(screen.getByLabelText(i18n.t("anchored_wall.input.excavation_height")), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText(`${i18n.t("anchored_wall.report.level_depth")} 1`), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(`${i18n.t("anchored_wall.report.level_spacing")} 1`), { target: { value: "2.5" } });
    fireEvent.change(screen.getByLabelText(i18n.t("anchored_wall.input.passive_factor")), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("textbox", { name: i18n.t("anchored_wall.input.profile") }));
    fireEvent.click((await screen.findAllByRole("option"))[0]);
    fireEvent.click(screen.getByRole("button", { name: i18n.t("anchored_wall.action.load_soil") }));
    await screen.findByTestId("aw-soil");
    const run = screen.getByRole("button", { name: i18n.t("anchored_wall.action.run") });
    await waitFor(() => expect(run).toBeEnabled());
    fireEvent.click(run);
    expect(await screen.findByTestId("aw-analysis-result")).toBeInTheDocument();
    expect(screen.getByTestId("aw-section")).toBeInTheDocument();
    expect(screen.getByTestId("aw-diagrams")).toBeInTheDocument();
    expect(screen.getByTestId("aw-envelope-diagram")).toBeInTheDocument();
    expect(screen.getByTestId("aw-warnings")).toHaveTextContent(i18n.t("anchored_wall.warning.mock_result"));
    expect(screen.getByTestId("aw-status")).toHaveTextContent(i18n.t("anchored_wall.status.ready"));
    // editing an input after the run marks the shown result as out of date
    fireEvent.change(screen.getByLabelText(i18n.t("anchored_wall.input.excavation_height")), { target: { value: "7" } });
    await waitFor(() => expect(screen.getByTestId("aw-status")).toHaveTextContent(i18n.t("anchored_wall.status.stale")));
  });
});

describe("anchor design page", () => {
  it("keeps the engineering inputs empty and lists them as missing; reference values are not applied", async () => {
    renderPage(<AnchorPage />);
    await screen.findByTestId("aw-status");
    const missing = screen.getByTestId("aw-missing");
    expect(missing).toHaveTextContent(i18n.t("anchored_wall.missing.safety_factor"));
    expect(missing).toHaveTextContent(i18n.t("anchored_wall.missing.lock_off_ratio"));
    expect(screen.getByLabelText(i18n.t("anchored_wall.input.safety_factor"))).toHaveValue("");
    expect(screen.getByRole("button", { name: i18n.t("anchored_wall.action.run_anchor") })).toBeDisabled();
  });

  it("applies a GEC-4 suggestion only when the user presses Use", async () => {
    renderPage(<AnchorPage />);
    await screen.findByTestId("aw-status");
    fireEvent.click(screen.getByRole("button", { name: i18n.t("anchored_wall.reference.show") }));
    const ref = await screen.findByTestId("aw-reference");
    expect(screen.getByLabelText(i18n.t("anchored_wall.input.ultimate_transfer_load"))).toHaveValue("");
    fireEvent.click(ref.querySelectorAll("button")[1] as HTMLElement);
    expect(screen.getByLabelText(i18n.t("anchored_wall.input.ultimate_transfer_load"))).toHaveValue("250");
  });
});

describe("mock routes", () => {
  it("answers 422 missing_inputs and a coded calculation stop like the backend", async () => {
    const missing = await mockRequest("POST", "/m/anchored_wall/anchor/design", { excavation_height: 8 });
    expect(missing.status).toBe(422);
    expect(missing.data).toMatchObject({ code: "missing_inputs", details: { missing: expect.any(Array) } });
    const stop = await mockRequest("POST", "/m/anchored_wall/analysis/run", {
      levels: [{ depth: 1, spacing: 2 }, { depth: 3, spacing: 2 }], backfill_slope: 5, excavation_height: 6,
    });
    expect(stop.data).toMatchObject({ code: "calculation_stopped", details: { stop_code: "envelope_sloping_ground" } });
  });
});
