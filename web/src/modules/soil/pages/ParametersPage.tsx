import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Group, NativeSelect, Paper, Stack, Text, Title, Tooltip, UnstyledButton } from "@mantine/core";
import { IconWand } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { ApiError, get_project } from "../../../shared/api/client";
import type { ParameterSelection, ProfileSummary, SoilLayer, SoilProfile } from "../../../shared/api/types";
import { EmptyState } from "../../../shared/components/EmptyState";
import {
  approve_parameters,
  get_profile,
  list_layer_parameters,
  list_profiles,
  suggest_all_parameters,
  update_parameter_selection,
} from "../api";
import { ParameterKeyCard } from "../components/ParameterKeyCard";
import { approvalState } from "../parameterState";

/** Approval counts of a layer from the selections stored on the profile. */
function layerCounts(layer: SoilLayer): { approved: number; stale: number; total: number } {
  const selections = Object.values(layer.selections ?? {});
  return {
    approved: selections.filter((s) => approvalState(s) === "approved").length,
    stale: selections.filter((s) => approvalState(s) === "stale").length,
    total: 7,
  };
}

export function ParametersPage() {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [profileId, setProfileId] = useState<string>("");
  const [profile, setProfile] = useState<SoilProfile | null>(null);
  const [layerId, setLayerId] = useState<string | null>(null);
  const [selections, setSelections] = useState<ParameterSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fail = (err: unknown) => {
    if (err instanceof ApiError) setError(err);
  };

  /** Re-reads the profile (layer badges) and the selected layer's parameters; never updates optimistically. */
  const reload = useCallback(async (pid: string, lid: string | null) => {
    const p = await get_profile(pid);
    setProfile(p);
    const target = lid && p.layers.some((l) => l.id === lid) ? lid : (p.layers[0]?.id ?? null);
    setLayerId(target);
    setSelections(target ? await list_layer_parameters(pid, target) : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, project] = await Promise.all([list_profiles(), get_project()]);
        if (cancelled) return;
        setProfiles(list);
        const first = list.find((p) => p.id === project.active_profile_id) ?? list[0];
        if (first) {
          setProfileId(first.id);
          await reload(first.id, null);
        }
      } catch (err) {
        if (!cancelled) fail(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const selectProfile = (pid: string) => {
    setProfileId(pid);
    void run(() => reload(pid, null));
  };

  const selectLayer = (lid: string) => {
    if (!profileId || lid === layerId) return;
    void run(async () => {
      setLayerId(lid);
      setSelections(await list_layer_parameters(profileId, lid));
    });
  };

  const suggestAll = () =>
    run(async () => {
      await suggest_all_parameters(profileId);
      await reload(profileId, layerId);
      setNotice(t("soil.params.suggest_all_done"));
    });

  const apply = (key: ParameterSelection["parameter"], update: Parameters<typeof update_parameter_selection>[3]) =>
    run(async () => {
      await update_parameter_selection(profileId, layerId as string, key, update);
      await reload(profileId, layerId);
    });

  const approve = (keys: ParameterSelection["parameter"][]) =>
    run(async () => {
      await approve_parameters(profileId, layerId as string, keys);
      // Approving phi' can revoke the dependent delta approval, so the whole list is re-read.
      await reload(profileId, layerId);
    });

  if (loading) return <Text size="sm">{t("web.common.loading")}</Text>;

  const readyKeys = selections
    .filter((s) => approvalState(s) === "unapproved" && s.selected != null && s.mode != null)
    .map((s) => s.parameter);

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

      {error && (
        <Alert color="red" title={t(`error.${error.code}`)} withCloseButton onClose={() => setError(null)}>
          <Text size="xs">{error.message}</Text>
        </Alert>
      )}
      {notice && (
        <Text size="xs" c="green">
          {notice}
        </Text>
      )}

      {profiles.length === 0 || !profile ? (
        <EmptyState title={t("soil.params.title")} description={t("soil.params.no_profiles")} />
      ) : (
        <Group align="flex-start" wrap="wrap" gap="sm">
          <Paper withBorder radius="sm" p={6} style={{ flex: "1 1 200px", maxWidth: 260 }}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" px={6} py={4}>
              {t("soil.params.layers")}
            </Text>
            <Stack gap={2}>
              {profile.layers.map((layer) => {
                const counts = layerCounts(layer);
                const selected = layer.id === layerId;
                return (
                  <UnstyledButton
                    key={layer.id}
                    onClick={() => selectLayer(layer.id)}
                    aria-current={selected || undefined}
                    data-testid={`params-layer-${layer.id}`}
                    style={{
                      display: "block",
                      borderRadius: "var(--mantine-radius-sm)",
                      padding: 8,
                      background: selected ? "var(--mantine-color-blue-light)" : undefined,
                      borderLeft: selected ? "3px solid var(--mantine-color-blue-filled)" : "3px solid transparent",
                    }}
                  >
                    <Text size="sm" fw={selected ? 700 : 500}>
                      {layer.id}: {layer.top}–{layer.bottom} m
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {layer.uscs ?? ""} {layer.description ?? ""}
                    </Text>
                    <Group gap={4} mt={3}>
                      <Badge size="xs" variant="light" color={counts.approved > 0 ? "green" : "gray"}>
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
                <Tooltip label={t("soil.params.approve_ready_hint")} withArrow multiline w={260}>
                  <Button
                    size="xs"
                    disabled={busy || readyKeys.length === 0}
                    onClick={() => void approve(readyKeys)}
                    data-testid="params-approve-ready"
                  >
                    {t("soil.params.approve_ready")}
                  </Button>
                </Tooltip>
              </Group>
            </Card>
            {selections.map((selection) => (
              <ParameterKeyCard
                key={`${layerId}-${selection.parameter}`}
                selection={selection}
                busy={busy}
                onApply={(update) => apply(selection.parameter, update)}
                onApprove={() => approve([selection.parameter])}
              />
            ))}
          </Stack>
        </Group>
      )}
    </Stack>
  );
}
