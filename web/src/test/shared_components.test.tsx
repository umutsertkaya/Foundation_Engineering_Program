import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { theme } from "../app/theme";
import { ActionBar } from "../shared/components/ActionBar";
import { CollapsibleSection } from "../shared/components/CollapsibleSection";
import { FieldNote } from "../shared/components/FieldNote";
import { KpiTile } from "../shared/components/KpiTile";
import { PageHeader } from "../shared/components/PageHeader";
import { SectionCard } from "../shared/components/SectionCard";
import { StatusChip } from "../shared/components/StatusChip";
import { VerdictBanner } from "../shared/components/VerdictBanner";

function ui(node: React.ReactNode) {
  return render(
    <MantineProvider theme={theme}>
      <MemoryRouter>{node}</MemoryRouter>
    </MantineProvider>,
  );
}

afterEach(cleanup);

describe("shared presentational components", () => {
  it("StatusChip exposes its tone and text", () => {
    ui(<><StatusChip tone="current">Current</StatusChip><StatusChip tone="stale">Stale</StatusChip></>);
    expect(screen.getByText("Current")).toHaveAttribute("data-tone", "current");
    expect(screen.getByText("Stale")).toHaveAttribute("data-tone", "stale");
  });

  it("CollapsibleSection is closed by default and toggles", async () => {
    ui(<CollapsibleSection label="Advanced"><input aria-label="Hidden field" /></CollapsibleSection>);
    const toggle = screen.getByRole("button", { name: "Advanced" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Hidden field" })).toBeVisible());
  });

  it("PageHeader renders title, lead, status, actions and a back link", () => {
    ui(
      <PageHeader
        title="Soil profiles"
        lead="Pick a profile."
        status={<StatusChip tone="current">Ready</StatusChip>}
        actions={<button type="button">New</button>}
        back={{ to: "/launcher", label: "Home" }}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Soil profiles" })).toBeInTheDocument();
    expect(screen.getByText("Pick a profile.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/launcher");
  });

  it("SectionCard shows the step number and children", () => {
    ui(<SectionCard title="Geometry" step={2}><p>Body</p></SectionCard>);
    expect(screen.getByRole("heading", { name: "Geometry" })).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("VerdictBanner uses alert only for the bad tone and renders its action", () => {
    ui(
      <>
        <VerdictBanner tone="bad" title="Stopped" text="Reduce beta." action={<button type="button">Fix</button>} />
        <VerdictBanner tone="ok" title="Passes" />
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Stopped");
    expect(screen.getByRole("alert")).toHaveTextContent("Reduce beta.");
    expect(screen.getByRole("button", { name: "Fix" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Passes");
  });

  it("ActionBar shows the missing summary and the primary action", () => {
    ui(<ActionBar summary="3 fields missing" text="Fill them to run."><button type="button">Run</button></ActionBar>);
    expect(screen.getByText("3 fields missing")).toHaveAttribute("data-tone", "missing");
    expect(screen.getByText("Fill them to run.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument();
  });

  it("FieldNote marks errors as alerts and leaves help and required notes quiet", () => {
    ui(<><FieldNote kind="required">Required</FieldNote><FieldNote kind="error">At least 0.5 m</FieldNote><FieldNote kind="help">Optional</FieldNote></>);
    expect(screen.getByRole("alert")).toHaveTextContent("At least 0.5 m");
    expect(screen.getByText("Required")).toHaveAttribute("data-kind", "required");
    expect(screen.getByText("Optional")).toHaveAttribute("data-kind", "help");
  });

  it("KpiTile shows label, value, unit and sub line", () => {
    ui(<KpiTile label="Sliding FS" value="1.82" unit="-" sub="limit 1.50" />);
    expect(screen.getByText("Sliding FS")).toBeInTheDocument();
    expect(screen.getByText("1.82")).toBeInTheDocument();
    expect(screen.getByText("limit 1.50")).toBeInTheDocument();
  });
});
