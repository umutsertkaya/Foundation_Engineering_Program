import katex from "katex";
import { describe, expect, it } from "vitest";
import { TOPICS } from "../content";
import { toTexLines } from "../math/toTex";
import type { Block } from "../content/types";

function exprs(blocks: Block[]): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.type === "formula") out.push(b.expr);
    if (b.type === "derivation") for (const s of b.steps) if (s.expr) out.push(s.expr);
    if (b.type === "worked") for (const s of b.steps) out.push(s.expr);
  }
  return out;
}

describe("formula typesetting", () => {
  it("converts representative notation", () => {
    expect(toTexLines("K_a = tan²(45° − φ/2)")[0]).toContain("\operatorname{tan}");
    expect(toTexLines("σ_h = K_a · σ_v − 2c' √K_a")[0]).toContain("\sqrt{");
  });
  it("keeps decimal commas as plain commas (no escaped braces)", () => {
    const tex = toTexLines("x = 6,00 + a^1,5 − 0,65·b")[0];
    expect(tex).not.toContain("\{,\}");
    expect(tex).toContain("6{,}00");
  });
  it("renders every formula in every topic without KaTeX errors", () => {
    const bad: string[] = [];
    for (const tp of TOPICS) {
      for (const e of exprs([...tp.blocks, ...(tp.student ?? [])])) {
        for (const l of toTexLines(e)) {
          try { katex.renderToString(l, { throwOnError: true, strict: "ignore" }); }
          catch (err) { bad.push(`${tp.id}: ${e.split("\n")[0].slice(0, 70)} => ${(err as Error).message.slice(0, 80)}`); }
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
