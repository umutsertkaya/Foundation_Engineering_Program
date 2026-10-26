import type { ReactNode } from "react";
import { Box, Group, Text } from "@mantine/core";
import { StatusChip, type StatusTone } from "./StatusChip";

export interface ActionBarProps {
  /** Left summary chip text, e.g. "3 fields missing". Omit when nothing is missing. */
  summary?: ReactNode;
  summaryTone?: StatusTone;
  /** Plain explanation next to the chip. */
  text?: ReactNode;
  /** Right side: normally the one primary action. */
  children: ReactNode;
}

/** Bottom bar of a form page: what is still missing on the left, the primary action on the right. */
export function ActionBar({ summary, summaryTone = "missing", text, children }: ActionBarProps) {
  return (
    <Group
      justify="space-between"
      align="center"
      gap="md"
      wrap="wrap"
      p="md"
      style={{ borderRadius: 12, border: "1px solid var(--gt-border)", background: "var(--mantine-color-body)" }}
    >
      <Group gap="sm" style={{ flex: 1, minWidth: 220 }}>
        {summary != null && <StatusChip tone={summaryTone}>{summary}</StatusChip>}
        {text && <Text size="sm" c="dimmed">{text}</Text>}
      </Group>
      <Box>{children}</Box>
    </Group>
  );
}
