import type { TFunction } from "i18next";
import { ApiError } from "./client";

/**
 * Message text for an API error: the translated `error.detail.<message_code>` when the server sent a
 * stable code (with its params), otherwise the server's fallback message.
 */
export function errorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiError) {
    const code = error.details.message_code;
    if (typeof code === "string" && code.length > 0) {
      const params = error.details.params;
      const values = params && typeof params === "object" ? (params as Record<string, unknown>) : {};
      return t(`error.detail.${code}`, { ...values, defaultValue: error.message });
    }
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Alert title for an error: the catalog `error.<code>` title, or the generic `fallbackKey` title when the
 * error is not an ApiError or its code has no catalog entry (never the raw key).
 */
export function errorTitle(
  error: unknown,
  t: TFunction,
  exists: (key: string) => boolean,
  fallbackKey = "error.engine_error",
): string {
  const key = error instanceof ApiError ? `error.${error.code}` : null;
  return t(key !== null && exists(key) ? key : fallbackKey);
}
