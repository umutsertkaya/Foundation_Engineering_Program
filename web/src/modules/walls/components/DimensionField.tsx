import type { ReactNode } from "react";
import { NumberInput, Text } from "@mantine/core";
import "./wallMarkers.css";

export interface DimensionFieldProps {
  /** Dimension id shared with the drawing callouts (see `WALL_MARKER_FIELDS`). */
  field: string;
  label: string;
  value: number;
  /** 1-based callout number; omit for a field without a callout. */
  n?: number;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  decimalScale?: number;
  focused?: boolean;
  description?: ReactNode;
  onChange: (value: string | number) => void;
  onFocusField?: (field: string | null) => void;
}

/** Number input for one wall dimension: label with a numbered callout, unit suffix, and focus reporting for the drawing. */
export function DimensionField({
  field, label, value, n, unit = "m", min, max, step, decimalScale = 2, focused = false, description, onChange, onFocusField,
}: DimensionFieldProps) {
  return (
    <NumberInput
      label={
        <>
          {n != null && <span className="gt-wall-mk" data-n={n} data-focused={focused} aria-hidden="true" />}
          {label}
        </>
      }
      description={description}
      value={value}
      min={min}
      max={max}
      step={step}
      decimalScale={decimalScale}
      rightSection={<Text component="span" fz={12} c="dimmed">{unit}</Text>}
      rightSectionWidth={34}
      onChange={onChange}
      onFocus={() => onFocusField?.(field)}
      onBlur={() => onFocusField?.(null)}
    />
  );
}
