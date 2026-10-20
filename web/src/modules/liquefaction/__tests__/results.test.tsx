import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import trModule from "../../../../../geotek/modules/liquefaction/i18n/tr.json";
import enModule from "../../../../../geotek/modules/liquefaction/i18n/en.json";
import "../../../app/i18n";
import { theme } from "../../../app/theme";
import * as client from "../../../shared/api/client";
import type { LiquefactionResultDTO } from "../../../shared/api/types";
import * as moduleApi from "../api";
import { DepthChart } from "../components/DepthChart";
import { ResultsPage } from "../pages/ResultsPage";

const tr = trModule as Record<string, string>;
const label = (key: string) => tr[`liquefaction.results.${key}`];
const color = "var(--mantine-color-blue-6)";
const chartProps = {
  ariaLabel: label("chart_fs"), xLabel: label("fs_dimensionless"), yLabel: label("depth_m"),
};

beforeAll(() => {
  // jsdom lacks scrollIntoView, which the Mantine combobox calls.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => vi.restoreAllMocks());

describe("DepthChart", () => {
  it.each([
    { depth: [], values: [] },
    { depth: [null, null], values: [0.8, 1.2] },
    { depth: [1, 2], values: [null, null] },
  ])("handles empty or missing coordinates: %j", ({ depth, values }) => {
    const { container } = render(<DepthChart {...chartProps} depth={depth}
      series={[{ label: label("fs"), values, color }]} />);
    expect(screen.getByRole("img", { name: label("chart_fs") })).toBeInTheDocument();
    expect(screen.getByText(label("no_chart_data"))).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
    expect(container.querySelectorAll("circle")).toHaveLength(0);
  });

  it("draws no reference line when there is no finite data", () => {
    const { container } = render(<DepthChart {...chartProps} depth={[1, 2]} reference={{ value: 1, label: label("fs_reference") }}
      series={[{ label: label("fs"), values: [null, null], color }]} />);
    expect(screen.getByText(label("no_chart_data"))).toBeInTheDocument();
    expect(screen.queryByText(label("fs_reference"))).not.toBeInTheDocument();
    expect(container.querySelector('path[stroke-dasharray="3 4"]')).not.toBeInTheDocument();
  });

  it("breaks lines at null values and null depths, retaining isolated points", () => {
    const { container } = render(<DepthChart {...chartProps} depth={[1, 2, 3, 4, null, 6]}
      series={[{ label: label("fs"), values: [0.8, 1.1, null, 1.3, 1.4, 1.5], color }]} />);
    const path = container.querySelector(`path[stroke="${color}"]`)!.getAttribute("d")!;
    expect(path.match(/M/g)).toHaveLength(3);
    expect(path.match(/L/g)).toHaveLength(1);
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(4);
    expect(Number(circles[0].getAttribute("cy"))).toBeLessThan(Number(circles[3].getAttribute("cy")));
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  });
});

const result: LiquefactionResultDTO = {
  per_sounding: {
    "BH-1": {
      depth: [1, 2, null], CSR: [0.1234, null, 0.3], CRR: [0.098, 0.25, null], FS: [0.8, null, null],
      status: ["liquefiable", "above_gwt", "invalid"], warnings: ["mock_result_not_a_calculation"],
    },
    "BH-2": {
      depth: [4], CSR: [0.2], CRR: [0.3], FS: [1.5], status: ["safe"], warnings: [],
    },
  },
  errors: {},
};

function renderResults(data = result) {
  vi.spyOn(client, "get_job").mockResolvedValue({
    job_id: "test-job", kind: "liquefaction", status: "done", progress: 1,
    message_key: null, result: data, error: null,
  });
  return render(
    <MantineProvider theme={theme}>
      <MemoryRouter initialEntries={["/m/liquefaction/results?job=test-job"]}>
        <ResultsPage />
      </MemoryRouter>
    </MantineProvider>,
  );
}

function renderStored(entry: string) {
  return render(
    <MantineProvider theme={theme}>
      <MemoryRouter initialEntries={[entry]}>
        <ResultsPage />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe("stored liquefaction result (no job in the URL)", () => {
  it("loads the result saved in the project and flags it when outdated", async () => {
    vi.spyOn(moduleApi, "get_liquefaction_result").mockResolvedValue({
      profile_id: "P1", settings: { method: "bi2014", amax_g: 0.3, mw: 7.5, target_fs: 1.1, c_fc: 0, ic_cutoff: 2.6 },
      result, stale: true,
    });
    renderStored("/m/liquefaction/results");
    await screen.findByRole("img", { name: label("chart_fs") });
    expect(screen.getByTestId("liq-stale")).toHaveTextContent(label("stale"));
  });

  it("shows no stale notice for a current result", async () => {
    vi.spyOn(moduleApi, "get_liquefaction_result").mockResolvedValue({
      profile_id: "P1", settings: { method: "bi2014", amax_g: 0.3, mw: 7.5, target_fs: 1.1, c_fc: 0, ic_cutoff: 2.6 },
      result, stale: false,
    });
    renderStored("/m/liquefaction/results");
    await screen.findByRole("img", { name: label("chart_fs") });
    expect(screen.queryByTestId("liq-stale")).not.toBeInTheDocument();
  });

  it("keeps the empty state when the project has no saved result", async () => {
    vi.spyOn(moduleApi, "get_liquefaction_result").mockRejectedValue(
      new client.ApiError(404, { code: "not_found", message: "none", details: {}, missing_factors: [] }));
    renderStored("/m/liquefaction/results");
    expect(await screen.findByText(label("no_job"))).toBeInTheDocument();
  });

  it("falls back to the saved result when the job is gone", async () => {
    vi.spyOn(client, "get_job").mockRejectedValue(
      new client.ApiError(404, { code: "not_found", message: "gone", details: {}, missing_factors: [] }));
    vi.spyOn(moduleApi, "get_liquefaction_result").mockResolvedValue({
      profile_id: "P1", settings: { method: "bi2014", amax_g: 0.3, mw: 7.5, target_fs: 1.1, c_fc: 0, ic_cutoff: 2.6 },
      result, stale: false,
    });
    renderStored("/m/liquefaction/results?job=old");
    await screen.findByRole("img", { name: label("chart_fs") });
  });
});

describe("liquefaction result details", () => {
  it("preserves the summary, displays DTO rows and two labelled charts, and selects soundings", async () => {
    const { container } = renderResults();
    const fsChart = await screen.findByRole("img", { name: label("chart_fs") });
    const ratiosChart = screen.getByRole("img", { name: label("chart_csr_crr") });
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByRole("columnheader", { name: label("min_fs") })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: label("detail_table") });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    const cells = within(within(table).getAllByRole("row")[1]).getAllByRole("cell");
    expect(cells.map((cell) => cell.textContent)).toEqual([
      "1.000", "0.123", "0.098", "0.800", label("status.liquefiable"), label("mock_note"),
    ]);
    expect(within(table).getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getAllByText(label("mock_note")).length).toBeGreaterThan(0);
    expect(within(fsChart).getByText(label("fs_reference"))).toBeInTheDocument();
    expect(fsChart.querySelector('circle[r="5"]')).toBeInTheDocument();
    expect(ratiosChart.querySelector('path[stroke-dasharray="7 4"]')).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);

    fireEvent.click(screen.getByRole("textbox", { name: label("select_sounding") }));
    fireEvent.click(await screen.findByRole("option", { name: "BH-2" }));
    expect(screen.getByRole("heading", { name: `${label("sounding")}: BH-2` })).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: label("detail_table") })).getAllByRole("row")).toHaveLength(2);
    expect(screen.getByRole("cell", { name: "1.500" })).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("shows a single sounding directly without a picker", async () => {
    renderResults({ per_sounding: { "BH-2": result.per_sounding["BH-2"] }, errors: {} });
    await screen.findByRole("img", { name: label("chart_fs") });
    expect(screen.queryByRole("textbox", { name: label("select_sounding") })).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: label("status.safe") })).toBeInTheDocument();
    expect(screen.queryByText(label("mock_note"))).not.toBeInTheDocument();
  });

  it("keeps TR/EN keys identical and translates all nine DTO statuses", () => {
    expect(Object.keys(trModule).sort()).toEqual(Object.keys(enModule).sort());
    const statuses = ["liquefiable", "marginal", "safe", "above_gwt", "clay_like", "non_liquefiable_dense",
      "excluded_by_user", "beyond_method_depth", "invalid"];
    for (const catalog of [trModule, enModule] as Record<string, string>[]) {
      for (const status of statuses) expect(catalog[`liquefaction.results.status.${status}`]).toBeTruthy();
    }
  });
});
