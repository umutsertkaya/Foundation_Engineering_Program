import { Group, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { SoilLayer } from "../api/types";
import { GWT_CASES, GWT_STYLE, GwtMarker } from "./GwtMarker";
import { SoilSwatch, useSoilScheme } from "./SoilPatternDefs";
import { SOIL_FAMILIES, SOIL_FAMILY_LABEL_KEY, soilFamily, type SoilFamily } from "./soilStyle";

export interface LayerLegendProps {
  /** Families shown are those present in these layers (all families when omitted). */
  layers?: SoilLayer[];
  showGwt?: boolean;
}

/** Legend of the soil families (colour + hatch + name) and the groundwater symbols. */
export function LayerLegend({ layers, showGwt = false }: LayerLegendProps) {
  const { t } = useTranslation();
  const scheme = useSoilScheme();
  const present = new Set<SoilFamily>(layers ? layers.map((l) => soilFamily(l)) : SOIL_FAMILIES);
  const families = SOIL_FAMILIES.filter((f) => present.has(f));

  return (
    <Group gap="sm" wrap="wrap" aria-label={t("web.soil.legend")} role="list">
      {families.map((f) => (
        <Group key={f} gap={5} wrap="nowrap" role="listitem">
          <SoilSwatch family={f} scheme={scheme} />
          <Text size="xs">{t(SOIL_FAMILY_LABEL_KEY[f])}</Text>
        </Group>
      ))}
      {showGwt &&
        GWT_CASES.map((c) => (
          <Group key={c} gap={4} wrap="nowrap" role="listitem">
            <svg width={22} height={16} viewBox="0 0 22 16" aria-hidden style={{ display: "block" }}>
              <line
                x1={0}
                y1={8}
                x2={22}
                y2={8}
                stroke={GWT_STYLE[c].color}
                strokeWidth={1.4}
                strokeDasharray={GWT_STYLE[c].dash}
              />
              <GwtMarker x={11} y={8} kind={c} size={8} />
            </svg>
            <Text size="xs">{t(`web.soil.gwt.${c}`)}</Text>
          </Group>
        ))}
    </Group>
  );
}
