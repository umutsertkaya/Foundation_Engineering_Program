import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../../shared/api/client";
import { list_investigations } from "../api";
import type { InvestigationsDTO } from "../types";
import { EmptyState } from "../../../shared/components/EmptyState";

export function SiteDataPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<InvestigationsDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);

  const loadInvestigations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await list_investigations();
      setData(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvestigations();
  }, [loadInvestigations]);

  if (loading && !data) {
    return <Text size="sm">{t("web.common.loading")}</Text>;
  }

  const cpts = data?.cpts ?? [];
  const boreholes = data?.boreholes ?? [];
  const isEmpty = cpts.length === 0 && boreholes.length === 0;

  return (
    <Stack gap="md">
      <div>
        <Title order={3}>{t("web.site.title")}</Title>
        <Text size="sm" c="dimmed">
          {t("web.site.subtitle")}
        </Text>
      </div>

      {error && (
        <Alert color="red" title={t(`error.${error.code}`)}>
          <Text size="xs">{error.message}</Text>
        </Alert>
      )}

      {isEmpty ? (
        <EmptyState
          title={t("web.site.empty_title")}
          description={t("web.site.empty_desc")}
        />
      ) : (
        <Stack gap="md">
          {/* CPT Soundings */}
          <Stack gap="xs">
            <Title order={5}>{t("web.site.cpt_section")}</Title>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              {cpts.map((cpt) => {
                const maxDepth =
                  cpt.depth.length > 0 ? Math.max(...cpt.depth).toFixed(1) : "0.0";
                return (
                  <Card key={cpt.id} withBorder padding="sm" radius="sm">
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text fw={700} ff="monospace">
                          {cpt.id}
                        </Text>
                        <Badge size="xs" color="blue" variant="light">
                          {t("web.site.points_count", { count: cpt.depth.length })}
                        </Badge>
                      </Group>
                      <Group gap="md">
                        <Text size="xs" c="dimmed">
                          {t("web.site.max_depth", { depth: maxDepth })}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t("term.gwt")}:{" "}
                          {cpt.gwt_depth !== null && cpt.gwt_depth !== undefined
                            ? `${cpt.gwt_depth.toFixed(1)} m`
                            : t("web.common.none")}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t("ui.import.area_ratio")}: {cpt.area_ratio ?? 0.8}
                        </Text>
                      </Group>
                    </Stack>
                  </Card>
                );
              })}
            </SimpleGrid>
          </Stack>

          {/* Boreholes & Log Intervals */}
          <Stack gap="xs">
            <Title order={5}>{t("web.site.borehole_section")}</Title>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              {boreholes.map((bh) => {
                const sptCount = bh.spt?.length ?? 0;
                const labCount = bh.lab?.length ?? 0;
                const logLayers = bh.log ?? [];
                return (
                  <Card key={bh.id} withBorder padding="sm" radius="sm">
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text fw={700} ff="monospace">
                          {bh.id}
                        </Text>
                        <Group gap={6}>
                          <Badge size="xs" color="teal" variant="light">
                            {t("web.site.spt_count", { count: sptCount })}
                          </Badge>
                          <Badge size="xs" color="grape" variant="light">
                            {t("web.site.lab_count", { count: labCount })}
                          </Badge>
                        </Group>
                      </Group>

                      <Text size="xs" c="dimmed">
                        {t("term.gwt")}:{" "}
                        {bh.gwt_depth !== null && bh.gwt_depth !== undefined
                          ? `${bh.gwt_depth.toFixed(1)} m`
                          : t("web.common.none")}
                      </Text>

                      {logLayers.length > 0 && (
                        <Stack gap={4}>
                          <Text size="xs" fw={600}>
                            {t("web.site.log_intervals")}
                          </Text>
                          <Table withTableBorder withColumnBorders verticalSpacing={3}>
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>{t("ui.layer.top")}</Table.Th>
                                <Table.Th>{t("ui.layer.bottom")}</Table.Th>
                                <Table.Th>{t("ui.layer.uscs")}</Table.Th>
                                <Table.Th>{t("ui.layer.description")}</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {logLayers.map((interval, idx) => (
                                <Table.Tr key={`${bh.id}-log-${idx}`}>
                                  <Table.Td ff="monospace">
                                    {interval.top.toFixed(1)}
                                  </Table.Td>
                                  <Table.Td ff="monospace">
                                    {interval.bottom.toFixed(1)}
                                  </Table.Td>
                                  <Table.Td>
                                    <Badge size="xs" variant="outline">
                                      {interval.uscs ?? t("web.common.none")}
                                    </Badge>
                                  </Table.Td>
                                  <Table.Td>
                                    <Text size="xs">
                                      {interval.description ?? t("web.common.none")}
                                    </Text>
                                  </Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        </Stack>
                      )}
                    </Stack>
                  </Card>
                );
              })}
            </SimpleGrid>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
