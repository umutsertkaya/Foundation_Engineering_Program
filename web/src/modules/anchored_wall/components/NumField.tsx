import { NumberInput, type NumberInputProps } from "@mantine/core";
import type { Num } from "../inputs";

type Props = Omit<NumberInputProps, "value" | "onChange"> & {
  value: Num;
  onChange: (v: Num) => void;
};

/** Number field whose empty state is "" (never 0): empty required inputs stay visibly missing. */
export function NumField({ value, onChange, ...rest }: Props) {
  return (
    <NumberInput
      {...rest}
      value={value}
      onChange={(v) => onChange(typeof v === "number" && Number.isFinite(v) ? v : "")}
      hideControls
    />
  );
}
