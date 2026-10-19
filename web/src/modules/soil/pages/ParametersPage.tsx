import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, Group, Modal, NativeSelect, Paper, Stack, Text, Title, Tooltip, UnstyledButton } from "@mantine/core";
import { IconWand } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { get_project } from "../../../shared/api/client";
import type { DesignKey, ParameterSelection, ProfileSummary, SoilProfile } from "../../../shared/api/types";
import { EmptyState } from "../../../shared/components/EmptyState";
import {
  approve_parameters,
  get_profile,
  list_layer_parameters,
  list_profiles,
  suggest_all_parameters,
  update_parameter_selection,
} from "../api";
import { ErrorAlert } from "../components/ErrorAlert";
import { ParameterKeyCard } from "../components/ParameterKeyCard";
import { LatestGuard } from "../latest";
import { approvalState, formatValue, readiness } from "../parameterState";

/** One consistent snapshot: the profile, the layer shown, and the parameters of every layer as last read. */
interface Loaded {
  profileId: string;
  profile: SoilProfile;
  layerId: string | null;
  byLayer: Record<string, ParameterSelection[]>;
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
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dirtyKeys, setDirtyKeys] = useState<ReadonlySet<DesignKey>>(new Set());
  const [confirmKeys, setConfirmKeys] = useState<DesignKey[] | null>(null);
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
    if (!guard.current.isCurrent(token)) return;
    const layerId =
      preferLayer && profile.layers.some((l) => l.id === preferLayer) ? preferLayer : (profile.layers[0]?.id ?? null);
    setLoaded({ profileId, profile, layerId, byLayer: Object.fromEntries(entries) });
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

  if (loading) return <Text size="sm">{t("web.common.loading")}</Text>;

  const profileId = loaded?.profileId ?? "";
  const layerId = loaded?.layerId ?? null;
  const selections = (loaded && layerId ? loaded.byLayer[layerId] : undefined) ?? [];

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
    <Stack gap="sm">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={3}>{t("soil.params.title")}</Title>
          <Text size="sm" c="dimmed">
            {t("soil.params.subtitle")}
          </Text>
        </div>
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
      </Group>

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
            <Paper withBorder radius="sm" p={6} style={{ flex: "1 1 200px", maxWidth: 260 }}>
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
                        {layer.id}: {t("soil.params.layer_range", { top: layer.top, bottom: layer.bottom })}
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
                    {layerId}
                  </Text>
                  <Tooltip label={bulkHint} withArrow multiline w={260}>
                    <Button size="xs" disabled={bulkDisabled} onClick={() => setConfirmKeys(readyKeys)} data-testid="params-approve-ready">
                      {t("soil.params.approve_ready")}
                    </Button>
                  </Tooltip>
                </Group>
              </Card>
              {selections.map((selection) => (
                <ParameterKeyCard
                  key={`${profileId}-${layerId}-${selection.parameter}`}
                  selection={selection}
                  busy={busy}
                  onApply={(update) => apply(selection.parameter, update)}
                  onApprove={() => approve([selection.parameter])}
                  onDirtyChange={onDirtyChange}
                />
              ))}
            </Stack>
          </Group>
        )
      )}

      <Modal
        opened={confirmKeys !== null}
        onClose={() => setConfirmKeys(null)}
        title={t("soil.params.approve_confirm_title")}
        size="sm"
      >
        <Stack gap="sm" data-testid="params-confirm">
          <Text size="sm">{t("soil.params.approve_confirm_body", { layer: layerId ?? "" })}</Text>
          <Stack gap={2}>
            {(confirmKeys ?? []).map((key) => {
              const sel = selections.find((s) => s.parameter === key);
              return (
                <Text key={key} size="sm" data-testid={`params-confirm-${key}`}>
                  {t(`soil.params.key.${key}`)}: <b>{formatValue(sel?.selected?.value)}</b> {sel?.selected?.unit}
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
