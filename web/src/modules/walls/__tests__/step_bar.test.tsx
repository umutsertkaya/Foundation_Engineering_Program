import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WizardStepBar } from "../components/WizardStepBar";
import { renderThemed } from "./helpers";

const LABELS = ["Tip/geometri", "Zemin", "Yükler/deprem", "Öner/Kontrol", "Sonuç"];

describe("WizardStepBar", () => {
  it("renders one button per step with the full label (no truncation) and marks the active step", () => {
    renderThemed(<WizardStepBar labels={LABELS} active={2} onSelect={() => undefined} ariaLabel="Adımlar" />);
    const nav = screen.getByRole("navigation", { name: "Adımlar" });
    const buttons = within(nav).getAllByRole("button");
    expect(buttons.map((b) => b.textContent?.replace(/^\d*/, ""))).toEqual(LABELS);
    expect(buttons[2]).toHaveAttribute("aria-current", "step");
    expect(buttons.filter((b) => b.hasAttribute("aria-current"))).toHaveLength(1);
    expect(buttons.map((b) => b.getAttribute("data-state"))).toEqual(["done", "done", "active", "todo", "todo"]);
    expect(screen.getByRole("button", { name: "Sonuç" })).toBeInTheDocument();
  });

  it("lays the steps out as one equal-width grid cell each (never a wrapping flex row)", () => {
    renderThemed(<WizardStepBar labels={LABELS} active={0} onSelect={() => undefined} ariaLabel="Adımlar" />);
    const list = screen.getByRole("list");
    expect(list.style.display).toBe("grid");
    expect(list.style.gridTemplateColumns).toBe("repeat(5, minmax(0, 1fr))");
    for (const item of screen.getAllByRole("listitem")) expect(item.style.minWidth).toMatch(/^0(px)?$/);
    for (const button of screen.getAllByRole("button")) expect(button.style.width).toBe("100%");
  });

  it("allows every step to be selected directly", () => {
    const onSelect = vi.fn();
    renderThemed(<WizardStepBar labels={LABELS} active={0} onSelect={onSelect} ariaLabel="Adımlar" />);
    fireEvent.click(screen.getByRole("button", { name: "Sonuç" }));
    expect(onSelect).toHaveBeenCalledWith(4);
  });
});
