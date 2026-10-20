import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setMockMode } from "../../../shared/api/client";
import { resetCoreMock } from "../../../shared/api/mock/core";
import { mockRequest, resetMockState, resetMockStateEmptyProject } from "../../../shared/api/mock";
import { getMockStore } from "../../../shared/api/mock/store";
import type { Structure } from "../../../shared/api/types";
import type { SheetPileResultDTO } from "../../../shared/api/types";
import "../../../app/i18n";
import { theme } from "../../../app/theme";
import { manifest } from "../manifest";
import { ResultPanel } from "../components/ResultPanel";
import Root from "../Root";

function Loc() {
  return <div data-testid="loc">{useLocation().pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <MantineProvider theme={theme}>
      <MemoryRouter initialEntries={[path]}>
        <Loc />
        <Routes>
          <Route path="/m/sheet_pile/*" element={<Root />} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

function seedSheetPile(id: string, name: string, support: "cantilever" | "anchored" = "cantilever") {
  const store = getMockStore();
  const profile = structuredClone(store.profiles[0]);
  profile.layers = [{ id: "L1", top: 0, bottom: 12, gamma: 18, design: { phi_eff: 30, c_eff: 0 } }];
  store.structures.push({
    kind: "sheet_pile",
    id,
    name,
    support,
    retained_height: 4,
    anchor_depth: support === "anchored" ? 1 : null,
    surcharge: 0,
    allowable_stress_mpa: 160,
    soil: { source_profile_id: store.profiles[0].id, source_hash: "h", profile },
  } as unknown as Structure);
}

describe("sheet_pile shell (mock)", () => {
  beforeEach(() => {
    setMockMode(true);
    resetMockState();
  });
  afterEach(() => {
    setMockMode(null);
  });

  it("lists only sheet pile structures", async () => {
    const first = getMockStore().structures[0] as { id: string; name?: string };
    const wallName = first.name ?? first.id;
    seedSheetPile("sp-1", "Perde A");
    renderAt("/m/sheet_pile");
    expect(await screen.findByText("Perde A")).toBeInTheDocument();
    expect(screen.queryByText(wallName)).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no sheet piles", async () => {
    resetMockStateEmptyProject();
    renderAt("/m/sheet_pile");
    expect(await screen.findByText("Henüz palplanş perdesi yok")).toBeInTheDocument();
  });

  it("row click opens the detail page, which can go back", async () => {
    seedSheetPile("sp-1", "Perde A");
    renderAt("/m/sheet_pile");
    fireEvent.click(await screen.findByText("Perde A"));
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/m/sheet_pile/s/sp-1"));
    expect(await screen.findByRole("heading", { name: "Perde A" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Listeye dön" }));
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/m/sheet_pile"));
  });

  it("detail shows not-found for an unknown sid", async () => {
    renderAt("/m/sheet_pile/s/nope");
    expect(await screen.findByText("Palplanş perdesi bulunamadı")).toBeInTheDocument();
  });

  it("mock design: 202 job for an existing sheet pile, 404 for an unknown id, unhandled otherwise", async () => {
    seedSheetPile("sp-1", "Perde A");
    const ok = await mockRequest("POST", "/m/sheet_pile/structures/sp-1/design");
    expect(ok.status).toBe(202);
    const job = await mockRequest("GET", `/jobs/${(ok.data as { job_id: string }).job_id}`);
    expect((job.data as { kind: string }).kind).toBe("sheet_pile");
    const missing = await mockRequest("POST", "/m/sheet_pile/structures/nope/design");
    expect(missing.status).toBe(404);
    const other = await mockRequest("GET", "/m/sheet_pile/whatever");
    expect(other.status).toBe(501);
  });

  it("mock design: 409 no_project_open when no project is open", async () => {
    seedSheetPile("sp-1", "Perde A");
    await mockRequest("POST", "/project/close");
    const res = await mockRequest("POST", "/m/sheet_pile/structures/sp-1/design");
    expect(res.status).toBe(409);
    expect((res.data as { code: string }).code).toBe("no_project_open");
    resetCoreMock();
  });

  it("nav list item stays active under s/", () => {
    expect(manifest.nav[0].matchPrefixes).toEqual(["s/", "new"]);
  });

  it("detail shows inputs, source profile and runs the mock job to a result with units", async () => {
    seedSheetPile("sp-2", "Perde B", "anchored");
    const view = renderAt("/m/sheet_pile/s/sp-2");
    expect(await screen.findByRole("heading", { name: "Perde B" })).toBeInTheDocument();
    expect(screen.getByTestId("soil-source").textContent).toContain(getMockStore().profiles[0].id);
    fireEvent.click(screen.getByRole("button", { name: "Tasarımı çalıştır" }));
    expect(await screen.findByTestId("job-progress")).toBeInTheDocument();
    expect(await screen.findByTestId("sheet-pile-result", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText("MOCK")).toBeInTheDocument();
    expect(screen.getByText("kNm/m")).toBeInTheDocument();
    expect(screen.getAllByText("kN/m").length).toBeGreaterThan(0);
    expect(screen.getByText("Ankraj kuvveti")).toBeInTheDocument();
    expect(screen.getByText("cm³/m")).toBeInTheDocument();
    // source profile untouched
    const st = getMockStore().structures.find((x) => x.id === "sp-2") as unknown as { soil: { source_profile_id: string } };
    expect(st.soil.source_profile_id).toBe(getMockStore().profiles[0].id);
    view.unmount();
    renderAt("/m/sheet_pile/s/sp-2");
    expect(await screen.findByText("Kaydedilmiş sonuç")).toBeInTheDocument();
    expect(screen.getByTestId("sheet-pile-result")).toBeInTheDocument();
  });

  it("renders a compact series table for 4000 result points", () => {
    const z = Array.from({ length: 4000 }, (_, index) => index * 0.002);
    const result: SheetPileResultDTO = {
      structure_id: "sp-dense",
      support: "cantilever",
      H: 4,
      D0: 2,
      D: 3,
      total_length: 7,
      anchor_depth: null,
      anchor_force: null,
      toe_force: 10,
      M_max: 120,
      z_M_max: z[1500],
      z,
      shear: z.map((depth) => Math.sin(depth)),
      moment: z.map((_, index) => (index === 1500 ? -120 : Math.sin(z[index]))),
      net: z.map((depth) => depth),
      section_modulus_cm3: 750,
      assumptions: [],
      warnings: [],
    };
    render(
      <MantineProvider theme={theme}>
        <ResultPanel result={result} />
      </MantineProvider>,
    );
    const rows = screen.getByTestId("result-series").querySelectorAll("tbody tr");
    expect(rows.length).toBeLessThanOrEqual(80);
    expect(rows.length).toBeLessThan(4000);
  });

  it("refreshes stale summary after saving changed inputs and keeps old result dimmed", async () => {
    seedSheetPile("sp-stale", "Perde Stale");
    renderAt("/m/sheet_pile/s/sp-stale");
    fireEvent.click(await screen.findByRole("button", { name: "Tasarımı çalıştır" }));
    await screen.findByTestId("sheet-pile-result", {}, { timeout: 5000 });
    fireEvent.change(screen.getByLabelText(/Sürşarj/), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    expect(await screen.findByText(/Girdiler değişti/)).toBeInTheDocument();
    expect(screen.getByTestId("sheet-pile-result").parentElement).toHaveStyle({ opacity: "0.5" });
  });

  it("preserves form edits made while the job is running", async () => {
    seedSheetPile("sp-edit-during-job", "Perde Edit");
    renderAt("/m/sheet_pile/s/sp-edit-during-job");
    fireEvent.click(await screen.findByRole("button", { name: "Tasarımı çalıştır" }));
    const surcharge = await screen.findByLabelText(/Sürşarj/);
    fireEvent.change(surcharge, { target: { value: "17" } });
    await screen.findByTestId("sheet-pile-result", {}, { timeout: 5000 });
    expect(surcharge).toHaveValue("17");
  });

  it("hides toe force for anchored results and explains the theoretical toe series", async () => {
    seedSheetPile("sp-toe", "Perde Toe", "anchored");
    renderAt("/m/sheet_pile/s/sp-toe");
    fireEvent.click(await screen.findByRole("button", { name: "Tasarımı çalıştır" }));
    await screen.findByTestId("sheet-pile-result", {}, { timeout: 5000 });
    expect(screen.queryByText("Uç kuvveti")).not.toBeInTheDocument();
    expect(screen.getByText(/teorik uçta/)).toBeInTheDocument();
  });

  it("does not offer source resync for a manual-soil wall when the result is stale", async () => {
    renderAt("/m/sheet_pile/new");
    fireEvent.change(await screen.findByLabelText("Ad"), { target: { value: "Elle" } });
    fireEvent.change(screen.getByLabelText(/Tutulan yükseklik/), { target: { value: "4" } });
    fireEvent.click(screen.getByText("Elle gir"));
    fireEvent.change(screen.getByLabelText(/Yeraltı suyu/), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Alt (m) 1"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText(/γ \(kN\/m³\) 1/), { target: { value: "18" } });
    fireEvent.change(screen.getByLabelText(/φ' \(°\) 1/), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Oluştur" }));
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toMatch(/^\/m\/sheet_pile\/s\/pile-mock-/));
    fireEvent.click(await screen.findByRole("button", { name: "Tasarımı çalıştır" }));
    await screen.findByTestId("sheet-pile-result", {}, { timeout: 5000 });
    fireEvent.change(screen.getByLabelText(/Sürşarj/), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    expect(await screen.findByText(/Girdiler değişti/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kaynak profille eşitle" })).not.toBeInTheDocument();
  });

  it("cancel stops the job; an unknown job is shown as unavailable", async () => {
    seedSheetPile("sp-3", "Perde C");
    renderAt("/m/sheet_pile/s/sp-3");
    fireEvent.click(await screen.findByRole("button", { name: "Tasarımı çalıştır" }));
    await screen.findByTestId("job-progress");
    fireEvent.click(await screen.findByRole("button", { name: "İptal et" }));
    expect(await screen.findByText("Hesap iptal edildi.")).toBeInTheDocument();
  });

  it("unknown job id shows unavailable", async () => {
    seedSheetPile("sp-4", "Perde D");
    renderAt("/m/sheet_pile/s/sp-4?job=nope");
    expect(await screen.findByText(/artık mevcut değil/)).toBeInTheDocument();
  });

  it("detail blocks the run and lists the missing design phi", async () => {
    seedSheetPile("sp-5", "Perde E");
    const st = getMockStore().structures.find((x) => x.id === "sp-5") as unknown as {
      soil: { profile: { layers: { design?: unknown }[] } };
    };
    st.soil.profile.layers[0].design = {};
    renderAt("/m/sheet_pile/s/sp-5");
    expect(await screen.findByTestId("missing-inputs")).toHaveTextContent("tasarım φ' değeri eksik");
    expect(screen.getByRole("button", { name: "Tasarımı çalıştır" })).toBeDisabled();
  });

  it("create form lists missing inputs explicitly and posts nothing", async () => {
    renderAt("/m/sheet_pile/new");
    fireEvent.click(await screen.findByRole("button", { name: "Oluştur" }));
    const list = await screen.findByTestId("missing-inputs");
    expect(list).toHaveTextContent("Ad girilmedi.");
    expect(list).toHaveTextContent("Tutulan yükseklik girilmedi.");
    expect(list).toHaveTextContent("Kaynak profil seçilmedi.");
  });

  it("blocks create when H is outside the server range", async () => {
    renderAt("/m/sheet_pile/new");
    fireEvent.change(await screen.findByLabelText("Ad"), { target: { value: "Too short" } });
    fireEvent.change(screen.getByLabelText(/Tutulan yükseklik/), { target: { value: "0.3" } });
    fireEvent.click(screen.getByRole("button", { name: "Oluştur" }));
    expect(await screen.findByTestId("missing-inputs")).toHaveTextContent("H, 0,5 m'den büyük");
    expect(screen.getByTestId("loc")).toHaveTextContent("/m/sheet_pile/new");
  });

  it("create (manual soil) sends a manual soil without a source profile and opens the detail", async () => {
    renderAt("/m/sheet_pile/new");
    fireEvent.change(await screen.findByLabelText("Ad"), { target: { value: "Yeni" } });
    fireEvent.change(screen.getByLabelText(/Tutulan yükseklik/), { target: { value: "4" } });
    fireEvent.click(screen.getByText("Elle gir"));
    fireEvent.change(screen.getByLabelText(/Yeraltı suyu/), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Alt (m) 1"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("γ (kN/m³) 1"), { target: { value: "18" } });
    fireEvent.change(screen.getByLabelText("φ' (°) 1"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Oluştur" }));
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toMatch(/^\/m\/sheet_pile\/s\/pile-mock-\d+$/));
    const created = getMockStore().structures.at(-1) as unknown as { kind: string; name: string; soil: { source_profile_id: unknown } };
    expect(created.kind).toBe("sheet_pile");
    expect(created.name).toBe("Yeni");
    expect(created.soil.source_profile_id).toBeNull();
  });

  it("shows advanced inputs collapsed, hides anchors for cantilever and sends changed design values", async () => {
    renderAt("/m/sheet_pile/new");
    expect(screen.queryByLabelText("Ankraj aralığı (m)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Gelişmiş girdiler"));
    expect(screen.queryByLabelText("Ankraj aralığı (m)")).not.toBeInTheDocument();
    const frontWater = await screen.findByLabelText("Ön su derinliği (m)");
    fireEvent.change(await screen.findByLabelText("Gömülme artışı"), { target: { value: "0.35" } });
    fireEvent.change(frontWater, { target: { value: "2.5" } });
    fireEvent.change(await screen.findByLabelText("Ad"), { target: { value: "Advanced" } });
    fireEvent.change(screen.getByLabelText(/Tutulan yükseklik/), { target: { value: "4" } });
    fireEvent.click(screen.getByText("Elle gir"));
    fireEvent.change(screen.getByLabelText(/Yeraltı suyu/), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Alt (m) 1"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("γ (kN/m³) 1"), { target: { value: "18" } });
    fireEvent.change(screen.getByLabelText("φ' (°) 1"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Oluştur" }));
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toMatch(/pile-mock/));
    const created = getMockStore().structures.at(-1) as unknown as { depth_increase: number; front_water_depth: number; anchor_spacing: unknown; design_code: string };
    expect(created).toMatchObject({ depth_increase: 0.35, front_water_depth: 2.5, anchor_spacing: null, design_code: "asd" });
  });

  it("renders the stored design basis with effective embedment increase", async () => {
    seedSheetPile("sp-basis", "Perde Esas");
    const structure = getMockStore().structures.find((x) => x.id === "sp-basis") as unknown as { design_code: string; approach: null; analysis_level: "basic"; depth_increase: null; front_water_depth: null };
    Object.assign(structure, { design_code: "asd", approach: null, analysis_level: "basic", depth_increase: null, front_water_depth: null });
    renderAt("/m/sheet_pile/s/sp-basis");
    fireEvent.click(await screen.findByRole("button", { name: "Tasarımı çalıştır" }));
    expect(await screen.findByTestId("sheet-pile-result", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId("design-basis")).toHaveTextContent("Tasarım esası");
    expect(screen.getByTestId("design-basis")).toHaveTextContent("Servis varsayılanı");
    expect(screen.getByTestId("design-basis")).toHaveTextContent("20,0%");
  });
});
