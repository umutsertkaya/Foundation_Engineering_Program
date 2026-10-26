import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Anchor, Badge, Button, Card, Checkbox, Group, Modal, NativeSelect, Paper, Stack, Table, Text, Title, Tooltip, UnstyledButton } from "@mantine/core";
import { IconWand } from "@tabler/icons-react";
import { Link, useInRouterContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import { ApiError, get_project } from "../../../shared/api/client";
import type { DesignKey, ParameterSelection, ProfileSummary, SoilProfile } from "../../../shared/api/types";
import { EmptyState } from "../../../shared/components/EmptyState";
import {
  approve_parameters,
  get_profile,
  get_profile_readiness,
  list_layer_parameters,
  list_profiles,
  reapprove_parameters,
  suggest_all_parameters,
  update_parameter_selection,
} from "../api";
import { ErrorAlert } from "../components/ErrorAlert";
import { PageHeader } from "../../../shared/components/PageHeader";
import { LayerInventoryPanel } from "../components/LayerInventoryPanel";
import { ParameterKeyCard } from "../components/ParameterKeyCard";
import { displayUnit } from "../units";
import { LatestGuard } from "../latest";
import { useBeforeUnloadWarning } from "../../../shared/hooks/useBeforeUnloadWarning";
import { approvalState, formatPercent, formatValue, orderSelections, readiness, refreshedDiff, staleReasonKey } from "../parameterState";
import type { LayerReadiness, ReapproveItem } from "../types";

/** One consistent snapshot: the profile, the layer shown, and the parameters of every layer as last read. */
interface Loaded {
  profileId: string;
  profile: SoilProfile;
  layerId: string | null;
  byLayer: Record<string, ParameterSelection[]>;
  /** Unit-weight status per layer; empty when the readiness route is unavailable. */
  readiness: LayerReadiness[];
}

/** One withdrawn approval whose current value is known, ready to be reviewed. */
interface ReviewRow {
  id: string;
  layerId: string;
  layerRange: string;
  key: DesignKey;
  oldValue: number;
  newValue: number;
  unit: string;
  percent: number | null;
  reasonKey: string;
}

function reviewRows(
  profile: SoilProfile,
  byLayer: Record<string, ParameterSelection[]>,
  rangeOf: (top: number, bottom: number) => string,
): ReviewRow[] {
  return profile.layers.flatMap((layer) =>
    orderSelections(byLayer[layer.id] ?? []).flatMap((selection) => {
      const diff = refreshedDiff(selection);
      const reasonKey = staleReasonKey(selection);
      if (!diff || !reasonKey) return [];
      return [
        {
          id: `${layer.id}:${selection.parameter}`,
          layerId: layer.id,
          layerRange: rangeOf(layer.top, layer.bottom),
          key: selection.parameter,
          oldValue: diff.oldValue,
          newValue: diff.newValue,
          unit: diff.unit,
          percent: diff.percent,
          reasonKey,
        },
      ];
    }),
  );
}

function layerCounts(selections: ParameterSelection[]): { approved: number; stale: number; total: number } {
  return {
    approved: selections.filter((s) => approvalState(s) === "approved").length,
    stale: selections.filter((s) => approvalState(s) === "stale").length,
    total: selections.length,
  };
}

export function ParametersPage() {
  const { t } = useTranslation();
  const inRouter = useInRouterContext();
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dirtyKeys, setDirtyKeys] = useState<ReadonlySet<DesignKey>>(new Set());
  const [confirmKeys, setConfirmKeys] = useState<DesignKey[] | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewPicked, setReviewPicked] = useState<ReadonlySet<string>>(new Set());
  const guard = useRef(new LatestGuard());

  /**
   * Reads the profile and every layer's parameters, then commits profile, layer and selections together.
   * A failure or an out-of-order (superseded) response leaves the previous snapshot untouched.
   */
  const load = useCallback(async (profileId: string, preferLayer: string | null) => {
    const token = guard.current.begin();
    const profile = await get_profile(profileId);
    const entries = await Promise.all(
      profile.layers.map(async (layer) => [layer.id, await list_layer_parameters(profileId, layer.id)] as const),
    );
    // The status box is advisory: a failing readiness route must not hide the parameters.
    const readinessList = await get_profile_readiness(profileId).catch(() => [] as LayerReadiness[]);
    if (!guard.current.isCurrent(token)) return;
    const layerId =
      preferLayer && profile.layers.some((l) => l.id === preferLayer) ? preferLayer : (profile.layers[0]?.id ?? null);
    setLoaded({ profileId, profile, layerId, byLayer: Object.fromEntries(entries), readiness: readinessList });
  }, []);

  useEffect(() => {
    const current = guard.current;
    let cancelled = false;
    (async () => {
      try {
        const [list, project] = await Promise.all([list_profiles(), get_project()]);
        if (cancelled) return;
        setProfiles(list);
        const first = list.find((p) => p.id === project.active_profile_id) ?? list[0];
        if (first) await load(first.id, null);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      current.cancel();
    };
  }, [load]);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const onDirtyChange = useCallback((key: DesignKey, dirty: boolean) => {
    setDirtyKeys((prev) => {
      if (prev.has(key) === dirty) return prev;
      const next = new Set(prev);
      if (dirty) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  useBeforeUnloadWarning(dirtyKeys.size > 0);

  if (loading) return <Text size="sm">{t("web.common.loading")}</Text>;

  const profileId = loaded?.profileId ?? "";
  const layerId = loaded?.layerId ?? null;
  const selections = orderSelections((loaded && layerId ? loaded.byLayer[layerId] : undefined) ?? []);
  const activeLayer = loaded?.profile.layers.find((l) => l.id === layerId);
  /** Depth range and description instead of the bare layer UUID. */
  const layerLabel = activeLayer
    ? [t("soil.params.layer_range", { top: activeLayer.top, bottom: activeLayer.bottom }), activeLayer.uscs, activeLayer.description]
        .filter((part) => part !== undefined && part !== null && `${part}`.trim() !== "")
        .join(" · ")
    : (layerId ?? "");

  const selectProfile = (pid: string) => {
    if (pid !== profileId) void run(() => load(pid, null));
  };

  const selectLayer = (lid: string) => {
    if (!loaded || busy || lid === layerId) return;
    setLoaded({ ...loaded, layerId: lid });
  };

  const suggestAll = () =>
    run(async () => {
      await suggest_all_parameters(profileId);
      await load(profileId, layerId);
      setNotice(t("soil.params.suggest_all_done"));
    });

  const apply = (key: DesignKey, update: Parameters<typeof update_parameter_selection>[3]) =>
    run(async () => {
      await update_parameter_selection(profileId, layerId as string, key, update);
      await load(profileId, layerId);
    });

  const approve = (keys: DesignKey[]) =>
    run(async () => {
      await approve_parameters(profileId, layerId as string, keys);
      // Approving phi can revoke the dependent delta approval, so everything is re-read.
      await load(profileId, layerId);
    });

  /** Renews approvals with the refreshed value the engineer saw; a moved value (409) reloads the list and says so. */
  const reapprove = (items: ReapproveItem[], doneMessage: string) =>
    run(async () => {
      try {
        await reapprove_parameters(profileId, items);
      } catch (err) {
        if (err instanceof ApiError && err.code === "reapprove_value_changed") {
          await load(profileId, layerId);
          notifications.show({ message: t("soil.params.reapprove_conflict"), color: "orange" });
          return;
        }
        throw err;
      }
      await load(profileId, layerId);
      setNotice(doneMessage);
    });

  const rangeOf = (top: number, bottom: number) => t("soil.params.layer_range", { top, bottom });
  const rows = loaded ? reviewRows(loaded.profile, loaded.byLayer, rangeOf) : [];
  const submitReview = () => {
    const items = rows
      .filter((r) => reviewPicked.has(r.id))
      .map((r) => ({ layer_id: r.layerId, key: r.key, expected_value: r.newValue }));
    if (items.length === 0) return;
    setReviewOpen(false);
    void reapprove(items, t("soil.params.reapprove_done"));
  };
  const activeReadiness = loaded?.readiness.find((r) => r.layer_id === layerId);

  // Bulk approval takes only keys that are ready (applied, not stale or outdated) and is blocked while any
  // card holds an unapplied draft, so nothing the engineer is still editing can be approved by accident.
  const readyKeys = selections.filter((s) => readiness(s) === "ready").map((s) => s.parameter);
  const anyDirty = dirtyKeys.size > 0;
  const bulkDisabled = busy || readyKeys.length === 0 || anyDirty;
  const bulkHint = anyDirty
    ? t("soil.params.bulk_blocked_dirty")
    : readyKeys.length === 0
      ? t("soil.params.bulk_none")
      : t("soil.params.approve_ready_hint");

  return (
    <Stack gap="md">
      <PageHeader
        title={t("soil.params.title")}
        lead={t("soil.params.subtitle")}
      />

      {profiles.length > 0 && (
          <Group align="flex-end" gap="xs" wrap="wrap">
            <NativeSelect
              size="xs"
              label={t("soil.params.profile")}
              data={profiles.map((p) => ({ value: p.id, label: p.name }))}
              value={profileId}
              disabled={busy}
              onChange={(e) => selectProfile(e.currentTarget.value)}
              data-testid="params-profile"
            />
            <Tooltip label={rows.length > 0 ? t("soil.params.review_stale_hint") : t("soil.params.review_none")} withArrow multiline w={260}>
              <Button
                size="xs"
                variant="default"
                disabled={busy || rows.length === 0}
                onClick={() => {
                  setReviewPicked(new Set());
                  setReviewOpen(true);
                }}
                data-testid="params-review-stale"
              >
                {t("soil.params.review_stale")}
              </Button>
            </Tooltip>
            <Tooltip label={t("soil.params.suggest_all_hint")} withArrow multiline w={240}>
              <Button
                size="xs"
                variant="default"
                leftSection={<IconWand size={14} />}
                disabled={busy || !profileId}
                onClick={() => void suggestAll()}
                data-testid="params-suggest-all"
              >
                {t("soil.params.suggest_all")}
              </Button>
            </Tooltip>
          </Group>
      )}

      <ErrorAlert error={error} onClose={() => setError(null)} />
      {notice && (
        <Text size="xs" c="green">
          {notice}
        </Text>
      )}

      {profiles.length === 0 ? (
        <EmptyState title={t("soil.params.title")} description={t("soil.params.no_profiles")} />
      ) : (
        loaded && (
          <Group align="flex-start" wrap="wrap" gap="sm">
            <Paper withBorder radius="md" p={8} style={{ flex: "1 1 200px", maxWidth: 260 }}>
              <Text size="xs" fw={700} c="dimmed" tt="uppercase" px={6} py={4}>
                {t("soil.params.layers")}
              </Text>
              <Stack gap={2}>
                {loaded.profile.layers.map((layer) => {
                  const counts = layerCounts(loaded.byLayer[layer.id] ?? []);
                  const selected = layer.id === layerId;
                  return (
                    <UnstyledButton
                      key={layer.id}
                      onClick={() => selectLayer(layer.id)}
                      disabled={busy}
                      aria-current={selected || undefined}
                      data-testid={`params-layer-${layer.id}`}
                      style={{
                        display: "block",
                        borderRadius: "var(--mantine-radius-sm)",
                        padding: 8,
                        opacity: busy && !selected ? 0.6 : 1,
                        background: selected ? "var(--mantine-color-blue-light)" : undefined,
                        borderLeft: selected ? "3px solid var(--mantine-color-blue-filled)" : "3px solid transparent",
                      }}
                    >
                      <Text size="sm" fw={selected ? 700 : 500}>
                        {t("soil.params.layer_range", { top: layer.top, bottom: layer.bottom })}
                      </Text>
                      <Text size="xs" c="dimmed" lineClamp={2}>
                        {layer.uscs ?? ""} {layer.description ?? ""}
                      </Text>
                      <Group gap={4} mt={3}>
                        <Badge size="xs" variant="light" color={counts.approved > 0 ? "green" : "gray"} data-testid={`params-badge-${layer.id}`}>
                          {t("soil.params.layer_approved", { approved: counts.approved, total: counts.total })}
                        </Badge>
                        {counts.stale > 0 && (
                          <Badge size="xs" variant="light" color="orange">
                            {t("soil.params.layer_stale", { count: counts.stale })}
                          </Badge>
                        )}
                      </Group>
                    </UnstyledButton>
                  );
                })}
              </Stack>
            </Paper>

            <Stack gap="sm" style={{ flex: "3 1 420px", minWidth: 0 }}>
              <Card withBorder padding="xs" radius="sm">
                <Group justify="space-between" wrap="wrap" gap="xs">
                  <Text size="sm" fw={600}>
                    {layerLabel}
                  </Text>
                  <Tooltip label={bulkHint} withArrow multiline w={260}>
                    <Button size="xs" disabled={bulkDisabled} onClick={() => setConfirmKeys(readyKeys)} data-testid="params-approve-ready">
                      {t("soil.params.approve_ready")}
                    </Button>
                  </Tooltip>
                </Group>
              </Card>
              {activeReadiness && (!activeReadiness.gamma_approved || !activeReadiness.gamma_sat_approved) && (
                <Alert color="blue" variant="light" data-testid="params-unit-weight-first">
                  {t("soil.params.unit_weight_first")}
                </Alert>
              )}
              {activeReadiness?.gamma_sat_missing_below_gwt && (
                <Alert color="red" variant="light" data-testid="params-gamma-sat-missing">
                  {t("soil.params.gamma_sat_missing_below_gwt")}
                </Alert>
              )}
              {activeReadiness?.gamma_sat_equals_gamma_unapproved && (
                <Alert color="yellow" variant="light" data-testid="params-gamma-sat-equals">
                  {t("soil.params.gamma_sat_equals_gamma_unapproved")}
                </Alert>
              )}
              {layerId && <LayerInventoryPanel profileId={profileId} layerId={layerId} />}
              {(loaded.profile.source_ids ?? []).length === 0 && !(loaded.profile.layers.find((l) => l.id === layerId)?.source_ids ?? []).length && (
                <Alert color="orange" variant="light" data-testid="params-no-sources">
                  {t("soil.params.no_sources_banner")}{" "}
                  {inRouter && (
                    <Anchor component={Link} to="/m/soil/profiles" size="sm">
                      {t("soil.params.no_sources_link")}
                    </Anchor>
                  )}
                </Alert>
              )}
              {selections.length > 0 && selections.every((s) => !s.suggested && (s.candidates ?? []).length === 0) && (
                <Alert color="orange" variant="light" data-testid="params-no-data">
                  {t("soil.params.no_data_banner")}
                </Alert>
              )}
              {selections.map((selection) => (
                <ParameterKeyCard
                  key={`${profileId}-${layerId}-${selection.parameter}`}
                  selection={selection}
                  busy={busy}
                  onApply={(update) => apply(selection.parameter, update)}
                  onApprove={() => approve([selection.parameter])}
                  onReapprove={(expected) =>
                    reapprove(
                      [{ layer_id: layerId as string, key: selection.parameter, expected_value: expected }],
                      t("soil.params.reapprove_done"),
                    )
                  }
                  onDirtyChange={onDirtyChange}
                />
              ))}
            </Stack>
          </Group>
        )
      )}

      <Modal opened={reviewOpen} onClose={() => setReviewOpen(false)} title={t("soil.params.review_title")} size="xl">
        <Stack gap="sm" data-testid="params-review">
          <Text size="sm">{t("soil.params.review_intro")}</Text>
          <Table.ScrollContainer minWidth={560} type="native">
            <Table withTableBorder fz="xs" verticalSpacing={3}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th />
                  <Table.Th>{t("soil.params.review_col.layer")}</Table.Th>
                  <Table.Th>{t("soil.params.review_col.parameter")}</Table.Th>
                  <Table.Th>{t("soil.params.review_col.old")}</Table.Th>
                  <Table.Th>{t("soil.params.review_col.new")}</Table.Th>
                  <Table.Th>{t("soil.params.review_col.percent")}</Table.Th>
                  <Table.Th>{t("soil.params.review_col.reason")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row) => (
                  <Table.Tr key={row.id} data-testid={`params-review-row-${row.id}`}>
                    <Table.Td>
                      <Checkbox
                        size="xs"
                        checked={reviewPicked.has(row.id)}
                        aria-label={t("soil.params.review_select", { layer: row.layerRange, parameter: t(`soil.params.key.${row.key}`) })}
                        onChange={(e) => {
                          const on = e.currentTarget.checked;
                          setReviewPicked((prev) => {
                            const next = new Set(prev);
                            if (on) next.add(row.id);
                            else next.delete(row.id);
                            return next;
                          });
                        }}
                        data-testid={`params-review-pick-${row.id}`}
                      />
                    </Table.Td>
                    <Table.Td>{row.layerRange}</Table.Td>
                    <Table.Td>{t(`soil.params.key.${row.key}`)}</Table.Td>
                    <Table.Td>
                      {formatValue(row.oldValue)} {displayUnit(row.unit)}
                    </Table.Td>
                    <Table.Td>
                      <b>{formatValue(row.newValue)}</b> {displayUnit(row.unit)}
                    </Table.Td>
                    <Table.Td>{formatPercent(row.percent)}</Table.Td>
                    <Table.Td style={{ minWidth: 200 }}>{t(row.reasonKey)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          <Group justify="space-between" gap="xs">
            <Text size="xs" c="dimmed">
              {t("soil.params.review_selected", { count: reviewPicked.size })}
            </Text>
            <Group gap="xs">
              <Button size="xs" variant="default" onClick={() => setReviewOpen(false)}>
                {t("web.common.cancel")}
              </Button>
              <Button size="xs" disabled={busy || reviewPicked.size === 0} onClick={submitReview} data-testid="params-review-submit">
                {t("soil.params.review_submit")}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={confirmKeys !== null}
        onClose={() => setConfirmKeys(null)}
        title={t("soil.params.approve_confirm_title")}
        size="sm"
      >
        <Stack gap="sm" data-testid="params-confirm">
          <Text size="sm">{t("soil.params.approve_confirm_body", { layer: layerLabel })}</Text>
          <Stack gap={2}>
            {(confirmKeys ?? []).map((key) => {
              const sel = selections.find((s) => s.parameter === key);
              return (
                <Text key={key} size="sm" data-testid={`params-confirm-${key}`}>
                  {t(`soil.params.key.${key}`)}: <b>{formatValue(sel?.selected?.value)}</b> {displayUnit(sel?.selected?.unit)}
                </Text>
              );
            })}
          </Stack>
          <Group justify="flex-end" gap="xs">
            <Button size="xs" variant="default" onClick={() => setConfirmKeys(null)}>
              {t("web.common.cancel")}
            </Button>
            <Button
              size="xs"
              disabled={busy}
              onClick={() => {
                const keys = confirmKeys ?? [];
                setConfirmKeys(null);
                void approve(keys);
              }}
              data-testid="params-confirm-approve"
            >
              {t("soil.params.approve_confirm")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
