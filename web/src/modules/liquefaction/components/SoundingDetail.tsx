import { Badge, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { SoundingLiquefactionDTO } from "../../../shared/api/types";
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

export function SoundingDetail({ id, sounding }: { id: string; sounding: SoundingLiquefactionDTO }) {
  const { t } = useTranslation();
  const warningText = useWarningText();
  const label = (key: string) => t(`liquefaction.results.${key}`);
  const warnings = sounding.warnings.map((warning) => warning === "mock_result_not_a_calculation"
    ? label("mock_note") : warningText(warning)).join("; ") || "—";
  const ratioCap = ratioAxisCap(sounding.CSR);

  return (
    <Stack gap="sm">
      <Title order={3}>{label("sounding")}: {id}</Title>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <DepthChart depth={sounding.depth} ariaLabel={label("chart_fs")} xLabel={label("fs_dimensionless")}
          yLabel={label("depth_m")} reference={{ value: 1, label: label("fs_reference") }}
          highlightLabel={label("status.liquefiable")}
          xCap={{ value: FS_AXIS_MAX, label: t("liquefaction.results.fs_clipped", { max: FS_AXIS_MAX }) }}
          series={[{ label: label("fs"), values: sounding.FS, color: "var(--mantine-color-blue-6)",
            highlighted: sounding.status.map((status) => status === "liquefiable") }]} />
        <DepthChart depth={sounding.depth} ariaLabel={label("chart_csr_crr")} xLabel={label("ratio_dimensionless")}
          yLabel={label("depth_m")}
          xCap={{ value: ratioCap, label: t("liquefaction.results.ratio_clipped", { max: ratioCap.toFixed(2) }) }}
          series={[
            { label: label("csr"), values: sounding.CSR, color: "var(--mantine-color-blue-6)" },
            { label: label("crr"), values: sounding.CRR, color: "var(--mantine-color-orange-6)", dashArray: "7 4" },
          ]} />
      </SimpleGrid>
      <Text size="sm" c="dimmed">{label("warnings_scope")}</Text>
      <Table.ScrollContainer minWidth={650}>
        <Table captionSide="top">
          <Table.Caption>{label("detail_table")}</Table.Caption>
          <Table.Thead><Table.Tr>
            {["depth_m", "csr", "crr", "fs", "status", "warnings"].map((key) => <Table.Th key={key}>{label(key)}</Table.Th>)}
          </Table.Tr></Table.Thead>
          <Table.Tbody>
            {sounding.depth.length === 0 && <Table.Tr>
              <Table.Td colSpan={5}>{label("no_chart_data")}</Table.Td>
              <Table.Td>{warnings}</Table.Td>
            </Table.Tr>}
            {sounding.depth.map((depth, i) => (
              <Table.Tr key={i}>
                <Table.Td>{format(depth)}</Table.Td>
                <Table.Td>{format(sounding.CSR[i])}</Table.Td>
                <Table.Td>{format(sounding.CRR[i])}</Table.Td>
                <Table.Td>{format(sounding.FS[i])}</Table.Td>
                <Table.Td style={{ whiteSpace: "nowrap" }}>{sounding.status[i] ? <Badge color={sounding.status[i] === "liquefiable" ? "red" : "blue"} styles={{ root: { maxWidth: "none" }, label: { overflow: "visible", textOverflow: "clip" } }}>
                  {label(`status.${sounding.status[i]}`)}
                </Badge> : "—"}</Table.Td>
                {i === 0 && <Table.Td rowSpan={sounding.depth.length}>{warnings}</Table.Td>}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}
