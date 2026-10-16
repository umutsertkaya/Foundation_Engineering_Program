import { Alert, Button, Group, Text } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";

interface ErrorAlertProps {
  error: unknown;
  onRetry?: () => void;
}

export function ErrorAlert({ error, onRetry }: ErrorAlertProps) {
  const { t } = useTranslation();

  const code = error instanceof ApiError ? error.code : "engine_error";
  const translated = t(`error.${code}`);
  const detailMsg = error instanceof Error ? error.message : String(error);

  return (
    <Alert
      color="red"
      variant="light"
      icon={<IconAlertCircle size={18} />}
      title={translated}
    >
      <Group justify="space-between" align="center">
        <Text size="xs" c="dimmed">
          {detailMsg}
        </Text>
        {onRetry && (
          <Button size="compact-xs" variant="light" color="red" onClick={onRetry}>
            {t("web.common.retry")}
          </Button>
        )}
      </Group>
    </Alert>
  );
}
