import { Badge, Card, Group, Stack, Table, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { ShearKeyResultDTO } from "../../../shared/api/types";
import { caseLabel } from "../labels";

const f = (v: number | null, d = 2) => (v === null || !Number.isFinite(v) ? "—" : v.toFixed(d));

/** Per-case shear key results: sliding with and without the key on both candidate planes, key demands. */
export function ShearKeyResult({ items, bare = false }: { items: ShearKeyResultDTO[]; bare?: boolean }) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  const body = (
      <Stack gap="xs">
        <Group justify="space-between">
          {bare ? <span /> : <Title order={5}>{t("walls.key.result_title")}</Title>}
          <Text size="xs" c="dimmed">
            {t(`walls.key.position.${items[0].position}`)} · {f(items[0].width)} × {f(items[0].depth)} m
          </Text>
        </Group>
        <Table withTableBorder withColumnBorders verticalSpacing={3} fz="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("walls.key.col_case")}</Table.Th>
              <Table.Th>{t("walls.key.col_fs_base")}</Table.Th>
              <Table.Th>{t("walls.key.col_fs_deep")}</Table.Th>
              <Table.Th>{t("walls.key.col_fs_without")}</Table.Th>
              <Table.Th>{t("walls.key.col_fs_with")}</Table.Th>
              <Table.Th>{t("walls.key.col_passive")}</Table.Th>
              <Table.Th>{t("walls.key.col_demand_v")}</Table.Th>
              <Table.Th>{t("walls.key.col_demand_m")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((k) => (
              <Table.Tr key={k.case}>
                <Table.Td>{caseLabel(k.case, t)}</Table.Td>
                <Table.Td ff="monospace">{f(k.fs_base_surface)}</Table.Td>
                <Table.Td ff="monospace">{f(k.fs_deep_surface)}</Table.Td>
                <Table.Td ff="monospace">{f(k.fs_without_key)}</Table.Td>
                <Table.Td ff="monospace">
                  {f(k.fs_with_key)}{" "}
                  <Badge size="xs" variant="light" color={k.governing === "deep" ? "orange" : "blue"}>
                    {t(`walls.key.governing.${k.governing}`)}
                  </Badge>
                </Table.Td>
                <Table.Td ff="monospace">{f(k.passive_used, 1)}</Table.Td>
                <Table.Td ff="monospace">{f(k.demand_v, 1)}</Table.Td>
                <Table.Td ff="monospace">{f(k.demand_m, 1)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Text size="xs" c="dimmed">{t("walls.key.result_note")}</Text>
      </Stack>
  );
  if (bare) return <div data-testid="shear-key-result">{body}</div>;
  return (
    <Card withBorder padding="sm" radius="sm" data-testid="shear-key-result">
      {body}
    </Card>
  );
}
