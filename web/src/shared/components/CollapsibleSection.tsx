import { useState, type ReactNode } from "react";
import { Box, Collapse, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";

export interface CollapsibleSectionProps {
  /** Toggle label, e.g. "Advanced". */
  label: ReactNode;
  defaultOpened?: boolean;
  children: ReactNode;
}

/** "Advanced"-style section: a dashed rule with a toggle, closed by default so rarely used fields stay out of the way. */
export function CollapsibleSection({ label, defaultOpened = false, children }: CollapsibleSectionProps) {
  const [opened, setOpened] = useState(defaultOpened);
  return (
    <Box mt="md" pt="sm" style={{ borderTop: "1px dashed var(--gt-border)" }}>
      <UnstyledButton
        onClick={() => setOpened((value) => !value)}
        aria-expanded={opened}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 500, fontSize: 13, color: "var(--gt-muted)" }}
      >
        {opened ? <IconChevronDown size={16} aria-hidden="true" /> : <IconChevronRight size={16} aria-hidden="true" />}
        {label}
      </UnstyledButton>
      <Collapse in={opened}><Box pt="sm">{children}</Box></Collapse>
    </Box>
  );
}
