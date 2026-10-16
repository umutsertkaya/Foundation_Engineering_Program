import type { ReactNode } from "react";
import { Paper, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconInbox } from "@tabler/icons-react";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Paper withBorder p="xl" radius="sm">
      <Stack align="center" gap="xs">
        <ThemeIcon variant="light" color="gray" size="xl" radius="md">
          <IconInbox size={22} />
        </ThemeIcon>
        <Title order={4}>{title}</Title>
        <Text size="sm" c="dimmed" ta="center" maw={480}>
          {description}
        </Text>
        {action}
      </Stack>
    </Paper>
  );
}
