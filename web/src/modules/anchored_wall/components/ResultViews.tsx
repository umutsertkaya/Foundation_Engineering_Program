import { Badge, Card, Group, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { fmt } from "../format";
import type { AnalysisResult, AnchorCheck, AnchorDesignResult, StructureSoil } from "../types";
import { Notices } from "./Notices";
import { ForceDiagrams, WallSection } from "./WallSection";

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <Card withBorder padding="xs" radius="sm">
      <Text size="xs" c="dimmed">{label}</Text>
      <Text fw={700}>
        {value} {unit && value !== "—" && <Text span size="xs" c="dimmed">{unit}</Text>}
      </Text>
    </Card>
  );
}

export function Checks({ checks }: { checks: AnchorCheck[] }) {
  const { t, i18n } = useTranslation();
  if (checks.length === 0) return null;
  return (
    <Table withTableBorder data-testid="aw-checks">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{t("anchored_wall.report.check")}</Table.Th>
          <Table.Th>{t("anchored_wall.report.demand")}</Table.Th>
          <Table.Th>{t("anchored_wall.report.limit")}</Table.Th>
          <Table.Th>{t("anchored_wall.report.result")}</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {checks.map((c) => {
          const key = `anchored_wall.check.${c.id}`;
          return (
            <Table.Tr key={c.id}>
              <Table.Td>{i18n.exists(key) ? t(key) : c.id}</Table.Td>
              <Table.Td>{fmt(c.demand)}</Table.Td>
              <Table.Td>{fmt(c.limit)}</Table.Td>
              <Table.Td>
                <Badge color={c.ok ? "teal" : "red"} variant="light">
                  {t(c.ok ? "anchored_wall.result.ok" : "anchored_wall.result.fail")}
                </Badge>
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}

export function AnchorResultView({ result }: { result: AnchorDesignResult }) {
  const { t } = useTranslation();
  const tendon = result.tendon;
  return (
    <Stack gap="sm" data-testid="aw-anchor-result">
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Stat label={t("anchored_wall.result.design_load")} value={fmt(result.design_load, 1)} unit="kN" />
        <Stat label={t("anchored_wall.result.lock_off_load")} value={fmt(result.lock_off_load, 1)} unit="kN" />
        <Stat label={t("anchored_wall.result.test_load")} value={fmt(result.test_load, 1)} unit="kN" />
        <Stat label={t("anchored_wall.result.vertical_load")} value={fmt(result.vertical_load_per_anchor, 1)} unit="kN" />
        <Stat label={t("anchored_wall.result.free_length")} value={fmt(result.free_length)} unit="m" />
        <Stat label={t("anchored_wall.result.bond_length")} value={fmt(result.bond_length)} unit="m" />
        <Stat label={t("anchored_wall.result.total_length")} value={fmt(result.total_length)} unit="m" />
        <Stat label={t("anchored_wall.result.tendon")} value={`${tendon.count} × ${tendon.label}`} />
      </SimpleGrid>
      <Text size="xs" c="dimmed">
        {t("anchored_wall.result.tendon_detail", {
          capacity: fmt(tendon.smts_total, 0),
          util: fmt(tendon.design_utilisation, 2),
          governing: t(`anchored_wall.tendon.governing_${tendon.count_governing}`),
          source: tendon.source,
        })}
      </Text>
      <Checks checks={result.checks} />
      <Notices warnings={result.warnings} assumptions={result.assumptions} sources={result.sources} />
    </Stack>
  );
}

export function AnalysisResultView({ result, soil }: { result: AnalysisResult; soil: StructureSoil }) {
  const { t } = useTranslation();
  const designed = result.levels.some((lv) => lv.design != null);
  const soldier = result.wall_type === "soldier_pile";
  return (
    <Stack gap="md" data-testid="aw-analysis-result">
      <Group justify="space-between">
        <Title order={4}>{t("anchored_wall.result.title")}</Title>
        <Badge variant="light">{t(`anchored_wall.method.${result.method}`)}</Badge>
      </Group>
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Stat label={t("anchored_wall.result.embedment_theoretical")} value={fmt(result.embedment_theoretical)} unit="m" />
        <Stat label={t("anchored_wall.result.embedment")} value={fmt(result.embedment)} unit="m" />
        <Stat label={t("anchored_wall.result.wall_length")} value={fmt(result.wall_length)} unit="m" />
        <Stat label={t("anchored_wall.result.base_reaction")} value={fmt(result.base_reaction, 1)} unit="kN/m" />
        <Stat label={t("anchored_wall.result.m_max")} value={fmt(result.m_max, 1)} unit="kNm/m" />
        <Stat label={t("anchored_wall.result.v_max")} value={fmt(result.v_max, 1)} unit="kN/m" />
        {soldier && <Stat label={t("anchored_wall.result.m_max_member")} value={fmt(result.m_max_member, 1)} unit="kNm" />}
        {soldier && <Stat label={t("anchored_wall.result.v_max_member")} value={fmt(result.v_max_member, 1)} unit="kN" />}
        <Stat label={t("anchored_wall.result.required_section_modulus")} value={fmt(result.required_section_modulus_cm3, 1)} unit="cm³" />
      </SimpleGrid>
      {result.envelope && (
        <Text size="sm" data-testid="aw-envelope">
          {t("anchored_wall.report.envelope", {
            kind: t(`anchored_wall.envelope.${result.envelope.kind}`),
            p: fmt(result.envelope.p_max, 1),
            thrust: fmt(result.envelope.total_thrust, 1),
          })}
        </Text>
      )}

      <Title order={5}>{t("anchored_wall.report.levels")}</Title>
      <Table withTableBorder data-testid="aw-levels">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("anchored_wall.report.level_depth")}</Table.Th>
            <Table.Th>{t("anchored_wall.report.level_inclination")}</Table.Th>
            <Table.Th>{t("anchored_wall.report.level_spacing")}</Table.Th>
            <Table.Th>{t("anchored_wall.report.level_load_per_m")}</Table.Th>
            <Table.Th>{t("anchored_wall.result.design_load")}</Table.Th>
            {designed && <Table.Th>{t("anchored_wall.result.free_length")}</Table.Th>}
            {designed && <Table.Th>{t("anchored_wall.result.bond_length")}</Table.Th>}
            {designed && <Table.Th>{t("anchored_wall.result.tendon")}</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {result.levels.map((lv, i) => (
            <Table.Tr key={i}>
              <Table.Td>{fmt(lv.depth)}</Table.Td>
              <Table.Td>{fmt(lv.inclination_deg, 1)}</Table.Td>
              <Table.Td>{fmt(lv.spacing)}</Table.Td>
              <Table.Td>{fmt(lv.horizontal_load_per_m, 1)}</Table.Td>
              <Table.Td>{fmt(lv.axial_load_per_anchor, 1)}</Table.Td>
              {designed && <Table.Td>{lv.design ? fmt(lv.design.free_length) : "—"}</Table.Td>}
              {designed && <Table.Td>{lv.design ? fmt(lv.design.bond_length) : "—"}</Table.Td>}
              {designed && (
                <Table.Td>
                  {lv.design ? `${lv.design.tendon.count} × ${lv.design.tendon.label}` : (
                    <Badge color="red" variant="light">
                      {(lv.design_missing ?? []).length > 0
                        ? t("anchored_wall.error.missing_inputs", { missing: (lv.design_missing ?? []).join(", ") })
                        : lv.design_error ?? "—"}
                    </Badge>
                  )}
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Checks checks={result.checks} />
      <WallSection result={result} soil={soil} />
      <ForceDiagrams result={result} />
      <Notices
        warnings={dedupe([...result.warnings, ...result.levels.flatMap((lv) => lv.design?.warnings ?? [])])}
        assumptions={dedupe([...result.assumptions, ...result.levels.flatMap((lv) => lv.design?.assumptions ?? [])])}
        sources={result.sources}
      />
    </Stack>
  );
}

function dedupe<T extends { code: string; params?: unknown }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((n) => {
    const key = `${n.code}:${JSON.stringify(n.params ?? {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
