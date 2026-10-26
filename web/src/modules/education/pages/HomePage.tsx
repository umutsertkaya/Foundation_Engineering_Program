import { Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusChip } from "../../../shared/components/StatusChip";
import { TOPICS, loc } from "../content";

export function HomePage() {
  const { t, i18n } = useTranslation();
  return (
    <Stack gap="md">
      <PageHeader title={t("education.home.heading")} lead={t("education.home.intro")} />
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {TOPICS.map((tp) => (
          <Card key={tp.id} component={Link} to={`topic/${tp.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <Group justify="space-between" mb="xs" wrap="nowrap">
              <Text fw={600}>{loc(tp.title, i18n.language)}</Text>
              <StatusChip tone="info" dot={false}>{t(`education.level.${tp.level}`)}</StatusChip>
            </Group>
            <Text size="sm" c="dimmed" lineClamp={4}>{loc(tp.summary, i18n.language)}</Text>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
