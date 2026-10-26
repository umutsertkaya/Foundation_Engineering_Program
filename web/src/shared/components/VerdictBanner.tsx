import type { ReactNode } from "react";
import { Box, Group, Text } from "@mantine/core";
import { IconAlertTriangle, IconCircleCheck, IconInfoCircle, IconOctagon } from "@tabler/icons-react";

export type VerdictTone = "ok" | "warn" | "bad" | "info";

const ICONS = { ok: IconCircleCheck, warn: IconAlertTriangle, bad: IconOctagon, info: IconInfoCircle } as const;

export interface VerdictBannerProps {
  tone: VerdictTone;
  title: ReactNode;
  /** One line that says what to do or why. */
  text?: ReactNode;
  /** Optional button or link on the right. */
  action?: ReactNode;
}

/** Coloured banner for a result or warning: bold title, one line of detail and an optional action. */
export function VerdictBanner({ tone, title, text, action }: VerdictBannerProps) {
  const Icon = ICONS[tone];
  return (
    <Group
      role={tone === "bad" ? "alert" : "status"}
      data-tone={tone}
      gap="sm"
      wrap="wrap"
      align="center"
      px="md"
      py={12}
      style={{ borderRadius: 10, background: `var(--gt-${tone}-bg)`, color: `var(--gt-${tone}-text)` }}
    >
      <Icon size={20} aria-hidden="true" style={{ flex: "none" }} />
      <Box style={{ flex: 1, minWidth: 200 }}>
        <Text fw={600} c="inherit">{title}</Text>
        {text && <Text size="sm" c="inherit">{text}</Text>}
      </Box>
      {action}
    </Group>
  );
}
