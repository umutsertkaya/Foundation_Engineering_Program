import { describe, expect, it } from "vitest";
import { parseWarning, renderWarning, type Translate } from "../warnings";

describe("parseWarning (mirrors geotek.engine.layering.common.parse_warning)", () => {
  it("parses a bare code", () => {
    expect(parseWarning("layering.warning.log_missing")).toEqual({ code: "layering.warning.log_missing", params: {} });
  });

  it("parses compact JSON values of every kind", () => {
    expect(parseWarning('layering.warning.x: top=0.5 bottom=2 ok=true none=null ids=[1,2] box={"a":1}')).toEqual({
      code: "layering.warning.x",
      params: { top: 0.5, bottom: 2, ok: true, none: null, ids: [1, 2], box: { a: 1 } },
    });
  });

  it("keeps JSON strings that contain spaces, colons, equals signs and escaped quotes", () => {
    const parsed = parseWarning('a.b: message="a b: c=d \\"q\\"" next=1');
    expect(parsed?.params).toEqual({ message: 'a b: c=d "q"', next: 1 });
  });

  it("rejects malformed context", () => {
    for (const bad of [
      "", // empty
      "code:", // separator without context
      "code:x=1", // missing space after the colon
      "code: x=1  y=2", // two spaces
      "code: x=1 ", // trailing space
      "code: x", // no equals
      "code: 1x=2", // key is not an identifier
      "code: x=1 x=2", // duplicate key
      "code: x=nope", // not JSON
      'code: x="open', // unterminated string
      "code: x=[1,2", // unterminated array
      "has space: x=1", // space in the code
    ]) {
      expect(parseWarning(bad), bad).toBeNull();
    }
  });

  it("does not mistake free-text messages for coded warnings", () => {
    expect(parseWarning("Value not computable for these inputs: division by zero")).toBeNull();
  });
});

describe("renderWarning", () => {
  const catalog: Record<string, string> = {
    "layering.warning.gap": "Gap between {top} m and {bottom} m",
    "layering.warning.plain": "Plain text",
    "layering.warning.list": "Zones {ids}",
  };
  const t: Translate = (key, options = {}) =>
    catalog[key].replace(/\{(\w+)\}/g, (_, name: string) => String(options[name]));
  const exists = (key: string) => key in catalog;

  it("renders t(code, params) when the key exists", () => {
    expect(renderWarning("layering.warning.gap: top=1.5 bottom=3", t, exists)).toBe("Gap between 1.5 m and 3 m");
    expect(renderWarning("layering.warning.plain", t, exists)).toBe("Plain text");
  });

  it("passes arrays and objects as compact JSON text", () => {
    expect(renderWarning("layering.warning.list: ids=[1,2]", t, exists)).toBe("Zones [1,2]");
  });

  it("falls back to the raw string for a missing key, free text or malformed context", () => {
    expect(renderWarning("layering.warning.unknown: a=1", t, exists)).toBe("layering.warning.unknown: a=1");
    expect(renderWarning("Free text: not coded", t, exists)).toBe("Free text: not coded");
    expect(renderWarning("layering.warning.gap: top=", t, exists)).toBe("layering.warning.gap: top=");
  });

  it("does not guess a prefix for a bare code", () => {
    expect(renderWarning("phi_cv_assumed_equal_phi_eff: phi_eff=30", t, exists)).toBe(
      "phi_cv_assumed_equal_phi_eff: phi_eff=30",
    );
  });
});
