import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setMockMode } from "../../../shared/api/client";
import { resetMockState } from "../../../shared/api/mock";
import "../../../app/i18n";
import i18n from "i18next";
import { theme } from "../../../app/theme";
import { clipSegments, crossingLL, decadeTicks, pathOf, PLOT, scale } from "../classification/geometry";
import { PlasticityChart } from "../classification/PlasticityChart";
import { SbtnChart } from "../classification/SbtnChart";
import { ClassificationPage, summariseZones } from "../pages/ClassificationPage";
import type { SBTNReferenceDTO, USCSItemDTO, USCSReferenceDTO } from "../types";

const LL = Array.from({ length: 101 }, (_, i) => i);
const USCS_REF: USCSReferenceDTO = {
  // Test fixture only: the A- and U-lines as the engine reports them, negative below LL 20 / 8.
  a_line: LL.map((x) => ({ LL: x, PI: 0.73 * (x - 20) })),
  u_line: LL.map((x) => ({ LL: x, PI: 0.9 * (x - 8) })),
  symbols: [{ symbol: "CL", group_name_en: "Lean clay", group_name_tr: "Düşük plastisiteli kil", description: "d" }],
};

const SBTN_REF: SBTNReferenceDTO = {
  zones: [
    { zone: 1, name_en: "Sensitive", name_tr: "Hassas", ic_min: null, ic_max: null },
    { zone: 6, name_en: "Sands", name_tr: "Kum", ic_min: 1.31, ic_max: 2.05 },
  ],
  ic_bounds: [1.31],
  zone_1_boundary: [
    { Fr: 0.1, Qtn: 10.4 },
    { Fr: 1, Qtn: 2.96 },
    { Fr: 3, Qtn: 0.18 }, // below the Qtn axis: must not be drawn
  ],
  ic_contours: [
    {
      Ic: 1.31,
      points: [
        { Fr: 0.5, Qtn: 100 },
        { Fr: 1, Qtn: 200 },
      ],
    },
  ],
  fr_range: { min: 0.1, max: 10 },
  qtn_range: { min: 1, max: 1000 },
};

function item(LLv: number | null, PIv: number | null, symbol: string | null = "CL"): USCSItemDTO {
  return {
    depth: 2, symbol, complete: true, notes: [], FC: 60, gravel: 0, LL: LLv, PL: null, PI: PIv,
    D10: null, D30: null, D60: null, Cu: null, Cc: null, plastic_class: null,
    group_name_en: null, group_name_tr: null, description: null,
  };
}

function pathYs(d: string): number[] {
  return [...d.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map((m) => Number(m[2]));
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

describe("chart geometry", () => {
  it("maps log and linear values onto the plot", () => {
    expect(scale(10, { min: 1, max: 100 }, 0, 200, true)).toBeCloseTo(100);
    expect(scale(25, { min: 0, max: 100 }, 0, 200, false)).toBeCloseTo(50);
  });

  it("splits a polyline where it leaves the ranges", () => {
    const pts = [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 99 }, { x: 4, y: 1 }];
    const runs = clipSegments(pts, { min: 0, max: 10 }, { min: 0, max: 10 });
    expect(runs.map((r) => r.length)).toEqual([3, 2]);
    expect(pathOf(runs[0])).toBe("M1.0,1.0 L2.0,2.0 L2.1,10.0");
    expect(runs[0][2].y).toBeCloseTo(10);
    expect(runs[1][1]).toEqual({ x: 4, y: 1 });
  });

  it("lists decade ticks and finds line crossings", () => {
    expect(decadeTicks({ min: 0.1, max: 10 })).toEqual([0.1, 1, 10]);
    expect(crossingLL(USCS_REF.a_line, 7.3)).toBeCloseTo(30);
    expect(crossingLL(USCS_REF.a_line, 1000)).toBeNull();
  });
});

describe("SbtnChart", () => {
  it("draws in-range points, clips the zone 1 boundary and reports hidden samples", () => {
    const points = [
      { depth: 1, Fr: 1, Qtn: 50, Ic: 2, zone: 6, zone_name_en: "Sands", zone_name_tr: "Kum" },
      { depth: 2, Fr: 50, Qtn: 50, Ic: 2, zone: 6, zone_name_en: "Sands", zone_name_tr: "Kum" },
      { depth: 3, Fr: null, Qtn: null, Ic: null, zone: null, zone_name_en: null, zone_name_tr: null },
    ];
    render(<SbtnChart reference={SBTN_REF} points={points} />);
    expect(screen.getAllByTestId("sbtn-point")).toHaveLength(1);
    expect(screen.getByTestId("sbtn-hidden")).toHaveTextContent("2");
    const zone1 = screen.getByTestId("sbtn-zone1");
    const ys = pathYs(zone1.getAttribute("d") ?? "");
    expect(ys).toHaveLength(3);
    expect(Math.max(...ys)).toBeLessThanOrEqual(PLOT.height - PLOT.bottom);
    expect(screen.getAllByTestId("sbtn-contour")).toHaveLength(1);
  });
});

describe("PlasticityChart", () => {
  it("clips the negative A- and U-line parts to the chart", () => {
    render(<PlasticityChart reference={USCS_REF} items={[]} />);
    const baseline = PLOT.height - PLOT.bottom;
    for (const id of ["plasticity-aline", "plasticity-uline"]) {
      const ys = pathYs(screen.getByTestId(id).getAttribute("d") ?? "");
      expect(ys.length).toBeGreaterThan(2);
      expect(Math.max(...ys)).toBeLessThanOrEqual(baseline + 0.05);
    }
    expect(screen.getByTestId("plasticity-clml")).toBeInTheDocument();
  });

  it("plots only samples with LL and PI inside the axes", () => {
    render(<PlasticityChart reference={USCS_REF} items={[item(40, 20), item(null, 10), item(150, 20), item(30, null)]} />);
    expect(screen.getAllByTestId("plasticity-point")).toHaveLength(1);
    expect(screen.getByTestId("plasticity-hidden")).toHaveTextContent("1");
  });
});

describe("summariseZones", () => {
  it("counts samples per zone with their depth extent and skips unzoned ones", () => {
    const base = { Fr: 1, Qtn: 1, Ic: 1, zone_name_en: null, zone_name_tr: null };
    const rows = summariseZones([
      { ...base, depth: 3, zone: 5 },
      { ...base, depth: 1, zone: 5 },
      { ...base, depth: 2, zone: 3 },
      { ...base, depth: 4, zone: null },
    ]);
    expect(rows).toEqual([
      { zone: 3, count: 1, top: 2, bottom: 3 },
      { zone: 5, count: 2, top: 1, bottom: 4 },
    ]);
  });
});

describe("ClassificationPage (mock)", () => {
  beforeEach(async () => {
    setMockMode(true);
    resetMockState();
  });
  afterEach(() => {
    setMockMode(null);
    resetMockState();
  });

  function renderPage() {
    return render(
      <MantineProvider theme={theme}>
        <ClassificationPage />
      </MantineProvider>,
    );
  }

  it("states the scope limits and shows the SBTn chart, zone table and legend for the first CPT", async () => {
    renderPage();
    expect(await screen.findByTestId("sbtn-chart")).toBeInTheDocument();
    expect(screen.getByTestId("cls-scope-note")).toHaveTextContent("OL, OH, Pt");
    expect(screen.getAllByTestId("sbtn-point").length).toBeGreaterThan(0);
    expect(within(screen.getByTestId("sbtn-zone-table")).getAllByRole("row").length).toBeGreaterThan(1);
    expect(within(screen.getByTestId("sbtn-legend")).getByText("Sensitive, fine grained")).toBeInTheDocument();
    expect(screen.getByTestId("sbtn-warnings")).toBeInTheDocument();
  });

  it("switches to the USCS tab, lists lab results and the symbol reference", async () => {
    renderPage();
    await screen.findByTestId("sbtn-chart");
    fireEvent.click(screen.getByRole("tab", { name: /USCS/ }));
    expect(await screen.findByTestId("plasticity-chart")).toBeInTheDocument();
    const table = await screen.findByTestId("uscs-table");
    expect(within(table).getAllByRole("row").length).toBeGreaterThan(1);
    expect(screen.getByTestId("uscs-symbols")).toBeInTheDocument();
  });

  it("classifies a sample through the quick form and shows the API error for bad input", async () => {
    renderPage();
    await screen.findByTestId("sbtn-chart");
    fireEvent.click(screen.getByRole("tab", { name: /USCS/ }));
    const fines = await screen.findByLabelText(/Fines FC/);
    const button = screen.getByRole("button", { name: "Classify" });
    expect(button).toBeDisabled();
    fireEvent.change(fines, { target: { value: "35" } });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(screen.getAllByTestId("uscs-table").length).toBe(2));
  });

  it("renders Turkish labels when the language is tr", async () => {
    await i18n.changeLanguage("tr");
    renderPage();
    expect(await screen.findByText("Zemin sınıflandırma")).toBeInTheDocument();
    expect(await screen.findByTestId("sbtn-chart")).toHaveAttribute("aria-label", expect.stringContaining("Robertson"));
    cleanup();
    await i18n.changeLanguage("en");
  });
});
