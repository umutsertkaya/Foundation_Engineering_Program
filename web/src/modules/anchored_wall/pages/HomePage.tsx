import { Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";

export function HomePage() {
  const { t } = useTranslation();
  return (
    <Stack gap="md">
      <Title order={3}>{t("anchored_wall.home.heading")}</Title>
      <Text>{t("anchored_wall.description")}</Text>
    </Stack>
  );
}
