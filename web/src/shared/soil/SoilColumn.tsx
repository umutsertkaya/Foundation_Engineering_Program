import { useTranslation } from "react-i18next";
import type { GroundwaterCondition, SoilLayer } from "../api/types";
import { niceTicks, spreadLabels, tickDecimals } from "./axis";
import { fmt, layerLabel, strengthText, truncate } from "./format";
import { GWT_CASES, GWT_STYLE, GwtMarker } from "./GwtMarker";
import { SoilPatternDefs, useSoilScheme, useSvgId } from "./SoilPatternDefs";
import { soilFamily, soilPatternUrl, soilStyle } from "./soilStyle";
import { gwtDepth } from "./zones";

export interface SoilColumnZone {
  top: number;
  bottom: number;
  label: string;
}

export interface SoilColumnProps {
  layers: SoilLayer[];
  gwt?: GroundwaterCondition | null;
  selectedId?: string | null;
  onSelect?: (id: string, index: number) => void;
  width?: number;
  height?: number;
  /** Optional dashed overlays (e.g. structure zones). */
  zones?: SoilColumnZone[];
  /** Depth shown at the bottom (default: last layer bottom). */
  maxDepth?: number;
  ariaLabel?: string;
}

const PAD_TOP = 22;
const PAD_BOTTOM = 10;
const AXIS_W = 34;
const COL_W = 56;

/** To-scale vertical soil log: colour + hatch per layer, depth axis, labels, GWT symbols. */
export function SoilColumn({
  layers,
  gwt,
  selectedId,
  onSelect,
  width = 250,
  height = 520,
  zones,
  maxDepth,
  ariaLabel,
}: SoilColumnProps) {
  const { t } = useTranslation();
  const scheme = useSoilScheme();
  const uid = useSvgId("col");

  const valid = layers.filter((l) => Number.isFinite(l.top) && Number.isFinite(l.bottom) && l.bottom > l.top);
  const bottom = Math.max(
    maxDepth ?? 0,
    valid.length > 0 ? Math.max(...valid.map((l) => l.bottom)) : 1,
    0.5,
  );
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const k = plotH / bottom;
  const zy = (z: number) => PAD_TOP + z * k;
  const colX = AXIS_W + 6;
  const labelX = colX + COL_W + 16;
  const labelW = Math.max(40, width - labelX - 4);
  const ticks = niceTicks(0, bottom, Math.max(3, Math.floor(plotH / 46)));
  const dec = tickDecimals(ticks);

  // Label placement: 3 lines when there is room, else 2.
  const mids = valid.map((l) => zy((l.top + l.bottom) / 2));
  const roomy = valid.length > 0 && plotH / valid.length >= 40;
  const gap = roomy ? 36 : 25;
  const labelYs = spreadLabels(mids, gap, PAD_TOP + 10, height - PAD_BOTTOM - (roomy ? 24 : 12));
  const maxChars = Math.floor(labelW / 5.6);

  const gwtCases = gwt
    ? GWT_CASES.map((c) => ({ c, z: gwtDepth(gwt, c) })).filter(({ z }) => Number.isFinite(z) && z <= bottom)
    : [];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel ?? t("web.soil.column_aria", { count: valid.length })}
      style={{ display: "block", overflow: "visible", fontFamily: "inherit" }}
    >
      <SoilPatternDefs idPrefix={uid} scheme={scheme} />

      {/* depth axis */}
      <text x={AXIS_W - 2} y={PAD_TOP - 9} textAnchor="end" fontSize={10} fill="var(--mantine-color-dimmed)">
        z (m)
      </text>
      <line x1={AXIS_W} y1={PAD_TOP} x2={AXIS_W} y2={zy(bottom)} stroke="var(--mantine-color-default-border)" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={AXIS_W - 4} y1={zy(v)} x2={AXIS_W} y2={zy(v)} stroke="var(--mantine-color-dimmed)" />
          <text
            x={AXIS_W - 6}
            y={zy(v) + 3.5}
            textAnchor="end"
            fontSize={10}
            fill="var(--mantine-color-dimmed)"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {v.toFixed(dec)}
          </text>
        </g>
      ))}

      {/* layer bands */}
      {valid.map((layer, i) => {
        const st = soilStyle(layer, scheme);
        const fam = soilFamily(layer);
        const y0 = zy(layer.top);
        const h = Math.max(1, zy(layer.bottom) - y0);
        const title = `${layerLabel(layer)} · ${layer.uscs ?? t(st.labelKey)}${
          layer.description ? ` · ${layer.description}` : ""
        } · ${strengthText(layer)}`;
        const index = layers.indexOf(layer);
        return (
          <g
            key={`${layer.id}-${i}`}
            onClick={onSelect ? () => onSelect(layer.id, index) : undefined}
            style={{ cursor: onSelect ? "pointer" : undefined }}
            data-layer-id={layer.id}
          >
            <title>{title}</title>
            <rect x={colX} y={y0} width={COL_W} height={h} fill={st.fill} />
            <rect x={colX} y={y0} width={COL_W} height={h} fill={soilPatternUrl(uid, fam)} />
            <rect x={colX} y={y0} width={COL_W} height={h} fill="none" stroke={st.stroke} strokeWidth={0.8} />
          </g>
        );
      })}

      {/* selection outline on top */}
      {valid
        .filter((l) => l.id === selectedId)
        .map((l) => (
          <rect
            key={`sel-${l.id}`}
            x={colX - 2}
            y={zy(l.top) - 1}
            width={COL_W + 4}
            height={Math.max(2, zy(l.bottom) - zy(l.top) + 2)}
            fill="none"
            stroke="var(--mantine-color-blue-filled)"
            strokeWidth={2.5}
            pointerEvents="none"
          />
        ))}

      {/* zone overlays */}
      {zones?.map((zn) => (
        <g key={`${zn.label}-${zn.top}`} pointerEvents="none">
          <rect
            x={colX - 5}
            y={zy(zn.top)}
            width={COL_W + 10}
            height={Math.max(1, zy(zn.bottom) - zy(zn.top))}
            fill="none"
            stroke="var(--mantine-color-text)"
            strokeDasharray="4 3"
            strokeWidth={1}
          />
          <title>{zn.label}</title>
        </g>
      ))}

      {/* GWT */}
      {gwtCases.map(({ c, z }, i) => (
        <g key={c}>
          <line
            x1={colX}
            y1={zy(z)}
            x2={colX + COL_W}
            y2={zy(z)}
            stroke={GWT_STYLE[c].color}
            strokeWidth={1.4}
            strokeDasharray={GWT_STYLE[c].dash}
          />
          <GwtMarker
            x={colX + 10 + i * 17}
            y={zy(z)}
            kind={c}
            title={`${t(`web.soil.gwt.${c}`)}: ${fmt(z, 2)} m`}
          />
        </g>
      ))}

      {/* labels with leader lines */}
      {valid.map((layer, i) => {
        const st = soilStyle(layer, scheme);
        const ly = labelYs[i];
        const my = mids[i];
        const selected = layer.id === selectedId;
        const index = layers.indexOf(layer);
        const head = layer.uscs ? layerLabel(layer) : `${layerLabel(layer)} · ${t(st.labelKey)}`;
        return (
          <g
            key={`lbl-${layer.id}-${i}`}
            onClick={onSelect ? () => onSelect(layer.id, index) : undefined}
            style={{ cursor: onSelect ? "pointer" : undefined }}
          >
            <polyline
              points={`${colX + COL_W + 1},${my} ${labelX - 8},${my} ${labelX - 3},${ly - 4}`}
              fill="none"
              stroke="var(--mantine-color-dimmed)"
              strokeWidth={0.8}
            />
            <text
              x={labelX}
              y={ly}
              fontSize={11}
              fontWeight={700}
              fill={selected ? "var(--mantine-color-blue-filled)" : "var(--mantine-color-text)"}
            >
              {truncate(head, maxChars)}
            </text>
            {roomy && (
              <text x={labelX} y={ly + 12} fontSize={10} fill="var(--mantine-color-dimmed)">
                {truncate(layer.description ?? "", maxChars + 2)}
              </text>
            )}
            <text
              x={labelX}
              y={ly + (roomy ? 24 : 12)}
              fontSize={10}
              fill="var(--mantine-color-text)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {truncate(strengthText(layer), maxChars + 2)}
            </text>
          </g>
        );
      })}

      {valid.length === 0 && (
        <text x={colX} y={PAD_TOP + 20} fontSize={11} fill="var(--mantine-color-dimmed)">
          {t("web.soil.no_layers")}
        </text>
      )}
    </svg>
  );
}
