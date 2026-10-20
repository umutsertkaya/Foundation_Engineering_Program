import { Alert, Button, Group, Text } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { errorMessage, errorTitle } from "../api/errorMessage";

interface ErrorAlertProps {
  error: unknown;
  onRetry?: () => void;
}

export function ErrorAlert({ error, onRetry }: ErrorAlertProps) {
  const { t, i18n } = useTranslation();

  const translated = errorTitle(error, t, (key) => i18n.exists(key));
  const detailMsg = errorMessage(error, t);

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
