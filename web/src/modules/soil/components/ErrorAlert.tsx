import { Alert, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../../shared/api/client";

/** Shows an API error with its catalog title; any other failure gets the generic soil.error.unexpected title. */
export function ErrorAlert({ error, onClose }: { error: unknown; onClose?: () => void }) {
  const { t } = useTranslation();
  if (error === null || error === undefined) return null;
  const isApi = error instanceof ApiError;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <Alert
      color="red"
      title={isApi ? t(`error.${error.code}`) : t("soil.error.unexpected")}
      withCloseButton={onClose !== undefined}
      onClose={onClose}
      data-testid="soil-error"
    >
      <Text size="xs">{message}</Text>
    </Alert>
  );
}
