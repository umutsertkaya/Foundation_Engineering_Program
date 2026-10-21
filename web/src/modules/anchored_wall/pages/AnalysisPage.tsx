import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Group, Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
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

  return (
    <Stack gap="md" maw={920}>
      <Group justify="space-between">
        <Title order={3}>{t("anchored_wall.analysis.heading")}</Title>
        <Badge color={!hasResult ? "gray" : stale ? "yellow" : "teal"} variant="light" data-testid="aw-status">
          {t(!hasResult ? "anchored_wall.status.no_result" : stale ? "anchored_wall.status.stale" : "anchored_wall.status.ready")}
        </Badge>
      </Group>
      <Text size="sm" c="dimmed">{t("anchored_wall.analysis.intro")}</Text>
      {stale && (
        <Alert color="yellow" variant="light" title={t("anchored_wall.status.stale_title")}>
          <Text size="sm">{t(dirty ? "anchored_wall.status.stale_edited" : soilStale ? "anchored_wall.status.stale_soil" : "anchored_wall.status.stale_stored")}</Text>
        </Alert>
      )}

      <AnalysisFormView value={form} onChange={setForm} reference={reference} soilStale={soilStale} />

      <MissingList keys={missing} />
      {gaps.length > 0 && (
        <Alert color="orange" variant="light">{t("anchored_wall.soil.gaps", { layers: gaps.join(", ") })}</Alert>
      )}
      {runError != null && (isCoded(runError) ? <StopAlert error={runError} /> : <ErrorAlert error={runError} />)}
      <Group>
        <Button onClick={() => void run()} disabled={missing.length > 0 || busy} loading={busy}>
          {t("anchored_wall.action.run")}
        </Button>
      </Group>

      {record?.result && (
        <div style={stale ? { opacity: 0.55 } : undefined}>
          <AnalysisResultView result={record.result} soil={record.inputs.soil} />
        </div>
      )}
    </Stack>
  );
}
