import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Group, List, SimpleGrid, Stack, Table, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useParams, useSearchParams } from "react-router-dom";
import {
  ApiError,
  get_structure,
  list_structures,
  resync_structure_soil,
  update_structure,
} from "../../../shared/api/client";
import type { GroundwaterCondition, SheetPileStructure, StructureSummary } from "../../../shared/api/types";
import { ActionBar } from "../../../shared/components/ActionBar";
import { CollapsibleSection } from "../../../shared/components/CollapsibleSection";
import { PageHeader } from "../../../shared/components/PageHeader";
import { SectionCard } from "../../../shared/components/SectionCard";
import { StatusChip } from "../../../shared/components/StatusChip";
import { VerdictBanner } from "../../../shared/components/VerdictBanner";
import { EmptyState } from "../../../shared/components/EmptyState";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";
import { useProfileName } from "../../../shared/hooks/useProfileName";
import { usePreSaveHook } from "../../../shared/hooks/usePreSaveHook";
import { design_sheet_pile } from "../api";
import { InputsForm } from "../components/InputsForm";
import { JobPanel } from "../components/JobPanel";
import { MissingList } from "../components/MissingList";
import { ResultPanel } from "../components/ResultPanel";
import { applyInputs, fromStructure, missingInputs, missingSoilInputs, type PileInputs } from "../inputs";

/** Display-only rounding; stored values keep full precision. */
const round = (v: number, digits: number): number => Number(v.toFixed(digits));

/** Read-only view of the water levels the calculation actually uses (design/seismic default to in-situ). */
function GroundwaterSummary({ soil }: { soil: SheetPileStructure["soil"] }) {
  const { t } = useTranslation();
  const rows: Array<{ key: string; gw: GroundwaterCondition; own: boolean }> = [
    { key: "retained", gw: soil.gwt_retained ?? soil.profile.gwt, own: Boolean(soil.gwt_retained) },
    { key: "front", gw: soil.gwt_front ?? soil.profile.gwt, own: Boolean(soil.gwt_front) },
  ];
  const fmt = (v: number) => round(v, 2);
  return (
    <Stack gap={4} data-testid="gwt-summary">
      <Text size="sm" fw={600}>{t("sheet_pile.detail.gw_title")}</Text>
      <Table withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("sheet_pile.detail.gw_side")}</Table.Th>
            <Table.Th>{t("sheet_pile.detail.gw_insitu")}</Table.Th>
            <Table.Th>{t("sheet_pile.detail.gw_design")}</Table.Th>
            <Table.Th>{t("sheet_pile.detail.gw_seismic")}</Table.Th>
            <Table.Th>{t("sheet_pile.detail.gw_origin")}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map(({ key, gw, own }) => (
            <Table.Tr key={key}>
              <Table.Td>{t(`sheet_pile.detail.gw_${key}`)}</Table.Td>
              <Table.Td>{fmt(gw.depth_insitu)}</Table.Td>
              <Table.Td>{fmt(gw.depth_design ?? gw.depth_insitu)}</Table.Td>
              <Table.Td>{fmt(gw.depth_seismic ?? gw.depth_insitu)}</Table.Td>
              <Table.Td>{t(own ? "sheet_pile.detail.gw_own" : "sheet_pile.detail.gw_profile")}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

export function SheetPileDetailPage() {
  const { t } = useTranslation();
  const { sid } = useParams();
  const [params, setParams] = useSearchParams();
  const jobId = params.get("job");

  const [structure, setStructure] = useState<SheetPileStructure | null>(null);
  const [summary, setSummary] = useState<StructureSummary | null>(null);
  const [inputs, setInputs] = useState<PileInputs | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  /** The ?job= id is unknown to the server (e.g. after a restart): fall back to the stored result. */
  const [jobGone, setJobGone] = useState(false);
  const sourceName = useProfileName(structure?.soil.source_profile_id);

  useEffect(() => setJobGone(false), [jobId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await list_structures();
      const found = list.find((s) => s.id === sid && s.kind === "sheet_pile") ?? null;
      setSummary(found);
      if (!found || !sid) {
        setStructure(null);
        return;
      }
      const full = (await get_structure(sid)) as SheetPileStructure;
      setStructure(full);
      setInputs(fromStructure(full));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setStructure(null);
        setSummary(null);
      } else setError(err);
    } finally {
      setLoading(false);
    }
  }, [sid]);

  const refreshSummary = useCallback(async () => {
    const list = await list_structures();
    setSummary(list.find((s) => s.id === sid && s.kind === "sheet_pile") ?? null);
  }, [sid]);

  useEffect(() => {
    void load();
  }, [load]);

  /** The finished job stored its result: re-read the structure so a later save (PUT) keeps that result. */
  const onJobDone = useCallback(async () => {
    if (!sid) return;
    try {
      const [fresh] = await Promise.all([get_structure(sid), refreshSummary()]);
      setStructure(fresh as SheetPileStructure);
    } catch {
      // Badges and the stored copy keep their last value when the refresh fails.
    }
  }, [sid, refreshSummary]);

  const missing = useMemo(() => {
    if (!structure || !inputs) return [];
    return [
      ...missingInputs(inputs, null),
      ...missingSoilInputs(structure.soil.profile.layers, typeof inputs.retained_height === "number" ? inputs.retained_height : 0, structure.soil.profile.gwt.depth_insitu),
    ];
  }, [structure, inputs]);

  const dirty = useMemo(
    () => (structure && inputs ? JSON.stringify(inputs) !== JSON.stringify(fromStructure(structure)) : false),
    [structure, inputs],
  );

  const inputsSaveBlocked = Boolean(inputs) && (
    (inputs ? missingInputs(inputs, null).length > 0 : false) || missing.some((key) => key.startsWith("range:"))
  );

  /** Top project Save: write the on-screen structure inputs into the structure first (or block with a message). */
  usePreSaveHook(async () => {
    if (!structure || !inputs || !dirty) return;
    if (inputsSaveBlocked) throw new Error(t("sheet_pile.detail.save_blocked"));
    const saved = (await update_structure(structure.id, applyInputs(structure, inputs))) as SheetPileStructure;
    setStructure(saved);
    setInputs(fromStructure(saved));
    await refreshSummary();
  });

  const backLink = { to: "/m/sheet_pile", label: t("web.common.back_to_list") };

  if (loading && !structure) return <Text size="sm">{t("web.common.loading")}</Text>;

  if (error != null) {
    return (
      <Stack gap="md">
        <PageHeader title={t("sheet_pile.title")} back={backLink} />
        <ErrorAlert error={error} onRetry={() => void load()} />
      </Stack>
    );
  }

  if (!structure || !inputs) {
    return (
      <Stack gap="md">
        <PageHeader title={t("sheet_pile.title")} back={backLink} />
        <EmptyState title={t("sheet_pile.detail.not_found_title")} description={t("sheet_pile.detail.not_found_desc")} />
      </Stack>
    );
  }

  const save = async () => {
    if (missingInputs(inputs, null).length > 0 || missing.some((key) => key.startsWith("range:"))) return;
    setBusy(true);
    setActionError(null);
    try {
      const saved = await update_structure(structure.id, applyInputs(structure, inputs));
      setStructure(saved as SheetPileStructure);
      setInputs(fromStructure(saved as SheetPileStructure));
      await refreshSummary();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  };

  const resync = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await resync_structure_soil(structure.id);
      const updated = (await get_structure(structure.id)) as SheetPileStructure;
      setStructure(updated);
      await refreshSummary();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const ref = await design_sheet_pile(structure.id);
      setParams({ job: ref.job_id });
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  };

  const soil = structure.soil;
  const source = soil.source_profile_id ?? null;
  const missingFactors = actionError instanceof ApiError ? actionError.missing_factors : [];

  const inputsInvalid = missingInputs(inputs, null).length > 0 || missing.some((key) => key.startsWith("range:"));
  const stale = Boolean(summary?.stale);
  const statusChip = stale ? (
    <StatusChip tone="stale">{t("sheet_pile.status.stale")}</StatusChip>
  ) : summary?.has_result ? (
    <StatusChip tone="current">{t("sheet_pile.status.current")}</StatusChip>
  ) : (
    <StatusChip tone="neutral">{t("sheet_pile.status.draft")}</StatusChip>
  );
  const hasResult = (Boolean(jobId) && !jobGone) || Boolean(structure.result);

  return (
    <Stack gap="md">
      <PageHeader title={structure.name} status={statusChip} back={backLink} />

      {summary?.source_stale && source && (
        <Alert color="blue" variant="light" title={t("sheet_pile.detail.source_stale_title")}>
          <Group justify="space-between">
            <Text size="sm">{t("sheet_pile.detail.stale_desc")}</Text>
            <Button size="xs" variant="light" onClick={() => void resync()} disabled={busy}>
              {t("sheet_pile.detail.resync")}
            </Button>
          </Group>
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" style={{ alignItems: "start" }}>
        <Stack gap="md">
          <InputsForm value={inputs} onChange={setInputs} missing={missing} />

          <SectionCard step={3} title={t("sheet_pile.card.soil")}>
            <Stack gap="sm">
              <Text size="sm" data-testid="soil-source">
                {source
                  ? t("sheet_pile.detail.soil_from_profile", { name: sourceName ?? "" })
                  : t("sheet_pile.detail.soil_manual")}
              </Text>
              <CollapsibleSection label={t("sheet_pile.detail.soil_details")}>
                <Stack gap="sm">
                  <GroundwaterSummary soil={soil} />
                  <Table withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{t("sheet_pile.soil.top")}</Table.Th>
                        <Table.Th>{t("sheet_pile.soil.bottom")}</Table.Th>
                        <Table.Th>{t("sheet_pile.soil.gamma")}</Table.Th>
                        <Table.Th>{t("sheet_pile.soil.phi")}</Table.Th>
                        <Table.Th>{t("sheet_pile.soil.c")}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {soil.profile.layers.map((l) => (
                        <Table.Tr key={l.id}>
                          <Table.Td>{round(l.top, 3)}</Table.Td>
                          <Table.Td>{round(l.bottom, 3)}</Table.Td>
                          <Table.Td>{round(l.gamma, 2)}</Table.Td>
                          <Table.Td>
                            {l.design?.phi_eff != null ? round(l.design.phi_eff, 2) : (
                              <Badge color="red" variant="light">
                                {t("sheet_pile.detail.missing_value")}
                              </Badge>
                            )}
                          </Table.Td>
                          <Table.Td>{round(l.design?.c_eff ?? 0, 2)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Stack>
              </CollapsibleSection>
              <MissingList keys={missing} />
            </Stack>
          </SectionCard>
        </Stack>

        <Stack gap="md">
          {stale && (
            <VerdictBanner
              tone="warn"
              title={t("sheet_pile.detail.result_stale_title")}
              text={t("sheet_pile.detail.result_stale")}
              action={
                <Button size="compact-sm" onClick={() => void run()} disabled={missing.length > 0 || dirty || busy}>
                  {t("sheet_pile.detail.rerun")}
                </Button>
              }
            />
          )}
          {!hasResult && (
            <EmptyState title={t("sheet_pile.detail.no_result_title")} description={t("sheet_pile.detail.no_result_desc")} />
          )}
          {jobId && (
            <div style={stale ? { opacity: 0.5 } : undefined}>
              <JobPanel jobId={jobId} onDone={() => void onJobDone()} onGone={() => setJobGone(true)} structure={structure} />
            </div>
          )}
          {(!jobId || jobGone) && structure.result && (
            <div style={stale ? { opacity: 0.5 } : undefined}>
              <Text size="sm" c="dimmed" mb="xs">{t("sheet_pile.result.saved")}</Text>
              <ResultPanel result={structure.result} structure={structure} />
            </div>
          )}
        </Stack>
      </SimpleGrid>

      {dirty && <Text size="xs" c="dimmed">{t("sheet_pile.detail.unsaved")}</Text>}
      {actionError != null && <ErrorAlert error={actionError} />}
      {missingFactors.length > 0 && (
        <Alert color="red" variant="light" title={t("sheet_pile.detail.missing_factors")}>
          <List size="sm" data-testid="missing-factors">
            {missingFactors.map((f) => (
              <List.Item key={f.path}>
                {f.path}
                {f.hint ? ` — ${f.hint}` : ""}
              </List.Item>
            ))}
          </List>
        </Alert>
      )}

      <ActionBar
        summary={missing.length > 0 ? t("sheet_pile.detail.missing_count", { n: missing.length }) : undefined}
        text={missing.length === 0 ? (dirty ? t("sheet_pile.detail.unsaved_short") : t("sheet_pile.detail.ready")) : undefined}
      >
        <Group>
          <Button variant="default" onClick={() => void save()} disabled={!dirty || busy || inputsInvalid}>
            {t("sheet_pile.detail.save")}
          </Button>
          <Button onClick={() => void run()} disabled={missing.length > 0 || dirty || busy}>
            {t("sheet_pile.detail.run")}
          </Button>
        </Group>
      </ActionBar>
    </Stack>
  );
}
