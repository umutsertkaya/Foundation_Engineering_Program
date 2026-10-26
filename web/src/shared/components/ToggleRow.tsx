import { Box, Switch } from "@mantine/core";

export interface ToggleRowProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  /** One line that says what the switch changes. */
  hint: string;
}

/** Switch with a title and one line of explanation in a soft box (the "toggle row" of the page pattern). */
export function ToggleRow({ checked, onChange, label, hint }: ToggleRowProps) {
  return (
    <Box p="sm" style={{ borderRadius: 10, background: "var(--gt-ground)" }}>
      <Switch size="md" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} label={label} description={hint} />
    </Box>
  );
}
