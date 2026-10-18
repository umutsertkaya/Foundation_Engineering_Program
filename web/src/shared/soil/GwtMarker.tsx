import type { GwtCase } from "./zones";

export const GWT_CASES: readonly GwtCase[] = ["insitu", "design", "seismic"];

export const GWT_STYLE: Record<GwtCase, { color: string; filled: boolean; dash: string | undefined }> = {
  insitu: { color: "var(--mantine-color-blue-6)", filled: true, dash: undefined },
  design: { color: "var(--mantine-color-blue-6)", filled: false, dash: "6 3" },
  seismic: { color: "var(--mantine-color-orange-6)", filled: true, dash: "2 3" },
};

export interface GwtMarkerProps {
  x: number;
  /** Water level (tip of the inverted triangle). */
  y: number;
  kind: GwtCase;
  size?: number;
  title?: string;
}

/**
 * Inverted-triangle groundwater symbol. Cases differ in fill, colour and the two short
 * strokes under the tip (1 = in situ, 2 = design, 3 = seismic), never colour alone.
 */
export function GwtMarker({ x, y, kind, size = 9, title }: GwtMarkerProps) {
  const s = GWT_STYLE[kind];
  const h = size * 0.85;
  const ticks = kind === "insitu" ? 1 : kind === "design" ? 2 : 3;
  return (
    <g pointerEvents="visiblePainted">
      {title && <title>{title}</title>}
      <polygon
        points={`${x - size / 2},${y - h} ${x + size / 2},${y - h} ${x},${y}`}
        fill={s.filled ? s.color : "var(--mantine-color-body)"}
        stroke={s.color}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {Array.from({ length: ticks }, (_, i) => {
        const w = size * (0.6 - i * 0.18);
        const yy = y + 2.5 + i * 2.5;
        return (
          <line key={i} x1={x - w / 2} y1={yy} x2={x + w / 2} y2={yy} stroke={s.color} strokeWidth={1.2} />
        );
      })}
    </g>
  );
}
