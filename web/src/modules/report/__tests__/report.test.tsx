import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../app/i18n";
import { ApiError } from "../../../shared/api/client";
import * as api from "../api";
import { HomePage } from "../pages/HomePage";

vi.mock("../api");

const SECTIONS: api.ReportSection[] = [
  { id: "project", kind: "project", name: "Project", status: "ready" },
  { id: "wall-1", kind: "retaining_wall", name: "Wall 1", status: "ready" },
  { id: "sheet-1", kind: "sheet_pile", name: "Sheet 1", status: "stale" },
  { id: "liq", kind: "liquefaction", name: "Liq", status: "no_result" },
];

const renderPage = () => render(<MantineProvider><HomePage /></MantineProvider>);

beforeEach(() => {
  vi.mocked(api.list_report_sections).mockResolvedValue(SECTIONS);
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("report page", () => {
  it("preselects ready sections and disables stale or result-less ones", async () => {
    renderPage();
    const project = await screen.findByLabelText("Project");
    expect(project).toBeChecked();
    expect(screen.getByLabelText("Wall 1")).toBeChecked();
    expect(screen.getByLabelText("Sheet 1")).toBeDisabled();
    expect(screen.getByLabelText("Liq")).toBeDisabled();
  });

  it("sends the selected ids and language, then downloads the file", async () => {
    vi.mocked(api.build_report_docx).mockResolvedValue({ blob: new Blob(["x"]), filename: "p_report.docx" });
    renderPage();
    fireEvent.click(await screen.findByLabelText("Wall 1"));
    fireEvent.click(screen.getByRole("button", { name: i18n.t("report.page.build") }));
    await waitFor(() => expect(api.build_report_docx).toHaveBeenCalledWith(["project"], "tr"));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  });

  it("explains a 409 refusal with the section names and reloads the list", async () => {
    vi.mocked(api.build_report_docx).mockRejectedValue(new ApiError(409, {
      code: "stale_result", message: "stale", details: { sections: ["wall-1"] }, missing_factors: [],
    }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: i18n.t("report.page.build") }));
    expect(await screen.findByText(i18n.t("report.page.refused.stale_result"))).toBeInTheDocument();
    expect(screen.getAllByText("Wall 1")).toHaveLength(2);
    await waitFor(() => expect(api.list_report_sections).toHaveBeenCalledTimes(2));
  });
});
