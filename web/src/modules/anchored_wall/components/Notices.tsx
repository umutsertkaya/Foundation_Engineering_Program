import { Alert, List, Stack, Text } from "@mantine/core";
import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../../shared/api/client";
import type { Notice } from "../types";

function useNoticeText() {
  const { t, i18n } = useTranslation();
  return (kind: "warning" | "assumption" | "error", code: string, params?: Record<string, unknown>) => {
    const key = `anchored_wall.${kind}.${code}`;
    if (!i18n.exists(key)) return code;
    const replace: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(params ?? {})) {
      if (k === "kind" && typeof v === "string" && i18n.exists(`anchored_wall.envelope.${v}`)) {
        replace[k] = String(t(`anchored_wall.envelope.${v}`)); // envelope type id -> translated name
      } else if (typeof v === "string" || typeof v === "number") replace[k] = v;
    }
    return String(t(key, { replace }));
  };
}

interface NoticesProps {
  warnings: Notice[];
  assumptions: Notice[];
  sources?: string[];
}

/** Coded warnings (yellow) and visible assumptions; unknown codes show the code itself. */
export function Notices({ warnings, assumptions, sources }: NoticesProps) {
  const { t } = useTranslation();
  const text = useNoticeText();
  return (
    <Stack gap="xs">
      {warnings.length > 0 && (
        <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={16} />} title={t("anchored_wall.notice.warnings")}>
          <List size="sm" data-testid="aw-warnings">
            {warnings.map((n, i) => (
              <List.Item key={`${n.code}-${i}`}>{text("warning", n.code, n.params)}</List.Item>
            ))}
          </List>
        </Alert>
      )}
      {assumptions.length > 0 && (
        <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />} title={t("anchored_wall.notice.assumptions")}>
          <List size="sm" data-testid="aw-assumptions">
            {assumptions.map((n, i) => (
              <List.Item key={`${n.code}-${i}`}>{text("assumption", n.code, n.params)}</List.Item>
            ))}
          </List>
        </Alert>
      )}
      {sources && sources.length > 0 && (
        <Text size="xs" c="dimmed">
          {t("anchored_wall.notice.sources")}: {sources.join("; ")}
        </Text>
      )}
    </Stack>
  );
}

/** Calculation stops (`calculation_stopped`) and missing inputs (`missing_inputs`) in plain words. */
export function StopAlert({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const text = useNoticeText();
  if (!(error instanceof ApiError)) return null;
  let body: string | null = null;
  let title = t("anchored_wall.error.stopped_title");
  if (error.code === "calculation_stopped") {
    const code = String(error.details.stop_code ?? "");
    const params = (error.details.params ?? {}) as Record<string, unknown>;
    body = text("error", code, params);
    if (body === code) body = error.message;
  } else if (error.code === "missing_inputs") {
    const missing = Array.isArray(error.details.missing) ? (error.details.missing as string[]) : [];
    title = t("anchored_wall.error.missing_title");
    body = t("anchored_wall.error.missing_inputs", { missing: missing.join(", ") });
  }
  if (body === null) return null;
  return (
    <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />} title={title} data-testid="aw-stop">
      <Text size="sm">{body}</Text>
    </Alert>
  );
}

/** True when `StopAlert` renders the error itself (so the generic alert can be skipped). */
export const isCoded = (error: unknown): boolean =>
  error instanceof ApiError && (error.code === "calculation_stopped" || error.code === "missing_inputs");
