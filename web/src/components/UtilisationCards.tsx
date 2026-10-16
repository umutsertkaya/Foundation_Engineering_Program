import { Badge, Card, Group, Progress, SimpleGrid, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { CheckDTO } from "../api/types";
import { utilisationColor } from "../utils/utilisation";

export interface UtilisationCardsProps {
  checks: CheckDTO[];
  governing?: string | null;
}

function formatNumber(val: number | null): string {
  if (val === null || !Number.isFinite(val)) {
    return "∞";
  }
  return val.toFixed(2);
}

export function UtilisationCards({ checks, governing }: UtilisationCardsProps) {
  const { t } = useTranslation();

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xs">
      {checks.map((check) => {
        const key = `${check.case}:${check.name}`;
        const isGoverning = governing === key;
        const color = utilisationColor(check.utilisation);
        const pct =
          check.utilisation !== null && Number.isFinite(check.utilisation)
            ? Math.min(100, Math.max(0, Math.round(check.utilisation * 100)))
            : 0;
        const symbol = check.comparison === ">=" ? "≥" : "≤";

        return (
          <Card
            key={key}
            withBorder
            padding="xs"
            radius="sm"
            data-governing={isGoverning || undefined}
            style={
              isGoverning
                ? {
                    borderColor: "var(--mantine-color-blue-filled)",
                    borderWidth: 2,
                  }
                : undefined
            }
          >
            <Stack gap={6}>
              <Group justify="space-between" gap={4} wrap="nowrap">
                <Group gap={6} wrap="nowrap">
                  <Badge
                    size="xs"
                    variant="light"
                    color={check.case === "seismic" ? "orange" : "blue"}
                  >
                    {t(`case.${check.case}`)}
                  </Badge>
                  <Text size="sm" fw={600}>
                    {t(`check.${check.name}`)}
                  </Text>
                </Group>
                <Badge size="xs" color={check.passed ? "green" : "red"} variant="light">
                  {check.passed ? t("ui.ok") : t("ui.not_ok")}
                </Badge>
              </Group>

              <Group justify="space-between" align="baseline">
                <Text size="sm" ff="monospace" fw={700}>
                  {formatNumber(check.value)} {symbol} {check.required.toFixed(2)}
                </Text>
                <Text size="xs" c="dimmed" ff="monospace">
                  {t("web.wizard.utilisation")}:{" "}
                  {check.utilisation !== null ? `${(check.utilisation * 100).toFixed(0)}%` : "—"}
                </Text>
              </Group>

              <Progress value={pct} color={color} size="sm" radius="xs" />

              <Group justify="space-between" gap={4}>
                <Text size="xs" c="dimmed" lineClamp={1} title={check.detail}>
                  {check.detail}
                </Text>
                {isGoverning && (
                  <Badge size="xs" color="blue" variant="filled">
                    {t("web.wizard.governing_badge")}
                  </Badge>
                )}
              </Group>
            </Stack>
          </Card>
        );
      })}
    </SimpleGrid>
  );
}
