import type { ReactNode } from "react";
import { Box, Text } from "@mantine/core";

export interface KpiTileProps {
  label: ReactNode;
  /** The number, shown in the monospace font. */
  value: ReactNode;
  unit?: ReactNode;
  /** Small line below the value, e.g. a limit or a status. */
  sub?: ReactNode;
}

/** Small tile with a label, one large monospace value, its unit and an optional sub line. */
export function KpiTile({ label, value, unit, sub }: KpiTileProps) {
  return (
    <Box p="md" style={{ border: "1px solid var(--gt-border)", borderRadius: 12, background: "var(--mantine-color-body)" }}>
      <Text size="sm" c="dimmed">{label}</Text>
      <Text component="div" ff="monospace" fz={24} fw={500} lh={1.2} mt={4}>
        {value}
        {unit != null && <Text component="span" fz={13} c="dimmed" ml={6}>{unit}</Text>}
      </Text>
      {sub && <Text size="xs" c="dimmed" mt={4}>{sub}</Text>}
    </Box>
  );
}
