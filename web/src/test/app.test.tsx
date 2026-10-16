import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import enCatalog from "../../../geotek/i18n/en.json";
import trCatalog from "../../../geotek/i18n/tr.json";
import {
  ApiError,
  get_health,
  get_job,
  parseApiError,
  setMockMode,
  size_wall,
} from "../shared/api/client";
import { resetMockState } from "../shared/api/mock";
import type { WallResultDTO } from "../shared/api/types";
import { WorkflowBar } from "../components/WorkflowBar";
import "../i18n";
import { theme } from "../theme";
import { utilisationColor } from "../shared/utils/utilisation";

afterEach(() => {
  setMockMode(null);
  resetMockState();
  vi.restoreAllMocks();
});

describe("API client error parsing", () => {
  it("parses ApiError envelope with missing_factors and details", () => {
    const err = parseApiError(422, {
      code: "missing_factors",
      message: "Missing TBDY factors",
      details: { design_code: "tbdy2018" },
      missing_factors: [
        {
          path: "TBDY-seismic.material.tan_phi",
          status: "not_in_source",
          source: "TBDY 2018",
          hint: "Material factor",
        },
      ],
    });

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.code).toBe("missing_factors");
    expect(err.message).toBe("Missing TBDY factors");
    expect(err.details).toEqual({ design_code: "tbdy2018" });
    expect(err.missing_factors).toHaveLength(1);
    expect(err.missing_factors[0].path).toBe("TBDY-seismic.material.tan_phi");
  });

  it("throws ApiError when fetch returns non-2xx JSON response", async () => {
    setMockMode(false);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "not_implemented",
          message: "This operation is not implemented.",
          details: {},
          missing_factors: [],
        }),
        { status: 501, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(get_health()).rejects.toMatchObject({
      name: "ApiError",
      status: 501,
      code: "not_implemented",
    });
  });
});

describe("Mock job flow & 422 missing_factors", () => {
  it("transitions queued -> running -> done and returns 5 m cantilever WallResultDTO (B = 4.60 m)", async () => {
    setMockMode(true);
    const jobRef = await size_wall("wall-mock-1");
    expect(jobRef.job_id).toMatch(/^job-mock-/);

    const statuses: string[] = [];
    let state = await get_job(jobRef.job_id);
    statuses.push(state.status);

    for (let i = 0; i < 6 && state.status !== "done"; i += 1) {
      state = await get_job(jobRef.job_id);
      statuses.push(state.status);
    }

    expect(statuses[0]).toBe("queued");
    expect(statuses).toContain("running");
    expect(state.status).toBe("done");
    expect(state.progress).toBe(1.0);
    expect(state.message_key).toBe("job.step.done");

    const res = state.result as WallResultDTO;
    expect(res).toBeTruthy();
    expect(res.governing).toBe("seismic:bearing");
    expect(res.checks).toHaveLength(10);

    if ("stem_height" in res.geometry) {
      const B = res.geometry.toe + res.geometry.stem_bottom + res.geometry.heel;
      expect(B).toBeCloseTo(4.6, 2);
    } else {
      expect.fail("Expected CantileverGeometry");
    }
  });

  it("throws 422 missing_factors ApiError for advanced tbdy2018 structure", async () => {
    setMockMode(true);
    await expect(size_wall("wall-mock-tbdy")).rejects.toMatchObject({
      status: 422,
      code: "missing_factors",
    });
  });
});

describe("utilisationColor", () => {
  it("maps utilisation values to green (<=0.9), amber (0.9-1.0), red (>1.0), and gray", () => {
    expect(utilisationColor(0.45)).toBe("green");
    expect(utilisationColor(0.9)).toBe("green");
    expect(utilisationColor(0.91)).toBe("amber");
    expect(utilisationColor(1.0)).toBe("amber");
    expect(utilisationColor(1.05)).toBe("red");
    expect(utilisationColor(null)).toBe("gray");
    expect(utilisationColor(Number.NaN)).toBe("gray");
  });
});

describe("i18n tr.json and en.json key parity", () => {
  it("has identical key sets and required error.*, job.step.*, and web.* keys", () => {
    const trKeys = Object.keys(trCatalog).sort();
    const enKeys = Object.keys(enCatalog).sort();
    expect(trKeys).toEqual(enKeys);

    const requiredErrorKeys = [
      "error.validation",
      "error.not_found",
      "error.missing_factors",
      "error.engine_error",
      "error.stale_structure",
      "error.not_implemented",
      "error.network",
    ];
    for (const k of requiredErrorKeys) {
      expect(trCatalog).toHaveProperty(k);
      expect(enCatalog).toHaveProperty(k);
    }

    expect(trCatalog).toHaveProperty("job.step.queued");
    expect(trCatalog).toHaveProperty("job.step.done");
    expect(trCatalog).toHaveProperty("web.nav.project");
  });
});

describe("WorkflowBar", () => {
  it("renders all 5 workflow steps and highlights the active route", () => {
    render(
      <MantineProvider theme={theme}>
        <MemoryRouter initialEntries={["/structures/wall-mock-1"]}>
          <WorkflowBar />
        </MemoryRouter>
      </MantineProvider>,
    );

    const stepProject = screen.getByTestId("workflow-step-project");
    const stepSiteData = screen.getByTestId("workflow-step-site-data");
    const stepSoilModels = screen.getByTestId("workflow-step-soil-models");
    const stepStructures = screen.getByTestId("workflow-step-structures");
    const stepReport = screen.getByTestId("workflow-step-report");

    expect(stepProject).toBeInTheDocument();
    expect(stepSiteData).toBeInTheDocument();
    expect(stepSoilModels).toBeInTheDocument();
    expect(stepStructures).toBeInTheDocument();
    expect(stepReport).toBeInTheDocument();
    expect(stepStructures).toHaveAttribute("aria-current", "step");
    expect(stepProject).not.toHaveAttribute("aria-current");
  });
});
