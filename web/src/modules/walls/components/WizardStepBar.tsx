import type { CSSProperties } from "react";
import { UnstyledButton } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";

export interface WizardStepBarProps {
  labels: string[];
  active: number;
  onSelect: (index: number) => void;
  ariaLabel: string;
}

const LIST: CSSProperties = { display: "grid", gap: 6, listStyle: "none", margin: 0, padding: 0 };

/**
 * Compact wizard step bar: one equal-width grid cell per step (never a wrapping flex row, which clipped the
 * last label at 800 px). Each cell is a bordered box with the step number (a check once the step is behind
 * the active one) and its label, so every step stays fully visible and clickable at any page width.
 */
export function WizardStepBar({ labels, active, onSelect, ariaLabel }: WizardStepBarProps) {
  return (
    <nav aria-label={ariaLabel} data-testid="wizard-step-bar">
      <ol className="gt-stepbar" style={{ ...LIST, gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>
        {labels.map((label, i) => {
          const state = i === active ? "active" : i < active ? "done" : "todo";
          return (
            <li key={label} data-state={state} style={{ minWidth: 0 }}>
              <UnstyledButton
                data-state={state}
                aria-current={i === active ? "step" : undefined}
                onClick={() => onSelect(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: state === "active" ? "7px 9px" : "8px 10px",
                  borderRadius: 10,
                  background: "var(--mantine-color-body)",
                  border: state === "active" ? "2px solid var(--gt-info-dot)" : "1px solid var(--gt-border)",
                  color: state === "active" ? "var(--gt-primary-soft-text)" : "var(--gt-neutral-text)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flex: "0 0 auto",
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 600,
                    background:
                      state === "active" ? "var(--gt-info-dot)" : state === "done" ? "var(--gt-ok-bg)" : "var(--gt-neutral-bg)",
                    color: state === "active" ? "#fff" : state === "done" ? "var(--gt-ok-text)" : "var(--gt-neutral-text)",
                  }}
                >
                  {state === "done" ? <IconCheck size={13} stroke={3} /> : i + 1}
                </span>
                <span
                  className="gt-step-label"
                  style={{
                    minWidth: 0,
                    fontSize: 13,
                    fontWeight: state === "active" ? 600 : 400,
                    lineHeight: 1.25,
                    overflowWrap: "break-word",
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
