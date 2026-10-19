import { describe, expect, it } from "vitest";
import { WallCrossSection } from "../components/WallCrossSection";
import { buildSectionLayout, type Pt } from "../components/sectionLayout";
import { CANTILEVER, GRAVITY, layer, renderThemed, soilModel } from "./helpers";

const xs = (poly: Pt[]) => poly.map((p) => p[0]);
const ys = (poly: Pt[]) => poly.map((p) => p[1]);
const span = (values: number[]) => Math.max(...values) - Math.min(...values);

describe("buildSectionLayout: cantilever", () => {
  const L = buildSectionLayout({ wallType: "cantilever", geometry: CANTILEVER, height: 5 });
  const [base, stem] = L.wall;

  it("derives B, H, D from the geometry", () => {
    expect(L.B).toBeCloseTo(0.9 + 0.5 + 3.2, 9);
    expect(L.H).toBe(5);
    expect(L.D).toBe(0.6);
    expect(L.baseThickness).toBe(0.5);
  });

  it("draws the base slab and stem to scale", () => {
    expect(span(xs(base)) / L.scale).toBeCloseTo(L.B, 1);
    expect(span(ys(base)) / L.scale).toBeCloseTo(0.5, 1);
    expect(span(ys(stem)) / L.scale).toBeCloseTo(4.5, 1);
    // stem back face sits at toe + stem_bottom from the toe edge
    const baseLeft = Math.min(...xs(base));
    expect(Math.max(...xs(stem)) - baseLeft).toBeCloseTo((0.9 + 0.5) * L.scale, 0);
    // stem is tapered: 0.3 m at the top, 0.5 m at the bottom
    const top = stem.filter((p) => p[1] === Math.min(...ys(stem)));
    expect(span(xs(top)) / L.scale).toBeCloseTo(0.3, 1);
  });

  it("puts the toe label anchor over the toe and the heel anchor over the heel", () => {
    const baseLeft = Math.min(...xs(base));
    expect((L.anchors.toe![0] - baseLeft) / L.scale).toBeCloseTo(0.45, 1);
    expect((L.anchors.heel![0] - baseLeft) / L.scale).toBeCloseTo(4.6 - 1.6, 1);
    expect(L.anchors.stem).not.toBeNull();
    expect(L.anchors.wall).toBeNull();
  });

  it("puts the front ground at D above the base and the retained ground at the wall top", () => {
    const baseBottom = Math.max(...ys(base));
    expect((baseBottom - L.groundFront[0][1]) / L.scale).toBeCloseTo(0.6, 1);
    const wallTop = Math.min(...ys(stem));
    expect(L.groundRetained[0][1]).toBeCloseTo(wallTop, 1);
    expect(L.groundRetained[1][1]).toBeCloseTo(wallTop, 1); // no slope
  });

  it("uses the actual embedment, including 0, instead of a default", () => {
    for (const embedment of [0, 1.2]) {
      const lay = buildSectionLayout({ wallType: "cantilever", geometry: { ...CANTILEVER, embedment }, height: 5 });
      expect(lay.D).toBe(embedment);
      expect((lay.baseY - lay.groundFront[0][1]) / lay.scale).toBeCloseTo(embedment, 1);
    }
    const gravity = buildSectionLayout({ wallType: "gravity", geometry: { ...GRAVITY, embedment: 0 }, height: 5 });
    expect(gravity.D).toBe(0);
  });

  it("does not distort real dimensions: small values are drawn to scale", () => {
    const thin = buildSectionLayout({ wallType: "cantilever", geometry: { ...CANTILEVER, stem_top: 0.05, stem_bottom: 0.08 }, height: 5 });
    const [, stem] = thin.wall;
    const bottom = stem.filter((p) => p[1] === Math.max(...ys(stem)));
    expect(span(xs(bottom)) / thin.scale).toBeCloseTo(0.08, 2);
  });

  it("raises the retained ground line by tan(beta)", () => {
    const sloped = buildSectionLayout({ wallType: "cantilever", geometry: CANTILEVER, height: 5, backfillSlope: 20 });
    const [a, b] = sloped.groundRetained;
    const rise = (a[1] - b[1]) / sloped.scale;
    const run = (b[0] - a[0]) / sloped.scale;
    expect(rise / run).toBeCloseTo(Math.tan((20 * Math.PI) / 180), 2);
  });
});

describe("buildSectionLayout: gravity", () => {
  const L = buildSectionLayout({ wallType: "gravity", geometry: GRAVITY, height: 5 });

  it("draws a trapezoid with the top width and set-back of the geometry", () => {
    expect(L.wall).toHaveLength(1);
    const poly = L.wall[0];
    const bottom = poly.filter((p) => p[1] === Math.max(...ys(poly)));
    const top = poly.filter((p) => p[1] === Math.min(...ys(poly)));
    expect(span(xs(bottom)) / L.scale).toBeCloseTo(3, 1);
    expect(span(xs(top)) / L.scale).toBeCloseTo(0.8, 1);
    // back face top is set back 0.2 m from the heel
    expect((Math.max(...xs(bottom)) - Math.max(...xs(top))) / L.scale).toBeCloseTo(0.2, 1);
    expect(L.anchors.wall).not.toBeNull();
    expect(L.anchors.toe).toBeNull();
    expect(L.anchors.heel).toBeNull();
  });
});

describe("buildSectionLayout: soil and water", () => {
  const soil = soilModel({
    gwt: 2,
    fill: [layer("F1", 0, 1.5), layer("F2", 1.5, 4)],
    layers: [layer("L1", 0, 4), layer("L2", 4, 6), layer("L3", 6, 12)],
  });
  const L = buildSectionLayout({ wallType: "cantilever", geometry: CANTILEVER, height: 4.5, soil });

  it("splits the soil into backfill, front and foundation bands in depth order", () => {
    const sides = (s: string) => L.bands.filter((b) => b.side === s).map((b) => b.layerId);
    // fill 0-4 m replaces the profile on the retained side; the profile continues below it (L2 from 4 m)
    expect(sides("backfill")).toEqual(["F1", "F2", "L2"]);
    // the front side (ground at z = 3.9 m) sees the profile itself
    expect(sides("front")).toEqual(["L1", "L2"]);
    expect(sides("foundation")).toEqual(["L2", "L3"]);
    const f1 = L.bands.find((b) => b.layerId === "F1")!;
    const f2 = L.bands.find((b) => b.layerId === "F2")!;
    expect(f1.y1).toBeCloseTo(f2.y0, 5); // layer boundary at z = 1.5
    expect((f2.y1 - f1.y1) / L.scale).toBeCloseTo(2.5, 1);
  });

  it("places the water table at its depth below the retained ground on both sides", () => {
    const retained = L.water.find((w) => w.side === "retained")!;
    const front = L.water.find((w) => w.side === "front")!;
    const f1 = L.bands.find((b) => b.layerId === "F1")!;
    expect((retained.y - f1.y0) / L.scale).toBeCloseTo(2, 1);
    expect(retained.y).toBeCloseTo(front.y, 5);
    expect(retained.inherited).toBe(true);
    expect(retained.visible).toBe(true);
  });

  it("uses a side-specific water table when the structure defines one", () => {
    const own = { ...soil, gwt_front: { depth_insitu: 4.2, depth_design: 4.2, depth_seismic: 4.2 } };
    const lay = buildSectionLayout({ wallType: "cantilever", geometry: CANTILEVER, height: 4.5, soil: own });
    const front = lay.water.find((w) => w.side === "front")!;
    expect(front.inherited).toBe(false);
    expect(front.z).toBe(4.2);
  });

  it("marks a water table far below the drawn foundation as not visible", () => {
    const lay = buildSectionLayout({ wallType: "cantilever", geometry: CANTILEVER, height: 4.5, soil: soilModel({ gwt: 99 }) });
    expect(lay.water.every((w) => !w.visible)).toBe(true);
  });

  it("has neither bands nor water without a soil model", () => {
    const lay = buildSectionLayout({ wallType: "cantilever", geometry: CANTILEVER, height: 4.5 });
    expect(lay.bands).toEqual([]);
    expect(lay.water).toEqual([]);
    expect(lay.hasSoil).toBe(false);
  });
});

describe("WallCrossSection", () => {
  const soil = soilModel({ gwt: 2, fill: [layer("F1", 0, 4.5)] });

  it("renders the wall parts, soil bands, water table and labels from i18n", () => {
    renderThemed(<WallCrossSection wallType="cantilever" geometry={CANTILEVER} height={5} soil={soil} />);
    const svg = document.querySelector("svg")!;
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toContain("H = 5.00");
    expect(svg.querySelector('[data-part="base"]')).not.toBeNull();
    expect(svg.querySelector('[data-part="stem"]')).not.toBeNull();
    expect(svg.querySelectorAll('[data-part="water"]')).toHaveLength(2);
    expect(svg.querySelector('[data-part="band"][data-layer-id="F1"]')).not.toBeNull();
    const text = svg.textContent ?? "";
    expect(text).toContain("Gövde");
    expect(text).toContain("YASS 2.00 m");
    expect(text).toContain("Taban B = 4.60 m");
    expect(text).not.toMatch(/walls\.|web\.section/);
  });

  it("renders the gravity wall and works without soil, in dark mode too", () => {
    renderThemed(<WallCrossSection wallType="gravity" geometry={GRAVITY} height={5} />, "dark");
    const svg = document.querySelector("svg")!;
    expect(svg.querySelector('[data-part="wall"]')).not.toBeNull();
    expect(svg.querySelector('[data-part="retained-soil"]')).not.toBeNull();
    expect(svg.querySelectorAll('[data-part="water"]')).toHaveLength(0);
  });

  it("is theme-aware: only theme variables and palette colours, no fixed black or white", () => {
    renderThemed(<WallCrossSection wallType="cantilever" geometry={CANTILEVER} height={5} soil={soil} />);
    const html = document.querySelector("svg")!.outerHTML;
    expect(html).toContain("var(--mantine-color-text)");
    expect(html).toContain("var(--mantine-color-body)");
    expect(html).not.toMatch(/(fill|stroke)="(#000|#fff|black|white)"/i);
  });
});
