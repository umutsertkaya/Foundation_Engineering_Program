import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import i18n from "../../../app/i18n";
import { theme } from "../../../app/theme";
import type { ParameterSelection } from "../../../shared/api/types";
import { ParameterKeyCard } from "../components/ParameterKeyCard";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("tr");
});

it("a key without candidates or suggestion says that only manual entry is available", () => {
  const selection = { parameter: "phi_eff", candidates: [], approved: false } as unknown as ParameterSelection;
  render(
    <MantineProvider theme={theme}>
      <ParameterKeyCard selection={selection} busy={false} onApply={async () => {}} onApprove={async () => {}} />
    </MantineProvider>,
  );
  expect(screen.getByText("No data for this value; only manual entry is available.")).toBeInTheDocument();
  expect(screen.queryByText("Choose how to select a value.")).not.toBeInTheDocument();
});
