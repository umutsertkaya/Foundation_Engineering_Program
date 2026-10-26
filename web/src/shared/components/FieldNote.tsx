import type { ReactNode } from "react";
import { Text } from "@mantine/core";

export interface FieldNoteProps {
  /** required = amber "Gerekli" style, error = red, help = muted. */
  kind: "required" | "error" | "help";
  children: ReactNode;
}

/** One-line note placed directly under a field: required, error or help text. */
export function FieldNote({ kind, children }: FieldNoteProps) {
  const color = kind === "required" ? "var(--gt-warn-text)" : kind === "error" ? "var(--gt-bad-text)" : "var(--gt-muted)";
  return (
    <Text
      component="span"
      role={kind === "error" ? "alert" : undefined}
      data-kind={kind}
      fz={12}
      fw={kind === "help" ? 400 : 500}
      style={{ display: "block", marginTop: 4, color }}
    >
      {children}
    </Text>
  );
}
