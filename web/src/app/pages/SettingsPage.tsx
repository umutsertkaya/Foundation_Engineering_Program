import { Button, Container, Stack, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Container py="xl"><Stack>
      <Title>{t("settings.title")}</Title>
      <Button onClick={() => navigate("/start")}>{t("settings.back")}</Button>
    </Stack></Container>
  );
}
