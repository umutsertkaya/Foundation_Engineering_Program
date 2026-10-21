import type { ReactNode } from "react";

export const W = 400;
export const H = 260;
export const C = {
  a: "var(--mantine-color-blue-6)",
  b: "var(--mantine-color-red-6)",
  c: "var(--mantine-color-teal-6)",
  d: "var(--mantine-color-orange-6)",
  soil: "var(--mantine-color-yellow-2)",
  wall: "var(--mantine-color-gray-6)",
  water: "var(--mantine-color-cyan-4)",
  grid: "var(--mantine-color-gray-4)",
};

export function Svg({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
      style={{ width: "100%", maxWidth: 560, height: "auto", color: "var(--mantine-color-text)" }}
      fontSize="11"
      fill="currentColor"
    >
      {children}
    </svg>
  );
}

export function Arrow({ id = "ah" }: { id?: string }) {
  return (
    <defs>
      <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
      </marker>
    </defs>
  );
}

export function Line(p: {
  x1: number; y1: number; x2: number; y2: number; color?: string; dash?: string; arrow?: boolean; w?: number;
}) {
  return (
    <line
      x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2}
      stroke={p.color ?? "currentColor"} strokeWidth={p.w ?? 1.5}
      strokeDasharray={p.dash} markerEnd={p.arrow ? "url(#ah)" : undefined}
    />
  );
}

export function T({ x, y, children, anchor, color }: { x: number; y: number; children: ReactNode; anchor?: "start" | "middle" | "end"; color?: string }) {
  return <text x={x} y={y} textAnchor={anchor ?? "start"} fill={color ?? "currentColor"}>{children}</text>;
}

export type Series = { pts: [number, number][]; color: string; label?: string; dash?: string };

/** Minimal linear/log-x line plot with axes; data in data units. */
export function Plot(props: {
  label: string; series: Series[]; xr: [number, number]; yr: [number, number];
  xl: string; yl: string; logX?: boolean; logY?: boolean; flipY?: boolean; extra?: (sx: (x: number) => number, sy: (y: number) => number) => ReactNode;
  xt?: number[]; yt?: number[];
}) {
  const L = 48, R = 12, Tp = 14, B = 38;
  const f = (v: number, r: [number, number], lg?: boolean) =>
    lg ? (Math.log10(v) - Math.log10(r[0])) / (Math.log10(r[1]) - Math.log10(r[0])) : (v - r[0]) / (r[1] - r[0]);
  const sx = (x: number) => L + f(x, props.xr, props.logX) * (W - L - R);
  const sy = (y: number) => {
    const u = f(y, props.yr, props.logY);
    return props.flipY ? Tp + u * (H - Tp - B) : H - B - u * (H - Tp - B);
  };
  const ticks = (r: [number, number], lg?: boolean) => {
    if (lg) { const o: number[] = []; for (let e = Math.ceil(Math.log10(r[0])); e <= Math.floor(Math.log10(r[1])); e++) o.push(10 ** e); return o; }
    const n = 5; return Array.from({ length: n + 1 }, (_, i) => +(r[0] + ((r[1] - r[0]) * i) / n).toPrecision(3));
  };
  const xt = props.xt ?? ticks(props.xr, props.logX), yt = props.yt ?? ticks(props.yr, props.logY);
  return (
    <Svg label={props.label}>
      {xt.map((v) => (<g key={`x${v}`}><Line x1={sx(v)} y1={Tp} x2={sx(v)} y2={H - B} color={C.grid} w={0.5} /><T x={sx(v)} y={H - B + 13} anchor="middle">{v}</T></g>))}
      {yt.map((v) => (<g key={`y${v}`}><Line x1={L} y1={sy(v)} x2={W - R} y2={sy(v)} color={C.grid} w={0.5} /><T x={L - 4} y={sy(v) + 4} anchor="end">{v}</T></g>))}
      <Line x1={L} y1={Tp} x2={L} y2={H - B} /><Line x1={L} y1={H - B} x2={W - R} y2={H - B} />
      <T x={(L + W - R) / 2} y={H - 6} anchor="middle">{props.xl}</T>
      <text transform={`translate(11 ${(Tp + H - B) / 2}) rotate(-90)`} textAnchor="middle">{props.yl}</text>
      {props.series.map((s, i) => (
        <g key={i}>
          <polyline fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} points={s.pts.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ")} />
          {s.label && <T x={W - R - 4} y={Tp + 12 + i * 13} anchor="end" color={s.color}>{s.label}</T>}
        </g>
      ))}
      {props.extra?.(sx, sy)}
    </Svg>
  );
}

export const range = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
