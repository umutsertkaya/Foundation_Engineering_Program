import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Group, List, Stack, Table, Text, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ApiError,
  get_structure,
  list_structures,
  resync_structure_soil,
  update_structure,
} from "../../../shared/api/client";
import type { SheetPileStructure, StructureSummary } from "../../../shared/api/types";
import { EmptyState } from "../../../shared/components/EmptyState";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";
import { design_sheet_pile } from "../api";
import { InputsForm } from "../components/InputsForm";
import { JobPanel } from "../components/JobPanel";
import { MissingList } from "../components/MissingList";
import { ResultPanel } from "../components/ResultPanel";
import { applyInputs, fromStructure, missingInputs, missingSoilInputs, type PileInputs } from "../inputs";

/** Display-only rounding; stored values keep full precision. */
const round = (v: number, digits: number): number => Number(v.toFixed(digits));

export function SheetPileDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  const back = (
    <Button size="xs" variant="subtle" leftSection={<IconArrowLeft size={14} />} onClick={() => navigate("/m/sheet_pile")}>
      {t("web.common.back_to_list")}
    </Button>
  );

  if (loading && !structure) return <Text size="sm">{t("web.common.loading")}</Text>;

  if (error != null) {
    return (
      <Stack gap="md">
        {back}
        <ErrorAlert error={error} onRetry={() => void load()} />
      </Stack>
    );
  }

  if (!structure || !inputs) {
    return (
      <Stack gap="md">
        {back}
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

  return (
    <Stack gap="md" maw={880}>
      {back}
      <Group justify="space-between">
        <Title order={3}>{structure.name}</Title>
        <Group gap="xs">
          {summary?.stale && (
            <Badge color="amber" variant="light">
              {t("web.structures.badge.stale")}
            </Badge>
          )}
          <Badge variant="light" color={summary?.has_result ? "teal" : "gray"}>
            {t(summary?.has_result ? "web.structures.badge.has_result" : "web.structures.badge.no_result")}
          </Badge>
        </Group>
      </Group>

      {summary?.stale && (
        <Alert color="yellow" variant="light" title={t("sheet_pile.detail.result_stale_title")}>
          <Text size="sm">{t("sheet_pile.detail.result_stale")}</Text>
        </Alert>
      )}
      {summary?.stale && source && (
        <Alert color="blue" variant="light" title={t("sheet_pile.detail.source_stale_title")}>
          <Group justify="space-between">
            <Text size="sm">{t("sheet_pile.detail.stale_desc")}</Text>
            <Button size="xs" variant="light" onClick={() => void resync()} disabled={busy}>
              {t("sheet_pile.detail.resync")}
            </Button>
          </Group>
        </Alert>
      )}

      <Title order={5}>{t("sheet_pile.create.section_inputs")}</Title>
      <InputsForm value={inputs} onChange={setInputs} missing={missing} />

      <Title order={5}>{t("sheet_pile.create.section_soil")}</Title>
      <Text size="sm" data-testid="soil-source">
        {source
          ? t("sheet_pile.detail.soil_from_profile", { id: source })
          : t("sheet_pile.detail.soil_manual")}
      </Text>
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

      <MissingList keys={missing} />
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

      <Group>
        <Button variant="default" onClick={() => void save()} disabled={!dirty || busy || missingInputs(inputs, null).length > 0 || missing.some((key) => key.startsWith("range:"))}>
          {t("sheet_pile.detail.save")}
        </Button>
        <Button onClick={() => void run()} disabled={missing.length > 0 || dirty || busy}>
          {t("sheet_pile.detail.run")}
        </Button>
      </Group>

      {jobId && (
        <Stack gap="xs">
          <Title order={5}>{t("sheet_pile.result.title")}</Title>
          <div style={summary?.stale ? { opacity: 0.5 } : undefined}>
            <JobPanel jobId={jobId} onDone={() => void refreshSummary()} structure={structure} />
          </div>
        </Stack>
      )}
      {!jobId && structure.result && (
        <Stack gap="xs">
          <Title order={5}>{t("sheet_pile.result.saved")}</Title>
          <div style={summary?.stale ? { opacity: 0.5 } : undefined}>
            <ResultPanel result={structure.result} structure={structure} />
          </div>
        </Stack>
      )}
    </Stack>
  );
}
