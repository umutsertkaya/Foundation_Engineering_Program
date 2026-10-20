import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { renderWarning, type Translate } from "../warnings";

/** Returns `(rawWarning) => localised text` bound to the current language. */
export function useWarningText(): (message: string) => string {
  const { t, i18n } = useTranslation();
  return useCallback(
    (message: string) => renderWarning(message, t as unknown as Translate, (key) => i18n.exists(key)),
    // `t` changes with the language, so the callback does too.
    [t, i18n],
  );
}
