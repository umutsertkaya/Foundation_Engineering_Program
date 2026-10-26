import { Alert, Button, Checkbox, Group, Loader, Stack, Text } from "@mantine/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../../shared/api/client";
import type { Language } from "../../../shared/api/types";
import { EmptyState } from "../../../shared/components/EmptyState";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";
import { PageHeader } from "../../../shared/components/PageHeader";
import { SectionCard } from "../../../shared/components/SectionCard";
import { StatusChip } from "../../../shared/components/StatusChip";
import type { StatusTone } from "../../../shared/components/StatusChip";
import { build_report_docx, list_report_sections } from "../api";
import type { ReportSection } from "../api";

const STATUS_TONE: Record<ReportSection["status"], StatusTone> = {
  ready: "current",
  stale: "stale",
  no_result: "missing",
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
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function HomePage() {
  const { t, i18n } = useTranslation();
  /** Module sections (`<module>:<entry>`) are named from the UI language, not the project language the server used. */
  const sectionLabel = (section: { id: string; kind: string; name: string }): string => {
    if (section.kind === "module") {
      const [moduleId, entry] = section.id.split(":");
      const key = `${moduleId}.report.${entry}`;
      if (entry && i18n.exists(key)) return t(key);
    }
    return section.name || t(`report.section.${section.kind}`);
  };
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

  const readyCount = (sections ?? []).filter((s) => s.status === "ready").length;
  const outdatedCount = (sections ?? []).filter((s) => s.status === "stale").length;

  return (
    <Stack gap="md">
      <PageHeader
        title={t("report.title")}
        lead={t("report.page.subtitle")}
        actions={sections !== null && sections.length > 0 ? (
          <Button onClick={() => void build()} loading={busy} disabled={selected.size === 0}>
            {t("report.page.build")}
          </Button>
        ) : undefined}
      />

      {loadError ? <ErrorAlert error={loadError} onRetry={() => void load()} /> : null}
      {sections === null && !loadError ? <Loader size="sm" /> : null}
      {sections !== null && sections.length === 0 ? (
        <EmptyState title={t("report.page.empty_title")} description={t("report.page.empty")} />
      ) : null}

      {sections !== null && sections.length > 0 ? (
        <SectionCard
          title={t("report.page.sections_title")}
          aside={
            <Button variant="default" size="xs" onClick={() => void load()} disabled={busy}>
              {t("report.page.refresh")}
            </Button>
          }
        >
          <Text size="sm" c="dimmed" mb="sm">
            {t("report.page.summary", { ready: readyCount, total: sections.length })}
            {outdatedCount > 0 ? ` ${t("report.page.summary_stale", { count: outdatedCount })}` : ""}
          </Text>
          <Stack gap="xs">
            {sections.map((section) => {
              const usable = section.status === "ready";
              return (
                <Group key={section.id} justify="space-between" wrap="nowrap">
                  <Checkbox
                    label={sectionLabel(section)}
                    checked={selected.has(section.id)}
                    disabled={!usable || busy}
                    onChange={(event) => toggle(section.id, event.currentTarget.checked)}
                  />
                  <StatusChip tone={STATUS_TONE[section.status]}>
                    {t(`report.page.status.${section.status}`)}
                  </StatusChip>
                </Group>
              );
            })}
          </Stack>
        </SectionCard>
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
