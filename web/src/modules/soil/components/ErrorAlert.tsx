import { Alert, Anchor, Text } from "@mantine/core";
import { Link, useInRouterContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../../shared/api/client";
import { errorMessage, errorTitle } from "../../../shared/api/errorMessage";

/** Shows an API error with its catalog title; any other failure or uncatalogued code gets the generic soil.error.unexpected title. */
const OUTSIDE_PROFILE = /outside the profile \(0 - ([0-9.]+) m\)/;

export function ErrorAlert({
  error,
  onClose,
  sourceDepth,
}: {
  error: unknown;
  onClose?: () => void;
  /** Deepest record of the source being layered, when known (named in the depth-outside-profile hint). */
  sourceDepth?: number | null;
}) {
  const { t, i18n } = useTranslation();
  const inRouter = useInRouterContext();
  if (error === null || error === undefined) return null;
  // The engine reports a missing groundwater depth in English; say where to enter it.
  if (error instanceof ApiError && error.message.includes("Groundwater depth is required")) {
    return (
      <Alert color="orange" title={t("soil.error.gwt_missing_title")} data-testid="soil-error">
        <Text size="xs">{t("soil.error.gwt_missing")}</Text>
        {inRouter && (
          <Anchor component={Link} to="/m/soil" size="xs">
            {t("soil.error.gwt_missing_link")}
          </Anchor>
        )}
      </Alert>
    );
  }
  if (error instanceof ApiError && error.message.includes("SPT processing needs a soil profile")) {
    return (
      <Alert color="orange" title={t("soil.error.spt_profile_title")} data-testid="soil-error">
        <Text size="xs">{t("soil.error.spt_profile")}</Text>
        {inRouter && (
          <Anchor component={Link} to="/m/soil/profiles" size="xs">
            {t("soil.error.spt_profile_link")}
          </Anchor>
        )}
      </Alert>
    );
  }
  const outside = error instanceof ApiError ? OUTSIDE_PROFILE.exec(error.message) : null;
  if (outside) {
    const profileDepth = outside[1];
    return (
      <Alert color="orange" title={t("soil.error.depth_outside_title")} data-testid="soil-error">
        <Text size="xs">
          {typeof sourceDepth === "number" && Number.isFinite(sourceDepth)
            ? t("soil.error.depth_outside", { profile_depth: profileDepth, source_depth: sourceDepth.toFixed(1) })
            : t("soil.error.depth_outside_nosrc", { profile_depth: profileDepth })}
        </Text>
        {inRouter && (
          <Anchor component={Link} to="/m/soil/profiles" size="xs">
            {t("soil.error.spt_profile_link")}
          </Anchor>
        )}
      </Alert>
    );
  }
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
