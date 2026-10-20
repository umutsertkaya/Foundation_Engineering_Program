import { useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconCircleCheck,
  IconDeviceFloppy,
  IconPlus,
  IconRefresh,
  IconX,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { ApiError, resync_structure_soil, set_structure_soil } from "../api/client";
import type {
  CantileverGeometry,
  GravityGeometry,
  RetainingWallStructure,
  SoilLayer,
  StructureSoilModel,
  WallType,
} from "../api/types";
import { StructureSoilSection } from "./StructureSoilSection";
import { useProfileName } from "../hooks/useProfileName";
import type { Undoable } from "../hooks/useUndoable";
import { GwtOverrideEditor } from "../soil/GwtEditor";
import { IssueList, LayerEditor } from "../soil/LayerEditor";
import { LayerLegend } from "../soil/LayerLegend";
import { blankLayer, layerErrorKey, nextLayerId, type LayerIssue } from "../soil/layerOps";
import type { GwtCase, LayerOrigin } from "../soil/zones";

export interface SoilStepValidation {
  fill: LayerIssue[];
  profile: LayerIssue[];
  gwtRetained: LayerIssue[];
  gwtFront: LayerIssue[];
  gwtProfile: LayerIssue[];
  count: number;
}

export interface StructureSoilStepProps {
  structure: RetainingWallStructure;
  draft: Undoable<StructureSoilModel | null>;
  validation: SoilStepValidation;
  stale: boolean;
  wallType: WallType;
  geometry: CantileverGeometry | GravityGeometry;
  height: number;
  backfillSlope: number;
  gwtView: GwtCase;
  onGwtViewChange: (c: GwtCase) => void;
  /** Called with the structure returned by save or re-sync. */
  onSaved: (saved: RetainingWallStructure) => void;
}

export function StructureSoilStep({
  structure,
  draft,
  validation,
  stale,
  wallType,
  geometry,
  height,
  backfillSlope,
  gwtView,
  onGwtViewChange,
  onSaved,
}: StructureSoilStepProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<LayerOrigin>("fill");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmResync, setConfirmResync] = useState(false);

  const soil = draft.value;
  const fill = useMemo(() => soil?.retained_fill ?? [], [soil]);
  const profileLayers = useMemo(() => soil?.profile.layers ?? [], [soil]);
  const allLayers = useMemo(() => [...fill, ...profileLayers], [fill, profileLayers]);
  const sourceName = useProfileName(soil?.source_profile_id);

  if (!soil) return null;

  const setFill = (layers: SoilLayer[]) => draft.set({ ...soil, retained_fill: layers });
  const setProfileLayers = (layers: SoilLayer[]) =>
    draft.set({ ...soil, profile: { ...soil.profile, layers } });

  const invalid = validation.count > 0;

  const save = async () => {
    if (invalid) return;
    setBusy(true);
    setError(null);
    try {
      const saved = (await set_structure_soil(structure.id, soil)) as RetainingWallStructure;
      onSaved(saved);
      setNotice(t("web.wizard.soil_saved"));
    } catch (err) {
      if (err instanceof ApiError) setError(err);
    } finally {
      setBusy(false);
    }
  };

  const resync = async () => {
    setConfirmResync(false);
    setBusy(true);
    setError(null);
    try {
      const saved = (await resync_structure_soil(structure.id)) as RetainingWallStructure;
      onSaved(saved);
      setNotice(t("web.wizard.resynced"));
    } catch (err) {
      if (err instanceof ApiError) setError(err);
    } finally {
      setBusy(false);
    }
  };

  const addFirstFill = () => {
    const id = nextLayerId([], "F", profileLayers.map((l) => l.id));
    const bottom = Math.min(height, profileLayers.length > 0 ? profileLayers[profileLayers.length - 1].bottom : height);
    setFill([blankLayer(id, 0, bottom > 0 ? bottom : 1)]);
    setTab("fill");
    setSelected(id);
  };

  const sourceId = soil.source_profile_id;
  const gwtErr = (issues: LayerIssue[]) => (issues.length > 0 ? t(layerErrorKey(issues[0].code)) : null);

  return (
    <Stack gap="sm" mt="sm">
      {/* source banner */}
      <Alert
        variant="light"
        color={!sourceId ? "gray" : stale ? "orange" : "green"}
        icon={stale ? <IconAlertTriangle size={18} /> : <IconCircleCheck size={18} />}
        p="xs"
      >
        <Group justify="space-between" gap="xs" wrap="wrap">
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Group gap={6} wrap="wrap">
              <Text size="sm" fw={600}>
                {sourceId ? t("web.wizard.soil_source_profile") : t("web.wizard.soil_no_source")}
                {sourceId && (
                  <Text span ml={6} data-testid="soil-source-name">
                    {sourceName}
                  </Text>
                )}
              </Text>
              {sourceId && (
                <Badge size="xs" color={stale ? "orange" : "green"} variant="filled" style={{ flexShrink: 0 }}>
                  {stale ? t("web.structures.badge.stale") : t("web.structures.badge.fresh")}
                </Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed">
              {sourceId
                ? stale
                  ? t("web.wizard.soil_stale_hint")
                  : t("web.wizard.soil_fresh_hint")
                : t("web.wizard.soil_no_source_hint")}
            </Text>
          </Stack>
          {sourceId && (
            <Button
              size="xs"
              variant={stale ? "filled" : "default"}
              color={stale ? "orange" : undefined}
              leftSection={<IconRefresh size={14} />}
              loading={busy}
              onClick={() => setConfirmResync(true)}
            >
              {t("web.wizard.resync")}
            </Button>
          )}
        </Group>
      </Alert>

      {error && (
        <Alert color="red" title={t(`error.${error.code}`)} withCloseButton onClose={() => setError(null)}>
          <Text size="xs">{error.message}</Text>
        </Alert>
      )}

      <Grid gutter="sm" align="stretch">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <StructureSoilSection
            wallType={wallType}
            geometry={geometry}
            height={height}
            backfillSlope={backfillSlope}
            soil={soil}
            gwtCase={gwtView}
            selectedLayerId={selected}
            onSelectLayer={(id, origin) => {
              setSelected(id);
              setTab(origin);
            }}
            title={t("web.wizard.soil_section_title")}
            maxHeight={620}
            minHeight={420}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="sm">
            <Card withBorder padding="sm" radius="sm">
              <Stack gap="xs">
                <Group justify="space-between" wrap="wrap" gap="xs">
                  <Text size="sm" fw={600}>
                    {t("web.wizard.soil_actions")}
                  </Text>
                  <Badge size="sm" variant="light" color={invalid ? "red" : "green"} style={{ flexShrink: 0 }}>
                    {invalid ? t("web.soil.issues_count", { count: validation.count }) : t("web.soil.valid")}
                  </Badge>
                </Group>
                <Group gap={6} wrap="wrap">
                  <Tooltip label={t("web.soil.action.undo")} openDelay={400}>
                    <ActionIcon variant="default" size="lg" disabled={!draft.canUndo} onClick={draft.undo} aria-label={t("web.soil.action.undo")}>
                      <IconArrowBackUp size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={t("web.soil.action.redo")} openDelay={400}>
                    <ActionIcon variant="default" size="lg" disabled={!draft.canRedo} onClick={draft.redo} aria-label={t("web.soil.action.redo")}>
                      <IconArrowForwardUp size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Button
                    size="xs"
                    variant="default"
                    leftSection={<IconX size={14} />}
                    disabled={!draft.dirty || busy}
                    onClick={() => draft.reset(structure.soil)}
                  >
                    {t("web.soil.discard")}
                  </Button>
                  <Tooltip label={t("web.soil.save_blocked")} disabled={!invalid} withArrow>
                    <Button
                      size="xs"
                      leftSection={<IconDeviceFloppy size={14} />}
                      disabled={invalid || !draft.dirty}
                      loading={busy}
                      onClick={() => void save()}
                    >
                      {t("web.wizard.save_soil")}
                    </Button>
                  </Tooltip>
                </Group>
                {draft.dirty && (
                  <Text size="xs" c="orange">
                    {t("web.wizard.soil_unsaved")}
                  </Text>
                )}
                {notice && !draft.dirty && (
                  <Text size="xs" c="green">
                    {notice}
                  </Text>
                )}
                {(validation.gwtProfile.length > 0) && (
                  <Text size="xs" c="red">
                    {t("web.wizard.profile_gwt_invalid")}
                  </Text>
                )}
              </Stack>
            </Card>

            <Card withBorder padding="sm" radius="sm">
              <Stack gap="sm">
                <Group justify="space-between" gap="xs" wrap="wrap">
                  <Text size="sm" fw={600}>
                    {t("web.soil.gwt.title")}
                  </Text>
                  <SegmentedControl
                    size="xs"
                    value={gwtView}
                    onChange={(v) => onGwtViewChange(v as GwtCase)}
                    aria-label={t("web.wizard.gwt_view")}
                    data={[
                      { value: "insitu", label: t("web.soil.gwt.insitu_short") },
                      { value: "design", label: t("web.soil.gwt.design_short") },
                      { value: "seismic", label: t("web.soil.gwt.seismic_short") },
                    ]}
                  />
                </Group>
                <GwtOverrideEditor
                  label={t("web.wizard.gwt_retained")}
                  value={soil.gwt_retained}
                  inherited={soil.profile.gwt}
                  error={gwtErr(validation.gwtRetained)}
                  onChange={(g) => draft.set({ ...soil, gwt_retained: g })}
                />
                <GwtOverrideEditor
                  label={t("web.wizard.gwt_front")}
                  value={soil.gwt_front}
                  inherited={soil.profile.gwt}
                  error={gwtErr(validation.gwtFront)}
                  onChange={(g) => draft.set({ ...soil, gwt_front: g })}
                />
              </Stack>
            </Card>

            <Card withBorder padding="sm" radius="sm">
              <Stack gap={6}>
                <Text size="sm" fw={600}>
                  {t("web.soil.legend")}
                </Text>
                <LayerLegend layers={allLayers} showGwt />
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>

      <Card withBorder padding="sm" radius="sm">
        <Tabs value={tab} onChange={(v) => setTab((v as LayerOrigin) ?? "fill")} keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab
              value="fill"
              rightSection={
                <Badge size="xs" variant="light" color={validation.fill.length > 0 ? "red" : "gray"} circle>
                  {fill.length}
                </Badge>
              }
            >
              {t("web.wizard.tab.fill")}
            </Tabs.Tab>
            <Tabs.Tab
              value="profile"
              rightSection={
                <Badge size="xs" variant="light" color={validation.profile.length > 0 ? "red" : "gray"} circle>
                  {profileLayers.length}
                </Badge>
              }
            >
              {t("web.wizard.tab.profile")}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="fill" pt="xs">
            <Stack gap="xs">
              <Text size="xs" c="dimmed">
                {t("web.wizard.fill_explain")}
              </Text>
              <LayerEditor
                layers={fill}
                onChange={setFill}
                issues={validation.fill}
                selectedId={selected}
                onSelect={(id) => setSelected(id)}
                idPrefix="F"
                reservedIds={profileLayers.map((l) => l.id)}
                baseLayers={draft.base?.retained_fill ?? []}
                allowEmpty
                ariaLabel={t("web.wizard.tab.fill")}
                emptyState={
                  <Stack align="center" gap={6} py="md">
                    <Text size="sm" fw={600}>
                      {t("web.wizard.fill_empty_title")}
                    </Text>
                    <Text size="xs" c="dimmed" ta="center" maw={520}>
                      {t("web.wizard.fill_empty_desc")}
                    </Text>
                    <Button size="xs" leftSection={<IconPlus size={14} />} onClick={addFirstFill}>
                      {t("web.wizard.add_fill")}
                    </Button>
                  </Stack>
                }
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="profile" pt="xs">
            <Stack gap="xs">
              <Text size="xs" c="dimmed">
                {t("web.wizard.profile_explain")}
              </Text>
              <LayerEditor
                layers={profileLayers}
                onChange={setProfileLayers}
                issues={validation.profile}
                selectedId={selected}
                onSelect={(id) => setSelected(id)}
                idPrefix="L"
                reservedIds={fill.map((l) => l.id)}
                baseLayers={draft.base?.profile.layers}
                ariaLabel={t("web.wizard.tab.profile")}
              />
            </Stack>
          </Tabs.Panel>
        </Tabs>
        {validation.gwtProfile.length + validation.gwtRetained.length + validation.gwtFront.length > 0 && (
          <IssueList
            issues={[...validation.gwtProfile, ...validation.gwtRetained, ...validation.gwtFront]}
            layers={[]}
          />
        )}
      </Card>

      <Modal opened={confirmResync} onClose={() => setConfirmResync(false)} title={t("web.wizard.resync_title")} size="md">
        <Stack gap="sm">
          <Text size="sm">{t("web.wizard.resync_confirm", { name: sourceName ?? "" })}</Text>
          {draft.dirty && (
            <Alert color="orange" variant="light" p="xs">
              <Text size="xs">{t("web.wizard.resync_unsaved")}</Text>
            </Alert>
          )}
          <Group justify="flex-end" gap="xs">
            <Button size="xs" variant="default" onClick={() => setConfirmResync(false)}>
              {t("web.common.cancel")}
            </Button>
            <Button size="xs" color="orange" leftSection={<IconRefresh size={14} />} onClick={() => void resync()}>
              {t("web.wizard.resync")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
