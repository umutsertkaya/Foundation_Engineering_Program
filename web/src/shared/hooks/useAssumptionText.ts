import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Translate } from "../warnings";

export interface CodedText {
  text: string;
  code?: string | null;
  params?: Record<string, unknown> | null;
}

const PREFIXES = ["report.assumption.", "sheet_pile.assumption."];

/** Returns `(assumption) => text in the UI language`; uncoded or unknown ones keep the stored text. */
export function useAssumptionText(): (item: CodedText) => string {
  const { t, i18n } = useTranslation();
  return useCallback(
    (item: CodedText) => {
      if (!item.code) return item.text;
      const key = PREFIXES.map((prefix) => `${prefix}${item.code}`).find((k) => i18n.exists(k));
      if (!key) return item.text;
      const replace: Record<string, string | number | boolean> = {};
      for (const [name, value] of Object.entries(item.params ?? {})) {
        replace[name] = typeof value === "string" || typeof value === "number" || typeof value === "boolean"
          ? value
          : JSON.stringify(value);
      }
      return String((t as unknown as Translate)(key, { replace }));
    },
    [t, i18n],
  );
}
