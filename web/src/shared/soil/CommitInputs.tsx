import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { NumberInput, TextInput } from "@mantine/core";

function displayOf(value: number | null | undefined): number | string {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

function parse(draft: number | string): number | null | "invalid" {
  if (typeof draft === "number") return Number.isFinite(draft) ? draft : "invalid";
  const s = draft.trim().replace(",", ".");
  if (s === "") return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : "invalid";
}

export interface CommitNumberInputProps {
  value: number | null | undefined;
  /** Called on blur / Enter with the parsed value (null = empty). */
  onCommit: (value: number | null) => void;
  ariaLabel: string;
  error?: string | null;
  width?: number | string;
  decimalScale?: number;
  readOnly?: boolean;
  placeholder?: string;
  style?: CSSProperties;
  label?: string;
  leftSection?: ReactNode;
}

/**
 * Number cell that keeps a local draft while typing and commits on blur or Enter, so
 * intermediate text ("1", "12", "12.") never reaches the model (and the undo history).
 * Rejected commits (value unchanged by the parent) revert to the current value.
 */
export function CommitNumberInput({
  value,
  onCommit,
  ariaLabel,
  error,
  width = 60,
  decimalScale = 3,
  readOnly,
  placeholder,
  style,
  label,
  leftSection,
}: CommitNumberInputProps) {
  const display = displayOf(value);
  const [draft, setDraft] = useState<number | string>(display);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    setDraft(display);
  }, [display, rev]);

  const commit = () => {
    const parsed = parse(draft);
    setRev((r) => r + 1);
    if (parsed === "invalid") return;
    const current = typeof value === "number" && Number.isFinite(value) ? value : null;
    if (parsed === current) return;
    onCommit(parsed);
  };

  return (
    <NumberInput
      size="xs"
      hideControls
      value={draft}
      onChange={setDraft}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setDraft(display);
      }}
      decimalScale={decimalScale}
      readOnly={readOnly}
      variant={readOnly ? "filled" : "default"}
      placeholder={placeholder}
      label={label}
      leftSection={leftSection}
      error={Boolean(error)}
      aria-label={ariaLabel}
      aria-invalid={Boolean(error) || undefined}
      title={error ?? undefined}
      w={width}
      styles={{ input: { fontVariantNumeric: "tabular-nums", paddingInline: 6, ...style } }}
    />
  );
}

export interface CommitTextInputProps {
  value: string;
  onCommit: (value: string) => void;
  ariaLabel: string;
  error?: string | null;
  width?: number | string;
  placeholder?: string;
  monospace?: boolean;
  size?: "xs" | "sm" | "md";
  variant?: "default" | "unstyled" | "filled";
  inputStyle?: CSSProperties;
}

export function CommitTextInput({
  value,
  onCommit,
  ariaLabel,
  error,
  width = 80,
  placeholder,
  monospace,
  size = "xs",
  variant,
  inputStyle,
}: CommitTextInputProps) {
  const [draft, setDraft] = useState(value);
  const [rev, setRev] = useState(0);
  useEffect(() => {
    setDraft(value);
  }, [value, rev]);
  const commit = () => {
    setRev((r) => r + 1);
    if (draft !== value) onCommit(draft);
  };
  return (
    <TextInput
      size={size}
      variant={variant}
      value={draft}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setDraft(value);
      }}
      placeholder={placeholder}
      error={Boolean(error)}
      aria-label={ariaLabel}
      aria-invalid={Boolean(error) || undefined}
      title={error ?? draft}
      w={width}
      styles={{
        input: {
          paddingInline: 6,
          fontFamily: monospace ? "var(--mantine-font-family-monospace)" : undefined,
          fontWeight: monospace ? 600 : undefined,
          ...inputStyle,
        },
      }}
    />
  );
}
