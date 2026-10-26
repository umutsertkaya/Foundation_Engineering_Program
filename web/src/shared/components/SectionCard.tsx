import type { ReactNode } from "react";
import { Box, Card, Group, Title } from "@mantine/core";

export interface SectionCardProps {
  title: ReactNode;
  /** Step number shown in a round badge before the title. */
  step?: number;
  /** Right-aligned content in the title row (chips, buttons). */
  aside?: ReactNode;
  children: ReactNode;
}

/** White card with an optionally numbered title row; the standard container for one page section. */
export function SectionCard({ title, step, aside, children }: SectionCardProps) {
  return (
    <Card component="section">
      <Group justify="space-between" align="center" mb="sm" wrap="nowrap" gap="sm">
        <Group gap="sm" align="center" wrap="nowrap">
          {step != null && (
            <Box
              component="span"
              aria-hidden="true"
              style={{
                width: 24, height: 24, borderRadius: "50%", flex: "none", fontSize: 13, fontWeight: 600,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: "var(--gt-primary-soft)", color: "var(--gt-primary-soft-text)",
              }}
            >
              {step}
            </Box>
          )}
          <Title order={2} fz={15} fw={600}>{title}</Title>
        </Group>
        {aside}
      </Group>
      {children}
    </Card>
  );
}
