import { useState } from "react";
import { Button, Card, Container, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ErrorAlert } from "../../shared/components/ErrorAlert";
import { useModules } from "../moduleRegistry";
import { useProjectSession } from "../ProjectProvider";

export function LauncherPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const modules = useModules();
  const { close } = useProjectSession();
  const [error, setError] = useState<unknown>(null);
  return (
    <Container py="xl"><Stack>
      <Title>{t("launcher.title")}</Title>
      {error != null && <ErrorAlert error={error} />}
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        {modules.map((module) => (
          <Card key={module.id} withBorder><Stack>
            <Title order={2}>{t(module.titleKey)}</Title>
            <Text>{t(module.descriptionKey)}</Text>
            <Button onClick={() => navigate(`/m/${module.id}`)}>{t("launcher.open_module")}</Button>
          </Stack></Card>
        ))}
      </SimpleGrid>
      <Button onClick={() => { void close().then(() => navigate("/start")).catch(setError); }}>
        {t("launcher.close_project")}
      </Button>
    </Stack></Container>
  );
}
