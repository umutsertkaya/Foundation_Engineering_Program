import { afterEach, describe, expect, it, vi } from "vitest";
import { getBundledCatalog } from "../app/i18n";
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
import { utilisationColor } from "../shared/utils/utilisation";

const trCatalog = getBundledCatalog("tr");
const enCatalog = getBundledCatalog("en");

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

describe("i18n core and module fragment key parity", () => {
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

  it("bundles each module fragment and checks its TR/EN parity independently", () => {
    const fragments = import.meta.glob<Record<string, string>>(
      "../../../geotek/modules/*/i18n/*.json",
      { eager: true, import: "default" },
    );
    for (const [path, trFragment] of Object.entries(fragments)) {
      if (!path.endsWith("/tr.json")) continue;
      const enFragment = fragments[path.replace(/\/tr\.json$/, "/en.json")];
      expect(enFragment).toBeDefined();
      expect(Object.keys(trFragment).sort()).toEqual(Object.keys(enFragment).sort());
      for (const [key, value] of Object.entries(trFragment)) expect(trCatalog[key]).toBe(value);
      for (const [key, value] of Object.entries(enFragment)) expect(enCatalog[key]).toBe(value);
    }
    for (const path of Object.keys(fragments)) {
      if (path.endsWith("/en.json")) expect(fragments[path.replace(/\/en\.json$/, "/tr.json")]).toBeDefined();
    }
  });
});

