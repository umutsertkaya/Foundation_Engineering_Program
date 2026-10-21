import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Group, Select, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";
import { design_anchor, get_reference, get_state } from "../api";
import { AnchorFields } from "../components/AnchorFields";
import { MissingList } from "../components/MissingList";
import { NumField } from "../components/NumField";
import { isCoded, StopAlert } from "../components/Notices";
import { AnchorResultView } from "../components/ResultViews";
import { EMPTY_ANCHOR, anchorFromPayload, anchorMissing, anchorPayload, sameInputs, type AnchorForm } from "../inputs";
import type { AnchorReference, StateResponse } from "../types";

export function AnchorPage() {
  const { t } = useTranslation();
  const [stored, setStored] = useState<StateResponse | null>(null);
  const [reference, setReference] = useState<AnchorReference | null>(null);
  const [form, setForm] = useState<AnchorForm>(EMPTY_ANCHOR);
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
      if (state.state.anchor) setForm(anchorFromPayload(state.state.anchor.inputs));
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

  const record = stored?.state.anchor ?? null;
  const missing = useMemo(() => anchorMissing(form), [form]);
  const dirty = record != null && !sameInputs(form, anchorFromPayload(record.inputs));
  const hasResult = record?.result != null;
  const stale = hasResult && (stored?.anchor_result_stale === true || dirty);
  const set = (patch: Partial<AnchorForm>) => setForm({ ...form, ...patch });

  if (loading && !stored) return <Text size="sm">{t("web.common.loading")}</Text>;
  if (loadError != null) return <ErrorAlert error={loadError} onRetry={() => void load()} />;

  const run = async () => {
    setBusy(true);
    setRunError(null);
    try {
      await design_anchor(anchorPayload(form));
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
        <Title order={3}>{t("anchored_wall.design.heading")}</Title>
        <Badge color={!hasResult ? "gray" : stale ? "yellow" : "teal"} variant="light" data-testid="aw-status">
          {t(!hasResult ? "anchored_wall.status.no_result" : stale ? "anchored_wall.status.stale" : "anchored_wall.status.ready")}
        </Badge>
      </Group>
      <Text size="sm" c="dimmed">{t("anchored_wall.design.intro")}</Text>
      {stale && (
        <Alert color="yellow" variant="light" title={t("anchored_wall.status.stale_title")}>
          <Text size="sm">{t(dirty ? "anchored_wall.status.stale_edited" : "anchored_wall.status.stale_stored")}</Text>
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 4 }}>
        <NumField label={t("anchored_wall.input.excavation_height")} value={form.excavation_height} onChange={(v) => set({ excavation_height: v })} min={0} decimalScale={2} />
        <NumField label={t("anchored_wall.input.head_depth")} value={form.head_depth} onChange={(v) => set({ head_depth: v })} min={0} decimalScale={2} />
        <NumField label={t("anchored_wall.input.inclination")} value={form.inclination_deg} onChange={(v) => set({ inclination_deg: v })} min={0} max={89} decimalScale={1} />
        <NumField label={t("anchored_wall.input.phi")} value={form.phi_deg} onChange={(v) => set({ phi_deg: v })} min={0} max={89} decimalScale={1} />
        <Select
          label={t("anchored_wall.input.load_mode")}
          data={[
            { value: "horizontal", label: t("anchored_wall.input.load_mode_horizontal") },
            { value: "axial", label: t("anchored_wall.input.load_mode_axial") },
          ]}
          value={form.load_mode}
          allowDeselect={false}
          onChange={(v) => set({ load_mode: (v as AnchorForm["load_mode"]) ?? "horizontal" })}
        />
        {form.load_mode === "horizontal" ? (
          <>
            <NumField label={t("anchored_wall.input.horizontal_load")} value={form.horizontal_load_per_m} onChange={(v) => set({ horizontal_load_per_m: v })} min={0} decimalScale={1} />
            <NumField label={t("anchored_wall.input.spacing")} value={form.spacing} onChange={(v) => set({ spacing: v })} min={0} decimalScale={2} />
          </>
        ) : (
          <NumField label={t("anchored_wall.input.axial_load")} value={form.axial_load} onChange={(v) => set({ axial_load: v })} min={0} decimalScale={1} />
        )}
      </SimpleGrid>
      <AnchorFields value={form.common} onChange={(common) => set({ common })} reference={reference} missing={missing} />

      <MissingList keys={missing} />
      {runError != null && (isCoded(runError) ? <StopAlert error={runError} /> : <ErrorAlert error={runError} />)}
      <Group>
        <Button onClick={() => void run()} disabled={missing.length > 0 || busy} loading={busy}>
          {t("anchored_wall.action.run_anchor")}
        </Button>
      </Group>

      {record?.result && (
        <div style={stale ? { opacity: 0.55 } : undefined}>
          <AnchorResultView result={record.result} />
        </div>
      )}
    </Stack>
  );
}
