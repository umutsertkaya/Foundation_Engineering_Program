import { Alert, Badge, Card, Group, SimpleGrid, Stack, Table, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { CantileverGeometry, GravityGeometry, WallResultDTO, WallType } from "../../../shared/api/types";
import { factorPathLabel } from "../labels";
import { WallCheckCards } from "./WallCheckCards";
import { WallCrossSection } from "./WallCrossSection";
import { useWarningText } from "../../../shared/hooks/useWarningText";

export interface WallResultViewProps {
  result: WallResultDTO;
  /** The shown result no longer matches the current inputs, or its job did not complete. */
  stale?: boolean;
  staleReason?: "inputs" | "job";
}

/** Wall type and structure height H of a result geometry (cantilever: base + stem; gravity: its own height). */
export function resultSectionBasis(geometry: CantileverGeometry | GravityGeometry): { wallType: WallType; height: number } {
  return "stem_bottom" in geometry
    ? { wallType: "cantilever", height: geometry.base_thickness + geometry.stem_height }
    : { wallType: "gravity", height: geometry.height };
}

export function StaleNotice({ reason }: { reason: "inputs" | "job" }) {
  const { t } = useTranslation();
  return (
    <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />} p="xs" data-testid="result-stale">
      <Text size="xs">{t(reason === "job" ? "walls.result.stale_job" : "walls.result.stale_inputs")}</Text>
    </Alert>
  );
}

/** Results screen: verdict, warnings, to-scale section, per-check utilisation cards, factors and assumptions. */
export function WallResultView({ result, stale = false, staleReason = "inputs" }: WallResultViewProps) {
  const { t } = useTranslation();
  const warningText = useWarningText();
  const basis = resultSectionBasis(result.geometry);
  return (
    <Stack gap="sm" data-stale={stale || undefined}>
      {stale && <StaleNotice reason={staleReason} />}
      <Stack gap="sm" style={stale ? { opacity: 0.55 } : undefined}>
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
                {warningText(w)}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="sm">
        {/* Geometry only: the result carries neither the soil nor the slope the run used. */}
        <WallCrossSection
          wallType={basis.wallType}
          geometry={result.geometry}
          height={basis.height}
          title={t("web.wizard.result_section_title")}
        />
        <WallCheckCards result={result} />
      </SimpleGrid>
      <Text size="xs" c="dimmed">
        {t("walls.result.section_geometry_only")}
      </Text>

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
    </Stack>
  );
}
