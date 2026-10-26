import { useState, type ReactNode } from "react";
import { Box, Collapse, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";

export interface DisclosureRowProps {
  title: ReactNode;
  /** Muted line after the title, e.g. what the section holds. */
  hint?: ReactNode;
  /** Right-aligned content next to the toggle, e.g. a count chip. */
  aside?: ReactNode;
  defaultOpened?: boolean;
  children: ReactNode;
}

/** One row of a details list: a full-width toggle with a chevron; the content stays in the DOM while closed. */
export function DisclosureRow({ title, hint, aside, defaultOpened = false, children }: DisclosureRowProps) {
  const [opened, setOpened] = useState(defaultOpened);
  return (
    <Box style={{ borderTop: "1px solid var(--gt-border-soft)" }} data-opened={opened}>
      <UnstyledButton
        onClick={() => setOpened((value) => !value)}
        aria-expanded={opened}
        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "14px 18px", fontWeight: 500 }}
      >
        {opened ? <IconChevronDown size={14} aria-hidden="true" /> : <IconChevronRight size={14} aria-hidden="true" />}
        <span>{title}</span>
        {hint && <Text component="span" fz={12} c="dimmed" fw={400}>{hint}</Text>}
        <span style={{ flex: 1 }} />
        {aside}
      </UnstyledButton>
      <Collapse in={opened}>
        <Box px="md" pb="md">{children}</Box>
      </Collapse>
    </Box>
  );
}

/** Card-less list container for `DisclosureRow`s: the first row loses its top rule. */
export function DisclosureList({ children }: { children: ReactNode }) {
  return (
    <Box
      component="section"
      style={{
        border: "1px solid var(--gt-border)",
        borderRadius: 12,
        background: "var(--mantine-color-body)",
        overflow: "hidden",
      }}
    >
      <Box style={{ marginTop: -1 }}>{children}</Box>
    </Box>
  );
}
