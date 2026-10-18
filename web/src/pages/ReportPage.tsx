import { Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../shared/components/EmptyState";

export function ReportPage() {
  const { t } = useTranslation();

  return (
    <Stack gap="md">
      <div>
        <Title order={3}>{t("web.report.title")}</Title>
        <Text size="sm" c="dimmed">
          {t("web.report.subtitle")}
        </Text>
      </div>

      <EmptyState
        title={t("web.report.title")}
        description={t("web.report.placeholder")}
      />
    </Stack>
  );
}
