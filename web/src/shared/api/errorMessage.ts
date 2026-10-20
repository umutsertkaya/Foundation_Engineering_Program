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
