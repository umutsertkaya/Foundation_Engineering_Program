import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n, { loadLanguageCatalog } from "../../../app/i18n";
import { theme } from "../../../app/theme";
import { setMockMode } from "../../../shared/api/client";
import { SiteDataPage } from "../pages/SiteDataPage";

const calls: { url: string; body: unknown }[] = [];
const plan = (blocked: boolean) => ({
  filename: "Example.xlsx",
  sheets: [{
    name: "SPT", role: "spt", confidence: 1, header_row: 0, row_count: 3, headers: ["Depth", "N"],
    columns: { depth: { header: "Depth", unit: "m", unit_source: "default" }, n: { header: "N", unit: null, unit_source: "default" } },
  }],
  options: { cu_failure: "max_stress_ratio", cu_strain_limit: 15, u2_zero_is_missing: true, sampler_map: {} },
  issues: blocked
    ? [{ code: "import.issue.energy_ratio_missing", severity: "blocker", sheet: "SPT", params: {} }]
    : [{ code: "import.issue.energy_ratio_missing", severity: "info", sheet: "SPT", params: {} }],
});

beforeEach(async () => {
  setMockMode(false);
  await loadLanguageCatalog("tr");
  calls.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body });
    if (url.endsWith("/m/soil/investigations")) return new Response(JSON.stringify({ boreholes: [], cpts: [] }), { status: 200 });
    if (url.endsWith("/analyze")) return new Response(JSON.stringify(plan(true)), { status: 200 });
    if (url.endsWith("/check")) return new Response(JSON.stringify(plan(false)), { status: 200 });
    return new Response(JSON.stringify({ boreholes: [{ id: "BH-1" }], cpts: [], warnings: ["import.warning.u2_not_measured: sheet=\"CPT\""] }), { status: 200 });
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setMockMode(null);
});

describe("workbook import wizard", () => {
  it("analyses, blocks on open questions, re-checks after an edit and commits", async () => {
    render(
      <MantineProvider theme={theme}>
        <MemoryRouter><SiteDataPage /></MemoryRouter>
      </MantineProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: i18n.t("web.import.open") }));
    const dialog = await screen.findByRole("dialog");
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "Example.xlsx")] } });

    const issues = await within(dialog).findByTestId("import-issues");
    expect(issues.textContent).toContain(i18n.t("import.issue.energy_ratio_missing"));
    const submit = within(dialog).getByRole("button", { name: i18n.t("web.site.import_submit") });
    expect(submit).toBeDisabled();
    expect(calls.at(-1)!.url).toBe("/api/m/soil/import/workbook/analyze");

    fireEvent.click(within(dialog).getByRole("button", { name: i18n.t("web.import.check") }));
    await waitFor(() => expect(submit).toBeEnabled());
    const checked = calls.at(-1)!;
    expect(checked.url).toBe("/api/m/soil/import/workbook/check");
    expect(JSON.parse((checked.body as FormData).get("plan") as string).sheets[0].role).toBe("spt");

    fireEvent.click(submit);
    const summary = await within(dialog).findByTestId("import-summary");
    expect(summary.textContent).toContain("1");
    expect(calls.some((c) => c.url.endsWith("/commit"))).toBe(true);
  });
});
