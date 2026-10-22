import { useId } from "react";
import { Card, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { spreadLabels } from "../../../shared/soil/axis";
import { useSoilScheme } from "../../../shared/soil/SoilPatternDefs";
import { truncate } from "../../../shared/soil/format";
import { soilStyle, type SoilScheme } from "../../../shared/soil/soilStyle";
import { buildSectionLayout, type Pt, type SectionInput, type SectionLayout } from "./sectionLayout";

export interface WallCrossSectionProps extends SectionInput {
  title?: string;
  /** Colour scheme of the soil palette; defaults to the active Mantine scheme. */
  scheme?: SoilScheme;
}

const HALO = {
  paintOrder: "stroke" as const,
  stroke: "var(--mantine-color-body)",
  strokeWidth: 3,
  strokeLinejoin: "round" as const,
};
const TEXT = "var(--mantine-color-text)";
const DIM = "var(--mantine-color-dimmed)";
const WATER = "var(--mantine-color-blue-6)";
const MIN_LABEL_PX = 34;

const path = (list: Pt[], close = false) =>
  `${list.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ")}${close ? " Z" : ""}`;

function Dimension({
  x0,
  y0,
  x1,
  y1,
  label,
  rotate = false,
}: {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  label: string;
  rotate?: boolean;
}) {
  const horizontal = y0 === y1;
  return (
    <g stroke={TEXT} strokeWidth={1} fill="none">
      <line x1={x0} y1={y0} x2={x1} y2={y1} />
      {horizontal ? (
        <>
          <line x1={x0} y1={y0 - 4} x2={x0} y2={y0 + 4} />
          <line x1={x1} y1={y1 - 4} x2={x1} y2={y1 + 4} />
          <text x={(x0 + x1) / 2} y={y0 - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill={TEXT} {...HALO}>
            {label}
          </text>
        </>
      ) : (
        <>
          <line x1={x0 - 4} y1={y0} x2={x0 + 4} y2={y0} />
          <line x1={x1 - 4} y1={y1} x2={x1 + 4} y2={y1} />
          <text
            x={rotate ? x0 - 5 : x0 + 6}
            y={(y0 + y1) / 2 + (rotate ? 0 : 4)}
            transform={rotate ? `rotate(-90 ${x0 - 5} ${(y0 + y1) / 2})` : undefined}
            textAnchor={rotate ? "middle" : "start"}
            fontSize={11}
            fontWeight={600}
            fill={TEXT}
            {...HALO}
          >
            {label}
          </text>
        </>
      )}
    </g>
  );
}

/**
 * To-scale wall cross-section (stem, base, toe/heel, ground lines, water tables, soil layers) drawn
 * from `buildSectionLayout`. Purely presentational: it never measures the DOM, so the drawing is
 * deterministic; the fixed viewBox scales to the container width.
 */
export function WallCrossSection({ title, scheme: schemeProp, ...input }: WallCrossSectionProps) {
  const { t } = useTranslation();
  const activeScheme = useSoilScheme();
  const scheme = schemeProp ?? activeScheme;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const layout: SectionLayout = buildSectionLayout(input);
  const { plot } = layout;

  const wallFill = scheme === "dark" ? "var(--mantine-color-gray-6)" : "var(--mantine-color-gray-5)";
  const neutral = "var(--mantine-color-gray-light)";
  const gutterX = plot.x1 + 6;

  // Layer labels: retained side and foundation on the right, front side inside the drawing.
  const right = layout.bands.filter((b) => b.side !== "front");
  const left = layout.bands.filter((b) => b.side === "front");
  const mid = (b: { y0: number; y1: number }) => (Math.max(b.y0, plot.y0) + b.y1) / 2;
  const rightYs = spreadLabels(right.map(mid), 26, plot.y0 + 8, plot.y1 - 8);

  // Layer ids are internal (often 32-char UUIDs): show description, then USCS, then a short ordinal.
  const layerOrder = [...new Set(layout.bands.map((b) => b.layerId))];
  const bandName = (b: (typeof layout.bands)[number], maxChars: number) => {
    const text = b.layer.description?.trim() || b.layer.uscs || `${t("web.section.layer_short")} ${layerOrder.indexOf(b.layerId) + 1}`;
    return truncate(text, maxChars);
  };
  const bandTitle = (b: (typeof layout.bands)[number]) =>
    `${b.layer.description?.trim() || b.layer.uscs || bandName(b, 40)} (${t(b.origin === "fill" ? "web.section.origin.fill" : "web.section.origin.profile")}) · z ${b.top.toFixed(2)}–${b.bottom.toFixed(2)} m`;

  return (
    <Card withBorder padding="xs" radius="sm" data-testid="wall-section">
      <Text fw={600} size="sm" mb={4}>
        {title ?? t("web.section.title")}
      </Text>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label={t("web.section.aria", {
          H: layout.H.toFixed(2),
          D: layout.D.toFixed(2),
          B: layout.B.toFixed(2),
        })}
        style={{ width: "100%", height: "auto", maxHeight: 520, display: "block" }}
      >
        <defs>
          <clipPath id={`${uid}-ret`}>
            <path d={path(layout.retained, true)} />
          </clipPath>
          <clipPath id={`${uid}-front`}>
            <path d={path(layout.front, true)} />
          </clipPath>
        </defs>

        {/* soil: neutral regions when no soil model is given, layer bands otherwise */}
        {!layout.hasSoil && (
          <>
            <path d={path(layout.retained, true)} fill={neutral} data-part="retained-soil" />
            <path d={path(layout.front, true)} fill={neutral} data-part="front-soil" />
          </>
        )}
        {layout.bands.map((b) => {
          const s = soilStyle(b.layer, scheme);
          return (
            <g key={b.key} data-part="band" data-layer-id={b.layerId} data-side={b.side} clipPath={b.clip ? `url(#${uid}-${b.clip === "retained" ? "ret" : "front"})` : undefined}>
              <title>{bandTitle(b)}</title>
              <rect x={b.x0} y={b.y0} width={Math.max(0, b.x1 - b.x0)} height={Math.max(0, b.y1 - b.y0)} fill={s.fill} />
              <line x1={b.x0} y1={b.y1} x2={b.x1} y2={b.y1} stroke={s.stroke} strokeWidth={0.8} strokeDasharray="4 3" />
            </g>
          );
        })}

        {/* ground surface */}
        <path d={path(layout.groundRetained)} fill="none" stroke={TEXT} strokeWidth={2} data-part="ground-retained" />
        <path d={path(layout.groundFront)} fill="none" stroke={TEXT} strokeWidth={2} data-part="ground-front" />

        {/* wall */}
        {layout.wall.map((poly, i) => (
          <path key={i} d={path(poly, true)} fill={wallFill} stroke={TEXT} strokeWidth={1.5} strokeLinejoin="round" data-part={layout.baseThickness !== null ? (i === 0 ? "base" : "stem") : "wall"} />
        ))}

        {/* water tables */}
        {layout.water
          .filter((w) => w.visible)
          .map((w) => {
            const text = `${t("walls.section.gwt")} ${w.z.toFixed(2)} m${w.inherited ? ` · ${t("web.section.gwt_inherited")}` : ""}`;
            // The front label is short and sits against the wall face, clear of the dimension lines.
            const shown = w.side === "retained" ? text : `${w.z.toFixed(2)} m`;
            return (
              <g key={w.side} data-part="water" data-side={w.side}>
                <title>{`${t(w.side === "retained" ? "web.section.retained_side" : "web.section.front_side")}: ${text}`}</title>
                <line x1={w.x0} y1={w.y} x2={w.x1} y2={w.y} stroke={WATER} strokeWidth={1.6} strokeDasharray="6 3" />
                <text
                  x={w.x1 - 4}
                  y={w.y - 4}
                  textAnchor="end"
                  fontSize={10}
                  fill={WATER}
                 
                  {...HALO}
                >
                  {`▽ ${shown}`}
                </text>
              </g>
            );
          })}

        {/* side captions */}
        <text x={plot.x0 + 4} y={14} fontSize={11} fontWeight={600} fill={DIM}>
          {t("web.section.front_side")}
        </text>
        <text x={plot.x1 - 4} y={14} fontSize={11} fontWeight={600} fill={DIM} textAnchor="end">
          {t("web.section.retained_side")}
        </text>

        {/* wall part labels */}
        {layout.anchors.stem && layout.heelWidth !== null && (
          <text x={layout.anchors.stem[0]} y={layout.anchors.stem[1]} textAnchor="middle" fontSize={10} fill={TEXT} {...HALO} data-part="label-stem">
            {t("walls.section.stem")}
          </text>
        )}
        {layout.anchors.base && layout.B * layout.scale > 3 * MIN_LABEL_PX && layout.baseThickness !== null && layout.baseThickness * layout.scale >= 12 && (
          <text x={layout.anchors.base[0]} y={layout.anchors.base[1] + 3} textAnchor="middle" fontSize={9} fill={TEXT} {...HALO} data-part="label-base">
            {t("walls.section.base")}
          </text>
        )}
        {layout.anchors.wall && (
          <text x={layout.anchors.wall[0]} y={layout.anchors.wall[1]} textAnchor="middle" fontSize={10} fill={TEXT} {...HALO} data-part="label-wall">
            {t("walls.section.gravity_body")}
          </text>
        )}
        {layout.anchors.toe && (layout.toeWidth ?? 0) * layout.scale >= MIN_LABEL_PX && (
          <text x={layout.anchors.toe[0]} y={layout.anchors.toe[1] + 12} textAnchor="middle" fontSize={10} fill={TEXT} {...HALO} data-part="label-toe">
            {t("walls.section.toe")}
          </text>
        )}
        {layout.anchors.heel && (layout.heelWidth ?? 0) * layout.scale >= MIN_LABEL_PX && (
          <text x={layout.anchors.heel[0]} y={layout.anchors.heel[1] + 12} textAnchor="middle" fontSize={10} fill={TEXT} {...HALO} data-part="label-heel">
            {t("walls.section.heel")}
          </text>
        )}

        {/* dimensions */}
        <Dimension x0={layout.dims.B.x0} y0={layout.dims.B.y} x1={layout.dims.B.x1} y1={layout.dims.B.y} label={t("web.section.base_label", { B: layout.B.toFixed(2) })} />
        <Dimension rotate x0={layout.dims.H.x} y0={layout.dims.H.y0} x1={layout.dims.H.x} y1={layout.dims.H.y1} label={t("web.section.height_label", { H: layout.H.toFixed(2) })} />
        {layout.D > 0 && (
          <Dimension x0={layout.dims.D.x} y0={layout.dims.D.y0} x1={layout.dims.D.x} y1={layout.dims.D.y1} label={t("web.section.embedment_label", { D: layout.D.toFixed(2) })} />
        )}

        {/* layer labels */}
        {right.map((b, i) => {
          const y = rightYs[i];
          return (
            <g key={`l-${b.key}`} data-part="layer-label" data-layer-id={b.layerId}>
              <line x1={plot.x1} y1={mid(b)} x2={gutterX} y2={y - 3} stroke={DIM} strokeWidth={0.8} />
              <text x={gutterX + 2} y={y} fontSize={11} fontWeight={600} fill={TEXT}>
                {bandName(b, 18)}
                {b.origin === "fill" ? ` ${t("web.section.fill_tag")}` : ""}
              </text>
              <text x={gutterX + 2} y={y + 11} fontSize={9.5} fill={DIM}>
                {`${b.top.toFixed(2)}–${b.bottom.toFixed(2)} m`}
              </text>
            </g>
          );
        })}
        {left.map((b) => (
          <text key={`lf-${b.key}`} x={plot.x0 + 4} y={mid(b) + 4} fontSize={10} fontWeight={600} fill={soilStyle(b.layer, scheme).ink} data-part="layer-label" data-layer-id={b.layerId}>
            {bandName(b, 12)}
          </text>
        ))}
      </svg>
      {layout.warnings.includes("profile_short") && (
        <Text size="xs" c="orange" mt={4}>
          {t("web.section.warn_profile_short", { z: layout.H.toFixed(2) })}
        </Text>
      )}
    </Card>
  );
}
