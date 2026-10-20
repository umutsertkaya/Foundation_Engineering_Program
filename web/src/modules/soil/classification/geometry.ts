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

/** Liang-Barsky clip of one segment to the box; null when it lies fully outside. */
function clipSegment(a: Pt, b: Pt, xr: Range, yr: Range, lx: boolean, ly: boolean): [Pt, Pt] | null {
  const tx = (v: number) => (lx ? Math.log10(v) : v);
  const ty = (v: number) => (ly ? Math.log10(v) : v);
  const ux = (v: number) => (lx ? 10 ** v : v);
  const uy = (v: number) => (ly ? 10 ** v : v);
  const x0 = tx(a.x), y0 = ty(a.y), dx = tx(b.x) - x0, dy = ty(b.y) - y0;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, x0 - tx(xr.min)], [dx, tx(xr.max) - x0], [-dy, y0 - ty(yr.min)], [dy, ty(yr.max) - y0],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) { if (r > t1) return null; t0 = Math.max(t0, r); }
      else { if (r < t0) return null; t1 = Math.min(t1, r); }
    }
  }
  return [
    t0 === 0 ? a : { x: ux(x0 + t0 * dx), y: uy(y0 + t0 * dy) },
    t1 === 1 ? b : { x: ux(x0 + t1 * dx), y: uy(y0 + t1 * dy) },
  ];
}

/**
 * Splits a sampled polyline into runs inside both ranges; segments crossing the boundary are cut
 * at the boundary. `logX` / `logY` interpolate in log10 space for log axes.
 */
export function clipSegments(points: Pt[], xr: Range, yr: Range, logX = false, logY = false): Pt[][] {
  const out: Pt[][] = [];
  let run: Pt[] = [];
  const flush = () => { if (run.length > 1) out.push(run); run = []; };
  const ok = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)
    && (!logX || p.x > 0) && (!logY || p.y > 0));
  for (let i = 1; i < ok.length; i += 1) {
    const seg = clipSegment(ok[i - 1], ok[i], xr, yr, logX, logY);
    if (!seg) { flush(); continue; }
    const [s, e] = seg;
    const last = run[run.length - 1];
    if (last && (last.x !== s.x || last.y !== s.y)) flush();
    if (run.length === 0) run.push(s);
    run.push(e);
    if (e !== ok[i]) flush();
  }
  flush();
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
