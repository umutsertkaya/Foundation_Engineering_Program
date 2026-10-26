import { Box, SimpleGrid, Table, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { SoundingLiquefactionDTO } from "../../../shared/api/types";
import { CollapsibleSection } from "../../../shared/components/CollapsibleSection";
import { SectionCard } from "../../../shared/components/SectionCard";
import { StatusChip, type StatusTone } from "../../../shared/components/StatusChip";
import { useWarningText } from "../../../shared/hooks/useWarningText";
import { DepthChart } from "./DepthChart";

/** FS above this is not meaningful for the chart; such points sit at the edge (the table keeps exact values). */
const FS_AXIS_MAX = 3;

/** CSR/CRR axis cap: twice the largest finite CSR (at least 1), so a very large CRR does not flatten CSR. */
function ratioAxisCap(csr: (number | null)[]): number {
  const finite = csr.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return Math.max(1, 2 * (finite.length ? Math.max(...finite) : 0));
}

const format = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(3) : "—";

const STATUS_TONE: Record<SoundingLiquefactionDTO["status"][number], StatusTone> = {
  liquefiable: "bad",
  marginal: "stale",
  safe: "current",
  above_gwt: "neutral",
  clay_like: "neutral",
  non_liquefiable_dense: "current",
  excluded_by_user: "neutral",
  beyond_method_depth: "neutral",
  invalid: "neutral",
};

export function SoundingDetail({ id, sounding }: { id: string; sounding: SoundingLiquefactionDTO }) {
  const { t } = useTranslation();
  const warningText = useWarningText();
  const label = (key: string) => t(`liquefaction.results.${key}`);
  const warnings = sounding.warnings.map((warning) => warning === "mock_result_not_a_calculation"
    ? label("mock_note") : warningText(warning));
  const ratioCap = ratioAxisCap(sounding.CSR);

  return (
    <SectionCard title={t("liquefaction.results.charts_title", { id })}>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <DepthChart depth={sounding.depth} ariaLabel={label("chart_fs")} xLabel={label("fs_dimensionless")}
          yLabel={label("depth_m")} reference={{ value: 1, label: label("fs_reference") }}
          highlightLabel={label("status.liquefiable")}
          xCap={{ value: FS_AXIS_MAX, label: t("liquefaction.results.fs_clipped", { max: FS_AXIS_MAX }) }}
          series={[{ label: label("fs"), values: sounding.FS, color: "var(--gt-info-dot)",
            highlighted: sounding.status.map((status) => status === "liquefiable") }]} />
        <DepthChart depth={sounding.depth} ariaLabel={label("chart_csr_crr")} xLabel={label("ratio_dimensionless")}
          yLabel={label("depth_m")}
          xCap={{ value: ratioCap, label: t("liquefaction.results.ratio_clipped", { max: ratioCap.toFixed(2) }) }}
          series={[
            { label: label("csr"), values: sounding.CSR, color: "var(--gt-info-dot)" },
            { label: label("crr"), values: sounding.CRR, color: "var(--gt-warn-dot)", dashArray: "7 4" },
          ]} />
      </SimpleGrid>
      <Text size="sm" c="dimmed" mt="xs">{label("chart_hint")}</Text>

      <CollapsibleSection label={t("liquefaction.results.table_toggle", { count: sounding.depth.length })}>
        <Table.ScrollContainer minWidth={560}>
          <Table captionSide="top">
            <Table.Caption>{label("detail_table")}</Table.Caption>
            <Table.Thead><Table.Tr>
              {["depth_m", "csr", "crr", "fs", "status"].map((key) => <Table.Th key={key}>{label(key)}</Table.Th>)}
            </Table.Tr></Table.Thead>
            <Table.Tbody>
              {sounding.depth.length === 0 && <Table.Tr>
                <Table.Td colSpan={5}>{label("no_chart_data")}</Table.Td>
              </Table.Tr>}
              {sounding.depth.map((depth, i) => (
                <Table.Tr key={i}>
                  <Table.Td ff="monospace">{format(depth)}</Table.Td>
                  <Table.Td ff="monospace">{format(sounding.CSR[i])}</Table.Td>
                  <Table.Td ff="monospace">{format(sounding.CRR[i])}</Table.Td>
                  <Table.Td ff="monospace">{format(sounding.FS[i])}</Table.Td>
                  <Table.Td style={{ whiteSpace: "nowrap" }}>{sounding.status[i]
                    ? <StatusChip tone={STATUS_TONE[sounding.status[i]]}>{label(`status.${sounding.status[i]}`)}</StatusChip>
                    : "—"}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </CollapsibleSection>

      <CollapsibleSection label={t("liquefaction.results.warnings_toggle", { count: warnings.length })} defaultOpened={warnings.length > 0}>
        {warnings.length === 0 ? <Text size="sm" c="dimmed">{label("no_warnings")}</Text> : (
          <Box component="ul" m={0} pl={18}>
            {warnings.map((text, i) => <li key={i}><Text size="sm" component="span">{text}</Text></li>)}
          </Box>
        )}
        <Text size="xs" c="dimmed" mt="xs">{label("warnings_scope")}</Text>
      </CollapsibleSection>
    </SectionCard>
  );
}
