import { C, Line, Plot, T, range } from "./plot";

const rad = (d: number) => (d * Math.PI) / 180;

/** Youd et al. (2001) piecewise depth-reduction factor. */
export const rdYoud = (z: number) =>
  z <= 9.15 ? 1 - 0.00765 * z : z <= 23 ? 1.174 - 0.0267 * z : 0.744 - 0.008 * z;
/** Boulanger & Idriss (2014) depth-reduction factor. */
export const rdBI = (z: number, m: number) => {
  const a = -1.012 - 1.126 * Math.sin(z / 11.73 + 5.133);
  const b = 0.106 + 0.118 * Math.sin(z / 11.28 + 5.142);
  return Math.exp(a + b * m);
};

export function LiqRdDepth() {
  return (
    <Plot
      label="rd - depth" xr={[0.4, 1]} yr={[0, 34]} flipY xl="rd" yl="z (m)"
      series={[
        { pts: range(0, 30, 60).map((z) => [rdYoud(z), z]), color: C.a, label: "Youd 2001" },
        ...[6.5, 7.5, 8.5].map((m, i) => ({
          pts: range(0, 34, 68).map((z) => [rdBI(z, m), z] as [number, number]),
          color: [C.c, C.d, C.b][i], dash: "5 3", label: `BI2014 M=${m}`,
        })),
      ]}
    />
  );
}

export function LiqCsrCrr() {
  // Illustrative only: smooth CSR demand and CRR capacity trends with depth.
  const z = range(0, 15, 30);
  return (
    <Plot
      label="CSR and CRR with depth (schematic)" xr={[0, 0.5]} yr={[0, 15]} flipY xl="CSR, CRR" yl="z (m)"
      series={[
        { pts: z.map((d) => [0.1 + 0.012 * d * (1 - 0.01 * d), d]), color: C.b, label: "CSR" },
        { pts: z.map((d) => [0.08 + 0.025 * d, d]), color: C.a, label: "CRR₇.₅" },
      ]}
      extra={(sx, sy) => (<g><T x={sx(0.27)} y={sy(11.5)}>FS = CRR / CSR</T><T x={sx(0.27)} y={sy(12.8)}>FS &lt; 1 ⇒ liq.</T></g>)}
    />
  );
}

export function LiqFsProfile() {
  const pts: [number, number][] = [[0.6, 2], [0.9, 4], [1.4, 6], [0.8, 8], [2.4, 10], [3, 12]];
  return (
    <Plot
      label="FS profile (schematic)" xr={[0, 3.5]} yr={[0, 14]} flipY xl="FS" yl="z (m)" series={[]}
      extra={(sx, sy) => (
        <g>
          <Line x1={sx(1)} y1={sy(0)} x2={sx(1)} y2={sy(14)} color={C.b} dash="5 3" />
          <T x={sx(1) + 3} y={sy(0.8)} color={C.b}>FS = 1</T>
          {pts.map(([f, d], i) => (
            <circle key={i} cx={sx(f)} cy={sy(d)} r={5} fill={f < 1 ? C.b : f < 1.2 ? C.d : C.c} />
          ))}
        </g>
      )}
    />
  );
}

export function BearFactorTrend() {
  const phis = range(1, 45, 44);
  const nq = (p: number) => Math.exp(Math.PI * Math.tan(rad(p))) * Math.tan(rad(45 + p / 2)) ** 2;
  const nc = (p: number) => (nq(p) - 1) / Math.tan(rad(p));
  const ng = (p: number) => 2 * (nq(p) + 1) * Math.tan(rad(p));
  return (
    <Plot
      label="Bearing capacity factors" xr={[0, 45]} yr={[1, 1000]} logY xl="φ (°)" yl="N" xt={[0, 10, 20, 30, 40]}
      series={[
        { pts: phis.map((p) => [p, nc(p)]), color: C.a, label: "Nc" },
        { pts: phis.map((p) => [p, nq(p)]), color: C.c, label: "Nq" },
        { pts: phis.map((p) => [p, Math.max(ng(p), 1)]), color: C.b, label: "Nγ (Vesic)" },
      ]}
    />
  );
}

export function ClassFcFromIc() {
  const ic = [1.5, 1.7, 2.0, 2.2, 2.6, 2.9, 3.2, 3.6];
  return (
    <Plot
      label="FC from Ic" xr={[1.2, 3.6]} yr={[0, 100]} xl="Ic" yl="FC (%)"
      series={[{ pts: ic.map((v) => [v, Math.min(100, Math.max(0, 80 * v - 137))]), color: C.a, label: "FC = 80·Ic − 137" }]}
    />
  );
}

export function ClassIcChart() {
  const circle = (r: number) => {
    const pts: [number, number][] = [];
    for (let a = 0; a <= 360; a += 3) {
      const lf = -1.22 + r * Math.cos(rad(a)), lq = 3.47 + r * Math.sin(rad(a));
      if (lf >= -1 && lf <= 1 && lq >= 0 && lq <= 3) pts.push([10 ** lf, 10 ** lq]);
    }
    return pts;
  };
  const rs = [1.31, 2.05, 2.6, 2.95, 3.6];
  return (
    <Plot
      label="Robertson SBTn chart Ic contours" xr={[0.1, 10]} yr={[1, 1000]} logX logY xl="Fr (%)" yl="Qtn"
      series={rs.map((r, i) => ({ pts: circle(r), color: [C.d, C.c, C.a, C.b, C.wall][i], label: `Ic ${r}` }))}
      extra={(sx, sy) => (<g><circle cx={sx(1)} cy={sy(50)} r={4} fill="currentColor" /><T x={sx(1) + 6} y={sy(50) + 4}>(1 %, 50)</T></g>)}
    />
  );
}

export function ClassUscsPlasticity() {
  const ll = range(20, 100, 16);
  return (
    <Plot
      label="Casagrande plasticity chart" xr={[0, 100]} yr={[0, 60]} xl="LL (%)" yl="PI (%)"
      series={[
        { pts: [[20, 0], ...ll.filter((v) => v >= 25.5).map((v) => [v, 0.73 * (v - 20)] as [number, number])], color: C.a, label: "A-line" },
        { pts: [[16, 0], [16, 7.2], [74.6, 60]] as [number, number][], color: C.b, dash: "5 3", label: "U-line" },
      ]}
      extra={(sx, sy) => (<g><rect x={sx(10)} y={sy(7)} width={sx(29.5) - sx(10)} height={sy(4) - sy(7)} fill={C.d} opacity={0.5} /><T x={sx(31)} y={sy(5)}>CL-ML</T></g>)}
    />
  );
}

const crrClean = (n: number) => (n >= 30 ? NaN : 1 / (34 - n) + n / 135 + 50 / (10 * n + 45) ** 2 - 1 / 200);
const fcShift = (fc: number) => (fc <= 5 ? [0, 1] : fc >= 35 ? [5, 1.2] : [Math.exp(1.76 - 190 / fc ** 2), 0.99 + fc ** 1.5 / 1000]);

export function LiqSptCorrelation() {
  const n = range(2, 29, 54);
  const pts = (fc: number) => {
    const [a, b] = fcShift(fc);
    return n.map((v) => [v, crrClean(a + b * v)] as [number, number]).filter(([, y]) => Number.isFinite(y) && y < 0.6);
  };
  return (
    <Plot
      label="CRR versus corrected SPT resistance" xr={[0, 30]} yr={[0, 0.6]} xl="(N1)60" yl="CRR₇.₅"
      series={[
        { pts: pts(5), color: C.a, label: "FC ≤ 5 %" },
        { pts: pts(15), color: C.c, label: "FC = 15 %" },
        { pts: pts(35), color: C.b, label: "FC ≥ 35 %" },
      ]}
      extra={(sx, sy) => (<g><Line x1={sx(30)} y1={sy(0)} x2={sx(30)} y2={sy(0.6)} color={C.d} dash="4 3" /><T x={sx(30) - 4} y={sy(0.03)} anchor="end" color={C.d}>(N1)60cs = 30: sıvılaşmaz</T></g>)}
    />
  );
}

export function LiqMsfCurve() {
  const m = range(5.5, 8.5, 30);
  return (
    <Plot
      label="Magnitude scaling factor" xr={[5.5, 8.5]} yr={[0.5, 2]} xl="Mw" yl="MSF"
      series={[
        { pts: m.map((x) => [x, Math.min(1.8, 6.9 * Math.exp(-x / 4) - 0.058)]), color: C.a, label: "Idriss" },
        { pts: m.map((x) => [x, Math.min(1.8, (x / 7.5) ** -2.56)]), color: C.b, dash: "5 3", label: "Andrus–Stokoe" },
      ]}
      extra={(sx, sy) => (<g><Line x1={sx(7.5)} y1={sy(0.5)} x2={sx(7.5)} y2={sy(2)} color={C.grid} dash="3 3" /><T x={sx(7.5) + 3} y={sy(0.62)}>Mw = 7,5 → MSF = 1</T></g>)}
    />
  );
}

export function LiqLpiWeight() {
  return (
    <Plot
      label="LPI depth weighting" xr={[0, 10]} yr={[0, 20]} flipY xl="w(z)" yl="z (m)"
      series={[{ pts: [[10, 0], [0, 20]], color: C.a, label: "w = 10 − 0,5 z" }]}
      extra={(sx, sy) => (<g><T x={sx(5.2)} y={sy(10)}>z = 20 m'de w = 0</T><T x={sx(0.2)} y={sy(1.2)}>LPI = ∫ F·w dz</T></g>)}
    />
  );
}
