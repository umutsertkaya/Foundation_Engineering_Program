import { Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";

export function HomePage() {
  const { t } = useTranslation();
  return (
    <Stack gap="md">
      <Title order={3}>{t("report.home.heading")}</Title>
      <Text>{t("report.description")}</Text>
    </Stack>
  );
}
