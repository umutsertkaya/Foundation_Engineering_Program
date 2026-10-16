import { Card, Group, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { CantileverGeometry, GravityGeometry, WallType } from "../api/types";

export interface WallSectionProps {
  wallType: WallType;
  geometry: CantileverGeometry | GravityGeometry;
  height?: number;
  backfillSlope?: number;
}

function isCantilever(
  wallType: WallType,
  geometry: CantileverGeometry | GravityGeometry,
): geometry is CantileverGeometry {
  return wallType === "cantilever" && "stem_bottom" in geometry;
}

export function WallSection({
  wallType,
  geometry,
  height,
  backfillSlope = 0,
}: WallSectionProps) {
  const { t } = useTranslation();

  const svgWidth = 520;
  const svgHeight = 320;
  const padLeft = 52;
  const padRight = 52;
  const padTop = 36;
  const padBottom = 44;

  let B: number;
  let H: number;
  let D: number;
  let baseSlabPoints: [number, number][] = [];
  let stemOrWallPoints: [number, number][] = [];
  let retainedTopX: number;
  let frontWallXAtD: number;
  let summaryText: string;

  if (isCantilever(wallType, geometry)) {
    const toe = Math.max(0, geometry.toe);
    const stemBottom = Math.max(0.1, geometry.stem_bottom);
    const stemTop = Math.max(0.1, Math.min(stemBottom, geometry.stem_top));
    const heel = Math.max(0, geometry.heel);
    const tb = Math.max(0.1, geometry.base_thickness);
    const hs = Math.max(0.2, geometry.stem_height || (height ? height - tb : 4.5));

    B = toe + stemBottom + heel;
    H = tb + hs;
    D = Math.max(0, Math.min(H, geometry.embedment ?? 0.6));

    // Base slab: (0,0) -> (B,0) -> (B,tb) -> (0,tb)
    baseSlabPoints = [
      [0, 0],
      [B, 0],
      [B, tb],
      [0, tb],
    ];

    // Stem with battered front and vertical back at x = toe + stemBottom
    const xBack = toe + stemBottom;
    const xFrontTop = xBack - stemTop;
    stemOrWallPoints = [
      [toe, tb],
      [xBack, tb],
      [xBack, H],
      [xFrontTop, H],
    ];

    retainedTopX = xBack;
    if (D <= tb) {
      frontWallXAtD = 0;
    } else {
      const ratio = (D - tb) / hs;
      frontWallXAtD = toe + ratio * (xFrontTop - toe);
    }

    summaryText = t("ui.wall.summary_cantilever", {
      B: B.toFixed(2),
      hs: hs.toFixed(2),
      D: D.toFixed(2),
    });
  } else {
    const grav = geometry as GravityGeometry;
    B = Math.max(0.2, grav.base_width);
    H = Math.max(0.5, height ?? grav.height);
    const topW = Math.max(0.1, Math.min(B, grav.top_width));
    const backOffset = Math.max(0, Math.min(B - topW, grav.back_offset ?? 0));
    D = Math.max(0, Math.min(H, grav.embedment ?? 0.6));

    const xBackTop = B - backOffset;
    const xFrontTop = xBackTop - topW;

    stemOrWallPoints = [
      [0, 0],
      [B, 0],
      [xBackTop, H],
      [xFrontTop, H],
    ];
    retainedTopX = xBackTop;
    frontWallXAtD = (D / H) * xFrontTop;

    summaryText = t("ui.wall.summary_gravity", {
      B: B.toFixed(2),
      D: D.toFixed(2),
    });
  }

  const leftMarginM = Math.max(1.0, 0.28 * B);
  const rightMarginM = Math.max(1.2, 0.35 * B);
  const slopeRad = (Math.max(0, Math.min(35, backfillSlope)) * Math.PI) / 180;
  const backfillRise = (B - retainedTopX + rightMarginM) * Math.tan(slopeRad);

  const worldMinX = -leftMarginM;
  const worldMaxX = B + rightMarginM;
  const worldMinY = -0.35;
  const worldMaxY = H + Math.max(0.4, backfillRise + 0.25);

  const worldW = worldMaxX - worldMinX;
  const worldH = worldMaxY - worldMinY;

  const availW = svgWidth - padLeft - padRight;
  const availH = svgHeight - padTop - padBottom;
  const scale = Math.min(availW / worldW, availH / worldH);

  const drawW = worldW * scale;
  const drawH = worldH * scale;
  const originX = padLeft + (availW - drawW) / 2 - worldMinX * scale;
  const originY = padTop + (availH - drawH) / 2 + worldMaxY * scale;

  const sx = (x: number) => originX + x * scale;
  const sy = (y: number) => originY - y * scale;
  const poly = (pts: [number, number][]) =>
    pts.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ");

  const retainedGroundTopEndY = H + backfillRise;
  const retainedSoilPts: [number, number][] = isCantilever(wallType, geometry)
    ? [
        [retainedTopX, geometry.base_thickness],
        [B, geometry.base_thickness],
        [B, 0],
        [worldMaxX, 0],
        [worldMaxX, retainedGroundTopEndY],
        [retainedTopX, H],
      ]
    : [
        [B, 0],
        [worldMaxX, 0],
        [worldMaxX, retainedGroundTopEndY],
        [retainedTopX, H],
      ];

  const frontSoilPts: [number, number][] = [
    [worldMinX, 0],
    [0, 0],
    [frontWallXAtD, D],
    [worldMinX, D],
  ];

  return (
    <Card withBorder padding="sm" radius="sm">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600} size="sm">
            {t("web.section.title")}
          </Text>
          <Text size="xs" c="dimmed" ff="monospace">
            {summaryText}
          </Text>
        </Group>

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          width="100%"
          height={svgHeight}
          role="img"
          aria-label={t("web.section.title")}
          style={{
            display: "block",
            background: "var(--mantine-color-body)",
            borderRadius: "var(--mantine-radius-xs)",
          }}
        >
          {/* Retained soil polygon */}
          <polygon
            points={poly(retainedSoilPts)}
            fill="var(--mantine-color-amber-light)"
            stroke="none"
          />

          {/* Front embedment soil polygon */}
          <polygon
            points={poly(frontSoilPts)}
            fill="var(--mantine-color-teal-light)"
            stroke="none"
          />

          {/* Retained ground surface line */}
          <line
            x1={sx(retainedTopX)}
            y1={sy(H)}
            x2={sx(worldMaxX)}
            y2={sy(retainedGroundTopEndY)}
            stroke="var(--mantine-color-amber-filled)"
            strokeWidth={2}
          />

          {/* Front ground surface line at embedment D */}
          <line
            x1={sx(worldMinX)}
            y1={sy(D)}
            x2={sx(frontWallXAtD)}
            y2={sy(D)}
            stroke="var(--mantine-color-teal-filled)"
            strokeWidth={2}
          />

          {/* Concrete base slab (cantilever) */}
          {baseSlabPoints.length > 0 && (
            <polygon
              points={poly(baseSlabPoints)}
              fill="var(--mantine-color-default-hover)"
              stroke="var(--mantine-color-text)"
              strokeWidth={1.75}
            />
          )}

          {/* Concrete stem or gravity wall body */}
          <polygon
            points={poly(stemOrWallPoints)}
            fill="var(--mantine-color-default-hover)"
            stroke="var(--mantine-color-text)"
            strokeWidth={1.75}
          />

          {/* Base width B dimension line */}
          <line
            x1={sx(0)}
            y1={sy(0) + 18}
            x2={sx(B)}
            y2={sy(0) + 18}
            stroke="var(--mantine-color-dimmed)"
            strokeWidth={1.2}
          />
          <text
            x={(sx(0) + sx(B)) / 2}
            y={sy(0) + 32}
            textAnchor="middle"
            fontSize={11}
            fill="var(--mantine-color-text)"
          >
            {t("web.section.base_label", { B: B.toFixed(2) })}
          </text>

          {/* Total height H label */}
          <line
            x1={sx(B + rightMarginM * 0.65)}
            y1={sy(0)}
            x2={sx(B + rightMarginM * 0.65)}
            y2={sy(H)}
            stroke="var(--mantine-color-dimmed)"
            strokeDasharray="3 3"
            strokeWidth={1.2}
          />
          <text
            x={sx(B + rightMarginM * 0.65) + 6}
            y={(sy(0) + sy(H)) / 2}
            fontSize={11}
            fill="var(--mantine-color-text)"
          >
            {t("web.section.height_label", { H: H.toFixed(2) })}
          </text>

          {/* Embedment D label on front side */}
          <text
            x={sx(worldMinX) + 4}
            y={sy(D) - 6}
            fontSize={11}
            fill="var(--mantine-color-teal-filled)"
          >
            {t("web.section.front_side")} ({t("web.section.embedment_label", { D: D.toFixed(2) })})
          </text>

          {/* Retained ground label */}
          <text
            x={sx(retainedTopX) + 8}
            y={sy(H) - 8}
            fontSize={11}
            fill="var(--mantine-color-amber-filled)"
          >
            {t("web.section.retained_side")}
          </text>

          {/* Cantilever toe / heel labels */}
          {isCantilever(wallType, geometry) && (
            <>
              <text
                x={sx(geometry.toe / 2)}
                y={sy(geometry.base_thickness / 2) + 4}
                textAnchor="middle"
                fontSize={10}
                fill="var(--mantine-color-text)"
              >
                {geometry.toe.toFixed(2)}
              </text>
              <text
                x={sx(geometry.toe + geometry.stem_bottom + geometry.heel / 2)}
                y={sy(geometry.base_thickness / 2) + 4}
                textAnchor="middle"
                fontSize={10}
                fill="var(--mantine-color-text)"
              >
                {geometry.heel.toFixed(2)}
              </text>
            </>
          )}
        </svg>
      </Stack>
    </Card>
  );
}
