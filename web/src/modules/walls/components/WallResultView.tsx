import { Alert, Badge, Card, Group, SimpleGrid, Stack, Table, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { StructureSoilModel, WallResultDTO, WallType } from "../../../shared/api/types";
import type { GwtCase } from "../../../shared/soil/zones";
import { factorPathLabel } from "../labels";
import { WallCheckCards, type RunMode } from "./WallCheckCards";
import { WallCrossSection } from "./WallCrossSection";

export interface WallResultViewProps {
  result: WallResultDTO;
  mode: RunMode;
  wallType: WallType;
  height: number;
  backfillSlope: number;
  soil: StructureSoilModel | null;
  gwtCase: GwtCase;
}

/** Results screen: verdict, warnings, to-scale section, per-check utilisation cards, factors and assumptions. */
export function WallResultView({ result, mode, wallType, height, backfillSlope, soil, gwtCase }: WallResultViewProps) {
  const { t } = useTranslation();
  return (
    <Stack gap="sm">
      <Alert color={result.passed ? "green" : "red"} variant="light" data-testid="result-verdict">
        <Group justify="space-between" gap="xs">
          <Text fw={700} size="sm">
            {result.passed ? t("ui.ok") : t("ui.not_ok")}
          </Text>
          {result.kh !== null && result.kv !== null && (
            <Text size="xs" ff="monospace">
              kh = {result.kh.toFixed(3)} · kv = {result.kv.toFixed(3)}
            </Text>
          )}
        </Group>
      </Alert>

      {result.warnings.length > 0 && (
        <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />} title={t("walls.result.warnings")} data-testid="result-warnings">
          <Stack gap={2}>
            {result.warnings.map((w, i) => (
              <Text key={i} size="xs">
                {w}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="sm">
        <WallCrossSection
          wallType={wallType}
          geometry={result.geometry}
          height={height}
          backfillSlope={backfillSlope}
          soil={soil}
          gwtCase={gwtCase}
          title={t("web.wizard.result_section_title")}
        />
        <WallCheckCards result={result} mode={mode} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
        <Card withBorder padding="sm" radius="sm">
          <Stack gap="xs">
            <Text fw={600} size="sm">
              {t("ui.wall.tab.factors")}
            </Text>
            <Table withTableBorder withColumnBorders verticalSpacing={3}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("walls.result.factor")}</Table.Th>
                  <Table.Th>{t("ui.col.value")}</Table.Th>
                  <Table.Th>{t("ui.col.status")}</Table.Th>
                  <Table.Th>{t("ui.col.source")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {result.factors_used.map((f) => (
                  <Table.Tr key={f.path}>
                    <Table.Td fz="xs" title={f.path}>
                      {factorPathLabel(f.path, t)}
                    </Table.Td>
                    <Table.Td ff="monospace" fw={600}>
                      {f.value ?? t("web.common.none")}
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="light" style={{ overflow: "visible" }}>
                        {t(`fstatus.${f.status}`)}
                      </Badge>
                    </Table.Td>
                    <Table.Td fz="xs">{f.source}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        </Card>

        <Card withBorder padding="sm" radius="sm">
          <Stack gap="xs">
            <Text fw={600} size="sm">
              {t("ui.wall.tab.notes")}
            </Text>
            <Table withTableBorder withColumnBorders verticalSpacing={3}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("ui.col.assumption")}</Table.Th>
                  <Table.Th>{t("ui.col.source")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {result.assumptions.map((a, idx) => (
                  <Table.Tr key={`assumption-${idx}`}>
                    <Table.Td fz="xs">{a.text}</Table.Td>
                    <Table.Td fz="xs">{a.source}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
