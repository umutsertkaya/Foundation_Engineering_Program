import { describe, expect, it } from "vitest";
import { ApiError } from "./client";
import { errorMessage } from "./errorMessage";
import { layerLabel } from "../soil/format";

const t = ((key: string, options?: Record<string, unknown>) =>
  key === "error.detail.layer_su_missing" ? `katman ${options?.top}–${options?.bottom}` : String(options?.defaultValue ?? key)) as never;

describe("errorMessage", () => {
  it("uses the translated detail when the server sent a message code", () => {
    const err = new ApiError(400, {
      code: "engine_error", message: "Layer 2–5 m: design s_u not set",
      details: { message_code: "layer_su_missing", params: { top: 2, bottom: 5 } }, missing_factors: [],
    });
    expect(errorMessage(err, t)).toBe("katman 2–5");
  });

  it("falls back to the server message for unknown codes and plain errors", () => {
    const err = new ApiError(400, {
      code: "engine_error", message: "raw", details: { message_code: "unknown_code" }, missing_factors: [],
    });
    expect(errorMessage(err, t)).toBe("raw");
    expect(errorMessage(new Error("boom"), t)).toBe("boom");
  });
});

describe("layerLabel", () => {
  it("names a layer by depth range and USCS, never by its id", () => {
    expect(layerLabel({ top: 0, bottom: 2.5, uscs: "SW" })).toBe("0.00–2.50 m · SW");
    expect(layerLabel({ top: 3, bottom: 4, uscs: null })).toBe("3.00–4.00 m");
  });
});
