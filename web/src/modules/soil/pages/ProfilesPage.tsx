import { useBeforeUnloadWarning } from "../../../shared/hooks/useBeforeUnloadWarning";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Modal,
  MultiSelect,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconChevronDown,
  IconCopy,
  IconDeviceFloppy,
  IconFileImport,
  IconPencil,
  IconPlus,
  IconStar,
  IconStarFilled,
  IconX,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  ApiError,
  get_project,
  set_active_profile,
} from "../../../shared/api/client";
import { create_profile, get_profile_with_live_approvals, list_investigations, list_profiles, update_profile } from "../api";
import type { ProfileOrigin, ProfileSummary, SoilLayer, SoilProfile } from "../../../shared/api/types";
import { EmptyState } from "../../../shared/components/EmptyState";
import { useUndoable } from "../../../shared/hooks/useUndoable";
import { CommitTextInput } from "../../../shared/soil/CommitInputs";
import { GwtEditor } from "../../../shared/soil/GwtEditor";
import { LayerEditor } from "../../../shared/soil/LayerEditor";
import { LayerLegend } from "../../../shared/soil/LayerLegend";
import { blankLayer, layerErrorKey, validateGwt, validateLayers } from "../../../shared/soil/layerOps";
import { SoilColumn } from "../../../shared/soil/SoilColumn";
import type { InvestigationsDTO } from "../types";
import { LayeringModal, type LayeringKind } from "../components/LayeringModal";

const NEW_ID = "__new__";

const ORIGIN_COLOR: Record<ProfileOrigin, string> = {
  cpt: "blue",
  spt: "grape",
  manual: "gray",
  mixed: "teal",
};

function OriginBadge({ origin }: { origin: ProfileOrigin }) {
  const { t } = useTranslation();
  return (
    <Badge size="xs" variant="light" color={ORIGIN_COLOR[origin]} style={{ flexShrink: 0 }}>
      {t(`web.soil.origin.${origin}`)}
    </Badge>
  );
}

export function ProfilesPage() {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [layeringKind, setLayeringKind] = useState<LayeringKind | null>(null);
  const [investigations, setInvestigations] = useState<InvestigationsDTO | null>(null);

  const draft = useUndoable<SoilProfile | null>(null);
  const profile = draft.value;
  useBeforeUnloadWarning(draft.dirty);
  const isNew = profile?.id === NEW_ID;

  const loadList = useCallback(async () => {
    const [list, proj, inv] = await Promise.all([list_profiles(), get_project(), list_investigations()]);
    setProfiles(list);
    setInvestigations(inv);
    setActiveId(proj.active_profile_id);
    return { list, activeId: proj.active_profile_id };
  }, []);

  const openProfile = useCallback(
    async (id: string) => {
      setBusy(true);
      setError(null);
      try {
        const p = await get_profile_with_live_approvals(id);
        setSelectedId(id);
        draft.reset(p);
        setSelectedLayerId(p.layers[0]?.id ?? null);
      } catch (err) {
        if (err instanceof ApiError) setError(err);
      } finally {
        setBusy(false);
      }
    },
    // draft.reset is a stable callback
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { list, activeId: act } = await loadList();
        if (cancelled) return;
        const first = list.find((p) => p.id === act) ?? list[0];
        if (first) await openProfile(first.id);
      } catch (err) {
        if (err instanceof ApiError) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadList, openProfile]);

  /** Runs `action` now, or after the user confirms discarding unsaved edits. */
  const guard = (action: () => void) => {
    if (draft.dirty) setPendingAction(() => action);
    else action();
  };

  // A profile's own ids stay selectable even if the record was deleted, so the link is visible and removable.
  const sourceOptions = useMemo(() => {
    const ids = new Set([
      ...(investigations?.boreholes ?? []).map((b) => b.id),
      ...(investigations?.cpts ?? []).map((c) => c.id),
      ...(profile?.source_ids ?? []),
    ]);
    return [...ids].map((id) => ({
      value: id,
      label: `${id} (${(investigations?.cpts ?? []).some((c) => c.id === id) ? "CPT" : "SPT"})`,
    }));
  }, [investigations, profile?.source_ids]);

  const layerIssues = useMemo(
    () => (profile ? validateLayers(profile.layers, { mustStartAtZero: true }) : []),
    [profile],
  );
  const gwtIssues = useMemo(() => (profile ? validateGwt(profile.gwt) : []), [profile]);
  const invalid = layerIssues.length + gwtIssues.length > 0;

  const patch = (p: Partial<SoilProfile>) => {
    if (profile) draft.set({ ...profile, ...p });
  };
  const setLayers = (layers: SoilLayer[]) => patch({ layers });

  const startManual = () => {
    const fresh: SoilProfile = {
      id: NEW_ID,
      name: t("web.soil.new_profile_name"),
      origin: "manual",
      source_ids: [],
      layering: null,
      gwt: { depth_insitu: Number.NaN, depth_design: null, depth_seismic: null },
      layers: [blankLayer("L1", 0, 10)],
    };
    setSelectedId(null);
    draft.reset(fresh);
    draft.set({ ...fresh });
    setSelectedLayerId("L1");
    setNotice(null);
  };

  const handleSave = async () => {
    if (!profile || invalid) return;
    setBusy(true);
    setError(null);
    try {
      if (isNew) {
        const created = await create_profile({
          name: profile.name ?? "",
          origin: profile.origin ?? "manual",
          source_ids: profile.source_ids ?? [],
          gwt: profile.gwt,
          layers: profile.layers,
        });
        await loadList();
        setSelectedId(created.id);
        draft.reset(created);
      } else {
        const saved = await update_profile(profile.id, profile);
        await loadList();
        draft.reset(saved);
      }
      setNotice(t("web.soil.saved"));
    } catch (err) {
      if (err instanceof ApiError) setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleDiscard = () => {
    if (isNew) {
      const target = selectedId ?? activeId ?? profiles[0]?.id ?? null;
      draft.reset(null);
      if (target) void openProfile(target);
      return;
    }
    if (selectedId) void openProfile(selectedId);
  };

  const handleDuplicate = async () => {
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      const created = await create_profile({
        name: `${profile.name ?? profile.id} ${t("web.soil.copy_suffix")}`,
        origin: profile.origin ?? "manual",
        source_ids: profile.source_ids ?? [],
        gwt: profile.gwt,
        layers: profile.layers,
      });
      await loadList();
      setSelectedId(created.id);
      draft.reset(created);
      setNotice(t("web.soil.duplicated"));
    } catch (err) {
      if (err instanceof ApiError) setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleSetActive = async () => {
    if (!profile || isNew) return;
    try {
      const proj = await set_active_profile({ profile_id: profile.id });
      setActiveId(proj.active_profile_id);
    } catch (err) {
      if (err instanceof ApiError) setError(err);
    }
  };

  if (loading && profiles.length === 0) {
    return <Text size="sm">{t("web.common.loading")}</Text>;
  }

  const newMenu = (
    <Menu shadow="md" position="bottom-end" withinPortal>
      <Menu.Target>
        <Button size="xs" leftSection={<IconPlus size={14} />} rightSection={<IconChevronDown size={14} />}>
          {t("web.soil.new_profile")}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => guard(startManual)}>
          {t("web.soil.new.manual")}
        </Menu.Item>
        <Menu.Item leftSection={<IconFileImport size={14} />} onClick={() => guard(() => setLayeringKind("cpt"))}>
          {t("web.soil.new.from_cpt")}
        </Menu.Item>
        <Menu.Item leftSection={<IconFileImport size={14} />} onClick={() => guard(() => setLayeringKind("spt"))}>
          {t("web.soil.new.from_spt")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );

  const listPanel = (
    <Paper withBorder radius="sm" p={6} style={{ width: 250, flexShrink: 0 }}>
      <Text size="xs" fw={700} c="dimmed" tt="uppercase" px={6} py={4}>
        {t("web.soil.list_title", { count: profiles.length })}
      </Text>
      <ScrollArea.Autosize mah={640} type="auto">
        <Stack gap={2}>
          {isNew && (
            <Paper radius="sm" p={8} bg="var(--mantine-color-blue-light)">
              <Text size="sm" fw={600} lineClamp={2}>
                {profile?.name || t("web.soil.new_profile_name")}
              </Text>
              <Badge size="xs" color="orange" variant="light" mt={4}>
                {t("web.soil.unsaved")}
              </Badge>
            </Paper>
          )}
          {profiles.map((p) => {
            const selected = !isNew && p.id === selectedId;
            const active = p.id === activeId;
            return (
              <UnstyledButton
                key={p.id}
                onClick={() => {
                  if (p.id !== selectedId || isNew) guard(() => void openProfile(p.id));
                }}
                aria-current={selected || undefined}
                data-testid={`profile-item-${p.id}`}
                style={{
                  display: "block",
                  borderRadius: "var(--mantine-radius-sm)",
                  padding: 8,
                  background: selected ? "var(--mantine-color-blue-light)" : undefined,
                  borderLeft: selected
                    ? "3px solid var(--mantine-color-blue-filled)"
                    : "3px solid transparent",
                }}
              >
                <Group gap={6} wrap="nowrap" align="flex-start">
                  {active ? (
                    <Tooltip label={t("web.soil.active_badge")}>
                      <IconStarFilled size={14} color="var(--mantine-color-yellow-filled)" style={{ flexShrink: 0, marginTop: 2 }} />
                    </Tooltip>
                  ) : (
                    <span style={{ width: 14, flexShrink: 0 }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={selected ? 700 : 500} lineClamp={2} title={p.name}>
                      {p.name}
                    </Text>
                    <Group gap={4} mt={3} wrap="wrap">
                      <OriginBadge origin={p.origin} />
                      <Badge size="xs" variant="outline" color="gray" style={{ flexShrink: 0 }}>
                        {t("web.soil.layer_count", { count: p.layer_count })}
                      </Badge>
                    </Group>
                  </div>
                </Group>
              </UnstyledButton>
            );
          })}
        </Stack>
      </ScrollArea.Autosize>
    </Paper>
  );

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={3}>{t("web.soil.title")}</Title>
          <Text size="sm" c="dimmed">
            {t("web.soil.subtitle")}
          </Text>
        </div>
        {newMenu}
      </Group>

      {error && (
        <Alert color="red" title={t(`error.${error.code}`)} withCloseButton onClose={() => setError(null)}>
          <Text size="xs">{error.message}</Text>
        </Alert>
      )}

      {profiles.length === 0 && !profile ? (
        <EmptyState
          title={t("web.soil.empty_title")}
          description={t("web.soil.empty_desc")}
          action={
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={startManual}>
              {t("web.soil.new.manual")}
            </Button>
          }
        />
      ) : (
        <Group align="flex-start" wrap="nowrap" gap="sm">
          {listPanel}

          {profile ? (
            <Stack gap="sm" style={{ flex: 1, minWidth: 0 }}>
              {/* header */}
              <Card withBorder padding="sm" radius="sm">
                <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
                  <Stack gap={6} style={{ flex: "1 1 360px", minWidth: 0 }}>
                    <CommitTextInput
                      size="sm"
                      variant="unstyled"
                      width="100%"
                      value={profile.name ?? ""}
                      ariaLabel={t("ui.profile.name")}
                      placeholder={t("ui.profile.name")}
                      onCommit={(name) => patch({ name })}
                      inputStyle={{ fontWeight: 700, fontSize: "var(--mantine-font-size-lg)", paddingInline: 0 }}
                    />
                    <MultiSelect
                      size="xs"
                      label={t("web.soil.sources_pick")}
                      description={t("web.soil.sources_hint")}
                      placeholder={(profile.source_ids ?? []).length > 0 ? undefined : t("web.soil.sources_placeholder")}
                      nothingFoundMessage={t("web.soil.sources_none_available")}
                      data={sourceOptions}
                      value={profile.source_ids ?? []}
                      onChange={(ids) => patch({ source_ids: ids })}
                      searchable
                      clearable
                      data-testid="profile-sources"
                    />
                    <Group gap={6} wrap="wrap">
                      <OriginBadge origin={profile.origin ?? "manual"} />
                      {!isNew && profile.id === activeId && (
                        <Badge size="xs" color="yellow" variant="filled" leftSection={<IconStarFilled size={10} />}>
                          {t("web.soil.active_badge")}
                        </Badge>
                      )}
                      {draft.dirty && (
                        <Badge size="xs" color="orange" variant="light">
                          {t("web.soil.unsaved")}
                        </Badge>
                      )}
                    </Group>
                  </Stack>
                  <Group gap={6} wrap="wrap">
                    {!isNew && profile.id !== activeId && (
                      <Button
                        size="xs"
                        variant="default"
                        leftSection={<IconStar size={14} />}
                        onClick={() => void handleSetActive()}
                      >
                        {t("web.soil.set_active")}
                      </Button>
                    )}
                    {!isNew && (
                      <Button
                        size="xs"
                        variant="default"
                        leftSection={<IconCopy size={14} />}
                        disabled={invalid || busy}
                        onClick={() => void handleDuplicate()}
                      >
                        {t("web.soil.duplicate")}
                      </Button>
                    )}
                    <Button
                      size="xs"
                      variant="default"
                      leftSection={<IconX size={14} />}
                      disabled={(!draft.dirty && !isNew) || busy}
                      onClick={handleDiscard}
                    >
                      {t("web.soil.discard")}
                    </Button>
                    <Tooltip
                      label={t("web.soil.save_blocked")}
                      disabled={!invalid}
                      withArrow
                    >
                      <Button
                        size="xs"
                        leftSection={<IconDeviceFloppy size={14} />}
                        disabled={invalid || (!draft.dirty && !isNew)}
                        loading={busy}
                        onClick={() => void handleSave()}
                      >
                        {t("web.soil.save")}
                      </Button>
                    </Tooltip>
                  </Group>
                </Group>
                {notice && !draft.dirty && (
                  <Text size="xs" c="green" mt={4}>
                    {notice}
                  </Text>
                )}
              </Card>

              {/* groundwater + legend */}
              <Card withBorder padding="sm" radius="sm">
                <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
                  <Stack gap={4}>
                    <Text size="sm" fw={600}>
                      {t("web.soil.gwt.title")}
                    </Text>
                    <GwtEditor
                      value={profile.gwt}
                      onChange={(gwt) => patch({ gwt })}
                      error={gwtIssues.length > 0 ? t(layerErrorKey(gwtIssues[0].code)) : null}
                    />
                  </Stack>
                  <LayerLegend layers={profile.layers} showGwt />
                </Group>
              </Card>

              {/* column + editor */}
              <Group align="flex-start" gap="sm" wrap="wrap">
                <Card withBorder padding="xs" radius="sm" style={{ flex: "0 0 auto" }}>
                  <Text size="xs" fw={700} c="dimmed" mb={4}>
                    {t("web.soil.column_title")}
                  </Text>
                  <SoilColumn
                    layers={profile.layers}
                    gwt={Number.isFinite(profile.gwt.depth_insitu) ? profile.gwt : null}
                    selectedId={selectedLayerId}
                    onSelect={(id) => setSelectedLayerId(id)}
                    width={250}
                    height={540}
                  />
                </Card>
                <Card withBorder padding="sm" radius="sm" style={{ flex: "1 1 560px", minWidth: 0 }}>
                  <Stack gap="xs">
                    <Group justify="space-between" wrap="nowrap">
                      <Text size="sm" fw={600}>
                        {t("ui.profile.layers")}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t("ui.profile.layers_hint")}
                      </Text>
                    </Group>
                    <LayerEditor
                      layers={profile.layers}
                      onChange={setLayers}
                      issues={layerIssues}
                      selectedId={selectedLayerId}
                      onSelect={(id) => setSelectedLayerId(id)}
                      idPrefix="L"
                      history={draft}
                      baseLayers={draft.base?.layers}
                      ariaLabel={t("ui.profile.layers")}
                    />
                  </Stack>
                </Card>
              </Group>
            </Stack>
          ) : (
            <Paper withBorder p="xl" radius="sm" style={{ flex: 1 }}>
              <Text size="sm" c="dimmed">
                {busy ? t("web.common.loading") : t("web.soil.select_hint")}
              </Text>
            </Paper>
          )}
        </Group>
      )}

      <Modal
        opened={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        title={t("web.soil.discard_title")}
        size="sm"
      >
        <Stack gap="sm">
          <Text size="sm">{t("web.soil.discard_confirm")}</Text>
          <Group justify="flex-end" gap="xs">
            <Button size="xs" variant="default" onClick={() => setPendingAction(null)}>
              {t("web.common.cancel")}
            </Button>
            <Button
              size="xs"
              color="red"
              onClick={() => {
                const action = pendingAction;
                setPendingAction(null);
                // Back to the saved profile (an unsaved new one is dropped), so a cancelled follow-up
                // action (e.g. closing the layering dialog) does not leave the edits as the saved state.
                draft.reset(isNew ? null : draft.base);
                action?.();
              }}
            >
              {t("web.soil.discard")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <LayeringModal
        kind={layeringKind}
        onClose={() => setLayeringKind(null)}
        onCreated={(created) => {
          setLayeringKind(null);
          void (async () => {
            await loadList();
            await openProfile(created.id);
            setNotice(t("web.soil.saved"));
          })();
        }}
      />
    </Stack>
  );
}
