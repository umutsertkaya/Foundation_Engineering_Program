import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setMockMode } from "../../../shared/api/client";
import { mockRequest, resetMockState, resetMockStateEmptyProject } from "../../../shared/api/mock";
import { getMockStore } from "../../../shared/api/mock/legacy";
import type { Structure } from "../../../shared/api/types";
import "../../../app/i18n";
import { theme } from "../../../app/theme";
import { manifest } from "../manifest";
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

function seedSheetPile(id: string, name: string) {
  const store = getMockStore();
  const base = structuredClone(store.structures[0]) as unknown as Record<string, unknown>;
  store.structures.push({ ...base, id, name, kind: "sheet_pile" } as unknown as Structure);
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

  it("mock design: 501 for an existing sheet pile, 404 for an unknown id, unhandled otherwise", async () => {
    seedSheetPile("sp-1", "Perde A");
    const ok = await mockRequest("POST", "/m/sheet_pile/structures/sp-1/design");
    expect(ok.status).toBe(501);
    expect((ok.data as { code: string }).code).toBe("not_implemented");
    const missing = await mockRequest("POST", "/m/sheet_pile/structures/nope/design");
    expect(missing.status).toBe(404);
    const other = await mockRequest("GET", "/m/sheet_pile/whatever");
    expect(other.status).toBe(501);
  });

  it("nav list item stays active under s/", () => {
    expect(manifest.nav[0].matchPrefixes).toEqual(["s/"]);
  });
});
