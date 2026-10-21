import { Alert, Anchor, Badge, Box, Card, Code, Group, List, Stack, Table, Tabs, Text, Title } from "@mantine/core";
import { Link, Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TOPICS, loc } from "../content";
import type { Block } from "../content/types";
import { FIGURES } from "../figures";
import { Formula, Rich } from "../math/Formula";

function BlockView({ b, lang }: { b: Block; lang: string }) {
  const { t } = useTranslation();
  switch (b.type) {
    case "h":
      return <Title order={4} mt="md"><Rich t={loc(b.text, lang)} /></Title>;
    case "p":
      return <Text style={{ lineHeight: 1.7 }}><Rich t={loc(b.text, lang)} /></Text>;
    case "formula":
      return (
        <Card withBorder>
          <Formula expr={b.expr} />
          <Text size="sm" mt="xs"><Rich t={loc(b.caption, lang)} /></Text>
          {b.where && (
            <List size="sm" mt="xs">
              {b.where.map((w, i) => <List.Item key={i}><Rich t={loc(w, lang)} /></List.Item>)}
            </List>
          )}
        </Card>
      );
    case "assumptions":
    case "steps":
      return (
        <Box>
          <Text fw={600}><Rich t={loc(b.title, lang)} /></Text>
          <List type={b.type === "steps" ? "ordered" : "unordered"} size="sm" mt={4}>
            {b.items.map((it, i) => <List.Item key={i}><Rich t={loc(it, lang)} /></List.Item>)}
          </List>
        </Box>
      );
    case "figure": {
      const Fig = FIGURES[b.id];
      return (
        <Card withBorder component="figure" m={0} data-figure={b.id}>
          {Fig ? <Fig /> : null}
          <Text component="figcaption" size="sm" c="dimmed" mt="xs"><Rich t={loc(b.caption, lang)} /></Text>
        </Card>
      );
    }
    case "example":
      return (
        <Alert color="teal" title={`${t("education.example")}: ${loc(b.title, lang)}`}>
          <Text size="sm" style={{ whiteSpace: "pre-wrap" }}><Rich t={loc(b.text, lang)} /></Text>
        </Alert>
      );
    case "derivation":
      return (
        <Box>
          <Title order={5}><Rich t={loc(b.title, lang)} /></Title>
          <Stack gap="xs" mt="xs">
            {b.steps.map((st, i) => (
              <Box key={i}>
                <Text size="sm">{i + 1}. <Rich t={loc(st.text, lang)} /></Text>
                {st.expr && <Formula expr={st.expr} />}
              </Box>
            ))}
          </Stack>
        </Box>
      );
    case "worked":
      return (
        <Card withBorder data-worked>
          <Title order={5}>{t("education.worked")}: <Rich t={loc(b.title, lang)} /></Title>
          <List size="sm" mt="xs">{b.given.map((g, i) => <List.Item key={i}><Rich t={loc(g, lang)} /></List.Item>)}</List>
          <Table mt="sm" withTableBorder>
            <Table.Tbody>
              {b.steps.map((st, i) => (
                <Table.Tr key={i}>
                  <Table.Td w="30%"><Text size="sm"><Rich t={loc(st.label, lang)} /></Text></Table.Td>
                  <Table.Td><Formula expr={st.expr} display={false} /></Table.Td>
                  <Table.Td><Text size="sm" fw={600}>{st.result}</Text></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Alert color="blue" mt="sm" title={t("education.program_result")}>
            <Text size="sm">{b.program.input}</Text>
            <Code block>{b.program.output}</Code>
            {b.program.note && <Text size="sm"><Rich t={loc(b.program.note, lang)} /></Text>}
          </Alert>
        </Card>
      );
    case "quiz":
      return (
        <Box>
          <Title order={5}>{t("education.quiz")}</Title>
          <Stack gap="xs" mt="xs">
            {b.items.map((it, i) => (
              <details key={i}>
                <summary>{i + 1}. <Rich t={loc(it.q, lang)} /></summary>
                <Text size="sm" c="dimmed" mt={4}><Rich t={loc(it.a, lang)} /></Text>
              </details>
            ))}
          </Stack>
        </Box>
      );
    case "mistakes":
      return (
        <Alert color="red" title={t("education.mistakes")}>
          <List size="sm">{b.items.map((it, i) => <List.Item key={i}><Rich t={loc(it, lang)} /></List.Item>)}</List>
        </Alert>
      );
    case "glossary":
      return (
        <Box>
          <Title order={5}>{t("education.glossary")}</Title>
          <List size="sm" mt="xs" listStyleType="none">
            {b.items.map((it, i) => <List.Item key={i}><b><Rich t={loc(it.term, lang)} /></b>: <Rich t={loc(it.def, lang)} /></List.Item>)}
          </List>
        </Box>
      );
    case "reading":
      return (
        <Box>
          <Title order={5}>{t("education.reading")}</Title>
          <List size="sm" mt="xs">{b.items.map((it, i) => <List.Item key={i}>{it}</List.Item>)}</List>
        </Box>
      );
    case "warn":
      return <Alert color="orange" title={t("education.warning")}><Rich t={loc(b.text, lang)} /></Alert>;
  }
}

export function TopicPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const topic = TOPICS.find((x) => x.id === id);
  if (!topic) return <Navigate to=".." replace />;
  const lang = i18n.language;
  const engineer = (
    <Stack gap="md">
      {topic.blocks.map((b, i) => <BlockView key={i} b={b} lang={lang} />)}
      <Title order={4} mt="lg">{t("education.sources")}</Title>
      <List size="sm">{topic.sources.map((s, i) => <List.Item key={i}>{s}</List.Item>)}</List>
      <Title order={5}>{t("education.code_refs")}</Title>
      <Group gap="xs">{topic.codeRefs.map((c) => <Code key={c}>{c}</Code>)}</Group>
    </Stack>
  );
  return (
    <Stack gap="md" maw={820}>
      <Anchor component={Link} to=".." relative="path" size="sm">← {t("education.back")}</Anchor>
      <Group>
        <Title order={2}>{loc(topic.title, lang)}</Title>
        <Badge variant="light">{t(`education.level.${topic.level}`)}</Badge>
      </Group>
      <Text c="dimmed"><Rich t={loc(topic.summary, lang)} /></Text>
      {topic.student ? (
        <Tabs defaultValue="student">
          <Tabs.List>
            <Tabs.Tab value="student">{t("education.tab.student")}</Tabs.Tab>
            <Tabs.Tab value="engineer">{t("education.tab.engineer")}</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="student" pt="md">
            <Stack gap="md">{topic.student.map((b, i) => <BlockView key={i} b={b} lang={lang} />)}</Stack>
          </Tabs.Panel>
          <Tabs.Panel value="engineer" pt="md">{engineer}</Tabs.Panel>
        </Tabs>
      ) : (
        engineer
      )}
    </Stack>
  );
}
