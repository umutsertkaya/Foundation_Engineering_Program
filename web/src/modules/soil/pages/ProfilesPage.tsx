import { useBeforeUnloadWarning } from "../../../shared/hooks/useBeforeUnloadWarning";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  Menu,
  Modal,
  MultiSelect,
  Paper,
  Stack,
  Text,
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
import { PageHeader } from "../../../shared/components/PageHeader";
import { SectionCard } from "../../../shared/components/SectionCard";
import { StatusChip } from "../../../shared/components/StatusChip";
import { VerdictBanner } from "../../../shared/components/VerdictBanner";
import { layerParamStatus } from "../../../shared/soil/layerStatus";
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
  // Layers whose required design parameter (phi' drained, s_u undrained) is not entered or approved yet.
  const missingLayerIds = useMemo(
    () => (profile ? profile.layers.filter((l) => layerParamStatus(l) === "missing").map((l) => l.id) : []),
    [profile],
  );

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

  const switcher = (
    <Group gap="xs" wrap="wrap" role="group" aria-label={t("web.soil.list_title", { count: profiles.length })}>
      {isNew && (
        <StatusChip tone="info" dot={false}>{profile?.name || t("web.soil.new_profile_name")} · {t("web.soil.unsaved")}</StatusChip>
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
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              height: 38,
              padding: "0 14px",
              borderRadius: 8,
              fontWeight: selected ? 600 : 500,
              border: `1px solid ${selected ? "var(--mantine-color-primary-6)" : "var(--gt-border)"}`,
              background: selected ? "var(--gt-primary-soft)" : "var(--mantine-color-body)",
              color: selected ? "var(--gt-primary-soft-text)" : "inherit",
            }}
          >
            {active && (
              <Tooltip label={t("web.soil.active_badge")}>
                <IconStarFilled size={14} color="var(--mantine-color-yellow-filled)" style={{ flexShrink: 0 }} />
              </Tooltip>
            )}
            <span title={p.name}>{p.name}</span>
            <OriginBadge origin={p.origin} />
            <Text span size="xs" c="dimmed">{t("web.soil.layer_count", { count: p.layer_count })}</Text>
          </UnstyledButton>
        );
      })}
    </Group>
  );

  return (
    <Stack gap="sm">
      <PageHeader title={t("web.soil.title")} lead={t("web.soil.subtitle")} actions={newMenu} />

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
        <Stack gap="md">
          {switcher}

          {profile ? (
            <>
              {missingLayerIds.length > 0 && (
                <VerdictBanner
                  tone="warn"
                  title={t("web.soil.missing_banner", { count: missingLayerIds.length })}
                  action={(
                    <Button size="xs" variant="default" data-testid="goto-missing" onClick={() => setSelectedLayerId(missingLayerIds[0])}>
                      {t("web.soil.goto_missing")}
                    </Button>
                  )}
                />
              )}

              <SectionCard
                title={t("web.soil.profile_card")}
                aside={(
                  <Group gap={6}>
                    {!isNew && profile.id === activeId && <StatusChip tone="current">{t("web.soil.active_badge")}</StatusChip>}
                    {draft.dirty && <StatusChip tone="stale">{t("web.soil.unsaved")}</StatusChip>}
                  </Group>
                )}
              >
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
                  </Stack>
                  <Group gap={6} wrap="wrap">
                    {!isNew && profile.id !== activeId && (
                      <Button size="xs" variant="default" leftSection={<IconStar size={14} />} onClick={() => void handleSetActive()}>
                        {t("web.soil.set_active")}
                      </Button>
                    )}
                    {!isNew && (
                      <Button size="xs" variant="default" leftSection={<IconCopy size={14} />} disabled={invalid || busy} onClick={() => void handleDuplicate()}>
                        {t("web.soil.duplicate")}
                      </Button>
                    )}
                    <Button size="xs" variant="default" leftSection={<IconX size={14} />} disabled={(!draft.dirty && !isNew) || busy} onClick={handleDiscard}>
                      {t("web.soil.discard")}
                    </Button>
                    <Tooltip label={t("web.soil.save_blocked")} disabled={!invalid} withArrow>
                      <Button size="xs" leftSection={<IconDeviceFloppy size={14} />} disabled={invalid || (!draft.dirty && !isNew)} loading={busy} onClick={() => void handleSave()}>
                        {t("web.soil.save")}
                      </Button>
                    </Tooltip>
                  </Group>
                </Group>
                {notice && !draft.dirty && (
                  <Text size="xs" c="green" mt={4}>{notice}</Text>
                )}
              </SectionCard>

              <Group align="flex-start" gap="md" wrap="wrap">
                <SectionCard title={t("web.soil.column_title")}>
                  <SoilColumn
                    layers={profile.layers}
                    gwt={Number.isFinite(profile.gwt.depth_insitu) ? profile.gwt : null}
                    selectedId={selectedLayerId}
                    onSelect={(id) => setSelectedLayerId(id)}
                    width={250}
                    height={540}
                  />
                </SectionCard>
                <div style={{ flex: "1 1 560px", minWidth: 0 }}>
                  <SectionCard title={t("ui.profile.layers")} aside={<Text size="xs" c="dimmed">{t("ui.profile.layers_hint")}</Text>}>
                    <LayerEditor
                      layers={profile.layers}
                      onChange={setLayers}
                      issues={layerIssues}
                      selectedId={selectedLayerId}
                      onSelect={(id) => setSelectedLayerId(id)}
                      idPrefix="L"
                      history={draft}
                      baseLayers={draft.base?.layers}
                      gwtDepth={profile.gwt.depth_insitu}
                      ariaLabel={t("ui.profile.layers")}
                    />
                    <div style={{ marginTop: 12 }}>
                      <LayerLegend layers={profile.layers} showGwt />
                    </div>
                  </SectionCard>
                </div>
              </Group>

              <SectionCard title={t("web.soil.gwt.title")}>
                <GwtEditor
                  value={profile.gwt}
                  onChange={(gwt) => patch({ gwt })}
                  error={gwtIssues.length > 0 ? t(layerErrorKey(gwtIssues[0].code)) : null}
                />
              </SectionCard>
            </>
          ) : (
            <Paper withBorder p="xl" radius="md">
              <Text size="sm" c="dimmed">
                {busy ? t("web.common.loading") : t("web.soil.select_hint")}
              </Text>
            </Paper>
          )}
        </Stack>
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
