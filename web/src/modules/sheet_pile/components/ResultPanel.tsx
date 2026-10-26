import { Alert, Badge, Group, List, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { list_codes } from "../../../shared/api/client";
import type { DesignCodeSummary } from "../../../shared/api/types";
import i18n from "../../../app/i18n";
import type { SheetPileResultDTO } from "../../../shared/api/types";
import { decimateSheetPileSeries } from "../series";
import { PileDiagrams } from "./PileDiagrams";
import { DisclosureList, DisclosureRow } from "../../../shared/components/DisclosureRow";
import { KpiTile } from "../../../shared/components/KpiTile";
import { SectionCard } from "../../../shared/components/SectionCard";
import { StatusChip } from "../../../shared/components/StatusChip";

const MOCK_WARNING = "mock_result_not_a_calculation";

function fmt(v: number | null | undefined, digits = 2): string {
  return typeof v === "number" && Number.isFinite(v)
    ? new Intl.NumberFormat(i18n.language, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)
    : "—";
}

export function ResultPanel({ result, structure }: { result: SheetPileResultDTO; structure?: { design_code?: string; approach?: string | null; analysis_level?: "basic" | "advanced"; depth_increase?: number | null; support?: "cantilever" | "anchored"; front_water_depth?: number | null; allowable_stress_mpa?: number | null } }) {
  const { t } = useTranslation();
  const [codes, setCodes] = useState<DesignCodeSummary[]>([]);
  useEffect(() => {
    void list_codes().then(setCodes).catch(() => undefined);
  }, []);
  const codeName = (id?: string) => (id ? codes.find((c) => c.id === id)?.name ?? id : "—");
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

  const tiles = (
    <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
      <KpiTile label={t("sheet_pile.result.D")} value={fmt(result.D)} unit="m" sub={result.D0 != null ? t("sheet_pile.result.kpi_d0", { value: fmt(result.D0) }) : undefined} />
      <KpiTile label={t("sheet_pile.result.total_length")} value={fmt(result.total_length)} unit="m" />
      <KpiTile label={t("sheet_pile.result.M_max_abs")} value={fmt(result.M_max)} unit="kNm/m" sub={result.z_M_max != null ? t("sheet_pile.result.kpi_m_at", { value: fmt(result.z_M_max) }) : undefined} />
      {result.section_modulus_cm3 != null && (
        <KpiTile label={t("sheet_pile.result.section_modulus")} value={fmt(result.section_modulus_cm3)} unit="cm³/m" sub={structure?.allowable_stress_mpa != null ? t("sheet_pile.result.kpi_w_sub", { value: fmt(structure.allowable_stress_mpa, 0) }) : undefined} />
      )}
    </SimpleGrid>
  );

  return (
    <Stack gap="md" data-testid="sheet-pile-result">
      <Group justify="space-between">
        <Title order={2} fz={18} fw={600}>{t("sheet_pile.result.title")}</Title>
        <Group gap="xs">
          <StatusChip tone="neutral" dot={false}>{t(`sheet_pile.support.${anchored ? "anchored" : "cantilever"}`)}</StatusChip>
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

      {tiles}
      {result.section_modulus_cm3 == null && (
        <Text size="xs" c="dimmed">
          {t("sheet_pile.result.section_missing")}
        </Text>
      )}

      {anchored && (
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <KpiTile label={t("sheet_pile.result.anchor_depth")} value={fmt(result.anchor_depth)} unit="m" />
          <KpiTile label={t("sheet_pile.result.anchor_force")} value={fmt(result.anchor_force)} unit="kN/m" />
          <div data-testid="per-anchor-load">
            <KpiTile
              label={t("sheet_pile.result.anchor_force_per_anchor")}
              value={fmt(result.anchor_force_per_anchor)}
              unit={t("sheet_pile.result.per_anchor_unit")}
              sub={t("sheet_pile.result.anchor_geometry", { spacing: fmt(result.anchor_spacing_used), inclination: fmt(result.anchor_inclination_used) })}
            />
          </div>
        </SimpleGrid>
      )}

      {rows.length > 0 && (
        <SectionCard title={t("sheet_pile.result.along_pile")}>
          <PileDiagrams
            rows={allRows}
            retainedHeight={result.H}
            anchorDepth={anchored ? result.anchor_depth : null}
          />
          {result.toe_force != null && (
            <Text size="sm" mt="sm" data-testid="toe-force-note">
              {t("sheet_pile.result.toe_note", { value: fmt(Math.abs(result.toe_force)) })}
            </Text>
          )}
        </SectionCard>
      )}

      <DisclosureList>
        {structure && (
          <div data-testid="design-basis">
          <DisclosureRow title={t("sheet_pile.result.design_basis")}>
            <Stack gap={2}>
              <Text size="sm">{t("sheet_pile.result.design_code")}: {codeName(structure.design_code)}</Text>
              <Text size="sm">{t("sheet_pile.result.approach")}: {structure.approach || t("sheet_pile.inputs.service_default")}</Text>
              <Text size="sm">{t("sheet_pile.result.analysis_level")}: {structure.analysis_level ? t(structure.analysis_level === "advanced" ? "sheet_pile.inputs.advanced_analysis" : "sheet_pile.inputs.basic") : "—"}</Text>
              <Text size="sm">{t("sheet_pile.result.depth_increase")}: {fmt((structure.depth_increase ?? (structure.support === "anchored" ? 0 : 0.2)) * 100, 1)}%</Text>
              {structure.front_water_depth != null && <Text size="sm">{t("sheet_pile.result.front_water_depth")}: {fmt(structure.front_water_depth)} m</Text>}
              <Text size="sm">H: {fmt(result.H)} m</Text>
            </Stack>
          </DisclosureRow>
          </div>
        )}
        {rows.length > 0 && (
          <DisclosureRow title={t("sheet_pile.result.table")}>
            <Text size="xs" c="dimmed" mb="xs">{t("sheet_pile.result.series_toe_note")}</Text>
            {rows.length < allRows.length && (
              <Text size="xs" c="dimmed" mb="xs">{t("sheet_pile.result.series_points_shown", { shown: rows.length, total: allRows.length })}</Text>
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
          </DisclosureRow>
        )}
        {result.assumptions.length > 0 && (
          <DisclosureRow title={t("sheet_pile.result.assumptions")}>
            <List size="sm" styles={{ itemWrapper: { maxWidth: "calc(100% - 20px)" }, itemLabel: { overflowWrap: "anywhere" } }}>
              {result.assumptions.map((a, i) => (
                <List.Item key={i}>
                  {a.code ? t(`sheet_pile.assumption.${a.code}`, { ...a.params, defaultValue: a.text }) : a.text}{" "}
                  <Text span size="xs" c="dimmed">
                    ({a.source})
                  </Text>
                </List.Item>
              ))}
            </List>
          </DisclosureRow>
        )}
      </DisclosureList>
      {warnings.length > 0 && (
        <Alert color="yellow" variant="light" title={t("sheet_pile.result.warnings")}>
          <List size="sm" styles={{ itemWrapper: { maxWidth: "calc(100% - 20px)" }, itemLabel: { overflowWrap: "anywhere" } }}>
            {warnings.map((w, i) => (
              <List.Item key={i}>{w}</List.Item>
            ))}
          </List>
        </Alert>
      )}
    </Stack>
  );
}
