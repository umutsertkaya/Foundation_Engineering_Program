import i18n from "../../app/i18n";

/** Locale number with fixed decimals; "—" for a missing or non-finite value. */
export function fmt(v: number | null | undefined, digits = 2): string {
  return typeof v === "number" && Number.isFinite(v)
    ? new Intl.NumberFormat(i18n.language, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)
    : "—";
}
