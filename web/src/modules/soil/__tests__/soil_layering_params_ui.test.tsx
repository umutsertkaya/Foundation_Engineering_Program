import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  cleanup();
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
    // Warnings are localised from the core catalog.
    const warnings = screen.getByTestId("layering-warnings");
    expect(within(warnings).getAllByRole("listitem")).toHaveLength(2);
    expect(warnings.textContent).toContain("Adjacent layers of the same soil behaviour were merged.");

    // The program's unit weights are shown but never filled in: Create stays blocked until each one is confirmed.
    const create = screen.getByTestId("layering-create");
    expect(create).toBeDisabled();
    expect(screen.getByTestId("layering-gamma-0")).toHaveValue("");
    expect(screen.getByTestId("layering-gamma-use-0")).toHaveTextContent("18.2");
    // The saturated unit weight suggestion is only displayed (the server carries it into the profile).
    expect(screen.getByTestId("layering-gamma-sat-0")).toHaveTextContent("19.4");
    fireEvent.click(screen.getByTestId("layering-gamma-use-0"));
    typeInto("layering-gamma-1", "17"); // override the suggestion of layer 2
    expect(create).toBeDisabled(); // layer 3 is still open
    fireEvent.click(screen.getByTestId("layering-gamma-use-2"));
    await waitFor(() => expect(create).not.toBeDisabled());
    fireEvent.click(create);
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    const created = onCreated.mock.calls[0][0] as SoilProfile;
    expect(created.layers.map((l) => l.gamma)).toEqual([18.2, 17, 19.6]);
    expect(created.layers.map((l) => l.gamma_sat)).toEqual([19.4, 18.5, 20.3]);
    expect(created.origin).toBe("cpt");
    expect(created.source_ids).toEqual(["CPT-M1"]);
    expect(created.layering?.method).toBe("cpt_ic");
    expect(created.layers).toHaveLength(3);
    expect(created.gwt.depth_insitu).toBe(3); // prefilled from the sounding, editable
    expect(created.layers.every((l) => !l.selections)).toBe(true); // nothing approved
  });

  it("renders localised warnings once the i18n key exists and keeps the raw string otherwise", async () => {
    const original = { ...(i18n.getResourceBundle("en", "translation") as Record<string, string>) };
    const withoutDrainage = { ...original };
    delete withoutDrainage["layering.warning.drainage_ic_based"];
    i18n.removeResourceBundle("en", "translation");
    i18n.addResourceBundle("en", "translation", withoutDrainage);
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
    // Plain wording: the unit weights are the engineer entries, no claim about provenance or gamma_sat.
    expect(screen.getByTestId("layering-gamma-note")).toHaveTextContent(/your entries/);
    expect(screen.getByTestId("layering-gamma-note")).toHaveTextContent(/not where it came from/);
    expect(screen.queryByTestId("layering-gamma-use-all")).toBeNull(); // SPT has no suggestion to confirm

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
    expect(candidates.textContent).toContain("°");
    // An invalid candidate is flagged and its warning is shown, localised.
    expect(candidates.textContent).toContain("outside validity range");
    expect(candidates.textContent).toContain("Value is not computable for method mock_phi_eff_c");
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
    await waitFor(() => expect(within(card).getByTestId("param-selected-phi_eff")).toHaveTextContent("°"));
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

  it("a stale approval cannot be approved as is: re-apply first, then the fresh value is approved", async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId("params-layer-L2"));
    const card = await screen.findByTestId("param-card-phi_eff");
    fireEvent.click(within(card).getByRole("radio", { name: "Suggestion" }));
    fireEvent.click(within(card).getByTestId("param-apply-phi_eff"));
    await waitFor(() => expect(within(card).getByTestId("param-approve-phi_eff")).not.toBeDisabled());
    fireEvent.click(within(card).getByTestId("param-approve-phi_eff"));
    await waitFor(() => expect(within(card).getByTestId("param-state-phi_eff")).toHaveTextContent("Approved"));
    expect(screen.getByTestId("params-badge-L2")).toHaveTextContent(/1\/7 approved/);
    const oldValue = (await get_profile("prof-mock-1")).layers[1].design?.phi_eff;

    // Move the L1/L2 boundary: the basis changes, the candidates change, the approval trace stays.
    const moved = await get_profile("prof-mock-1");
    moved.layers[0].bottom = 1.2;
    moved.layers[1].top = 1.2;
    await update_profile(moved.id, moved);

    // Re-read through the page (switch profile and back).
    fireEvent.change(screen.getByTestId("params-profile"), { target: { value: "prof-mock-2" } });
    await waitFor(() => expect(screen.getByTestId("params-layer-S1")).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("params-profile"), { target: { value: "prof-mock-1" } });
    await waitFor(() => expect(screen.getByTestId("params-layer-L2")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("params-layer-L2"));
    await waitFor(() => expect(screen.getByTestId("param-state-phi_eff")).toHaveTextContent("Stale"));
    expect(screen.getByTestId("params-badge-L2")).toHaveTextContent(/0\/7 approved/); // counted from fresh data
    expect(screen.getByTestId("param-approve-phi_eff")).toBeDisabled();
    expect(screen.getByTestId("param-reapply-phi_eff")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("param-apply-phi_eff")); // re-apply: re-evaluated on the current candidates
    await waitFor(() => expect(screen.getByTestId("param-state-phi_eff")).toHaveTextContent("Not approved"));
    const shown = Number(screen.getByTestId("param-selected-phi_eff").textContent?.split(" ")[0]);
    await waitFor(() => expect(screen.getByTestId("param-approve-phi_eff")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("param-approve-phi_eff"));
    await waitFor(() => expect(screen.getByTestId("param-state-phi_eff")).toHaveTextContent("Approved"));
    const approved = (await get_profile("prof-mock-1")).layers[1].design?.phi_eff;
    expect(approved).toBe(shown); // the value shown is the value the server approved
    expect(approved).not.toBe(oldValue);
  });

  it("bulk approve is blocked while a draft is unapplied and lists exact keys and values before approving", async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId("params-layer-L2"));
    const phi = await screen.findByTestId("param-card-phi_eff");
    const bulk = screen.getByTestId("params-approve-ready");
    expect(bulk).toBeDisabled(); // nothing applied yet

    fireEvent.click(within(phi).getByRole("radio", { name: "Manual" }));
    typeInto("param-manual-phi_eff", "31");
    expect(bulk).toBeDisabled(); // unapplied draft
    fireEvent.click(within(phi).getByTestId("param-apply-phi_eff"));
    await waitFor(() => expect(within(phi).getByTestId("param-selected-phi_eff")).toHaveTextContent("31"));
    const suCard = screen.getByTestId("param-card-su");
    fireEvent.click(within(suCard).getByRole("radio", { name: "Manual" }));
    typeInto("param-manual-su", "77"); // a second, still-unapplied draft
    expect(bulk).toBeDisabled();
    // Discard the draft by leaving the layer (cards remount with what the server stores).
    fireEvent.click(screen.getByTestId("params-layer-L3"));
    fireEvent.click(screen.getByTestId("params-layer-L2"));
    await waitFor(() => expect(screen.getByTestId("params-approve-ready")).not.toBeDisabled());

    fireEvent.click(screen.getByTestId("params-approve-ready"));
    const dialog = await screen.findByTestId("params-confirm");
    expect(within(dialog).getByTestId("params-confirm-phi_eff")).toHaveTextContent("31");
    expect(within(dialog).queryByTestId("params-confirm-su")).toBeNull();
    expect((await get_profile("prof-mock-1")).layers[1].design?.phi_eff).toBe(29); // nothing approved yet
    fireEvent.click(within(dialog).getByTestId("params-confirm-approve"));
    await waitFor(() => expect(screen.getByTestId("param-state-phi_eff")).toHaveTextContent("Approved"));
    expect((await get_profile("prof-mock-1")).layers[1].design?.phi_eff).toBe(31);
  });

  it("suggest-all refreshes suggestions and reports that nothing was approved", async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId("params-suggest-all"));
    expect(await screen.findByText(/nothing was approved/)).toBeInTheDocument();
  });
});
