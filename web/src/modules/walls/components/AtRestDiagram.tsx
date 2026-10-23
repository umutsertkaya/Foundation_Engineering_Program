import { useTranslation } from "react-i18next";
import type { AtRestResultDTO } from "../types";

const W = 320;
const H = 300;
const PAD = { l: 40, r: 12, t: 22, b: 30 };

function path(z: number[], values: number[], x: (v: number) => number, y: (d: number) => number): string {
  return z.map((d, i) => `${i === 0 ? "M" : "L"}${x(values[i]).toFixed(1)},${y(d).toFixed(1)}`).join(" ");
}

/** Effective and total horizontal pressure against depth (SVG, same style as the sheet pile diagrams). */
export function AtRestDiagram({ result }: { result: AtRestResultDTO }) {
  const { t } = useTranslation();
  const { z, sigma_h_eff: eff, sigma_h: total } = result;
  if (z.length < 2) return null;
  const zMax = Math.max(...z) || 1;
  const vMax = Math.max(...total, ...eff, 1e-9);
  const x = (v: number) => PAD.l + (v / vMax) * (W - PAD.l - PAD.r);
  const y = (d: number) => PAD.t + (d / zMax) * (H - PAD.t - PAD.b);
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * vMax);
  const zTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * zMax);
  const effPath = path(z, eff, x, y);
  const totalPath = path(z, total, x, y);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 420 }} role="img" aria-label={t("walls.at_rest.diagram")} data-testid="at-rest-diagram">
      {xTicks.map((v) => (
        <g key={`x${v}`}>
          <line x1={x(v)} x2={x(v)} y1={PAD.t} y2={H - PAD.b} stroke="currentColor" strokeOpacity={0.12} />
          <text x={x(v)} y={H - PAD.b + 11} textAnchor="middle" fontSize={8} fill="currentColor">{+v.toFixed(1)}</text>
        </g>
      ))}
      {zTicks.map((d) => (
        <g key={`z${d}`}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(d)} y2={y(d)} stroke="currentColor" strokeOpacity={0.12} />
          <text x={PAD.l - 4} y={y(d) + 3} textAnchor="end" fontSize={8} fill="currentColor">{+d.toFixed(2)}</text>
        </g>
      ))}
      <path d={`${totalPath} L${x(0)},${y(z[z.length - 1])} L${x(0)},${y(z[0])} Z`} fill="#1c7ed6" fillOpacity={0.12} />
      <path d={totalPath} fill="none" stroke="#1c7ed6" strokeWidth={1.6} />
      <path d={effPath} fill="none" stroke="#2f9e44" strokeWidth={1.6} strokeDasharray="4 3" />
      <text x={PAD.l + 4} y={12} fontSize={9} fill="#1c7ed6">{t("walls.at_rest.diagram_total")}</text>
      <text x={PAD.l + 90} y={12} fontSize={9} fill="#2f9e44">{t("walls.at_rest.diagram_eff")}</text>
      <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="currentColor">kPa</text>
      <text x={9} y={H / 2} fontSize={9} fill="currentColor" transform={`rotate(-90 9 ${H / 2})`} textAnchor="middle">z (m)</text>
    </svg>
  );
}
