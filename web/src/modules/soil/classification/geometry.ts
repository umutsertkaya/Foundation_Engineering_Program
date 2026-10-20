/** Pure chart geometry for the classification charts (scales, clipping, paths); no engineering content. */

export interface Range {
  min: number;
  max: number;
}

export interface Pt {
  x: number;
  y: number;
}

export interface Plot {
  width: number;
  height: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const PLOT: Plot = { width: 640, height: 480, left: 56, top: 16, right: 16, bottom: 48 };

/** Maps a value in `range` to pixels along [from, to]; `log` uses log10 spacing. */
export function scale(value: number, range: Range, from: number, to: number, log: boolean): number {
  const f = log
    ? (Math.log10(value) - Math.log10(range.min)) / (Math.log10(range.max) - Math.log10(range.min))
    : (value - range.min) / (range.max - range.min);
  return from + f * (to - from);
}

export function inside(p: Pt, xr: Range, yr: Range): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y)
    && p.x >= xr.min && p.x <= xr.max && p.y >= yr.min && p.y <= yr.max;
}

/** Splits a sampled polyline into runs of consecutive points that lie inside both ranges. */
export function clipSegments(points: Pt[], xr: Range, yr: Range): Pt[][] {
  const out: Pt[][] = [];
  let run: Pt[] = [];
  for (const p of points) {
    if (inside(p, xr, yr)) {
      run.push(p);
    } else if (run.length > 0) {
      out.push(run);
      run = [];
    }
  }
  if (run.length > 0) out.push(run);
  return out;
}

export function pathOf(points: Pt[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

/** Decade ticks 10^k inside [min, max]. */
export function decadeTicks(range: Range): number[] {
  const out: number[] = [];
  for (let k = Math.ceil(Math.log10(range.min) - 1e-9); k <= Math.floor(Math.log10(range.max) + 1e-9); k += 1) {
    out.push(10 ** k);
  }
  return out;
}

/** Linear interpolation of the LL where a sampled line crosses `value`; null when it never does. */
export function crossingLL(line: { LL: number; PI: number | null }[], value: number): number | null {
  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1];
    const b = line[i];
    if (a.PI === null || b.PI === null) continue;
    if ((a.PI - value) * (b.PI - value) <= 0 && a.PI !== b.PI) {
      return a.LL + ((value - a.PI) / (b.PI - a.PI)) * (b.LL - a.LL);
    }
  }
  return null;
}

/** Zone → fill colour; zones 8 and 9 are disabled in the engine by default but keep a colour. */
export const ZONE_COLORS: Record<number, string> = {
  1: "#8e6bbf",
  2: "#7a5230",
  3: "#2e7d32",
  4: "#7cb342",
  5: "#f9a825",
  6: "#ef6c00",
  7: "#c62828",
  8: "#546e7a",
  9: "#90a4ae",
};
