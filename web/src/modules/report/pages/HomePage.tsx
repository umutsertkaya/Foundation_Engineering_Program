import { Alert, Badge, Button, Checkbox, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../../shared/api/client";
import type { Language } from "../../../shared/api/types";
import { EmptyState } from "../../../shared/components/EmptyState";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";
import { build_report_docx, list_report_sections } from "../api";
import type { ReportSection } from "../api";

const STATUS_COLOR: Record<ReportSection["status"], string> = {
  ready: "green",
  stale: "orange",
  no_result: "gray",
};
const REFUSAL_CODES = new Set(["no_result", "stale_result", "empty_selection", "unknown_section"]);

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function HomePage() {
  const { t, i18n } = useTranslation();
  const [sections, setSections] = useState<ReportSection[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [buildError, setBuildError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const next = await list_report_sections();
      setSections(next);
      setSelected(new Set(next.filter((s) => s.status === "ready").map((s) => s.id)));
    } catch (err) {
      setLoadError(err);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nameById = useMemo(
    () => new Map((sections ?? []).map((s) => [s.id, s.name])),
    [sections],
  );

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const build = async () => {
    setBusy(true);
    setBuildError(null);
    try {
      const language: Language = i18n.language === "en" ? "en" : "tr";
      const ids = (sections ?? []).filter((s) => selected.has(s.id)).map((s) => s.id);
      const { blob, filename } = await build_report_docx(ids, language);
      saveBlob(blob, filename ?? "report.docx");
    } catch (err) {
      setBuildError(err);
      // A refusal means the stored results changed; re-read so the statuses are current.
      if (err instanceof ApiError && REFUSAL_CODES.has(err.code)) void load();
    } finally {
      setBusy(false);
    }
  };

  const refusal = buildError instanceof ApiError && REFUSAL_CODES.has(buildError.code)
    ? buildError
    : null;
  const refusedNames = refusal && Array.isArray(refusal.details.sections)
    ? (refusal.details.sections as string[]).map((id) => nameById.get(id) ?? id).join(", ")
    : "";

  return (
    <Stack gap="md">
      <div>
        <Title order={3}>{t("report.title")}</Title>
        <Text size="sm" c="dimmed">{t("report.page.subtitle")}</Text>
      </div>

      {loadError ? <ErrorAlert error={loadError} onRetry={() => void load()} /> : null}
      {sections === null && !loadError ? <Loader size="sm" /> : null}
      {sections !== null && sections.length === 0 ? (
        <EmptyState title={t("report.page.empty_title")} description={t("report.page.empty")} />
      ) : null}

      {sections !== null && sections.length > 0 ? (
        <Stack gap="xs">
          {sections.map((section) => {
            const usable = section.status === "ready";
            return (
              <Group key={section.id} justify="space-between" wrap="nowrap">
                <Checkbox
                  label={section.name}
                  checked={selected.has(section.id)}
                  disabled={!usable || busy}
                  onChange={(event) => toggle(section.id, event.currentTarget.checked)}
                />
                <Badge color={STATUS_COLOR[section.status]} variant="light">
                  {t(`report.page.status.${section.status}`)}
                </Badge>
              </Group>
            );
          })}
          <Group>
            <Button onClick={() => void build()} loading={busy} disabled={selected.size === 0}>
              {t("report.page.build")}
            </Button>
            <Button variant="default" onClick={() => void load()} disabled={busy}>
              {t("report.page.refresh")}
            </Button>
          </Group>
        </Stack>
      ) : null}

      {refusal ? (
        <Alert color="orange" variant="light" title={t(`report.page.refused.${refusal.code}`)}>
          {refusedNames ? <Text size="sm">{refusedNames}</Text> : null}
        </Alert>
      ) : buildError ? (
        <ErrorAlert error={buildError} />
      ) : null}
    </Stack>
  );
}
