export interface SheetPileSeriesPoint {
  z: number | null;
  shear: number | null;
  moment: number | null;
  net: number | null;
}

/** Reduce dense result series while preserving endpoints and key shear/moment features. */
export function decimateSheetPileSeries<T extends SheetPileSeriesPoint>(
  points: readonly T[],
  depthInterval = 0.25,
): T[] {
  if (points.length <= 80 || depthInterval <= 0) return [...points];

  const kept = new Set<number>([0, points.length - 1]);
  let maxMomentIndex = -1;
  let maxMoment = -Infinity;
  points.forEach((point, index) => {
    if (typeof point.moment === "number" && Number.isFinite(point.moment) && Math.abs(point.moment) > maxMoment) {
      maxMoment = Math.abs(point.moment);
      maxMomentIndex = index;
    }
  });
  if (maxMomentIndex >= 0) kept.add(maxMomentIndex);

  for (const series of ["shear", "moment"] as const) {
    const valid = points.flatMap((point, index) =>
      typeof point[series] === "number" && Number.isFinite(point[series]) ? [{ index, value: point[series] as number }] : [],
    );
    for (let i = 1; i < valid.length; i += 1) {
      const previous = valid[i - 1];
      const current = valid[i];
      if ((previous.value < 0 && current.value > 0) || (previous.value > 0 && current.value < 0)) {
        kept.add(previous.index);
        kept.add(current.index);
      }
    }
    for (let i = 1; i < valid.length - 1; i += 1) {
      const before = valid[i - 1];
      const current = valid[i];
      const after = valid[i + 1];
      const leftSlope = current.value - before.value;
      const rightSlope = after.value - current.value;
      if ((leftSlope > 0 && rightSlope <= 0) || (leftSlope < 0 && rightSlope >= 0)) kept.add(current.index);
    }
  }

  const firstDepth = points[0].z;
  if (typeof firstDepth === "number" && Number.isFinite(firstDepth)) {
    let nextDepth = firstDepth + depthInterval;
    for (let index = 1; index < points.length - 1; index += 1) {
      const depth = points[index].z;
      if (typeof depth !== "number" || !Number.isFinite(depth)) continue;
      if (depth >= nextDepth) {
        kept.add(index);
        while (nextDepth <= depth) nextDepth += depthInterval;
      }
    }
  }

  return [...kept].sort((a, b) => a - b).map((index) => points[index]);
}
