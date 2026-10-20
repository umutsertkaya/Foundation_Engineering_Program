import type { ApiErrorDTO, MissingFactorDTO } from "./types";

const BASE_URL = "/api";

let mockOverride: boolean | null = null;

export function setMockMode(enabled: boolean | null): void {
  mockOverride = enabled;
}

export function isMockMode(): boolean {
  if (mockOverride !== null) {
    return mockOverride;
  }
  return import.meta.env.VITE_API_MOCK === "1";
}

type MutationListener = (method: string, path: string) => void;

const mutationListeners = new Set<MutationListener>();

/**
 * Subscribe to every successful non-GET request (the project may have changed); returns the unsubscribe.
 * Listener failures never affect the request.
 */
export function onMutation(listener: MutationListener): () => void {
  mutationListeners.add(listener);
  return () => {
    mutationListeners.delete(listener);
  };
}

function notifyMutation(method: string, path: string): void {
  if (method.toUpperCase() === "GET") return;
  for (const listener of [...mutationListeners]) {
    try {
      listener(method, path);
    } catch {
      // A listener must not turn a successful request into a failure.
    }
  }
}

export class ApiError extends Error implements ApiErrorDTO {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly missing_factors: MissingFactorDTO[];

  constructor(status: number, payload: ApiErrorDTO) {
    super(payload.message);
    this.name = "ApiError";
    this.status = status;
    this.code = payload.code;
    this.details = payload.details ?? {};
    this.missing_factors = payload.missing_factors ?? [];
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

function fallbackCodeForStatus(status: number): string {
  if (status === 404) return "not_found";
  if (status === 409) return "stale_structure";
  if (status === 422) return "validation";
  if (status === 501) return "not_implemented";
  if (status >= 500) return "engine_error";
  return "validation";
}

export function parseApiError(status: number, body: unknown): ApiError {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const rec = body as Record<string, unknown>;
    const code =
      typeof rec.code === "string" && rec.code.length > 0
        ? rec.code
        : fallbackCodeForStatus(status);
    const message =
      typeof rec.message === "string" && rec.message.length > 0
        ? rec.message
        : `HTTP ${status}`;
    const details =
      rec.details && typeof rec.details === "object" && !Array.isArray(rec.details)
        ? (rec.details as Record<string, unknown>)
        : {};
    const missing_factors = Array.isArray(rec.missing_factors)
      ? (rec.missing_factors as MissingFactorDTO[])
      : [];
    return new ApiError(status, { code, message, details, missing_factors });
  }
  return new ApiError(status, {
    code: fallbackCodeForStatus(status),
    message: typeof body === "string" && body.length > 0 ? body : `HTTP ${status}`,
    details: {},
    missing_factors: [],
  });
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (isMockMode()) {
    // Dynamic import keeps the mock out of the production bundle's main chunk.
    const { mockRequest } = await import("./mock/index");
    const { status, data } = await mockRequest(method, path, body);
    if (status >= 400) {
      throw parseApiError(status, data);
    }
    notifyMutation(method, path);
    return data as T;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers:
        body !== undefined
          ? { "Content-Type": "application/json", Accept: "application/json" }
          : { Accept: "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(0, {
      code: "network",
      message: err instanceof Error ? err.message : "Network request failed",
      details: {},
      missing_factors: [],
    });
  }

  let parsed: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    throw parseApiError(response.status, parsed);
  }

  notifyMutation(method, path);
  return parsed as T;
}

export interface BlobResult {
  blob: Blob;
  filename: string | null;
}

function filenameFromDisposition(header: string | null): string | null {
  const match = header ? /filename="?([^";]+)"?/i.exec(header) : null;
  return match ? match[1] : null;
}

/** Like `request`, but returns the binary body (file downloads); errors still parse as ApiError. */
export async function request_blob(method: string, path: string, body?: unknown): Promise<BlobResult> {
  if (isMockMode()) {
    const { mockRequest } = await import("./mock/index");
    const { status, data } = await mockRequest(method, path, body);
    if (status >= 400) {
      throw parseApiError(status, data);
    }
    notifyMutation(method, path);
    return { blob: new Blob([String(data)]), filename: null };
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers:
        body !== undefined
          ? { "Content-Type": "application/json", Accept: "*/*" }
          : { Accept: "*/*" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(0, {
      code: "network",
      message: err instanceof Error ? err.message : "Network request failed",
      details: {},
      missing_factors: [],
    });
  }

  if (!response.ok) {
    const text = await response.text();
    let parsed: unknown = text || null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // Keep the raw text as the message.
    }
    throw parseApiError(response.status, parsed);
  }
  notifyMutation(method, path);
  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(response.headers.get("Content-Disposition")),
  };
}
