import { Alert, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { errorMessage, errorTitle } from "../../../shared/api/errorMessage";

/** Shows an API error with its catalog title; any other failure or uncatalogued code gets the generic soil.error.unexpected title. */
export function ErrorAlert({ error, onClose }: { error: unknown; onClose?: () => void }) {
  const { t, i18n } = useTranslation();
  if (error === null || error === undefined) return null;
  const message = errorMessage(error, t);
  return (
    <Alert
      color="red"
      title={errorTitle(error, t, (key) => i18n.exists(key), "soil.error.unexpected")}
      withCloseButton={onClose !== undefined}
      onClose={onClose}
      data-testid="soil-error"
    >
      <Text size="xs">{message}</Text>
    </Alert>
  );
}
