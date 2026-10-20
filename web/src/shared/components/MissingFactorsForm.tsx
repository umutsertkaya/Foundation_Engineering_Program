import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { MissingFactorDTO } from "../api/types";

export interface MissingFactorsFormProps {
  missingFactors: MissingFactorDTO[];
  onSubmit?: (overrides: Record<string, number>) => void;
}

export function MissingFactorsForm({ missingFactors, onSubmit }: MissingFactorsFormProps) {
  const { t } = useTranslation();
  // Fields start empty: a missing code factor is never pre-filled with an assumed value.
  const [values, setValues] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const complete = missingFactors.every((mf) => Number.isFinite(values[mf.path]));

  const handleValueChange = (path: string, val: string | number) => {
    const numeric = typeof val === "number" ? val : Number.parseFloat(val);
    setValues((prev) => {
      const next = { ...prev };
      if (Number.isFinite(numeric)) next[path] = numeric;
      else delete next[path];
      return next;
    });
  };

  const handleSave = () => {
    if (!complete) return;
    setSubmitted(true);
    onSubmit?.(values);
  };

  return (
    <Card withBorder padding="sm" radius="sm">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs">
            <IconAlertTriangle size={18} color="var(--mantine-color-amber-6)" />
            <Text fw={600} size="sm">
              {t("ui.missing.title")}
            </Text>
          </Group>
          <Badge color="amber" variant="light" size="sm">
            {t("ui.missing.count", { count: missingFactors.length })}
          </Badge>
        </Group>

        <Text size="xs" c="dimmed">
          {t("ui.missing.subtitle")}
        </Text>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xs">
          {missingFactors.map((mf) => (
            <Card key={mf.path} withBorder padding="xs" radius="xs">
              <Stack gap={4}>
                <Group justify="space-between" gap={4}>
                  <Text size="xs" fw={600} ff="monospace">
                    {mf.path}
                  </Text>
                  <Badge size="xs" variant="outline" color="gray">
                    {t(`fstatus.${mf.status}`)}
                  </Badge>
                </Group>
                {mf.hint && (
                  <Text size="xs" c="dimmed">
                    {mf.hint}
                  </Text>
                )}
                <Text size="xs" c="dimmed">
                  {t("ui.col.source")}: {mf.source}
                </Text>
                <NumberInput
                  size="xs"
                  label={mf.path}
                  aria-label={mf.path}
                  data-testid="missing-factor-input"
                  value={values[mf.path] ?? ""}
                  min={0.01}
                  max={10.0}
                  step={0.05}
                  decimalScale={2}
                  onChange={(val) => handleValueChange(mf.path, val)}
                />
              </Stack>
            </Card>
          ))}
        </SimpleGrid>

        <Group justify="space-between">
          {submitted ? (
            <Alert color="green" variant="light" py={4} px="sm">
              <Text size="xs">{t("web.wizard.missing_submitted_stub")}</Text>
            </Alert>
          ) : (
            <span />
          )}
          <Button size="xs" color="amber" onClick={handleSave} disabled={!complete}>
            {t("ui.missing.save")}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
