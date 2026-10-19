import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setMockMode } from "../../../shared/api/client";
import { resetMockState } from "../../../shared/api/mock";
import type { SoilProfile } from "../../../shared/api/types";
import i18n from "../../../app/i18n";
import { theme } from "../../../app/theme";
import { get_profile, update_profile } from "../api";
import { LayeringModal, type LayeringKind } from "../components/LayeringModal";
import { ParametersPage } from "../pages/ParametersPage";

beforeEach(async () => {
  setMockMode(true);
  resetMockState();
  await i18n.changeLanguage("en");
});
afterEach(async () => {
  setMockMode(null);
  resetMockState();
  await i18n.changeLanguage("tr");
});

const wrap = (ui: React.ReactNode) => (
  <MantineProvider theme={theme}>
    <MemoryRouter>{ui}</MemoryRouter>
  </MantineProvider>
);

function typeInto(testId: string, value: string) {
  const root = screen.getByTestId(testId);
  const input = root instanceof HTMLInputElement ? root : root.querySelector("input");
  fireEvent.change(input as HTMLInputElement, { target: { value } });
}

describe("LayeringModal", () => {
  function open(kind: LayeringKind) {
    const onCreated = vi.fn();
    const onClose = vi.fn();
    render(wrap(<LayeringModal kind={kind} onClose={onClose} onCreated={onCreated} />));
    return { onCreated, onClose };
  }

  it("CPT: proposes, shows the table and warnings, and creates a profile from the proposal", async () => {
    const { onCreated } = open("cpt");
    const propose = await screen.findByTestId("layering-propose");
    await waitFor(() => expect(propose).not.toBeDisabled());
    fireEvent.click(propose);

    expect(await screen.findByTestId("layering-proposal")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^layering-row-/)).toHaveLength(3);
    expect(screen.getByText(/Nothing is approved automatically/)).toBeInTheDocument();
    // The core catalog does not have layering.warning.* yet (added in parallel), so the raw string is shown.
    const warnings = screen.getByTestId("layering-warnings");
    expect(within(warnings).getAllByRole("listitem")).toHaveLength(2);
    expect(warnings.textContent).toContain("layering.warning.similar_merged");

    const create = screen.getByTestId("layering-create");
    await waitFor(() => expect(create).not.toBeDisabled());
    fireEvent.click(create);
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    const created = onCreated.mock.calls[0][0] as SoilProfile;
    expect(created.origin).toBe("cpt");
    expect(created.source_ids).toEqual(["CPT-M1"]);
    expect(created.layering?.method).toBe("cpt_ic");
    expect(created.layers).toHaveLength(3);
    expect(created.gwt.depth_insitu).toBe(3); // prefilled from the sounding, editable
    expect(created.layers.every((l) => !l.selections)).toBe(true); // nothing approved
  });

  it("renders localised warnings once the i18n key exists and keeps the raw string otherwise", async () => {
    const original = { ...(i18n.getResourceBundle("en", "translation") as Record<string, string>) };
    i18n.addResource("en", "translation", "layering.warning.similar_merged", "Similar zones were merged");
    open("cpt");
    const propose = await screen.findByTestId("layering-propose");
    await waitFor(() => expect(propose).not.toBeDisabled());
    fireEvent.click(propose);
    const warnings = (await screen.findByTestId("layering-warnings")).textContent ?? "";
    expect(warnings).toContain("Similar zones were merged");
    expect(warnings).toContain("layering.warning.drainage_ic_based: message=");
    i18n.removeResourceBundle("en", "translation");
    i18n.addResourceBundle("en", "translation", original);
  });

  it("SPT: unit weights are entered by the engineer and Create stays disabled until they are", async () => {
    const { onCreated } = open("spt");
    const propose = await screen.findByTestId("layering-propose");
    await waitFor(() => expect(propose).not.toBeDisabled());
    fireEvent.click(propose);
    await screen.findByTestId("layering-proposal");
    expect(screen.getByText(/No unit weight could be suggested/)).toBeInTheDocument();

    const create = screen.getByTestId("layering-create");
    expect(create).toBeDisabled();
    const rows = screen.getAllByTestId(/^layering-row-/);
    rows.forEach((_, i) => typeInto(`layering-gamma-${i}`, "18.5"));
    await waitFor(() => expect(create).not.toBeDisabled());
    fireEvent.click(create);
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    const created = onCreated.mock.calls[0][0] as SoilProfile;
    expect(created.origin).toBe("spt");
    expect(created.layers.every((l) => l.gamma === 18.5)).toBe(true);
  });

  it("changing a setting after proposing marks the proposal outdated and blocks Create", async () => {
    open("cpt");
    const propose = await screen.findByTestId("layering-propose");
    await waitFor(() => expect(propose).not.toBeDisabled());
    fireEvent.click(propose);
    await screen.findByTestId("layering-proposal");
    typeInto("layering-setting-min_thickness", "1");
    expect(await screen.findByText(/Settings changed/)).toBeInTheDocument();
    expect(screen.getByTestId("layering-create")).toBeDisabled();
  });
});

describe("ParametersPage", () => {
  async function renderPage() {
    render(wrap(<ParametersPage />));
    // The active mock profile (prof-mock-1) opens with its first layer, L1.
    return await screen.findByTestId("param-card-phi_eff");
  }

  it("shows candidates with references and units, and the approval state of each key", async () => {
    const card = await renderPage();
    expect(within(card).getByTestId("param-state-phi_eff")).toHaveTextContent("Approved"); // seeded manual approval
    const candidates = within(card).getByTestId("param-candidates-phi_eff");
    expect(candidates.textContent).toContain("mock_phi_eff_a");
    expect(candidates.textContent).toContain("Sentetik korelasyon A (Mock)");
    expect(candidates.textContent).toContain("deg");
    // An invalid candidate is flagged and its warning is shown (raw string: key not in the catalog yet).
    expect(candidates.textContent).toContain("outside validity range");
    expect(candidates.textContent).toContain("parameters.warning.outside_validity");
    expect(within(screen.getByTestId("param-card-su")).getByTestId("param-state-su")).toHaveTextContent("Not approved");
  });

  it("select a method, apply, approve: the card goes from not approved to approved", async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId("params-layer-L2"));
    const card = await screen.findByTestId("param-card-phi_eff");
    await waitFor(() => expect(within(card).getByTestId("param-state-phi_eff")).toHaveTextContent("Not approved"));

    expect(within(card).getByTestId("param-approve-phi_eff")).toBeDisabled(); // nothing selected yet
    fireEvent.click(within(card).getByRole("radio", { name: "Method" }));
    fireEvent.change(within(card).getByTestId("param-method-phi_eff"), { target: { value: "mock_phi_eff_b" } });
    expect(within(card).getByTestId("param-approve-phi_eff")).toBeDisabled(); // unapplied draft
    fireEvent.click(within(card).getByTestId("param-apply-phi_eff"));
    await waitFor(() => expect(within(card).getByTestId("param-selected-phi_eff")).toHaveTextContent("deg"));
    expect(within(card).getByTestId("param-state-phi_eff")).toHaveTextContent("Not approved");

    fireEvent.click(within(card).getByTestId("param-approve-phi_eff"));
    await waitFor(() => expect(within(card).getByTestId("param-state-phi_eff")).toHaveTextContent("Approved"));
    const profile = await get_profile("prof-mock-1");
    expect(profile.layers[1].design?.phi_eff).toBeTypeOf("number");
    expect(profile.layers[1].selections?.phi_eff.approved).toBe(true);
  });

  it("mean − k·SD needs a user-entered k before it can be applied", async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId("params-layer-L2"));
    const card = await screen.findByTestId("param-card-phi_eff");
    fireEvent.click(within(card).getByRole("radio", { name: "Statistic" }));
    fireEvent.change(within(card).getByTestId("param-statistic-phi_eff"), { target: { value: "mean_minus_k_sd" } });
    expect(within(card).getByTestId("param-apply-phi_eff")).toBeDisabled();
    typeInto("param-ksd-phi_eff", "1");
    await waitFor(() => expect(within(card).getByTestId("param-apply-phi_eff")).not.toBeDisabled());
  });

  it("a stale approval is shown as stale and is not counted as approved", async () => {
    // Approve phi' on L2, then move the L1/L2 boundary: the basis changes, the approval trace stays.
    const before = await get_profile("prof-mock-1");
    expect(before.layers[1].id).toBe("L2");
    await renderPage();
    fireEvent.click(screen.getByTestId("params-layer-L2"));
    const card = await screen.findByTestId("param-card-phi_eff");
    fireEvent.click(within(card).getByRole("radio", { name: "Suggestion" }));
    fireEvent.click(within(card).getByTestId("param-apply-phi_eff"));
    await waitFor(() => expect(within(card).getByTestId("param-approve-phi_eff")).not.toBeDisabled());
    fireEvent.click(within(card).getByTestId("param-approve-phi_eff"));
    await waitFor(() => expect(within(card).getByTestId("param-state-phi_eff")).toHaveTextContent("Approved"));

    const moved = await get_profile("prof-mock-1");
    moved.layers[0].bottom = 1.2;
    moved.layers[1].top = 1.2;
    await update_profile(moved.id, moved);

    // Re-open the layer through the page (select another layer, then back) to re-read the parameters.
    fireEvent.click(screen.getByTestId("params-layer-L3"));
    await waitFor(() => expect(screen.getByTestId("params-layer-L3")).toHaveAttribute("aria-current", "true"));
    fireEvent.click(screen.getByTestId("params-layer-L2"));
    await waitFor(() => expect(screen.getByTestId("param-state-phi_eff")).toHaveTextContent("Stale"));
    expect(screen.getByTestId("param-stale-phi_eff")).toBeInTheDocument();
  });

  it("suggest-all refreshes suggestions and reports that nothing was approved", async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId("params-suggest-all"));
    expect(await screen.findByText(/nothing was approved/)).toBeInTheDocument();
  });
});
