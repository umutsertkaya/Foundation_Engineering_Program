import type { ReactNode } from "react";
import { Card, Group, Stack, Text } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import type {
  CantileverGeometry,
  GravityGeometry,
  StructureSoilModel,
  WallType,
} from "../api/types";
import { niceTicks, spreadLabels, tickDecimals } from "../soil/axis";
import { fmt, strengthText, truncate } from "../soil/format";
import { GWT_STYLE, GwtMarker } from "../soil/GwtMarker";
import { SoilPatternDefs, useSoilScheme, useSvgId } from "../soil/SoilPatternDefs";
import { soilFamily, soilPatternUrl, soilStyle } from "../soil/soilStyle";
import {
  computeZones,
  frontGwt,
  gwtDepth,
  retainedGwt,
  type GwtCase,
  type LayerOrigin,
  type ZoneSlice,
} from "../soil/zones";

export interface StructureSoilSectionProps {
  wallType: WallType;
  geometry: CantileverGeometry | GravityGeometry;
  /** Structure height H = base depth in the structure frame. */
  height?: number;
  backfillSlope?: number;
  soil?: StructureSoilModel | null;
  gwtCase?: GwtCase;
  selectedLayerId?: string | null;
  onSelectLayer?: (id: string, origin: LayerOrigin) => void;
  showZones?: boolean;
  maxHeight?: number;
  minHeight?: number;
  title?: string;
  headerExtra?: ReactNode;
}

type Pt = [number, number];

function isCantilever(
  wallType: WallType,
  geometry: CantileverGeometry | GravityGeometry,
): geometry is CantileverGeometry {
  return wallType === "cantilever" && "stem_bottom" in geometry;
}

const HALO = {
  paintOrder: "stroke" as const,
  stroke: "var(--mantine-color-body)",
  strokeWidth: 3,
  strokeLinejoin: "round" as const,
};

const ZONE_COLOR = {
  backfill: "var(--mantine-color-orange-7)",
  front: "var(--mantine-color-teal-7)",
  foundation: "var(--mantine-color-violet-6)",
};

/**
 * To-scale wall cross-section in the structure frame (z down from the retained surface):
 * retained side right, front side left, foundation below the base; layers per
 * `StructureSoilModel.zones()`, GWT on both sides, zone outlines, depth axis and labels
 * placed outside the drawing with leader lines.
 */
export function StructureSoilSection({
  wallType,
  geometry,
  height,
  backfillSlope = 0,
  soil,
  gwtCase = "design",
  selectedLayerId,
  onSelectLayer,
  showZones = true,
  maxHeight = 560,
  minHeight = 300,
  title,
  headerExtra,
}: StructureSoilSectionProps) {
  const { t } = useTranslation();
  const scheme = useSoilScheme();
  const uid = useSvgId("sec");
  const { ref, width: measured } = useElementSize();
  const W = measured > 0 ? measured : 640;

  // ---------------------------------------------------------------- wall geometry (world, m)
  let B: number;
  let H: number;
  let D: number;
  let wallPolys: Pt[][];
  let frontAt: (y: number) => number;
  /** x of the retained-side soil boundary at height y (wall back face; B below the base). */
  let backAt: (y: number) => number;
  let backTopX: number;
  let backMinX: number;
  let retainedPoly: Pt[];
  let summaryText: string;
  let dimChain: { a: number; b: number; label: string }[];

  if (isCantilever(wallType, geometry)) {
    const toe = Math.max(0, geometry.toe);
    const stemBottom = Math.max(0.1, geometry.stem_bottom);
    const stemTop = Math.max(0.1, Math.min(stemBottom, geometry.stem_top));
    const heel = Math.max(0, geometry.heel);
    const tb = Math.max(0.1, geometry.base_thickness);
    const hs = Math.max(0.2, geometry.stem_height || (height ? height - tb : 4.5));
    B = toe + stemBottom + heel;
    H = Math.max(tb + 0.2, height ?? tb + hs);
    D = Math.max(0, Math.min(H - 0.05, geometry.embedment ?? 0.6));
    const xBack = toe + stemBottom;
    const xFrontTop = xBack - stemTop;
    wallPolys = [
      [
        [0, 0],
        [B, 0],
        [B, tb],
        [0, tb],
      ],
      [
        [toe, tb],
        [xBack, tb],
        [xBack, H],
        [xFrontTop, H],
      ],
    ];
    frontAt = (y) => (y <= tb ? 0 : toe + ((y - tb) / (H - tb)) * (xFrontTop - toe));
    backAt = (y) => (y >= tb ? xBack : B);
    backTopX = xBack;
    backMinX = xBack;
    retainedPoly = [
      [xBack, H],
      [xBack, tb],
      [B, tb],
      [B, 0],
    ];
    summaryText = t("ui.wall.summary_cantilever", {
      B: B.toFixed(2),
      hs: (H - tb).toFixed(2),
      D: D.toFixed(2),
    });
    dimChain = [
      { a: 0, b: toe, label: toe.toFixed(2) },
      { a: toe, b: xBack, label: stemBottom.toFixed(2) },
      { a: xBack, b: B, label: heel.toFixed(2) },
    ];
  } else {
    const grav = geometry as GravityGeometry;
    B = Math.max(0.2, grav.base_width);
    H = Math.max(0.5, height ?? grav.height);
    const topW = Math.max(0.1, Math.min(B, grav.top_width));
    const backOffset = Math.max(0, Math.min(B - topW, grav.back_offset ?? 0));
    D = Math.max(0, Math.min(H - 0.05, grav.embedment ?? 0.6));
    const xBackTop = B - backOffset;
    const xFrontTop = xBackTop - topW;
    wallPolys = [
      [
        [0, 0],
        [B, 0],
        [xBackTop, H],
        [xFrontTop, H],
      ],
    ];
    frontAt = (y) => (y / H) * xFrontTop;
    backAt = (y) => (y >= 0 && y <= H ? B + ((xBackTop - B) * y) / H : B);
    backTopX = xBackTop;
    backMinX = Math.min(xBackTop, B);
    retainedPoly = [
      [xBackTop, H],
      [B, 0],
    ];
    summaryText = t("ui.wall.summary_gravity", { B: B.toFixed(2), D: D.toFixed(2) });
    dimChain = [];
  }

  const frontDepth = H - D;
  const zones = soil ? computeZones(soil, frontDepth, H) : null;
  const profileBottom =
    soil && soil.profile.layers.length > 0
      ? soil.profile.layers[soil.profile.layers.length - 1].bottom
      : H;

  const leftMarginM = Math.max(1.6, 0.5 * B, 0.35 * H);
  const rightMarginM = Math.max(2.4, 0.7 * B, 0.5 * H);
  const xMin = -leftMarginM;
  const xMax = B + rightMarginM;
  const slopeRad = (Math.max(0, Math.min(35, backfillSlope)) * Math.PI) / 180;
  const rise = (xMax - backTopX) * Math.tan(slopeRad);
  const yTop = H + rise;
  // ---------------------------------------------------------------- pixel layout
  const hasSoil = Boolean(soil);
  const axisW = hasSoil ? 42 : 8;
  const leftLabelW = hasSoil ? Math.min(170, Math.max(104, W * 0.16)) : 12;
  const rightLabelW = hasSoil ? Math.min(196, Math.max(118, W * 0.19)) : 12;
  const dimW = 40;
  const padTop = 30;
  const padBottom = dimChain.length > 0 ? 58 : 38;
  const drawX0 = axisW + leftLabelW;
  const drawX1 = W - rightLabelW - dimW;
  const DW = Math.max(120, drawX1 - drawX0);
  const worldW = xMax - xMin;
  const scaleW = DW / worldW;
  const plotMin = minHeight - padTop - padBottom;
  const plotMax = maxHeight - padTop - padBottom;

  // Foundation depth shown below the base: a sensible minimum, extended (up to the profile
  // bottom) when the width-limited drawing would leave vertical room unused.
  const available = soil ? Math.max(0, profileBottom - H) : 0.6;
  let below = soil ? Math.max(0.8, Math.min(available, Math.max(2.5, 0.6 * H, 0.5 * B))) : 0.6;
  if (soil && (yTop + below) * scaleW < plotMin) {
    below = Math.max(below, Math.min(available, plotMin / scaleW - yTop));
  }
  const yBottom = -below;
  const zViewBottom = H + below;
  const truncated = soil ? profileBottom > zViewBottom + 1e-6 : false;
  const worldH = yTop - yBottom;
  const plotH = Math.min(plotMax, Math.max(plotMin, worldH * scaleW));
  const scale = Math.min(scaleW, plotH / worldH);
  const usedW = worldW * scale;
  const offX = drawX0 + (DW - usedW) / 2;
  const svgH = Math.round(worldH * scale + padTop + padBottom);

  retainedPoly = [...retainedPoly, [xMax, 0], [xMax, yTop]];
  const frontPoly: Pt[] = [[xMin, 0]];
  if (isCantilever(wallType, geometry)) {
    const tb = Math.max(0.1, geometry.base_thickness);
    frontPoly.push([0, 0], [0, Math.min(tb, D)]);
    if (D > tb) frontPoly.push([Math.max(0, geometry.toe), tb], [frontAt(D), D]);
  } else {
    frontPoly.push([0, 0], [frontAt(D), D]);
  }
  frontPoly.push([xMin, D]);
  const frontMaxX = Math.max(...frontPoly.map((p) => p[0]));
  const sx = (x: number) => offX + (x - xMin) * scale;
  const sy = (y: number) => padTop + (yTop - y) * scale;
  const zy = (z: number) => sy(H - z);
  const poly = (pts: Pt[]) => pts.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ");

  const leftEdge = sx(xMin);
  const rightEdge = sx(xMax);
  const axisX = leftEdge - leftLabelW;

  // ---------------------------------------------------------------- bands
  interface Band {
    key: string;
    slice: ZoneSlice;
    x0: number;
    x1: number;
    y0: number; // px top
    y1: number; // px bottom
    clip?: string;
    side: "backfill" | "front" | "foundation";
  }
  const bands: Band[] = [];
  if (zones) {
    zones.backfill.forEach((s, i) =>
      bands.push({
        key: `b-${i}-${s.layer_id}`,
        slice: s,
        x0: sx(backMinX) - 1,
        x1: rightEdge,
        y0: i === 0 ? sy(yTop) : zy(s.top),
        y1: zy(s.bottom),
        clip: `url(#${uid}-clip-ret)`,
        side: "backfill",
      }),
    );
    zones.front.forEach((s, i) =>
      bands.push({
        key: `f-${i}-${s.layer_id}`,
        slice: s,
        x0: leftEdge,
        x1: sx(frontMaxX) + 1,
        y0: zy(s.top),
        y1: zy(s.bottom),
        clip: `url(#${uid}-clip-front)`,
        side: "front",
      }),
    );
    zones.foundation.forEach((s, i) => {
      if (s.top >= zViewBottom) return;
      bands.push({
        key: `d-${i}-${s.layer_id}`,
        slice: s,
        x0: leftEdge,
        x1: rightEdge,
        y0: zy(s.top),
        y1: zy(Math.min(s.bottom, zViewBottom)),
        side: "foundation",
      });
    });
  }

  // ---------------------------------------------------------------- labels
  const rightBands = bands.filter((b) => b.side !== "front");
  const leftBands = bands.filter((b) => b.side === "front");
  const labelGapR = rightBands.length > 0 && (svgH - padTop - padBottom) / rightBands.length >= 26 ? 26 : 14;
  const labelGapL = leftBands.length > 0 && (D * scale) / leftBands.length >= 26 ? 26 : 14;
  const midOf = (b: Band) => (Math.max(b.y0, padTop) + b.y1) / 2;
  const rightYs = spreadLabels(rightBands.map(midOf), labelGapR, padTop + 8, svgH - padBottom - (labelGapR > 14 ? 12 : 0));
  const leftYs = spreadLabels(leftBands.map(midOf), labelGapL, padTop + 8, svgH - padBottom - (labelGapL > 14 ? 12 : 0));
  const rightChars = Math.floor((rightLabelW - 14) / 6);
  const leftChars = Math.floor((leftLabelW - 14) / 6);

  const headOf = (s: ZoneSlice) => {
    const st = soilStyle(s.layer, scheme);
    return `${s.layer_id} · ${s.layer.uscs ?? t(st.labelKey)}`;
  };
  const tooltipOf = (s: ZoneSlice) =>
    `${s.layer_id} (${t(s.origin === "fill" ? "web.section.origin.fill" : "web.section.origin.profile")}) · ${
      s.layer.uscs ?? t(soilStyle(s.layer, scheme).labelKey)
    } · z ${fmt(s.top, 2)}–${fmt(s.bottom, 2)} m · ${strengthText(s.layer)}${
      s.layer.description ? ` · ${s.layer.description}` : ""
    }`;

  // ---------------------------------------------------------------- axis
  const ticks = niceTicks(0, zViewBottom, Math.max(4, Math.floor((zViewBottom * scale) / 44)));
  const dec = tickDecimals(ticks);
  const keyLevels = [
    { z: frontDepth, label: t("web.section.level.front"), color: ZONE_COLOR.front },
    { z: H, label: t("web.section.level.base"), color: "var(--mantine-color-text)" },
  ];

  // ---------------------------------------------------------------- GWT
  const gwtMarks: { side: "retained" | "front"; z: number; inherited: boolean }[] = [];
  if (soil) {
    const r = retainedGwt(soil);
    const f = frontGwt(soil);
    gwtMarks.push({ side: "retained", z: gwtDepth(r.gwt, gwtCase), inherited: r.inherited });
    gwtMarks.push({ side: "front", z: gwtDepth(f.gwt, gwtCase), inherited: f.inherited });
  }

  // A front-water label that does not fit inside the front zone goes into the left gutter;
  // depth-axis tick labels at that height are then suppressed so they do not overlap.
  const axisAvoidYs: number[] = [];
  for (const g of gwtMarks) {
    if (g.side !== "front" || !Number.isFinite(g.z) || g.z > zViewBottom) continue;
    const yw = H - g.z;
    const x1 = yw >= 0 && yw <= H ? sx(frontAt(Math.min(yw, H))) : sx(0);
    const text = `${g.z.toFixed(2)} m${g.inherited ? ` · ${t("web.section.gwt_inherited")}` : ""}`;
    if (!(leftEdge + 24 + text.length * 5.8 < x1 - 4)) axisAvoidYs.push(zy(g.z) - 4);
  }
  const concreteFill = scheme === "dark" ? "#7A8089" : "#C4C9CF";
  const selectable = Boolean(onSelectLayer);

  return (
    <Card withBorder padding="sm" radius="sm" h="100%">
      <Stack gap={6} h="100%">
        <Group justify="space-between" gap="xs" wrap="wrap">
          <Group gap="xs" wrap="nowrap">
            <Text fw={600} size="sm">
              {title ?? t("web.section.title")}
            </Text>
            {headerExtra}
          </Group>
          <Text size="xs" c="dimmed" ff="monospace">
            {summaryText}
          </Text>
        </Group>
        {zones?.warnings.includes("profile_short") && (
          <Text size="xs" c="red">
            {t("web.section.warn_profile_short", { z: H.toFixed(2) })}
          </Text>
        )}

        <div ref={ref} style={{ width: "100%", flex: 1, minHeight: 0 }}>
          <svg
            width={W}
            height={svgH}
            viewBox={`0 0 ${W} ${svgH}`}
            role="img"
            aria-label={t("web.section.aria", { H: H.toFixed(2), D: D.toFixed(2), B: B.toFixed(2) })}
            style={{ display: "block", fontFamily: "inherit" }}
          >
            <defs>
              <clipPath id={`${uid}-clip-ret`}>
                <polygon points={poly(retainedPoly)} />
              </clipPath>
              <clipPath id={`${uid}-clip-front`}>
                <polygon points={poly(frontPoly)} />
              </clipPath>
            </defs>
            <SoilPatternDefs idPrefix={uid} scheme={scheme} />

            {/* side titles */}
            <text x={(leftEdge + sx(0)) / 2} y={14} textAnchor="middle" fontSize={11} fontWeight={600} fill={ZONE_COLOR.front}>
              {t("web.section.front_side")}
            </text>
            <text
              x={(sx(backTopX) + rightEdge) / 2}
              y={14}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill={ZONE_COLOR.backfill}
            >
              {t("web.section.retained_side")}
            </text>

            {/* plain soil when no soil model is given */}
            {!hasSoil && (
              <>
                <polygon points={poly(retainedPoly)} fill="var(--mantine-color-yellow-light)" />
                <polygon points={poly(frontPoly)} fill="var(--mantine-color-teal-light)" />
              </>
            )}

            {/* layer bands */}
            {bands.map((b) => {
              const st = soilStyle(b.slice.layer, scheme);
              const fam = soilFamily(b.slice.layer);
              const h = Math.max(0.5, b.y1 - b.y0);
              return (
                <g
                  key={b.key}
                  clipPath={b.clip}
                  onClick={selectable ? () => onSelectLayer?.(b.slice.layer_id, b.slice.origin) : undefined}
                  style={{ cursor: selectable ? "pointer" : undefined }}
                  data-layer-id={b.slice.layer_id}
                >
                  <title>{tooltipOf(b.slice)}</title>
                  <rect x={b.x0} y={b.y0} width={b.x1 - b.x0} height={h} fill={st.fill} />
                  <rect x={b.x0} y={b.y0} width={b.x1 - b.x0} height={h} fill={soilPatternUrl(uid, fam)} />
                  <line x1={b.x0} y1={b.y1} x2={b.x1} y2={b.y1} stroke={st.stroke} strokeWidth={0.9} />
                </g>
              );
            })}

            {/* selected layer outline */}
            {bands
              .filter((b) => b.slice.layer_id === selectedLayerId)
              .map((b) => (
                <g key={`sel-${b.key}`} clipPath={b.clip} pointerEvents="none">
                  <rect
                    x={b.x0 + 1.5}
                    y={Math.max(b.y0, padTop) + 1.5}
                    width={Math.max(0, b.x1 - b.x0 - 3)}
                    height={Math.max(0, b.y1 - Math.max(b.y0, padTop) - 3)}
                    fill="none"
                    stroke="var(--mantine-color-blue-filled)"
                    strokeWidth={3}
                  />
                </g>
              ))}

            {/* boundary depth labels (inside, at the outer edges) */}
            {hasSoil &&
              bands.map((b) => {
                const z = b.slice.bottom;
                if (Math.abs(z - H) < 1e-6 || z >= zViewBottom - 1e-6) return null;
                const y = zy(z);
                const right = b.side !== "front";
                return (
                  <text
                    key={`bd-${b.key}`}
                    x={right ? rightEdge - 4 : leftEdge + 4}
                    y={y - 3}
                    textAnchor={right ? "end" : "start"}
                    fontSize={9.5}
                    fill="var(--mantine-color-text)"
                    style={{ ...HALO, fontVariantNumeric: "tabular-nums" }}
                    pointerEvents="none"
                  >
                    {z.toFixed(2)}
                  </text>
                );
              })}

            {/* zone outlines */}
            {hasSoil && showZones && (
              <g pointerEvents="none" fill="none" strokeWidth={1.4} strokeDasharray="7 4">
                <polygon points={poly(retainedPoly)} stroke={ZONE_COLOR.backfill} />
                <polygon points={poly(frontPoly)} stroke={ZONE_COLOR.front} />
                <rect
                  x={leftEdge + 0.7}
                  y={sy(0)}
                  width={rightEdge - leftEdge - 1.4}
                  height={Math.max(0, sy(yBottom) - sy(0) - 0.7)}
                  stroke={ZONE_COLOR.foundation}
                />
                <text
                  x={rightEdge - 5}
                  y={sy(H) + 13}
                  textAnchor="end"
                  fontSize={10}
                  fontStyle="italic"
                  fontWeight={600}
                  fill={ZONE_COLOR.backfill}
                  stroke="none"
                  strokeDasharray="none"
                  style={HALO}
                >
                  <title>{t("web.section.zone.backfill", { a: "0.00", b: H.toFixed(2) })}</title>
                  {t("web.section.zone_short.backfill")}
                </text>
                {D * scale >= 28 && (
                  <text
                    x={leftEdge + 5}
                    y={sy(0) - 4}
                    fontSize={10}
                    fontStyle="italic"
                    fontWeight={600}
                    fill={ZONE_COLOR.front}
                    stroke="none"
                    strokeDasharray="none"
                    style={HALO}
                  >
                    <title>{t("web.section.zone.front", { a: frontDepth.toFixed(2), b: H.toFixed(2) })}</title>
                    {t("web.section.zone_short.front")}
                  </text>
                )}
                <text
                  x={leftEdge + 5}
                  y={sy(0) + 13}
                  fontSize={10}
                  fontStyle="italic"
                  fontWeight={600}
                  fill={ZONE_COLOR.foundation}
                  stroke="none"
                  strokeDasharray="none"
                  style={HALO}
                >
                  <title>{t("web.section.zone.foundation", { a: H.toFixed(2), b: profileBottom.toFixed(2) })}</title>
                  {t("web.section.zone_short.foundation")}
                </text>
              </g>
            )}

            {/* ground surfaces */}
            <line
              x1={sx(backTopX)}
              y1={sy(H)}
              x2={rightEdge}
              y2={sy(yTop)}
              stroke="var(--mantine-color-text)"
              strokeWidth={2}
            />
            <line x1={leftEdge} y1={sy(D)} x2={sx(frontAt(D))} y2={sy(D)} stroke="var(--mantine-color-text)" strokeWidth={2} />

            {/* groundwater */}
            {gwtMarks.map((g) => {
              if (!Number.isFinite(g.z) || g.z > zViewBottom) return null;
              const y = zy(g.z);
              const yw = H - g.z;
              const st = GWT_STYLE[gwtCase];
              const label = `${t(`web.soil.gwt.${gwtCase}`)} ${g.z.toFixed(2)} m${g.inherited ? ` (${t("web.section.gwt_inherited")})` : ""}`;
              const shortLabel = `${g.z.toFixed(2)} m${g.inherited ? ` · ${t("web.section.gwt_inherited")}` : ""}`;
              if (g.side === "retained") {
                const x0 = sx(backAt(yw));
                return (
                  <g key="gwt-r" pointerEvents="visiblePainted">
                    <title>{`${t("web.section.retained_side")}: ${label}`}</title>
                    <line x1={x0} y1={y} x2={rightEdge} y2={y} stroke={st.color} strokeWidth={1.6} strokeDasharray={st.dash} />
                    <GwtMarker x={x0 + 14} y={y} kind={gwtCase} />
                    <text x={x0 + 24} y={y - 4} fontSize={10} fontWeight={600} fill={st.color} style={HALO}>
                      {shortLabel}
                    </text>
                  </g>
                );
              }
              const x1 = yw >= 0 && yw <= H ? sx(frontAt(Math.min(yw, H))) : sx(0);
              return (
                <g key="gwt-f" pointerEvents="visiblePainted">
                  <title>{`${t("web.section.front_side")}: ${label}`}</title>
                  <line x1={leftEdge} y1={y} x2={x1} y2={y} stroke={st.color} strokeWidth={1.6} strokeDasharray={st.dash} />
                  <GwtMarker x={leftEdge + 14} y={y} kind={gwtCase} />
                  {leftEdge + 24 + shortLabel.length * 5.8 < x1 - 4 ? (
                    <text x={leftEdge + 24} y={y - 4} fontSize={10} fontWeight={600} fill={st.color} style={HALO}>
                      {shortLabel}
                    </text>
                  ) : (
                    <text x={leftEdge - 6} y={y - 4} textAnchor="end" fontSize={10} fontWeight={600} fill={st.color} style={HALO}>
                      {shortLabel}
                    </text>
                  )}
                </g>
              );
            })}

            {/* wall */}
            {wallPolys.map((p, i) => (
              <polygon
                key={`wall-${i}`}
                points={poly(p)}
                fill={concreteFill}
                stroke="var(--mantine-color-text)"
                strokeWidth={1.6}
                strokeLinejoin="round"
              />
            ))}

            {/* truncated profile marker */}
            {truncated && (
              <g pointerEvents="none">
                <polyline
                  points={Array.from({ length: 13 }, (_, i) => {
                    const x = leftEdge + ((rightEdge - leftEdge) * i) / 12;
                    return `${x.toFixed(1)},${(sy(yBottom) + (i % 2 === 0 ? -3 : 3)).toFixed(1)}`;
                  }).join(" ")}
                  fill="none"
                  stroke="var(--mantine-color-dimmed)"
                  strokeWidth={1.2}
                />
                <text
                  x={rightEdge - 4}
                  y={sy(yBottom) - 8}
                  textAnchor="end"
                  fontSize={10}
                  fill="var(--mantine-color-text)"
                  style={HALO}
                >
                  {t("web.section.continues", { z: profileBottom.toFixed(2) })}
                </text>
              </g>
            )}

            {/* depth axis (structure frame) */}
            {hasSoil && (
              <g>
                <text x={axisX + 4} y={zy(0) - 8} textAnchor="end" fontSize={10} fill="var(--mantine-color-dimmed)">
                  z (m)
                </text>
                <line x1={axisX + 6} y1={zy(0)} x2={axisX + 6} y2={zy(zViewBottom)} stroke="var(--mantine-color-default-border)" />
                {ticks.map((v) => {
                  const nearKey =
                    keyLevels.some((k) => Math.abs(zy(k.z) - zy(v)) < 10) ||
                    axisAvoidYs.some((y) => Math.abs(y - zy(v)) < 12);
                  return (
                    <g key={`tick-${v}`}>
                      <line x1={axisX + 2} y1={zy(v)} x2={axisX + 6} y2={zy(v)} stroke="var(--mantine-color-dimmed)" />
                      {!nearKey && (
                        <text
                          x={axisX}
                          y={zy(v) + 3.5}
                          textAnchor="end"
                          fontSize={10}
                          fill="var(--mantine-color-dimmed)"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {v.toFixed(dec)}
                        </text>
                      )}
                    </g>
                  );
                })}
                {keyLevels.map((k) => (
                  <g key={`key-${k.label}`}>
                    <title>{`${k.label}: z = ${k.z.toFixed(2)} m`}</title>
                    <polygon
                      points={`${axisX + 6},${zy(k.z)} ${axisX + 12},${zy(k.z) - 4} ${axisX + 12},${zy(k.z) + 4}`}
                      fill={k.color}
                    />
                    <line
                      x1={axisX + 12}
                      y1={zy(k.z)}
                      x2={leftEdge}
                      y2={zy(k.z)}
                      stroke={k.color}
                      strokeWidth={0.6}
                      strokeDasharray="2 3"
                    />
                    <text
                      x={axisX}
                      y={zy(k.z) + 3.5}
                      textAnchor="end"
                      fontSize={10}
                      fontWeight={700}
                      fill={k.color}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {k.z.toFixed(2)}
                    </text>
                  </g>
                ))}
              </g>
            )}

            {/* right labels: retained side + foundation */}
            {rightBands.map((b, i) => {
              const ly = rightYs[i];
              const my = midOf(b);
              const lx = rightEdge + 12;
              const selected = b.slice.layer_id === selectedLayerId;
              return (
                <g
                  key={`rl-${b.key}`}
                  onClick={selectable ? () => onSelectLayer?.(b.slice.layer_id, b.slice.origin) : undefined}
                  style={{ cursor: selectable ? "pointer" : undefined }}
                >
                  <title>{tooltipOf(b.slice)}</title>
                  <polyline
                    points={`${rightEdge - 6},${my} ${rightEdge + 4},${my} ${lx - 3},${ly - 4}`}
                    fill="none"
                    stroke="var(--mantine-color-dimmed)"
                    strokeWidth={0.8}
                  />
                  <circle cx={rightEdge - 6} cy={my} r={1.8} fill="var(--mantine-color-text)" />
                  <text
                    x={lx}
                    y={ly}
                    fontSize={11}
                    fontWeight={700}
                    fill={selected ? "var(--mantine-color-blue-filled)" : "var(--mantine-color-text)"}
                  >
                    {truncate(headOf(b.slice), rightChars)}
                    {b.slice.origin === "fill" ? (
                      <tspan fontSize={9} fontWeight={600} fill={ZONE_COLOR.backfill}>
                        {` ${t("web.section.fill_tag")}`}
                      </tspan>
                    ) : null}
                  </text>
                  {labelGapR > 14 && (
                    <text x={lx} y={ly + 12} fontSize={10} fill="var(--mantine-color-dimmed)" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {truncate(`${strengthText(b.slice.layer)} · γ ${fmt(b.slice.layer.gamma, 1)}`, rightChars + 2)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* left labels: front side */}
            {leftBands.map((b, i) => {
              const ly = leftYs[i];
              const my = midOf(b);
              const lx = leftEdge - 12;
              const selected = b.slice.layer_id === selectedLayerId;
              return (
                <g
                  key={`ll-${b.key}`}
                  onClick={selectable ? () => onSelectLayer?.(b.slice.layer_id, b.slice.origin) : undefined}
                  style={{ cursor: selectable ? "pointer" : undefined }}
                >
                  <title>{tooltipOf(b.slice)}</title>
                  <polyline
                    points={`${leftEdge + 6},${my} ${leftEdge - 4},${my} ${lx + 3},${ly - 4}`}
                    fill="none"
                    stroke="var(--mantine-color-dimmed)"
                    strokeWidth={0.8}
                  />
                  <circle cx={leftEdge + 6} cy={my} r={1.8} fill="var(--mantine-color-text)" />
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="end"
                    fontSize={11}
                    fontWeight={700}
                    fill={selected ? "var(--mantine-color-blue-filled)" : "var(--mantine-color-text)"}
                  >
                    {truncate(headOf(b.slice), leftChars)}
                  </text>
                  {labelGapL > 14 && (
                    <text x={lx} y={ly + 12} textAnchor="end" fontSize={10} fill="var(--mantine-color-dimmed)">
                      {truncate(strengthText(b.slice.layer), leftChars + 2)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* dimensions (outside the drawing) */}
            <g fontSize={10} fill="var(--mantine-color-text)" style={{ fontVariantNumeric: "tabular-nums" }}>
              {Array.from(new Set([0, B, ...dimChain.map((d) => d.b)])).map((x) => (
                <line
                  key={`ext-${x}`}
                  x1={sx(x)}
                  y1={sy(0) + 2}
                  x2={sx(x)}
                  y2={sy(yBottom) + (dimChain.length > 0 ? 42 : 22)}
                  stroke="var(--mantine-color-dimmed)"
                  strokeWidth={0.6}
                  strokeDasharray="2 3"
                />
              ))}
              {dimChain.map((d) => (
                <g key={`dim-${d.a}`}>
                  <line x1={sx(d.a)} y1={sy(yBottom) + 14} x2={sx(d.b)} y2={sy(yBottom) + 14} stroke="var(--mantine-color-text)" strokeWidth={0.8} />
                  <line x1={sx(d.a)} y1={sy(yBottom) + 10} x2={sx(d.a)} y2={sy(yBottom) + 18} stroke="var(--mantine-color-text)" strokeWidth={0.8} />
                  <line x1={sx(d.b)} y1={sy(yBottom) + 10} x2={sx(d.b)} y2={sy(yBottom) + 18} stroke="var(--mantine-color-text)" strokeWidth={0.8} />
                  {sx(d.b) - sx(d.a) > 22 && (
                    <text x={(sx(d.a) + sx(d.b)) / 2} y={sy(yBottom) + 11} textAnchor="middle" fontSize={9.5}>
                      {d.label}
                    </text>
                  )}
                </g>
              ))}
              {(() => {
                const y = sy(yBottom) + (dimChain.length > 0 ? 36 : 16);
                return (
                  <g>
                    <line x1={sx(0)} y1={y} x2={sx(B)} y2={y} stroke="var(--mantine-color-text)" strokeWidth={0.9} />
                    <line x1={sx(0)} y1={y - 4} x2={sx(0)} y2={y + 4} stroke="var(--mantine-color-text)" strokeWidth={0.9} />
                    <line x1={sx(B)} y1={y - 4} x2={sx(B)} y2={y + 4} stroke="var(--mantine-color-text)" strokeWidth={0.9} />
                    <text x={(sx(0) + sx(B)) / 2} y={y + 13} textAnchor="middle" fontWeight={600}>
                      {t("web.section.base_label", { B: B.toFixed(2) })}
                    </text>
                  </g>
                );
              })()}
              {(() => {
                const x = W - dimW / 2 - 4;
                return (
                  <g>
                    <line x1={x} y1={sy(H)} x2={x} y2={sy(0)} stroke="var(--mantine-color-text)" strokeWidth={0.9} />
                    <line x1={x - 4} y1={sy(H)} x2={x + 4} y2={sy(H)} stroke="var(--mantine-color-text)" strokeWidth={0.9} />
                    <line x1={x - 4} y1={sy(0)} x2={x + 4} y2={sy(0)} stroke="var(--mantine-color-text)" strokeWidth={0.9} />
                    <text
                      x={x + 12}
                      y={(sy(H) + sy(0)) / 2}
                      textAnchor="middle"
                      fontWeight={600}
                      transform={`rotate(-90 ${x + 12} ${(sy(H) + sy(0)) / 2})`}
                    >
                      {t("web.section.height_label", { H: H.toFixed(2) })}
                    </text>
                  </g>
                );
              })()}
            </g>
          </svg>
        </div>
      </Stack>
    </Card>
  );
}
