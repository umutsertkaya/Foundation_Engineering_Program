import { Alert, Anchor, Badge, Box, Card, Code, Group, List, Stack, Text, Title } from "@mantine/core";
import { Link, Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TOPICS, loc } from "../content";
import type { Block } from "../content/types";
import { FIGURES } from "../figures";

function BlockView({ b, lang }: { b: Block; lang: string }) {
  const { t } = useTranslation();
  switch (b.type) {
    case "h":
      return <Title order={4} mt="md">{loc(b.text, lang)}</Title>;
    case "p":
      return <Text style={{ lineHeight: 1.7 }}>{loc(b.text, lang)}</Text>;
    case "formula":
      return (
        <Card withBorder>
          <Code block fz="md">{b.expr}</Code>
          <Text size="sm" mt="xs">{loc(b.caption, lang)}</Text>
          {b.where && (
            <List size="sm" mt="xs">
              {b.where.map((w, i) => <List.Item key={i}>{loc(w, lang)}</List.Item>)}
            </List>
          )}
        </Card>
      );
    case "assumptions":
    case "steps":
      return (
        <Box>
          <Text fw={600}>{loc(b.title, lang)}</Text>
          <List type={b.type === "steps" ? "ordered" : "unordered"} size="sm" mt={4}>
            {b.items.map((it, i) => <List.Item key={i}>{loc(it, lang)}</List.Item>)}
          </List>
        </Box>
      );
    case "figure": {
      const Fig = FIGURES[b.id];
      return (
        <Card withBorder component="figure" m={0} data-figure={b.id}>
          {Fig ? <Fig /> : null}
          <Text component="figcaption" size="sm" c="dimmed" mt="xs">{loc(b.caption, lang)}</Text>
        </Card>
      );
    }
    case "example":
      return (
        <Alert color="teal" title={`${t("education.example")}: ${loc(b.title, lang)}`}>
          <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{loc(b.text, lang)}</Text>
        </Alert>
      );
    case "warn":
      return <Alert color="orange" title={t("education.warning")}>{loc(b.text, lang)}</Alert>;
  }
}

export function TopicPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const topic = TOPICS.find((x) => x.id === id);
  if (!topic) return <Navigate to=".." replace />;
  const lang = i18n.language;
  return (
    <Stack gap="md" maw={820}>
      <Anchor component={Link} to=".." relative="path" size="sm">← {t("education.back")}</Anchor>
      <Group>
        <Title order={2}>{loc(topic.title, lang)}</Title>
        <Badge variant="light">{t(`education.level.${topic.level}`)}</Badge>
      </Group>
      <Text c="dimmed">{loc(topic.summary, lang)}</Text>
      {topic.blocks.map((b, i) => <BlockView key={i} b={b} lang={lang} />)}
      <Title order={4} mt="lg">{t("education.sources")}</Title>
      <List size="sm">{topic.sources.map((s, i) => <List.Item key={i}>{s}</List.Item>)}</List>
      <Title order={5}>{t("education.code_refs")}</Title>
      <Group gap="xs">{topic.codeRefs.map((c) => <Code key={c}>{c}</Code>)}</Group>
    </Stack>
  );
}
