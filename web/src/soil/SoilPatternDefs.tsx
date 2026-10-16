import { useId } from "react";
import { useComputedColorScheme } from "@mantine/core";
import {
  familyStyle,
  SOIL_FAMILIES,
  soilPatternId,
  soilPatternUrl,
  type SoilFamily,
  type SoilScheme,
} from "./soilStyle";

/** Current Mantine colour scheme mapped to the soil palette scheme. */
export function useSoilScheme(): SoilScheme {
  return useComputedColorScheme("light") === "dark" ? "dark" : "light";
}

/** A React id usable inside SVG `url(#...)` references (no colons). */
export function useSvgId(prefix = "soil"): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function PatternShape({ family, color }: { family: SoilFamily; color: string }) {
  switch (family) {
    case "gravel":
      return (
        <g fill="none" stroke={color} strokeWidth={0.9}>
          <circle cx={3} cy={3} r={1.9} />
          <circle cx={9.5} cy={8} r={1.5} />
          <circle cx={3.5} cy={10.5} r={1} />
        </g>
      );
    case "sand":
      return (
        <g fill={color} stroke="none">
          <circle cx={1.5} cy={1.5} r={0.7} />
          <circle cx={4.5} cy={4.5} r={0.7} />
        </g>
      );
    case "silt":
      return (
        <g stroke={color} strokeWidth={1} strokeLinecap="round">
          <line x1={1} y1={1.5} x2={4.5} y2={1.5} />
          <line x1={6} y1={4.5} x2={9.5} y2={4.5} />
        </g>
      );
    case "clay":
      return <line x1={0} y1={2.5} x2={8} y2={2.5} stroke={color} strokeWidth={0.9} />;
    case "clay_high":
      return (
        <g stroke={color} strokeWidth={1}>
          <line x1={0} y1={1.25} x2={8} y2={1.25} />
          <line x1={0} y1={3.75} x2={8} y2={3.75} />
          <line x1={4} y1={1.25} x2={4} y2={3.75} strokeWidth={0.7} />
        </g>
      );
    case "organic":
      return (
        <path d="M0 3.5 Q3 0.5 6 3.5 T12 3.5" fill="none" stroke={color} strokeWidth={0.9} />
      );
    case "peat":
      return (
        <g fill="none" stroke={color} strokeWidth={0.9} strokeLinecap="round">
          <path d="M0 7.5 Q2.5 5.5 5 7.5 T10 7.5" />
          <line x1={2.5} y1={1} x2={2.5} y2={4} />
          <line x1={1.2} y1={2} x2={2.5} y2={4} />
          <line x1={3.8} y1={2} x2={2.5} y2={4} />
        </g>
      );
    case "fill":
    default:
      return (
        <g stroke={color} strokeWidth={0.7}>
          <line x1={0} y1={0} x2={8} y2={8} />
          <line x1={8} y1={0} x2={0} y2={8} />
        </g>
      );
  }
}

const TILE: Record<SoilFamily, [number, number]> = {
  gravel: [12, 12],
  sand: [6, 6],
  silt: [10, 6],
  clay: [8, 5],
  clay_high: [8, 5],
  organic: [12, 7],
  peat: [10, 10],
  fill: [8, 8],
};

export interface SoilPatternDefsProps {
  /** Unique per SVG/page; pattern ids are `${idPrefix}-pat-${family}`. */
  idPrefix: string;
  scheme: SoilScheme;
  families?: readonly SoilFamily[];
}

/** `<defs>` with one hatch pattern per soil family. Render inside an `<svg>`. */
export function SoilPatternDefs({ idPrefix, scheme, families = SOIL_FAMILIES }: SoilPatternDefsProps) {
  return (
    <defs>
      {families.map((family) => {
        const [w, h] = TILE[family];
        return (
          <pattern
            key={family}
            id={soilPatternId(idPrefix, family)}
            patternUnits="userSpaceOnUse"
            width={w}
            height={h}
          >
            <PatternShape family={family} color={familyStyle(family, scheme).pattern} />
          </pattern>
        );
      })}
    </defs>
  );
}

export interface SoilSwatchProps {
  family: SoilFamily;
  scheme: SoilScheme;
  width?: number;
  height?: number;
  title?: string;
}

/** Small self-contained swatch: family colour + hatch (colour is never the only cue). */
export function SoilSwatch({ family, scheme, width = 22, height = 14, title }: SoilSwatchProps) {
  const uid = useSvgId("sw");
  const style = familyStyle(family, scheme);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={title}
      style={{ display: "block", flexShrink: 0 }}
    >
      {title && <title>{title}</title>}
      <SoilPatternDefs idPrefix={uid} scheme={scheme} families={[family]} />
      <rect x={0.5} y={0.5} width={width - 1} height={height - 1} fill={style.fill} />
      <rect x={0.5} y={0.5} width={width - 1} height={height - 1} fill={soilPatternUrl(uid, family)} />
      <rect
        x={0.5}
        y={0.5}
        width={width - 1}
        height={height - 1}
        fill="none"
        stroke={style.stroke}
        strokeWidth={1}
      />
    </svg>
  );
}
