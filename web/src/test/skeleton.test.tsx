import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBundledCatalog } from "../app/i18n";
import {
  ApiError,
  parseApiError,
  setMockMode,
} from "../shared/api/client";
import { size_wall } from "../modules/walls/api";
import { resetMockState } from "../shared/api/mock";
import type { WallResultDTO } from "../shared/api/types";
import { useJob } from "../shared/hooks/useJob";
import { utilisationColor } from "../shared/utils/utilisation";

const trCatalog = getBundledCatalog("tr");
const enCatalog = getBundledCatalog("en");

describe("GeoTek v2 web skeleton", () => {
  beforeEach(() => {
    setMockMode(true);
    resetMockState();
  });

  afterEach(() => {
    vi.useRealTimers();
    setMockMode(null);
  });

  it("parses API error responses into ApiError with missing_factors and status fallbacks", () => {
    const err422 = parseApiError(422, {
      code: "missing_factors",
      message: "Missing factors in selected design code",
      details: { design_code: "tbdy2018" },
      missing_factors: [
        {
          path: "TBDY-seismic.material.tan_phi",
          status: "not_in_source",
          source: "TBDY 2018",
          hint: "Material factor for tan(phi)",
        },
      ],
    });

    expect(err422).toBeInstanceOf(ApiError);
    expect(err422.status).toBe(422);
    expect(err422.code).toBe("missing_factors");
    expect(err422.details).toEqual({ design_code: "tbdy2018" });
    expect(err422.missing_factors).toHaveLength(1);
    expect(err422.missing_factors[0].path).toBe("TBDY-seismic.material.tan_phi");

    const err501 = parseApiError(501, "Not Implemented");
    expect(err501.status).toBe(501);
    expect(err501.code).toBe("not_implemented");
    expect(err501.message).toBe("Not Implemented");
    expect(err501.missing_factors).toEqual([]);
  });

  it("runs mock job flow through queued -> running -> done via useJob hook", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useJob<WallResultDTO>());
    expect(result.current.status).toBe("idle");

    await act(async () => {
      await result.current.start(() => size_wall("wall-mock-1"));
    });

    expect(result.current.status).toBe("queued");
    expect(result.current.messageKey).toBe("job.step.queued");

    // Advance 4 polling intervals of 300ms each to reach "done"
    for (let i = 0; i < 4; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
    }

    expect(result.current.status).toBe("done");
    expect(result.current.progress).toBe(1.0);
    expect(result.current.messageKey).toBe("job.step.done");
    expect(result.current.result).not.toBeNull();
    expect(result.current.result?.governing).toBe("seismic:bearing");
    expect(result.current.result?.passed).toBe(true);
  });

  it("maps utilisation ratio to green, amber, red and gray colour tokens", () => {
    expect(utilisationColor(0.0)).toBe("green");
    expect(utilisationColor(0.58)).toBe("green");
    expect(utilisationColor(0.9)).toBe("green");
    expect(utilisationColor(0.91)).toBe("amber");
    expect(utilisationColor(0.97)).toBe("amber");
    expect(utilisationColor(1.0)).toBe("amber");
    expect(utilisationColor(1.01)).toBe("red");
    expect(utilisationColor(1.35)).toBe("red");
    expect(utilisationColor(null)).toBe("gray");
    expect(utilisationColor(undefined)).toBe("gray");
    expect(utilisationColor(Number.NaN)).toBe("gray");
  });

  it("maintains strict i18n key parity for bundled core and module catalogs", () => {
    const trKeys = Object.keys(trCatalog).sort();
    const enKeys = Object.keys(enCatalog).sort();

    expect(trKeys).toEqual(enKeys);

    const requiredKeys = [
      "error.validation",
      "error.not_found",
      "error.missing_factors",
      "error.engine_error",
      "error.stale_structure",
      "error.not_implemented",
      "error.network",
      "job.step.queued",
      "job.step.earth_pressure",
      "job.step.stability_checks",
      "job.step.done",
      "web.nav.project",
      "web.nav.site_data",
      "web.nav.soil_models",
      "web.nav.structures",
      "web.nav.report",
    ];

    for (const key of requiredKeys) {
      expect((trCatalog as Record<string, string>)[key]).toBeTruthy();
      expect((enCatalog as Record<string, string>)[key]).toBeTruthy();
    }
  });

});
