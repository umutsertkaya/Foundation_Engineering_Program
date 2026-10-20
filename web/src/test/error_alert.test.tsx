import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n, { loadLanguageCatalog } from "../app/i18n";
import { theme } from "../app/theme";
import { ErrorAlert as SoilErrorAlert } from "../modules/soil/components/ErrorAlert";
import { ApiError } from "../shared/api/client";
import { errorTitle } from "../shared/api/errorMessage";
import { ErrorAlert } from "../shared/components/ErrorAlert";

const uncatalogued = () =>
  new ApiError(409, { code: "brand_new_server_code", message: "Server text", details: {}, missing_factors: [] });

beforeEach(async () => {
  await loadLanguageCatalog("tr");
});

afterEach(() => cleanup());

describe("error alert titles", () => {
  it("uses the catalog title for a known code and the generic title for an unknown one", () => {
    const exists = (key: string) => key === "error.not_found";
    const t = ((key: string) => `T(${key})`) as never;
    const known = new ApiError(404, { code: "not_found", message: "x", details: {}, missing_factors: [] });
    expect(errorTitle(known, t, exists)).toBe("T(error.not_found)");
    expect(errorTitle(uncatalogued(), t, exists)).toBe("T(error.engine_error)");
    expect(errorTitle(new Error("boom"), t, exists, "soil.error.unexpected")).toBe("T(soil.error.unexpected)");
  });

  it("never shows the raw error.<code> key in the shared and soil alerts", () => {
    render(
      <MantineProvider theme={theme}>
        <ErrorAlert error={uncatalogued()} />
        <SoilErrorAlert error={uncatalogued()} />
      </MantineProvider>,
    );
    expect(i18n.exists("soil.error.unexpected")).toBe(true);
    expect(document.body.textContent).not.toContain("error.brand_new_server_code");
    expect(screen.getByText(i18n.t("error.engine_error"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("soil.error.unexpected"))).toBeInTheDocument();
    expect(screen.getAllByText("Server text")).toHaveLength(2);
  });
});
