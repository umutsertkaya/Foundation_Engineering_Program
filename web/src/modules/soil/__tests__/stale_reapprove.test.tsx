import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, setMockMode } from "../../../shared/api/client";
import { resetMockState } from "../../../shared/api/mock";
import type { ParameterSelection } from "../../../shared/api/types";
import i18n from "../../../app/i18n";
import { theme } from "../../../app/theme";
import { approve_parameters, get_profile, reapprove_parameters, update_parameter_selection, update_profile } from "../api";
import { formatPercent, orderSelections, refreshedDiff, staleReasonKey } from "../parameterState";
import { ParametersPage } from "../pages/ParametersPage";

const control = vi.hoisted(() => ({ reapprovePayloads: [] as unknown[] }));

vi.mock("../api", async (importActual) => {
  const actual = await importActual<typeof import("../api")>();
  return {
    ...actual,
    reapprove_parameters: (profile: string, items: Parameters<typeof actual.reapprove_parameters>[1]) => {
      control.reapprovePayloads.push(items);
      return actual.reapprove_parameters(profile, items);
    },
  };
});

const PROFILE = "prof-mock-1";
const LAYER = "L2";

beforeEach(async () => {
  setMockMode(true);
  resetMockState();
  control.reapprovePayloads = [];
  await i18n.changeLanguage("en");
});
afterEach(async () => {
  setMockMode(null);
  resetMockState();
  cleanup();
  await i18n.changeLanguage("tr");
});

const page = () => (
  <MantineProvider theme={theme}>
    <Notifications />
    <MemoryRouter>
      <ParametersPage />
    </MemoryRouter>
  </MantineProvider>
);

/** phi' and E approved from a correlation, then gamma changed by hand and approved: both stress keys fall. */
async function makeStress(): Promise<void> {
  await update_parameter_selection(PROFILE, LAYER, "phi_eff", { mode: "correlation", method_id: "mock_phi_eff_a" });
  await update_parameter_selection(PROFILE, LAYER, "E", { mode: "correlation", method_id: "mock_E_a" });
  await approve_parameters(PROFILE, LAYER, ["phi_eff", "E"]);
  await update_parameter_selection(PROFILE, LAYER, "gamma", { mode: "manual", manual_value: 21 });
  await approve_parameters(PROFILE, LAYER, ["gamma"]);
}

async function openStressLayer(): Promise<void> {
  render(page());
  await screen.findByTestId("param-card-phi_eff");
  fireEvent.click(screen.getByTestId(`params-layer-${LAYER}`));
  await waitFor(() => expect(screen.getByTestId(`params-layer-${LAYER}`)).toHaveAttribute("aria-current", "true"));
}

const sel = (extra: Partial<ParameterSelection>): ParameterSelection => ({ parameter: "phi_eff", approved: false, ...extra });

describe("stale helpers", () => {
  const stale = sel({
    approved_at: "2026-10-01T00:00:00Z",
    stale_reason: "stress_changed",
    selected: { value: 30, unit: "deg", method_id: "m", source: "SPT" },
    refreshed: { value: 31.5, unit: "deg", method_id: "m", source: "SPT" },
  });

  it("reason key and old to new difference only for a withdrawn approval", () => {
    expect(staleReasonKey(stale)).toBe("soil.params.stale_reason.stress_changed");
    expect(staleReasonKey(sel({}))).toBeNull();
    const diff = refreshedDiff(stale);
    expect(diff).toMatchObject({ oldValue: 30, newValue: 31.5, diff: 1.5 });
    expect(diff?.percent).toBeCloseTo(5, 6);
    expect(formatPercent(diff?.percent ?? null)).toBe("+5.0 %");
    expect(refreshedDiff({ ...stale, refreshed: null })).toBeNull();
  });

  it("puts gamma and gamma_sat first and keeps the rest in order", () => {
    const keys = ["phi_eff", "c_eff", "gamma_sat", "su", "gamma"] as const;
    const ordered = orderSelections(keys.map((parameter) => sel({ parameter })));
    expect(ordered.map((s) => s.parameter)).toEqual(["gamma", "gamma_sat", "phi_eff", "c_eff", "su"]);
  });
});

describe("withdrawn approval on the parameters page", () => {
  it("shows the stress reason and the old to new line, and re-approves one value at the refreshed value", async () => {
    await makeStress();
    await openStressLayer();

    expect(await screen.findByTestId("param-stale-reason-phi_eff")).toHaveTextContent(
      "The stress basis changed (γ, γsat or water table). This method uses σ′v.",
    );
    expect(screen.getByTestId("param-state-gamma")).toHaveTextContent("Approved");
    const line = screen.getByTestId("param-refreshed-phi_eff");
    expect(line).toHaveTextContent("Approved: 30 → Current: 30.8");
    expect(line).toHaveTextContent("+0.8");
    expect(line).toHaveTextContent("+2.7 %");

    fireEvent.click(screen.getByTestId("param-reapprove-phi_eff"));
    await waitFor(() => expect(screen.getByTestId("param-state-phi_eff")).toHaveTextContent("Approved"));
    expect(control.reapprovePayloads).toEqual([[{ layer_id: LAYER, key: "phi_eff", expected_value: 30.8 }]]);
    expect(screen.getByTestId("param-state-E")).toHaveTextContent("Needs refresh");
  });

  it("lists gamma and gamma_sat cards first", async () => {
    await openStressLayer();
    const order = screen
      .getAllByTestId(/^param-card-/)
      .map((el) => el.getAttribute("data-testid"))
      .slice(0, 3);
    expect(order).toEqual(["param-card-gamma", "param-card-gamma_sat", "param-card-phi_eff"]);
  });

  it("bulk review starts with nothing selected and submits only the ticked rows", async () => {
    await makeStress();
    await openStressLayer();
    fireEvent.click(await screen.findByTestId("params-review-stale"));

    const dialog = await screen.findByTestId("params-review");
    expect(within(dialog).getByTestId(`params-review-row-${LAYER}:phi_eff`)).toBeInTheDocument();
    expect(within(dialog).getByTestId(`params-review-row-${LAYER}:E`)).toBeInTheDocument();
    for (const box of within(dialog).getAllByRole("checkbox")) expect(box).not.toBeChecked();
    expect(screen.getByTestId("params-review-submit")).toBeDisabled();

    fireEvent.click(screen.getByTestId(`params-review-pick-${LAYER}:phi_eff`));
    expect(screen.getByTestId("params-review-submit")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("params-review-submit"));

    await waitFor(() => expect(screen.getByTestId("param-state-phi_eff")).toHaveTextContent("Approved"));
    expect(control.reapprovePayloads).toEqual([[{ layer_id: LAYER, key: "phi_eff", expected_value: 30.8 }]]);
    expect(screen.getByTestId("param-state-E")).toHaveTextContent("Needs refresh");
  });

  it("the review button is disabled while no withdrawn approval has a current value", async () => {
    await openStressLayer();
    expect(screen.getByTestId("params-review-stale")).toBeDisabled();
  });

  it("a moved value answers 409 reapprove_value_changed and nothing is approved", async () => {
    await makeStress();
    const error = await reapprove_parameters(PROFILE, [{ layer_id: LAYER, key: "phi_eff", expected_value: 99 }]).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("reapprove_value_changed");
    expect((error as ApiError).status).toBe(409);
  });
});

describe("unit weight guidance", () => {
  it("tells the engineer to approve unit weights first, and flags a missing gamma_sat below the water table", async () => {
    const profile = await get_profile(PROFILE);
    await update_profile(PROFILE, {
      ...profile,
      layers: profile.layers.map((l) => (l.id === LAYER ? { ...l, gamma_sat: null } : l)),
    });
    await openStressLayer();
    expect(await screen.findByTestId("params-unit-weight-first")).toHaveTextContent("Approve the unit weights first");
    expect(await screen.findByTestId("params-gamma-sat-missing")).toHaveTextContent("γsat is not entered");
  });
});
