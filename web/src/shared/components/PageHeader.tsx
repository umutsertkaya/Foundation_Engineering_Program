import type { ReactNode } from "react";
import { Anchor, Box, Group, Text, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { Link } from "react-router-dom";

export interface PageHeaderProps {
  title: ReactNode;
  /** One sentence that says what the page is for. */
  lead?: ReactNode;
  /** Optional StatusChip shown next to the title. */
  status?: ReactNode;
  /** Right-aligned buttons. */
  actions?: ReactNode;
  back?: { to: string; label: string };
}

/** Page title block: optional back link, title with status chip, one-sentence lead and an actions slot. */
export function PageHeader({ title, lead, status, actions, back }: PageHeaderProps) {
  return (
    <Box mb="md">
      {back && (
        <Anchor component={Link} to={back.to} size="sm" mb={6} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <IconArrowLeft size={14} aria-hidden="true" />
          {back.label}
        </Anchor>
      )}
      <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
        <Box style={{ flex: 1, minWidth: 280 }}>
          <Group gap="sm" align="center">
            <Title order={1} fz={24} fw={600}>{title}</Title>
            {status}
          </Group>
          {lead && <Text c="dimmed" mt={4} maw={720}>{lead}</Text>}
        </Box>
        {actions && <Group gap="xs">{actions}</Group>}
      </Group>
    </Box>
  );
}
