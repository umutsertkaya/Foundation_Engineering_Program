import { useId, type ReactNode } from "react";

/** Drawing kit for the education figures: 640x400 canvas, soil/concrete hatching, dimension lines, force arrows. */
export const W = 640;
export const H = 400;

export const K = {
  blue: "var(--mantine-color-blue-6)",
  red: "var(--mantine-color-red-6)",
  green: "var(--mantine-color-teal-6)",
  orange: "var(--mantine-color-orange-6)",
  violet: "var(--mantine-color-violet-6)",
  water: "var(--mantine-color-cyan-5)",
  soilFill: "var(--mantine-color-yellow-1)",
  soilLine: "var(--mantine-color-yellow-8)",
  concFill: "var(--mantine-color-gray-3)",
  concLine: "var(--mantine-color-gray-7)",
  grid: "var(--mantine-color-gray-4)",
  ink: "var(--mantine-color-text)",
  bg: "var(--mantine-color-body)",
  mut: "var(--mantine-color-dimmed)",
};

const rad = (d: number) => (d * Math.PI) / 180;
export const pt = (x: number, y: number, len: number, deg: number): [number, number] => [x + len * Math.cos(rad(deg)), y - len * Math.sin(rad(deg))];

export interface Ctx { soil: string; conc: string; arrow: (color: string) => string }

export function Fig({ label, children, h = H, w = W }: { label: string; children: (c: Ctx) => ReactNode; h?: number; w?: number }) {
  const uid = useId().replace(/[:]/g, "");
  const soil = `soil${uid}`, conc = `conc${uid}`;
  const arrow = (color: string) => `url(#ah${uid}${color.replace(/[^a-z0-9]/gi, "")})`;
  const colors = [K.blue, K.red, K.green, K.orange, K.violet, K.ink, K.water];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} style={{ width: "100%", maxWidth: 720, height: "auto", color: K.ink }} fontSize="15" fontFamily="system-ui, sans-serif" fill="currentColor">
      <defs>
        <pattern id={soil} width="14" height="14" patternUnits="userSpaceOnUse">
          <rect width="14" height="14" fill={K.soilFill} />
          <path d="M0 14 L14 0 M-3 3 L3 -3 M11 17 L17 11" stroke={K.soilLine} strokeWidth="0.8" opacity="0.55" />
          <circle cx="4" cy="4" r="0.9" fill={K.soilLine} opacity="0.6" /><circle cx="10" cy="10" r="0.9" fill={K.soilLine} opacity="0.6" />
        </pattern>
        <pattern id={conc} width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill={K.concFill} />
          <path d="M0 10 L10 0" stroke={K.concLine} strokeWidth="0.7" opacity="0.6" />
        </pattern>
        {colors.map((c) => (
          <marker key={c} id={`ah${uid}${c.replace(/[^a-z0-9]/gi, "")}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={c} />
          </marker>
        ))}
      </defs>
      {children({ soil: `url(#${soil})`, conc: `url(#${conc})`, arrow })}
    </svg>
  );
}

/** Text with a background-coloured halo so it stays legible over hatching and lines. */
export function Tx(p: { x: number; y: number; children: ReactNode; a?: "start" | "middle" | "end"; c?: string; s?: number; b?: boolean; i?: boolean }) {
  return (
    <text x={p.x} y={p.y} textAnchor={p.a ?? "start"} fill={p.c ?? K.ink} fontSize={p.s ?? 15} fontWeight={p.b ? 700 : 400} fontStyle={p.i ? "italic" : undefined}
      stroke={K.bg} strokeWidth={3.5} paintOrder="stroke" strokeLinejoin="round">
      {p.children}
    </text>
  );
}

export function Ln(p: { x1: number; y1: number; x2: number; y2: number; c?: string; w?: number; d?: string; end?: string; start?: string }) {
  return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.c ?? K.ink} strokeWidth={p.w ?? 1.6} strokeDasharray={p.d} markerEnd={p.end} markerStart={p.start} />;
}

/** Force arrow from tail to head with a bold label near the tail. */
export function Force(p: { x1: number; y1: number; x2: number; y2: number; c: string; arrow: (c: string) => string; label?: ReactNode; lx?: number; ly?: number; w?: number; a?: "start" | "middle" | "end" }) {
  return (
    <g>
      <Ln x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} c={p.c} w={p.w ?? 3} end={p.arrow(p.c)} />
      {p.label && <Tx x={p.lx ?? p.x1} y={p.ly ?? p.y1 - 6} c={p.c} b a={p.a}>{p.label}</Tx>}
    </g>
  );
}

/** Dimension line with end ticks and a centred label (offset perpendicular). */
export function Dim(p: { x1: number; y1: number; x2: number; y2: number; label: ReactNode; off?: number; c?: string; side?: "left" | "right" }) {
  const dx = p.x2 - p.x1, dy = p.y2 - p.y1, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const tick = 5, mx = (p.x1 + p.x2) / 2, my = (p.y1 + p.y2) / 2, o = p.off ?? 14;
  const vertical = Math.abs(dx) < Math.abs(dy);
  return (
    <g>
      <Ln x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} c={p.c ?? K.ink} w={1.1} />
      <Ln x1={p.x1 - nx * tick} y1={p.y1 - ny * tick} x2={p.x1 + nx * tick} y2={p.y1 + ny * tick} c={p.c ?? K.ink} w={1.4} />
      <Ln x1={p.x2 - nx * tick} y1={p.y2 - ny * tick} x2={p.x2 + nx * tick} y2={p.y2 + ny * tick} c={p.c ?? K.ink} w={1.4} />
      <Tx x={mx + (vertical ? (p.side === "right" ? o : -o) : 0)} y={my + (vertical ? 4 : -9)} a={vertical ? (p.side === "right" ? "start" : "end") : "middle"} c={p.c}>{p.label}</Tx>
    </g>
  );
}

/** Ground block with soil hatching. */
export const Soil = ({ x, y, w, h, c }: { x: number; y: number; w: number; h: number; c: Ctx }) => <rect x={x} y={y} width={w} height={h} fill={c.soil} stroke={K.soilLine} strokeWidth={1} />;
export const Concrete = ({ x, y, w, h, c }: { x: number; y: number; w: number; h: number; c: Ctx }) => <rect x={x} y={y} width={w} height={h} fill={c.conc} stroke={K.concLine} strokeWidth={1.4} />;
export const Poly = ({ pts, fill, stroke, o = 0.35, w = 1.6, d }: { pts: [number, number][]; fill?: string; stroke?: string; o?: number; w?: number; d?: string }) => (
  <polygon points={pts.map((p) => p.join(",")).join(" ")} fill={fill ?? "none"} fillOpacity={fill ? o : undefined} stroke={stroke ?? fill ?? K.ink} strokeWidth={w} strokeDasharray={d} strokeLinejoin="round" />
);

/** Water-table symbol: a small inverted triangle on a dashed line. */
export function WaterLevel({ x, y, len, label }: { x: number; y: number; len: number; label?: ReactNode }) {
  return (
    <g>
      <Ln x1={x} y1={y} x2={x + len} y2={y} c={K.water} w={2} d="6 4" />
      <polygon points={`${x + len - 22},${y - 14} ${x + len - 8},${y - 14} ${x + len - 15},${y - 2}`} fill={K.water} />
      {label && <Tx x={x + len - 28} y={y - 6} a="end" c={K.water}>{label}</Tx>}
    </g>
  );
}

/** Row of small horizontal arrows spread over a pressure diagram edge. */
export function Spread({ x0, xs, ys, c, arrow }: { x0: number; xs: number[]; ys: number[]; c: string; arrow: (c: string) => string }) {
  return (
    <g>
      {ys.map((y, i) => <Ln key={i} x1={x0 + xs[i]} y1={y} x2={x0 + 2} y2={y} c={c} w={1.2} end={arrow(c)} />)}
    </g>
  );
}

export function Ang({ x, y, r, from, to, label, c }: { x: number; y: number; r: number; from: number; to: number; label?: ReactNode; c?: string }) {
  const [x1, y1] = pt(x, y, r, from), [x2, y2] = pt(x, y, r, to);
  const mid = (from + to) / 2, [lx, ly] = pt(x, y, r + 14, mid);
  return (
    <g>
      <path d={`M${x1} ${y1} A ${r} ${r} 0 0 ${to > from ? 0 : 1} ${x2} ${y2}`} fill="none" stroke={c ?? K.ink} strokeWidth={1.3} />
      {label && <Tx x={lx} y={ly + 4} a="middle" c={c}>{label}</Tx>}
    </g>
  );
}

export interface Series { pts: [number, number][]; c: string; label?: string; d?: string; w?: number }

/** Line chart with grid, ticks, axis titles and direct series labels. Plot area: x 70..610, y 30..330. */
export function Chart(p: {
  label: string; xr: [number, number]; yr: [number, number]; xl: string; yl: string; series: Series[];
  logX?: boolean; logY?: boolean; flipY?: boolean; xt?: number[]; yt?: number[]; fmt?: (v: number) => string;
  extra?: (sx: (x: number) => number, sy: (y: number) => number, c: Ctx) => ReactNode;
}) {
  const L = 76, R = 616, T0 = 24, B0 = 330;
  const f = (v: number, r: [number, number], lg?: boolean) => (lg ? (Math.log10(v) - Math.log10(r[0])) / (Math.log10(r[1]) - Math.log10(r[0])) : (v - r[0]) / (r[1] - r[0]));
  const sx = (x: number) => L + f(x, p.xr, p.logX) * (R - L);
  const sy = (y: number) => (p.flipY ? T0 + f(y, p.yr, p.logY) * (B0 - T0) : B0 - f(y, p.yr, p.logY) * (B0 - T0));
  const nice = (r: [number, number], lg?: boolean) => {
    if (lg) { const o: number[] = []; for (let e = Math.ceil(Math.log10(r[0])); e <= Math.floor(Math.log10(r[1])); e++) o.push(10 ** e); return o; }
    const span = r[1] - r[0], raw = span / 6, mag = 10 ** Math.floor(Math.log10(raw)), st = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
    const o: number[] = []; for (let v = Math.ceil(r[0] / st) * st; v <= r[1] + 1e-9; v += st) o.push(+v.toFixed(6)); return o;
  };
  const xt = p.xt ?? nice(p.xr, p.logX), yt = p.yt ?? nice(p.yr, p.logY), fmt = p.fmt ?? ((v: number) => String(v).replace(".", ","));
  return (
    <Fig label={p.label}>
      {(c) => (
        <>
          {xt.map((v) => <g key={`x${v}`}><Ln x1={sx(v)} y1={T0} x2={sx(v)} y2={B0} c={K.grid} w={0.7} /><Tx x={sx(v)} y={B0 + 18} a="middle">{fmt(v)}</Tx></g>)}
          {yt.map((v) => <g key={`y${v}`}><Ln x1={L} y1={sy(v)} x2={R} y2={sy(v)} c={K.grid} w={0.7} /><Tx x={L - 8} y={sy(v) + 4} a="end">{fmt(v)}</Tx></g>)}
          <Ln x1={L} y1={T0} x2={L} y2={B0} w={1.8} /><Ln x1={L} y1={B0} x2={R} y2={B0} w={1.8} />
          <Tx x={(L + R) / 2} y={B0 + 44} a="middle" b>{p.xl}</Tx>
          <text transform={`translate(18 ${(T0 + B0) / 2}) rotate(-90)`} textAnchor="middle" fontWeight={700} fill={K.ink}>{p.yl}</text>
          {p.series.map((s, i) => (
            <g key={i}>
              <polyline fill="none" stroke={s.c} strokeWidth={s.w ?? 2.6} strokeDasharray={s.d} strokeLinejoin="round" points={s.pts.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ")} />
            </g>
          ))}
          {p.series.filter((s) => s.label).map((s, i) => (
            <g key={`l${i}`}><Ln x1={R - 190} y1={T0 + 16 + i * 20} x2={R - 160} y2={T0 + 16 + i * 20} c={s.c} w={3} d={s.d} /><Tx x={R - 154} y={T0 + 20 + i * 20}>{s.label}</Tx></g>
          ))}
          {p.extra?.(sx, sy, c)}
        </>
      )}
    </Fig>
  );
}

export const linspace = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
