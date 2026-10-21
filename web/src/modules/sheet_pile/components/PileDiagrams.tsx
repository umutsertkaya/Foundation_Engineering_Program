import { SimpleGrid, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { SheetPileSeriesPoint } from "../series";

const W = 220;
const H = 300;
const PAD = { l: 40, r: 10, t: 22, b: 30 };

interface PlotProps {
  title: string;
  unit: string;
  z: number[];
  values: number[];
  /** Depth of the retained height H (excavation level) and of the anchor, drawn as reference lines. */
  marks: { z: number; label: string }[];
  color: string;
}

function niceStep(span: number): number {
  const raw = span / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * pow;
}

function Plot({ title, unit, z, values, marks, color }: PlotProps) {
  const zMax = Math.max(...z);
  const vMin = Math.min(0, ...values);
  const vMax = Math.max(0, ...values);
  const span = vMax - vMin || 1;
  const step = niceStep(span);
  const lo = Math.floor(vMin / step) * step;
  const hi = Math.ceil(vMax / step) * step;
  const x = (v: number) => PAD.l + ((v - lo) / (hi - lo || 1)) * (W - PAD.l - PAD.r);
  const y = (d: number) => PAD.t + (d / (zMax || 1)) * (H - PAD.t - PAD.b);
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v / step) * step);
  const zStep = niceStep(zMax);
  const zTicks: number[] = [];
  for (let d = 0; d <= zMax + 1e-9; d += zStep) zTicks.push(d);
  const path = z.map((d, i) => `${i === 0 ? "M" : "L"}${x(values[i]).toFixed(1)},${y(d).toFixed(1)}`).join(" ");
  const area = `${path} L${x(0).toFixed(1)},${y(z[z.length - 1]).toFixed(1)} L${x(0).toFixed(1)},${y(z[0]).toFixed(1)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${title} (${unit})`}>
      <text x={W / 2} y={12} textAnchor="middle" fontSize={11} fontWeight={600} fill="currentColor">{title}</text>
      {ticks.map((v) => (
        <g key={`x${v}`}>
          <line x1={x(v)} x2={x(v)} y1={PAD.t} y2={H - PAD.b} stroke="currentColor" strokeOpacity={v === 0 ? 0.6 : 0.12} />
          <text x={x(v)} y={H - PAD.b + 11} textAnchor="middle" fontSize={8} fill="currentColor">{+v.toFixed(2)}</text>
        </g>
      ))}
      {zTicks.map((d) => (
        <g key={`z${d}`}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(d)} y2={y(d)} stroke="currentColor" strokeOpacity={0.12} />
          <text x={PAD.l - 4} y={y(d) + 3} textAnchor="end" fontSize={8} fill="currentColor">{+d.toFixed(2)}</text>
        </g>
      ))}
      {marks.map((m) => (
        <g key={m.label}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(m.z)} y2={y(m.z)} stroke="#e8590c" strokeDasharray="4 3" />
          <text x={W - PAD.r - 2} y={y(m.z) - 2} textAnchor="end" fontSize={8} fill="#e8590c">{m.label}</text>
        </g>
      ))}
      <path d={area} fill={color} fillOpacity={0.15} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.6} />
      <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="currentColor">{unit}</text>
      <text x={9} y={H / 2} fontSize={9} fill="currentColor" transform={`rotate(-90 9 ${H / 2})`} textAnchor="middle">z (m)</text>
    </svg>
  );
}

/** Net pressure, shear and moment against depth (SVG, no charting dependency). */
export function PileDiagrams({
  rows, retainedHeight, anchorDepth,
}: { rows: readonly SheetPileSeriesPoint[]; retainedHeight: number | null; anchorDepth: number | null }) {
  const { t } = useTranslation();
  const ok = rows.filter((r) => [r.z, r.net, r.shear, r.moment].every((v) => typeof v === "number" && Number.isFinite(v)));
  if (ok.length < 2) return null;
  const z = ok.map((r) => r.z as number);
  const marks: { z: number; label: string }[] = [];
  if (retainedHeight != null) marks.push({ z: retainedHeight, label: t("sheet_pile.diagram.excavation") });
  if (anchorDepth != null) marks.push({ z: anchorDepth, label: t("sheet_pile.diagram.anchor") });
  return (
    <Stack gap={4} data-testid="pile-diagrams">
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
        <Plot title={t("sheet_pile.diagram.net")} unit="kPa" z={z} values={ok.map((r) => r.net as number)} marks={marks} color="#1c7ed6" />
        <Plot title={t("sheet_pile.diagram.shear")} unit="kN/m" z={z} values={ok.map((r) => r.shear as number)} marks={marks} color="#2f9e44" />
        <Plot title={t("sheet_pile.diagram.moment")} unit="kNm/m" z={z} values={ok.map((r) => r.moment as number)} marks={marks} color="#c2255c" />
      </SimpleGrid>
      <Text size="xs" c="dimmed">{t("sheet_pile.diagram.note")}</Text>
    </Stack>
  );
}
