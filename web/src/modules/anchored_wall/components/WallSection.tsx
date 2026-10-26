import { useTranslation } from "react-i18next";
import { fmt } from "../format";
import type { AnalysisResult, StructureSoil } from "../types";

interface Props {
  result: AnalysisResult;
  soil: StructureSoil;
}

const W = 560;
const TOP = 34;
const BOTTOM = 18;
const WALL_X = 170;
const STUB = 3;

/** Anchor length (m) drawn from the wall head: designed length, or a short stub when no design exists. */
function anchorGeometry(level: AnalysisResult["levels"][number]) {
  const a = (level.inclination_deg * Math.PI) / 180;
  const free = level.design?.free_length ?? STUB;
  const bond = level.design?.bond_length ?? 0;
  return { cos: Math.cos(a), sin: Math.sin(a), free, bond };
}

/** To-scale wall section: ground, excavation base, wall, anchors (free = thin, bond = thick), layer lines. */
export function WallSection({ result, soil }: Props) {
  const { t } = useTranslation();
  const H = result.excavation_height;
  const L = result.wall_length;
  const reach = Math.max(
    STUB,
    ...result.levels.map((lv) => {
      const g = anchorGeometry(lv);
      return (g.free + g.bond) * g.cos;
    }),
  );
  const maxDrop = Math.max(...result.levels.map((lv) => {
    const g = anchorGeometry(lv);
    return lv.depth + (g.free + g.bond) * g.sin;
  }));
  const depthShown = Math.max(L, maxDrop) * 1.04;
  const scale = Math.min(300 / depthShown, (W - WALL_X - 24) / reach);
  const height = TOP + depthShown * scale + BOTTOM;
  const y = (z: number) => TOP + z * scale;
  const x = (dx: number) => WALL_X + 4 + dx * scale;
  const boundaries = soil.profile.layers.map((l) => l.top).filter((z) => z > 0 && z < depthShown);

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      width="100%"
      style={{ maxWidth: W, color: "var(--mantine-color-text)" }}
      role="img"
      aria-label={t("anchored_wall.section.aria")}
      data-testid="aw-section"
    >
      <rect x={WALL_X + 4} y={y(0)} width={W - WALL_X - 8} height={depthShown * scale} fill="currentColor" fillOpacity={0.06} />
      <rect x={10} y={y(H)} width={WALL_X - 14} height={(depthShown - H) * scale} fill="currentColor" fillOpacity={0.06} />
      {boundaries.map((z) => (
        <g key={z}>
          <line x1={10} x2={W - 4} y1={y(z)} y2={y(z)} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="4 3" />
          <text x={W - 6} y={y(z) - 2} fontSize={9} textAnchor="end" fill="currentColor" fillOpacity={0.6}>{fmt(z, 1)} m</text>
        </g>
      ))}
      <line x1={WALL_X + 4} x2={W - 4} y1={y(0)} y2={y(0)} stroke="currentColor" strokeWidth={1.5} />
      <line x1={10} x2={WALL_X - 4} y1={y(H)} y2={y(H)} stroke="currentColor" strokeWidth={1.5} />
      <text x={12} y={y(H) - 4} fontSize={10} fill="currentColor">{t("anchored_wall.section.base", { h: fmt(H, 1) })}</text>
      <rect x={WALL_X - 3} y={y(0)} width={7} height={L * scale} fill="var(--mantine-color-gray-6)" />
      <text x={WALL_X + 8} y={y(L) + 12} fontSize={10} fill="currentColor">{t("anchored_wall.section.toe", { l: fmt(L, 1) })}</text>
      {result.levels.map((lv, i) => {
        const g = anchorGeometry(lv);
        const y0 = y(lv.depth);
        const x1 = x(g.free * g.cos);
        const y1 = y0 + g.free * g.sin * scale;
        const x2 = x(( g.free + g.bond) * g.cos);
        const y2 = y0 + (g.free + g.bond) * g.sin * scale;
        const designed = lv.design != null;
        return (
          <g key={i} data-testid={`aw-section-anchor-${i}`}>
            <line x1={x(0)} y1={y0} x2={x1} y2={y1} stroke="var(--mantine-color-blue-6)" strokeWidth={1.5} strokeDasharray={designed ? undefined : "5 3"} />
            {designed && <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--mantine-color-blue-6)" strokeWidth={5} />}
            <circle cx={x(0)} cy={y0} r={3} fill="var(--mantine-color-blue-6)" />
            <text x={WALL_X - 8} y={y0 + 3} fontSize={10} textAnchor="end" fill="currentColor">
              {fmt(lv.depth, 1)} m · {fmt(lv.horizontal_load_per_m, 0)} kN/m
            </text>
            {designed && (
              <text x={x2 + 4} y={y2 + 3} fontSize={9} fill="currentColor">
                {fmt(lv.design!.free_length, 1)} + {fmt(lv.design!.bond_length, 1)} m
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

interface SeriesProps {
  z: number[];
  values: number[];
  label: string;
  unit: string;
  base: number;
}

/** One internal-force diagram against depth (depth downward, base marks the excavation level). */
function Series({ z, values, label, unit, base }: SeriesProps) {
  const w = 200;
  const h = 260;
  const pad = 24;
  const zMax = Math.max(...z, 1e-6);
  const vMax = Math.max(...values.map(Math.abs), 1e-6);
  const px = (v: number) => w / 2 + (v / vMax) * (w / 2 - pad);
  const py = (zz: number) => pad + (zz / zMax) * (h - 2 * pad);
  const points = z.map((zz, i) => `${px(values[i])},${py(zz)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w, color: "var(--mantine-color-text)" }} role="img" aria-label={label}>
      <text x={w / 2} y={12} fontSize={11} textAnchor="middle" fill="currentColor">{label} [{unit}]</text>
      <line x1={w / 2} x2={w / 2} y1={pad} y2={h - pad} stroke="currentColor" strokeOpacity={0.4} />
      <line x1={4} x2={w - 4} y1={py(base)} y2={py(base)} stroke="currentColor" strokeOpacity={0.4} strokeDasharray="4 3" />
      <polyline points={points} fill="none" stroke="var(--mantine-color-blue-6)" strokeWidth={1.8} />
      <text x={w - 4} y={h - 6} fontSize={9} textAnchor="end" fill="currentColor">±{fmt(vMax, 1)}</text>
    </svg>
  );
}

export function ForceDiagrams({ result }: { result: AnalysisResult }) {
  const { t } = useTranslation();
  if (result.z.length < 2) return null;
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }} data-testid="aw-diagrams">
      <Series z={result.z} values={result.moment} base={result.excavation_height} label={t("anchored_wall.result.moment")} unit="kNm/m" />
      <Series z={result.z} values={result.shear} base={result.excavation_height} label={t("anchored_wall.result.shear")} unit="kN/m" />
    </div>
  );
}

/** Apparent pressure envelope against depth (depth downward); dashed lines are the anchor levels. */
export function EnvelopeDiagram({ result }: { result: AnalysisResult }) {
  const { t } = useTranslation();
  const env = result.envelope;
  if (!env || env.z.length < 2) return null;
  const w = 260;
  const h = 280;
  const pad = 28;
  const left = 34;
  const pMax = Math.max(...env.p, 1e-6);
  const H = result.excavation_height;
  const px = (v: number) => left + (v / pMax) * (w - left - pad);
  const py = (z: number) => pad + (z / H) * (h - 2 * pad);
  const points = [`${px(0)},${py(0)}`, ...env.z.map((z, i) => `${px(env.p[i])},${py(z)}`), `${px(0)},${py(H)}`].join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w, color: "var(--mantine-color-text)" }} role="img"
      aria-label={t("anchored_wall.envelope.aria")} data-testid="aw-envelope-diagram">
      <text x={w / 2} y={12} fontSize={11} textAnchor="middle" fill="currentColor">{t("anchored_wall.envelope.axis")}</text>
      <line x1={left} x2={left} y1={py(0)} y2={py(H)} stroke="currentColor" strokeOpacity={0.5} />
      <polygon points={points} fill="var(--mantine-color-blue-6)" fillOpacity={0.2} stroke="var(--mantine-color-blue-6)" strokeWidth={1.8} />
      {result.levels.map((lv, i) => (
        <g key={i}>
          <line x1={4} x2={w - 4} y1={py(lv.depth)} y2={py(lv.depth)} stroke="currentColor" strokeOpacity={0.5} strokeDasharray="4 3" />
          <text x={w - 4} y={py(lv.depth) - 2} fontSize={9} textAnchor="end" fill="currentColor">{fmt(lv.depth, 1)} m</text>
        </g>
      ))}
      <text x={px(pMax)} y={py(env.z[1]) - 4} fontSize={10} textAnchor="end" fill="currentColor">{fmt(pMax, 1)} kPa</text>
      <text x={left + 4} y={py(H) + 12} fontSize={9} fill="currentColor">{fmt(H, 1)} m</text>
    </svg>
  );
}
