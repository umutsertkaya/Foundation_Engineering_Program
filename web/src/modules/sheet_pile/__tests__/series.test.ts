import { describe, expect, it } from "vitest";
import { decimateSheetPileSeries } from "../series";

describe("decimateSheetPileSeries", () => {
  it("keeps endpoints and maximum absolute moment in a dense series", () => {
    const points = Array.from({ length: 5000 }, (_, index) => {
      const z = index * 0.002;
      return {
        z,
        shear: Math.sin(z * 0.5),
        moment: index === 3210 ? -250 : Math.sin(z * 0.5) * 20,
        net: z,
      };
    });

    const rows = decimateSheetPileSeries(points);
    expect(rows.length).toBeLessThanOrEqual(80);
    expect(rows[0]).toBe(points[0]);
    expect(rows.at(-1)).toBe(points.at(-1));
    expect(rows).toContain(points[3210]);
  });

  it("leaves short series unchanged", () => {
    const points = Array.from({ length: 20 }, (_, index) => ({ z: index / 100, shear: index, moment: index, net: index }));
    expect(decimateSheetPileSeries(points)).toEqual(points);
  });
});
