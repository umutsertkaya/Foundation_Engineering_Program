import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it } from "vitest";
import i18n from "../../../app/i18n";
import { theme } from "../../../app/theme";
import { ApiError } from "../../../shared/api/client";
import { ErrorAlert } from "../components/ErrorAlert";

beforeEach(async () => {
  await i18n.changeLanguage("tr");
});
afterEach(cleanup);

it("SPT layering without a profile explains what to do instead of the raw English engine message", () => {
  const error = new ApiError(422, { code: "validation", message: "SPT processing needs a soil profile (unit weights)", details: {}, missing_factors: [] });
  render(
    <MantineProvider theme={theme}>
      <MemoryRouter>
        <ErrorAlert error={error} />
      </MemoryRouter>
    </MantineProvider>,
  );
  expect(screen.getByText("SPT için önce bir zemin profili gerekir")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Zemin profillerine git" })).toHaveAttribute("href", "/m/soil/profiles");
});

it("a source deeper than the active profile names both depths instead of the raw 422", () => {
  const error = new ApiError(422, { code: "validation", message: "Depth outside the profile (0 - 10.0 m)", details: {}, missing_factors: [] });
  render(
    <MantineProvider theme={theme}>
      <MemoryRouter>
        <ErrorAlert error={error} sourceDepth={15} />
      </MemoryRouter>
    </MantineProvider>,
  );
  expect(screen.getByText("Kaynak etkin profilden daha derin")).toBeInTheDocument();
  expect(screen.getByText(/10\.0 m derinliğe iniyor.*15\.0 m/)).toBeInTheDocument();
});
