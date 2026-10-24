import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setMockMode } from "../../../shared/api/client";
import { getMockStore, mockRequest, resetMockState } from "../../../shared/api/mock";
import type { LayeringProposal, SoilProfile } from "../../../shared/api/types";
import i18n from "../../../app/i18n";
import { theme } from "../../../app/theme";
import { LayeringModal, type LayeringKind } from "../components/LayeringModal";

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
  fireEvent.change(screen.getByTestId(testId) as HTMLInputElement, { target: { value } });
}

function open(kind: LayeringKind) {
  const onCreated = vi.fn();
  render(wrap(<LayeringModal kind={kind} onClose={vi.fn()} onCreated={onCreated} />));
  return { onCreated };
}

async function propose() {
  const button = await screen.findByTestId("layering-propose");
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.click(button);
  await screen.findByTestId("layering-proposal");
}

async function proposeCombined() {
  const method = await screen.findByTestId("layering-method");
  await waitFor(() => expect(screen.getByTestId("layering-source")).toHaveValue("CPT-M1"));
  fireEvent.change(method, { target: { value: "combined" } });
  expect(screen.getByTestId("layering-propose")).toBeDisabled(); // no borehole chosen yet
  fireEvent.click(await screen.findByTestId("layering-borehole-SK-M1"));
  await propose();
}

describe("gamma columns (HS-F F1)", () => {
  it("SPT: a Bowles suggestion is pre-filled, editable, labelled with its range; layers without one stay empty and required", async () => {
    const store = getMockStore();
    store.boreholes[0] = { ...store.boreholes[0], log: [
      { top: 0, bottom: 2.5, uscs: "SM", description: "silty sand" },
      { top: 2.5, bottom: 10, uscs: "CL", description: "clay" },
    ] };
    open("spt");
    await propose();
    const rows = screen.getAllByTestId(/^layering-row-/);
    const prefilled = rows.findIndex((_, i) => (screen.getByTestId(`layering-gamma-${i}`) as HTMLInputElement).value !== "");
    expect(prefilled).toBeGreaterThanOrEqual(0);
    expect(screen.getByTestId(`layering-gamma-source-${prefilled}`)).toHaveTextContent("SPT table (Bowles 1996), range 17–20");
    expect(screen.getByTestId(`layering-gamma-${prefilled}`)).toHaveValue("18.5");
    const empty = rows.findIndex((_, i) => (screen.getByTestId(`layering-gamma-${i}`) as HTMLInputElement).value === "");
    expect(empty).toBeGreaterThanOrEqual(0);
    expect(screen.getByTestId("layering-create")).toBeDisabled();
    typeInto(`layering-gamma-${prefilled}`, "19");
    expect(screen.getByTestId(`layering-gamma-${prefilled}`)).toHaveValue("19");
  });

  it("CPT: gamma_sat is editable and may be left empty; below the groundwater table an empty cell is flagged", async () => {
    const { onCreated } = open("cpt");
    await propose();
    expect(screen.getByTestId("layering-gamma-sat-1")).toHaveValue("18.5");
    // The mock groundwater table is 3 m: layer 3 (about 6.5-10 m) lies below it.
    expect(screen.queryByTestId("layering-gamma-sat-missing-2")).toBeNull();
    typeInto("layering-gamma-sat-2", "");
    fireEvent.blur(screen.getByTestId("layering-gamma-sat-2"));
    expect(await screen.findByTestId("layering-gamma-sat-missing-2")).toHaveTextContent("γsat");
    typeInto("layering-gamma-sat-1", "19.1");
    fireEvent.blur(screen.getByTestId("layering-gamma-sat-1"));
    await waitFor(() => expect(screen.getByTestId("layering-gamma-sat-source-1")).toHaveTextContent("Manual"));
    await waitFor(() => expect(screen.getByTestId("layering-create")).not.toBeDisabled()); // gamma_sat is optional
    fireEvent.click(screen.getByTestId("layering-create"));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    const created = onCreated.mock.calls[0][0] as SoilProfile;
    expect(created.layers[1].gamma_sat).toBe(19.1);
    expect(created.layers[2].gamma_sat).toBeUndefined();
  });

  it("a refresh after leaving a cell keeps every hand-typed cell", async () => {
    open("cpt");
    await propose();
    typeInto("layering-gamma-0", "17.7");
    fireEvent.blur(screen.getByTestId("layering-gamma-0"));
    await waitFor(() => expect(screen.getByTestId("layering-gamma-source-0")).toHaveTextContent("Manual"));
    typeInto("layering-gamma-2", "20.5");
    fireEvent.blur(screen.getByTestId("layering-gamma-2"));
    await waitFor(() => expect(screen.getByTestId("layering-gamma-source-2")).toHaveTextContent("Manual"));
    expect(screen.getByTestId("layering-gamma-0")).toHaveValue("17.7");
    expect(screen.getByTestId("layering-gamma-2")).toHaveValue("20.5");
    expect(screen.getByTestId("layering-gamma-source-1")).toHaveTextContent("CPT (Robertson & Cabal 2010)");
  });

  it("all gamma source labels are localised", async () => {
    await i18n.changeLanguage("tr");
    expect(i18n.t("soil.layering.gamma_source.lab")).toBe("Lab ölçümü");
    expect(i18n.t("soil.layering.gamma_source.phase")).toBe("Faz bağıntısı (w, Gs)");
    expect(i18n.t("soil.layering.gamma_source.cpt_rc2010")).toBe("CPT (Robertson & Cabal 2010)");
    expect(i18n.t("soil.layering.gamma_source.spt_bowles", { low: 17, high: 20 })).toBe("SPT tablo (Bowles 1996), aralık 17–20");
    expect(i18n.t("soil.layering.gamma_source.user")).toBe("Elle");
  });
});

describe("combined layering (HS-F F2)", () => {
  it("shows distance, boundary sources and a conflict row; Create stays disabled until the conflict is resolved", async () => {
    const { onCreated } = open("cpt");
    await proposeCombined();

    expect(screen.getByTestId("layering-distance-SK-M1")).toHaveTextContent("SK-M1: 5.4 m from the CPT");
    expect(screen.queryByTestId("layering-not-aligned")).toBeNull(); // both elevations are known
    expect(screen.getByTestId("layering-boundary-0")).toHaveTextContent("Both");
    expect(screen.getByTestId("layering-boundary-1")).toHaveTextContent("CPT");

    expect(screen.getByTestId("layering-row-1")).toHaveAttribute("data-conflict", "true");
    expect(screen.getByTestId("layering-conflict-1")).toHaveTextContent("CPT: sand-like (Ic 1.9) — Lab/log: CL");
    const create = screen.getByTestId("layering-create");
    expect(create).toBeDisabled();
    expect(screen.getByTestId("layering-create-hint")).toHaveTextContent("choose which data applies");

    fireEvent.click(screen.getByTestId("layering-resolution-1-cpt"));
    await waitFor(() => expect(create).not.toBeDisabled());
    expect(screen.getByTestId("layering-create-hint")).toHaveTextContent("");
    fireEvent.click(create);
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    const created = onCreated.mock.calls[0][0] as SoilProfile;
    expect(created.source_ids).toEqual(["CPT-M1", "SK-M1"]);
    expect(created.origin).toBe("mixed");
    expect(created.layering?.method).toBe("combined");
    // "Follow CPT" was sent as the resolution: the contradicting USCS symbol is dropped.
    expect(created.layers[1].uscs).toBeNull();
    expect(created.layers[1].behaviour).toBe("drained");
  });

  it("resolution 'uscs' keeps the USCS symbol and its behaviour", async () => {
    const { onCreated } = open("cpt");
    await proposeCombined();
    fireEvent.click(screen.getByTestId("layering-resolution-1-uscs"));
    await waitFor(() => expect(screen.getByTestId("layering-create")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("layering-create"));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect((onCreated.mock.calls[0][0] as SoilProfile).layers[1].uscs).toBe("CL");
  });

  it("warns when elevations are missing and says 'no coordinates' for a borehole without them", async () => {
    const store = getMockStore();
    store.boreholes[0] = { ...store.boreholes[0], elevation: null, x: null, y: null };
    open("cpt");
    await proposeCombined();
    expect(screen.getByTestId("layering-not-aligned")).toHaveTextContent(
      "Elevations are missing: depths were combined without alignment.",
    );
    expect(screen.getByTestId("layering-distance-SK-M1")).toHaveTextContent("SK-M1: no coordinates");
    expect(screen.getByTestId("layering-warnings").textContent).toContain("ground elevations are missing");
  });

  it("the server refuses a profile with an unresolved conflict (422 layering_conflict_unresolved)", async () => {
    const res = await mockRequest("POST", "/m/soil/layering/combined", {
      cpt_id: "CPT-M1", borehole_ids: ["SK-M1"], settings: { method: "combined" },
    });
    const proposal = res.data as LayeringProposal;
    expect(proposal.layers[1].conflict).toBeTruthy();
    const layers = proposal.layers.map((l) => ({ ...l, gamma_suggested: l.gamma_suggested ?? 18 }));
    const create = await mockRequest("POST", "/m/soil/profiles", {
      name: "P", origin: "mixed", source_ids: proposal.source_ids, gwt: { depth_insitu: 3 },
      from_proposal: { ...proposal, layers },
    });
    expect(create.status).toBe(422);
    expect((create.data as { code: string }).code).toBe("layering_conflict_unresolved");
  });
});
