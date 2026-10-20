import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n, { loadLanguageCatalog } from "../app/i18n";
import { theme } from "../app/theme";
import { MissingFactorsForm } from "../shared/components/MissingFactorsForm";

const factors = [
  { path: "resistance.sliding", status: "not_in_source" as const, source: "aashto.yaml" },
  { path: "resistance.bearing", status: "not_in_source" as const, source: "aashto.yaml" },
];

beforeEach(async () => {
  await loadLanguageCatalog("tr");
});

afterEach(() => cleanup());

function renderForm(onSubmit = vi.fn()) {
  render(
    <MantineProvider theme={theme}>
      <I18nextProvider i18n={i18n}>
        <MissingFactorsForm missingFactors={factors} onSubmit={onSubmit} />
      </I18nextProvider>
    </MantineProvider>,
  );
  return onSubmit;
}

describe("missing factors form", () => {
  it("starts with empty fields and does not submit an assumed factor", () => {
    const onSubmit = renderForm();
    for (const f of factors) {
      expect((screen.getByRole("textbox", { name: f.path }) as HTMLInputElement).value).toBe("");
    }
    const save = screen.getByRole("button");
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits only after every factor is entered", () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByRole("textbox", { name: "resistance.sliding" }), { target: { value: "0.8" } });
    expect(screen.getByRole("button")).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "resistance.bearing" }), { target: { value: "0.55" } });
    const save = screen.getByRole("button");
    expect(save).toBeEnabled();
    fireEvent.click(save);
    expect(onSubmit).toHaveBeenCalledWith({ "resistance.sliding": 0.8, "resistance.bearing": 0.55 });
  });
});
