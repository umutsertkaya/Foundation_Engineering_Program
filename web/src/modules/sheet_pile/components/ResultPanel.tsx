import { Alert, Badge, Card, Group, List, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import i18n from "../../../app/i18n";
import type { SheetPileResultDTO } from "../../../shared/api/types";
import { decimateSheetPileSeries } from "../series";

const MOCK_WARNING = "mock_result_not_a_calculation";

function fmt(v: number | null | undefined, digits = 2): string {
  return typeof v === "number" && Number.isFinite(v)
    ? new Intl.NumberFormat(i18n.language, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)
    : "—";
}

function Stat({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <Card withBorder padding="xs" radius="sm">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={700}>
        {fmt(value)} {value != null && <Text span size="xs" c="dimmed">{unit}</Text>}
      </Text>
    </Card>
  );
}

export function ResultPanel({ result }: { result: SheetPileResultDTO }) {
  const { t } = useTranslation();
  const isMock = result.warnings.includes(MOCK_WARNING);
  const warnings = result.warning_items
    ? result.warning_items.filter((w) => w.code !== MOCK_WARNING).map((w) =>
      t(`sheet_pile.warning.${w.code}`, { ...w.params, defaultValue: String(w.params?.text ?? w.code) }))
    : result.warnings.filter((w) => w !== MOCK_WARNING);
  const anchored = result.support === "anchored";
  const allRows = result.z.map((z, i) => ({
    z,
    shear: result.shear[i] ?? null,
    moment: result.moment[i] ?? null,
    net: result.net[i] ?? null,
  }));
  const rows = decimateSheetPileSeries(allRows);

  return (
    <Stack gap="md" data-testid="sheet-pile-result">
      <Group justify="space-between">
        <Title order={4}>{t("sheet_pile.result.title")}</Title>
        <Group gap="xs">
          <Badge variant="light">{t(`sheet_pile.support.${anchored ? "anchored" : "cantilever"}`)}</Badge>
          {isMock && (
            <Badge color="orange" variant="filled">
              {t("sheet_pile.result.mock_badge")}
            </Badge>
          )}
        </Group>
      </Group>
      {isMock && (
        <Alert color="orange" variant="light">
          {t("sheet_pile.result.mock_note")}
        </Alert>
      )}

      <Text fw={600} size="sm">
        {t("sheet_pile.result.embedment")}
      </Text>
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
        <Stat label={t("sheet_pile.result.H")} value={result.H} unit="m" />
        <Stat label={t("sheet_pile.result.D0")} value={result.D0} unit="m" />
        <Stat label={t("sheet_pile.result.D")} value={result.D} unit="m" />
        <Stat label={t("sheet_pile.result.total_length")} value={result.total_length} unit="m" />
      </SimpleGrid>

      <Text fw={600} size="sm">
        {t("sheet_pile.result.forces")}
      </Text>
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
        <Stat label={t("sheet_pile.result.M_max_abs")} value={result.M_max} unit="kNm/m" />
        <Stat label={t("sheet_pile.result.z_M_max")} value={result.z_M_max} unit="m" />
        {result.toe_force != null && <Stat label={t("sheet_pile.result.toe_force")} value={result.toe_force} unit="kN/m" />}
        <Stat label={t("sheet_pile.result.section_modulus")} value={result.section_modulus_cm3} unit="cm³/m" />
      </SimpleGrid>
      {result.section_modulus_cm3 == null && (
        <Text size="xs" c="dimmed">
          {t("sheet_pile.result.section_missing")}
        </Text>
      )}

      {anchored && (
        <>
          <Text fw={600} size="sm">
            {t("sheet_pile.result.anchor")}
          </Text>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
            <Stat label={t("sheet_pile.result.anchor_depth")} value={result.anchor_depth} unit="m" />
            <Stat label={t("sheet_pile.result.anchor_force")} value={result.anchor_force} unit="kN/m" />
            <Card withBorder padding="xs" radius="sm" data-testid="per-anchor-load">
              <Text size="xs" c="dimmed">{t("sheet_pile.result.anchor_force_per_anchor")}</Text>
              <Text fw={700}>{fmt(result.anchor_force_per_anchor)} {t("sheet_pile.result.per_anchor_unit")}</Text>
              <Text size="xs" c="dimmed">{t("sheet_pile.result.anchor_geometry", {
                spacing: fmt(result.anchor_spacing_used), inclination: fmt(result.anchor_inclination_used),
              })}</Text>
            </Card>
          </SimpleGrid>
        </>
      )}

      {rows.length > 0 && (
        <>
        <Text size="xs" c="dimmed">{t("sheet_pile.result.series_toe_note")}</Text>
        {rows.length < allRows.length && (
          <Text size="xs" c="dimmed">{t("sheet_pile.result.series_points_shown", { shown: rows.length, total: allRows.length })}</Text>
        )}
        <Table withTableBorder striped data-testid="result-series">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("sheet_pile.result.col_z")}</Table.Th>
              <Table.Th>{t("sheet_pile.result.col_net")}</Table.Th>
              <Table.Th>{t("sheet_pile.result.col_shear")}</Table.Th>
              <Table.Th>{t("sheet_pile.result.col_moment")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r, i) => (
              <Table.Tr key={i}>
                <Table.Td>{fmt(r.z)}</Table.Td>
                <Table.Td>{fmt(r.net)}</Table.Td>
                <Table.Td>{fmt(r.shear)}</Table.Td>
                <Table.Td>{fmt(r.moment)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        </>
      )}

      {result.assumptions.length > 0 && (
        <div>
          <Text fw={600} size="sm">
            {t("sheet_pile.result.assumptions")}
          </Text>
          <List size="sm">
            {result.assumptions.map((a, i) => (
              <List.Item key={i}>
                {a.code ? t(`sheet_pile.assumption.${a.code}`, { ...a.params, defaultValue: a.text }) : a.text}{" "}
                <Text span size="xs" c="dimmed">
                  ({a.source})
                </Text>
              </List.Item>
            ))}
          </List>
        </div>
      )}
      {warnings.length > 0 && (
        <Alert color="yellow" variant="light" title={t("sheet_pile.result.warnings")}>
          <List size="sm">
            {warnings.map((w, i) => (
              <List.Item key={i}>{w}</List.Item>
            ))}
          </List>
        </Alert>
      )}
    </Stack>
  );
}
