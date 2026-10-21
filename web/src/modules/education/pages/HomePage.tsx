import { Badge, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TOPICS, loc } from "../content";

export function HomePage() {
  const { t, i18n } = useTranslation();
  return (
    <Stack gap="md">
      <Title order={3}>{t("education.home.heading")}</Title>
      <Text c="dimmed">{t("education.home.intro")}</Text>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {TOPICS.map((tp) => (
          <Card key={tp.id} withBorder component={Link} to={`topic/${tp.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <Group justify="space-between" mb="xs" wrap="nowrap">
              <Text fw={600}>{loc(tp.title, i18n.language)}</Text>
              <Badge variant="light">{t(`education.level.${tp.level}`)}</Badge>
            </Group>
            <Text size="sm" c="dimmed" lineClamp={4}>{loc(tp.summary, i18n.language)}</Text>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
