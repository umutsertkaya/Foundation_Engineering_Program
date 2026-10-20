import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setMockMode } from "../../../shared/api/client";
import { resetMockState } from "../../../shared/api/mock";
import type { ParameterSelection } from "../../../shared/api/types";
import i18n from "../../../app/i18n";
import { theme } from "../../../app/theme";
import { ParametersPage } from "../pages/ParametersPage";
import { LatestGuard } from "../latest";

// The real api module with list_layer_parameters made controllable (fail / delay on demand).
const control = vi.hoisted(() => ({
  failFor: null as string | null,
  failWith: null as unknown,
  gate: null as Promise<void> | null,
  approveCalls: [] as { profile: string; layer: string }[],
}));

vi.mock("../api", async (importActual) => {
  const actual = await importActual<typeof import("../api")>();
  return {
    ...actual,
    list_layer_parameters: async (profileId: string, layerId: string): Promise<ParameterSelection[]> => {
      if (control.gate) await control.gate;
      if (control.failFor === `${profileId}/${layerId}`) throw control.failWith;
      return actual.list_layer_parameters(profileId, layerId);
    },
    approve_parameters: (profile: string, layer: string, keys: Parameters<typeof actual.approve_parameters>[2]) => {
      control.approveCalls.push({ profile, layer });
      return actual.approve_parameters(profile, layer, keys);
    },
  };
});

beforeEach(async () => {
  setMockMode(true);
  resetMockState();
  control.failFor = null;
  control.failWith = null;
  control.gate = null;
  control.approveCalls = [];
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
    <MemoryRouter>
      <ParametersPage />
    </MemoryRouter>
  </MantineProvider>
);

describe("LatestGuard", () => {
  it("only the newest token is current, so a slow earlier response is ignored", () => {
    const guard = new LatestGuard();
    const slow = guard.begin();
    const fast = guard.begin();
    expect(guard.isCurrent(slow)).toBe(false);
    expect(guard.isCurrent(fast)).toBe(true);
    guard.cancel();
    expect(guard.isCurrent(fast)).toBe(false);
  });
});

describe("ParametersPage keeps profile, layer and cards consistent", () => {
  it("a failed profile switch changes nothing: same profile, same layer, error shown, approvals go to that layer", async () => {
    render(page());
    await screen.findByTestId("param-card-phi_eff");
    fireEvent.click(screen.getByTestId("params-layer-L2"));
    await waitFor(() => expect(screen.getByTestId("params-layer-L2")).toHaveAttribute("aria-current", "true"));

    control.failFor = "prof-mock-2/S2";
    control.failWith = new Error("boom");
    fireEvent.change(screen.getByTestId("params-profile"), { target: { value: "prof-mock-2" } });
    // A plain Error (not an ApiError) is surfaced with the generic title instead of being swallowed.
    const alert = await screen.findByTestId("soil-error");
    expect(alert).toHaveTextContent("Unexpected error");
    expect(alert).toHaveTextContent("boom");
    expect(screen.getByTestId("params-profile")).toHaveValue("prof-mock-1");
    expect(screen.getByTestId("params-layer-L2")).toHaveAttribute("aria-current", "true");
    expect(screen.queryByTestId("params-layer-S1")).toBeNull();

    // Approving now still targets prof-mock-1 / L2, i.e. what the cards show.
    fireEvent.click(within(screen.getByTestId("param-card-phi_eff")).getByRole("radio", { name: "Suggestion" }));
    fireEvent.click(screen.getByTestId("param-apply-phi_eff"));
    await waitFor(() => expect(screen.getByTestId("param-approve-phi_eff")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("param-approve-phi_eff"));
    await waitFor(() => expect(control.approveCalls).toEqual([{ profile: "prof-mock-1", layer: "L2" }]));
  });

  it("navigation is disabled while a request is in flight and the snapshot commits only when it completes", async () => {
    render(page());
    await screen.findByTestId("param-card-phi_eff");
    let release: () => void = () => undefined;
    control.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    fireEvent.click(screen.getByTestId("params-suggest-all"));
    await waitFor(() => expect(screen.getByTestId("params-profile")).toBeDisabled());
    expect(screen.getByTestId("params-layer-L3")).toBeDisabled();
    fireEvent.click(screen.getByTestId("params-layer-L3")); // ignored while busy
    expect(screen.getByTestId("params-layer-L1")).toHaveAttribute("aria-current", "true");
    release();
    await waitFor(() => expect(screen.getByTestId("params-profile")).not.toBeDisabled());
    expect(screen.getByTestId("params-layer-L1")).toHaveAttribute("aria-current", "true");
  });
});
