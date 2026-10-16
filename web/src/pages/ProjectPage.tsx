import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconPlus, IconRefresh } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { ApiError, get_project, new_project } from "../api/client";
import type { Language, ProjectSummary } from "../api/types";

export function ProjectPage() {
  const { t, i18n } = useTranslation();
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);

  const loadProject = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await get_project();
      setSummary(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  const handleNewProject = async () => {
    setLoading(true);
    setError(null);
    try {
      const lang: Language = i18n.language === "en" ? "en" : "tr";
      const created = await new_project({
        name: t("ui.untitled"),
        language: lang,
      });
      setSummary(created);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading && !summary) {
    return <Text size="sm">{t("web.common.loading")}</Text>;
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={3}>{t("web.project.title")}</Title>
          <Text size="sm" c="dimmed">
            {t("web.project.subtitle")}
          </Text>
        </div>
        <Group gap="xs">
          <Button
            size="xs"
            variant="default"
            leftSection={<IconRefresh size={14} />}
            onClick={() => void loadProject()}
          >
            {t("web.common.retry")}
          </Button>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => void handleNewProject()}
          >
            {t("web.project.new_btn")}
          </Button>
        </Group>
      </Group>

      {error && (
        <Alert color="red" title={t(`error.${error.code}`)}>
          <Text size="xs">{error.message}</Text>
        </Alert>
      )}

      {summary && (
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
          {/* Meta Card */}
          <Card withBorder padding="sm" radius="sm">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={600} size="sm">
                  {t("web.project.meta_card")}
                </Text>
                <Badge size="xs" variant="light">
                  {summary.meta.analysis_level === "advanced"
                    ? t("ui.level.advanced")
                    : t("ui.level.basic")}
                </Badge>
              </Group>
              <Table withRowBorders={false} verticalSpacing={4}>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td c="dimmed">{t("web.project.name")}</Table.Td>
                    <Table.Td fw={600}>{summary.meta.name}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td c="dimmed">{t("web.project.number")}</Table.Td>
                    <Table.Td ff="monospace">
                      {summary.meta.number ?? t("web.common.none")}
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td c="dimmed">{t("web.project.engineer")}</Table.Td>
                    <Table.Td>{summary.meta.engineer ?? t("web.common.none")}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td c="dimmed">{t("web.project.date")}</Table.Td>
                    <Table.Td ff="monospace">
                      {summary.meta.date ?? t("web.common.none")}
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td c="dimmed">{t("ui.code.code")}</Table.Td>
                    <Table.Td ff="monospace">
                      {(summary.meta.design_code ?? "asd").toUpperCase()}
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td c="dimmed">{t("web.project.schema_version")}</Table.Td>
                    <Table.Td ff="monospace">
                      {summary.meta.schema_version ?? "1.2"}
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Stack>
          </Card>

          {/* Site Seismic Card */}
          <Card withBorder padding="sm" radius="sm">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text fw={600} size="sm">
                  {t("web.project.site_card")}
                </Text>
                <Badge size="xs" color="orange" variant="light">
                  {summary.site.source ?? "TBDY2018"}
                </Badge>
              </Group>
              <Table withRowBorders={false} verticalSpacing={4}>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td c="dimmed">{t("web.project.pga")}</Table.Td>
                    <Table.Td ff="monospace" fw={600}>
                      {summary.site.pga_g ?? t("web.common.none")}
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td c="dimmed">{t("web.project.mw")}</Table.Td>
                    <Table.Td ff="monospace">
                      {summary.site.mw ?? t("web.common.none")}
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td c="dimmed">{t("web.project.sds")}</Table.Td>
                    <Table.Td ff="monospace" fw={600}>
                      {summary.site.sds ?? t("web.common.none")}
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td c="dimmed">{t("web.project.sd1")}</Table.Td>
                    <Table.Td ff="monospace">
                      {summary.site.sd1 ?? t("web.common.none")}
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td c="dimmed">{t("web.project.site_class")}</Table.Td>
                    <Table.Td ff="monospace">
                      {summary.site.site_class ?? t("web.common.none")}
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td c="dimmed">{t("web.project.source")}</Table.Td>
                    <Table.Td>{summary.site.source ?? t("web.common.none")}</Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Stack>
          </Card>

          {/* Counts Card */}
          <Card withBorder padding="sm" radius="sm">
            <Stack gap="xs">
              <Text fw={600} size="sm">
                {t("web.project.counts_card")}
              </Text>
              <SimpleGrid cols={2} spacing="xs">
                <Card withBorder padding="xs" radius="xs">
                  <Text size="xs" c="dimmed">
                    {t("ui.tree.cpts")}
                  </Text>
                  <Text size="lg" fw={700} ff="monospace">
                    {summary.counts.cpts}
                  </Text>
                </Card>
                <Card withBorder padding="xs" radius="xs">
                  <Text size="xs" c="dimmed">
                    {t("ui.tree.boreholes")}
                  </Text>
                  <Text size="lg" fw={700} ff="monospace">
                    {summary.counts.boreholes}
                  </Text>
                </Card>
                <Card withBorder padding="xs" radius="xs">
                  <Text size="xs" c="dimmed">
                    {t("web.nav.soil_models")}
                  </Text>
                  <Text size="lg" fw={700} ff="monospace">
                    {summary.counts.profiles}
                  </Text>
                </Card>
                <Card withBorder padding="xs" radius="xs">
                  <Text size="xs" c="dimmed">
                    {t("web.nav.structures")}
                  </Text>
                  <Text size="lg" fw={700} ff="monospace">
                    {summary.counts.structures}
                  </Text>
                </Card>
              </SimpleGrid>
            </Stack>
          </Card>
        </SimpleGrid>
      )}
    </Stack>
  );
}
