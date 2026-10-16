import { MantineProvider } from "@mantine/core";
import { act, render, renderHook, screen } from "@testing-library/react";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import enCatalog from "../../../geotek/i18n/en.json";
import trCatalog from "../../../geotek/i18n/tr.json";
import {
  ApiError,
  parseApiError,
  setMockMode,
  size_wall,
} from "../shared/api/client";
import { resetMockState } from "../shared/api/mock";
import type { WallResultDTO } from "../shared/api/types";
import { WorkflowBar } from "../components/WorkflowBar";
import { useJob } from "../shared/hooks/useJob";
import { theme } from "../theme";
import { utilisationColor } from "../shared/utils/utilisation";

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

  it("maintains strict i18n key parity between geotek/i18n/tr.json and en.json", () => {
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

  it("renders WorkflowBar with all 5 steps and highlights the active route", async () => {
    const testI18n = i18next.createInstance();
    await testI18n.use(initReactI18next).init({
      resources: {
        tr: { translation: trCatalog },
        en: { translation: enCatalog },
      },
      lng: "tr",
      fallbackLng: "en",
      keySeparator: false,
      nsSeparator: false,
      interpolation: { prefix: "{", suffix: "}", escapeValue: false },
    });

    render(
      <MantineProvider theme={theme}>
        <I18nextProvider i18n={testI18n}>
          <MemoryRouter initialEntries={["/structures/wall-mock-1"]}>
            <WorkflowBar />
          </MemoryRouter>
        </I18nextProvider>
      </MantineProvider>,
    );

    const nav = screen.getByRole("navigation", {
      name: trCatalog["web.nav.workflow_aria"],
    });
    expect(nav).toBeInTheDocument();

    const stepLabels = [
      trCatalog["web.nav.project"],
      trCatalog["web.nav.site_data"],
      trCatalog["web.nav.soil_models"],
      trCatalog["web.nav.structures"],
      trCatalog["web.nav.report"],
    ];

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(5);

    for (const label of stepLabels) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }

    const activeBtn = screen.getByRole("button", {
      name: new RegExp(trCatalog["web.nav.structures"]),
    });
    expect(activeBtn).toHaveAttribute("aria-current", "step");
  });
});
