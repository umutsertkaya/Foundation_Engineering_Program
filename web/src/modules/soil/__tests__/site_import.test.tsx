import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n, { loadLanguageCatalog } from "../../../app/i18n";
import { theme } from "../../../app/theme";
import { setMockMode } from "../../../shared/api/client";
import { SiteDataPage } from "../pages/SiteDataPage";

const calls: { url: string; method: string; body: unknown }[] = [];

beforeEach(async () => {
  setMockMode(false);
  await loadLanguageCatalog("tr");
  calls.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: init?.body });
    if (url.endsWith("/m/soil/investigations")) {
      return new Response(JSON.stringify({ boreholes: [], cpts: [] }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: "CPT-1", depth: [1], qc: [1], fs: [1] }), { status: 200 });
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setMockMode(null);
});

describe("site data import", () => {
  it("uploads a chosen CPT file as multipart form data", async () => {
    render(
      <MantineProvider theme={theme}>
        <MemoryRouter>
          <SiteDataPage />
        </MemoryRouter>
      </MantineProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: i18n.t("web.site.import_cpt") }));
    const dialog = await screen.findByRole("dialog");
    // Missing file and id are reported before any request is sent.
    fireEvent.click(within(dialog).getByRole("button", { name: i18n.t("web.site.import_submit") }));
    expect(await within(dialog).findByText(i18n.t("web.site.import_file_required"))).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);

    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["depth;qc;fs\n1;2;3\n"], "cpt1.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.change(within(dialog).getByLabelText(i18n.t("web.site.cpt_id")), { target: { value: "CPT-1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: i18n.t("web.site.import_submit") }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.url).toBe("/api/m/soil/import/cpt");
    const form = post.body as FormData;
    expect(form.get("sounding_id")).toBe("CPT-1");
    expect(form.get("qc_unit")).toBe("MPa");
    expect(form.get("delimiter")).toBe(";");
    expect(form.get("decimal")).toBe(",");
    expect((form.get("file") as File).name).toBe("cpt1.csv");
  });
});
