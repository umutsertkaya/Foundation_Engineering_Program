import type { CSSProperties } from "react";
import { UnstyledButton } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";

export interface WizardStepBarProps {
  labels: string[];
  active: number;
  onSelect: (index: number) => void;
  ariaLabel: string;
}

const LIST: CSSProperties = { display: "grid", gap: 4, listStyle: "none", margin: 0, padding: 0 };

/**
 * Wizard step bar: one equal-width grid cell per step (never a wrapping flex row, which clipped the
 * last label at 800 px). The number sits above its label, which may wrap at spaces inside the cell, so
 * every step stays fully visible and clickable at any page width.
 */
export function WizardStepBar({ labels, active, onSelect, ariaLabel }: WizardStepBarProps) {
  return (
    <nav aria-label={ariaLabel} data-testid="wizard-step-bar">
      <ol style={{ ...LIST, gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>
        {labels.map((label, i) => {
          const state = i === active ? "active" : i < active ? "done" : "todo";
          const filled = state !== "todo";
          return (
            <li key={label} style={{ minWidth: 0 }}>
              <UnstyledButton
                data-state={state}
                aria-current={i === active ? "step" : undefined}
                onClick={() => onSelect(i)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  width: "100%",
                  padding: "6px 4px",
                  textAlign: "center",
                  borderRadius: "var(--mantine-radius-sm)",
                  borderBottom: `3px solid ${
                    state === "active"
                      ? "var(--mantine-color-blue-filled)"
                      : state === "done"
                        ? "var(--mantine-color-blue-light-color)"
                        : "var(--mantine-color-default-border)"
                  }`,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flex: "0 0 auto",
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    background: filled ? "var(--mantine-color-blue-filled)" : "transparent",
                    color: filled ? "var(--mantine-color-white)" : "var(--mantine-color-dimmed)",
                    border: `1px solid ${filled ? "var(--mantine-color-blue-filled)" : "var(--mantine-color-default-border)"}`,
                  }}
                >
                  {state === "done" ? <IconCheck size={12} stroke={3} /> : i + 1}
                </span>
                <span
                  style={{
                    minWidth: 0,
                    fontSize: "var(--mantine-font-size-xs)",
                    fontWeight: state === "active" ? 700 : 500,
                    lineHeight: 1.25,
                    overflowWrap: "break-word",
                    color: state === "todo" ? "var(--mantine-color-dimmed)" : "var(--mantine-color-text)",
                  }}
                >
                  {label}
                </span>
              </UnstyledButton>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
