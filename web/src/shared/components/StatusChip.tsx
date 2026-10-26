import type { ReactNode } from "react";
import { Box } from "@mantine/core";

export type StatusTone = "current" | "stale" | "missing" | "neutral" | "bad" | "info";

const TONE: Record<StatusTone, "ok" | "warn" | "neutral" | "bad" | "info"> = {
  current: "ok",
  stale: "warn",
  missing: "warn",
  neutral: "neutral",
  bad: "bad",
  info: "info",
};

export interface StatusChipProps {
  /** current = up to date, stale = needs a re-run, missing = input absent, neutral = no state. */
  tone?: StatusTone;
  /** Show the leading colour dot. */
  dot?: boolean;
  children: ReactNode;
}

/** Small rounded status label whose colour carries the state (never the only signal: the text says it too). */
export function StatusChip({ tone = "neutral", dot = true, children }: StatusChipProps) {
  const key = TONE[tone];
  return (
    <Box
      component="span"
      data-tone={tone}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 24,
        padding: "0 9px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: "nowrap",
        background: `var(--gt-${key}-bg)`,
        color: `var(--gt-${key}-text)`,
      }}
    >
      {dot && (
        <span
          aria-hidden="true"
          style={{ width: 8, height: 8, borderRadius: "50%", flex: "none", background: `var(--gt-${key}-dot)` }}
        />
      )}
      {children}
    </Box>
  );
}
