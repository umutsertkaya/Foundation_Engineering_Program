import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, SimpleGrid, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { ActionBar } from "../../../shared/components/ActionBar";
import { DisclosureList, DisclosureRow } from "../../../shared/components/DisclosureRow";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusChip } from "../../../shared/components/StatusChip";
import { VerdictBanner } from "../../../shared/components/VerdictBanner";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";
import { get_reference, get_state, run_analysis } from "../api";
import { AnalysisFormView } from "../components/AnalysisForm";
import { MissingList } from "../components/MissingList";
import { isCoded, StopAlert } from "../components/Notices";
import { AnalysisResultView } from "../components/ResultViews";
import { EMPTY_ANALYSIS, analysisFromPayload, analysisMissing, analysisPayload, sameInputs, soilGaps, type AnalysisForm } from "../inputs";
import type { AnchorReference, StateResponse } from "../types";

export function AnalysisPage() {
  const { t } = useTranslation();
  const [stored, setStored] = useState<StateResponse | null>(null);
  const [reference, setReference] = useState<AnchorReference | null>(null);
  const [form, setForm] = useState<AnalysisForm>(EMPTY_ANALYSIS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [runError, setRunError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const state = await get_state();
      setStored(state);
      if (state.state.analysis) setForm(analysisFromPayload(state.state.analysis.inputs));
      // The reference tables are only suggestions; the page works without them.
      get_reference().then(setReference, () => setReference(null));
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const record = stored?.state.analysis ?? null;
  const missing = useMemo(() => [...analysisMissing(form)], [form]);
  const gaps = soilGaps(form.soil, form.drainage);
  const dirty = record != null && !sameInputs(form, analysisFromPayload(record.inputs));
  const hasResult = record?.result != null;
  const soilStale = stored?.analysis_soil_stale === true;
  const stale = hasResult && (stored?.analysis_result_stale === true || soilStale || dirty);

  if (loading && !stored) return <Text size="sm">{t("web.common.loading")}</Text>;
  if (loadError != null) return <ErrorAlert error={loadError} onRetry={() => void load()} />;

  const run = async () => {
    setBusy(true);
    setRunError(null);
    try {
      await run_analysis(analysisPayload(form));
      setStored(await get_state());
    } catch (err) {
      setRunError(err);
    } finally {
      setBusy(false);
    }
  };

  const statusTone = !hasResult ? "neutral" : stale ? "stale" : "current";
  const statusText = t(!hasResult ? "anchored_wall.status.no_result" : stale ? "anchored_wall.status.stale" : "anchored_wall.status.ready");

  return (
    <Stack gap="md">
      <PageHeader
        title={t("anchored_wall.analysis.heading")}
        lead={t("anchored_wall.analysis.intro")}
        status={<span data-testid="aw-status"><StatusChip tone={statusTone}>{statusText}</StatusChip></span>}
      />

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" style={{ alignItems: "start" }}>
        <Stack gap="md">
          <AnalysisFormView value={form} onChange={setForm} reference={reference} soilStale={soilStale} />
        </Stack>

        <Stack gap="md">
          {stale && (
            <VerdictBanner
              tone="warn"
              title={t("anchored_wall.status.stale_title")}
              text={t(dirty ? "anchored_wall.status.stale_edited" : soilStale ? "anchored_wall.status.stale_soil" : "anchored_wall.status.stale_stored")}
              action={
                <Button size="compact-sm" onClick={() => void run()} disabled={missing.length > 0 || busy} loading={busy}>
                  {t("anchored_wall.action.rerun")}
                </Button>
              }
            />
          )}
          {record?.result ? (
            <div style={stale ? { opacity: 0.55 } : undefined}>
              <AnalysisResultView result={record.result} soil={record.inputs.soil} />
            </div>
          ) : (
            <EmptyState title={t("anchored_wall.result.empty_title")} description={t("anchored_wall.result.empty_desc")} />
          )}
        </Stack>
      </SimpleGrid>

      {gaps.length > 0 && (
        <Alert color="orange" variant="light">{t("anchored_wall.soil.gaps", { layers: gaps.join(", ") })}</Alert>
      )}
      {runError != null && (isCoded(runError) ? <StopAlert error={runError} /> : <ErrorAlert error={runError} />)}
      {missing.length > 0 && (
        <DisclosureList>
          <DisclosureRow title={t("anchored_wall.missing.list_title", { n: missing.length })} aside={undefined}>
            <MissingList keys={missing} />
          </DisclosureRow>
        </DisclosureList>
      )}

      <ActionBar
        summary={missing.length > 0 ? t("anchored_wall.missing.count", { n: missing.length }) : undefined}
        text={missing.length === 0 ? t("anchored_wall.action.all_set") : undefined}
      >
        <Button onClick={() => void run()} disabled={missing.length > 0 || busy} loading={busy}>
          {t("anchored_wall.action.run")}
        </Button>
      </ActionBar>
    </Stack>
  );
}
