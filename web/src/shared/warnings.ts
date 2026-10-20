/**
 * Warning strings are `"code"` or `"code: key=value key2=value2"` where `code` is the full i18n key and
 * every value is one compact JSON value (see `format_warning` / `parse_warning` in
 * geotek/core/warning_codes.py). This module mirrors that parser and renders `t(code, params)`,
 * falling back to the raw string when the key is missing or the string is not in that format.
 */
/** Values go under `replace` so a parameter named count, context, lng, ns, defaultValue... cannot change lookup behaviour. */
export type Translate = (key: string, options?: { replace?: Record<string, string | number | boolean> }) => string;

export interface ParsedWarning {
  code: string;
  params: Record<string, unknown>;
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** End index (exclusive) of the JSON value that starts at `start`, or -1 when it is unterminated. */
function jsonValueEnd(text: string, start: number): number {
  const first = text[start];
  if (first === undefined) return -1;
  if (first === '"' || first === "[" || first === "{") {
    let depth = 0;
    let inString = false;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (inString) {
        if (ch === "\\") i += 1;
        else if (ch === '"') {
          inString = false;
          if (depth === 0) return i + 1;
        }
      } else if (ch === '"') inString = true;
      else if (ch === "[" || ch === "{") depth += 1;
      else if (ch === "]" || ch === "}") {
        depth -= 1;
        if (depth === 0) return i + 1;
      }
    }
    return -1;
  }
  // Bare token (number, true, false, null): up to the next space.
  const space = text.indexOf(" ", start);
  return space < 0 ? text.length : space;
}

/** Parse one warning string; returns null when it is not in the `code[: key=value ...]` format. */
export function parseWarning(message: string): ParsedWarning | null {
  const colon = message.indexOf(":");
  const code = colon < 0 ? message : message.slice(0, colon);
  if (code.length === 0 || /\s/.test(code)) return null;
  const params: Record<string, unknown> = {};
  if (colon < 0) return { code, params };
  const context = message.slice(colon + 1);
  if (!context.startsWith(" ") || context.trim().length === 0) return null;
  let rest = context.slice(1);
  while (rest.length > 0) {
    const equals = rest.indexOf("=");
    if (equals < 0) return null;
    const key = rest.slice(0, equals);
    if (!IDENTIFIER.test(key) || key in params) return null;
    const valueStart = equals + 1;
    const end = jsonValueEnd(rest, valueStart);
    if (end < 0) return null;
    try {
      params[key] = JSON.parse(rest.slice(valueStart, end));
    } catch {
      return null;
    }
    rest = rest.slice(end);
    if (rest.length > 0) {
      if (!rest.startsWith(" ") || rest.length === 1) return null;
      rest = rest.slice(1);
    }
  }
  return { code, params };
}

/** i18next interpolates primitives; arrays and objects become compact JSON text. */
function interpolationValue(value: unknown): string | number | boolean {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

/**
 * Localised text for one warning string. `exists` tells whether the i18n key is defined;
 * a missing key (or a free-text message) is shown as the raw string.
 */
export function renderWarning(
  message: string,
  t: Translate,
  exists: (key: string) => boolean,
): string {
  const parsed = parseWarning(message);
  if (!parsed || !exists(parsed.code)) return message;
  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(parsed.params)) params[key] = interpolationValue(value);
  return String(t(parsed.code, { replace: params }));
}
