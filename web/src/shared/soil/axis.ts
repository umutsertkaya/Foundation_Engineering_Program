/** Small layout helpers for to-scale soil drawings (no engineering content). */

/** "Nice" tick values covering [min, max] with at most ~maxTicks ticks (steps 1, 2, 2.5, 5 × 10^k). */
export function niceTicks(min: number, max: number, maxTicks = 8): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || maxTicks < 1) {
    return Number.isFinite(min) ? [min] : [];
  }
  const raw = (max - min) / maxTicks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const steps = [1, 2, 2.5, 5, 10];
  let step = mag * 10;
  for (const s of steps) {
    if (s * mag >= raw) {
      step = s * mag;
      break;
    }
  }
  const out: number[] = [];
  const start = Math.ceil(min / step - 1e-9) * step;
  for (let v = start; v <= max + step * 1e-6; v += step) {
    out.push(Math.round(v * 1e6) / 1e6 + 0); // + 0 turns -0 into 0
  }
  return out;
}

/** Decimal places suited to a tick list. */
export function tickDecimals(ticks: number[]): number {
  return ticks.some((t) => Math.abs(t - Math.round(t)) > 1e-6) ? 1 : 0;
}

/**
 * Spreads label anchor positions (sorted ascending, pixels) so neighbours are at least
 * `minGap` apart while staying inside [lo, hi] when possible. Returns new positions.
 */
export function spreadLabels(desired: number[], minGap: number, lo: number, hi: number): number[] {
  const n = desired.length;
  if (n === 0) return [];
  const y = desired.map((d) => Math.min(Math.max(d, lo), hi));
  for (let i = 1; i < n; i += 1) {
    y[i] = Math.max(y[i], y[i - 1] + minGap);
  }
  if (y[n - 1] > hi) {
    y[n - 1] = hi;
    for (let i = n - 2; i >= 0; i -= 1) {
      y[i] = Math.min(y[i], y[i + 1] - minGap);
    }
  }
  if (y[0] < lo) {
    // Not enough room: distribute evenly over the whole range.
    const span = hi - lo;
    return desired.map((_, i) => (n === 1 ? lo : lo + (span * i) / (n - 1)));
  }
  return y;
}
