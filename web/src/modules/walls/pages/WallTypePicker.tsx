import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Button,
  Card,
  Group,
  Loader,
  NumberInput,
  Radio,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBox, IconCheck, IconInfoCircle, IconWall } from "@tabler/icons-react";
import { list_wall_types } from "../api";
import { ApiError, create_structure, get_project } from "../../../shared/api/client";
import { list_project_profiles } from "../../../shared/api/core";
import type {
  ProfileSummary,
  RetainingWallCreate,
  SoilLayer,
  WallType,
  WallTypeInfo,
} from "../../../shared/api/types";
import { EmptyState } from "../../../shared/components/EmptyState";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";
import { CommitNumberInput } from "../../../shared/soil/CommitInputs";
import { IssueList, LayerEditor } from "../../../shared/soil/LayerEditor";
import { blankLayer, validateGwt, validateLayers } from "../../../shared/soil/layerOps";

type SoilSource = "copy" | "manual";

/** Retaining wall type picker and creation screen (`/m/walls/new`). */
export function WallTypePicker() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [types, setTypes] = useState<WallTypeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);

  const [selected, setSelected] = useState<WallType | null>(null);
  const [name, setName] = useState("");
  const [height, setHeight] = useState<number>(5);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [source, setSource] = useState<SoilSource>("copy");
  const [profileId, setProfileId] = useState<string | null>(null);
  // null until the user edits the layers: the starting depth then follows the wall height.
  const [editedLayers, setEditedLayers] = useState<SoilLayer[] | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<string | null>("L1");
  // NaN until the user enters it; never defaulted.
  const [gwtDepth, setGwtDepth] = useState<number>(Number.NaN);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const loadSeq = useRef(0);

  const load = useCallback(() => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      list_wall_types(),
      list_project_profiles(),
      get_project().then((p) => p.active_profile_id).catch(() => null),
    ])
      .then(([data, profs, active]) => {
        if (seq !== loadSeq.current) return;
        setTypes(data);
        setProfiles(profs);
        setActiveId(active);
        setSource(profs.length > 0 ? "copy" : "manual");
        setProfileId((cur) =>
          cur && profs.some((p) => p.id === cur)
            ? cur
            : profs.find((p) => p.id === active)?.id ?? profs[0]?.id ?? null,
        );
        setSelected((cur) => cur ?? data.find((i) => i.id === "cantilever")?.id ?? data[0]?.id ?? null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (seq !== loadSeq.current) return;
        setLoadError(err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
    return () => {
      loadSeq.current += 1;
    };
  }, [load]);

  const cancelButton = (
    <Button variant="default" onClick={() => navigate("/m/walls")}>
      {t("walls.type_picker.cancel")}
    </Button>
  );

  if (loading) {
    return <Loader />;
  }

  if (loadError != null) {
    return (
      <Stack gap="md" maw={880}>
        <ErrorAlert error={loadError} />
        <Group>
          <Button onClick={load}>{t("web.common.retry")}</Button>
          {cancelButton}
        </Group>
      </Stack>
    );
  }

  if (types.length === 0) {
    return (
      <EmptyState
        title={t("walls.type_picker.empty_title")}
        description={t("walls.type_picker.empty_desc")}
        action={cancelButton}
      />
    );
  }

  const selectedInfo = types.find((info) => info.id === selected);
  const hasProfiles = profiles.length > 0;
  const manual = source === "manual" || !hasProfiles;
  const effectiveName = name.trim() || (selectedInfo ? t(selectedInfo.title_key) : "");

  // A geometric starting depth (not a soil property); the user edits it.
  const layers = editedLayers ?? [blankLayer("L1", 0, height + 5)];
  const gwt = { depth_insitu: gwtDepth, depth_design: null, depth_seismic: null };
  const layerIssues = manual ? validateLayers(layers, { minBottom: height }) : [];
  const gwtIssues = manual ? validateGwt(gwt) : [];
  const manualInvalid = layerIssues.length + gwtIssues.length > 0;
  const copyInvalid = !manual && !profileId;

  async function handleCreate() {
    if (!selected || !selectedInfo || manualInvalid || copyInvalid) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: RetainingWallCreate = {
        kind: "retaining_wall",
        name: effectiveName,
        wall_type: selected,
        height,
        ...(manual
          ? {
              soil: {
                source_profile_id: null,
                source_hash: null,
                profile: {
                  id: "manual",
                  name: effectiveName,
                  origin: "manual",
                  source_ids: [],
                  layering: null,
                  gwt,
                  layers,
                },
                retained_fill: [],
                gwt_retained: null,
                gwt_front: null,
              },
            }
          : { profile_id: profileId }),
      };
      const created = await create_structure(payload);
      notifications.show({
        color: "green",
        message: t("walls.type_picker.created"),
      });
      navigate(`/m/walls/s/${encodeURIComponent(created.id)}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err : new Error(t("error.engine_error")));
      setSubmitting(false);
    }
  }

  function handleRadioKey(e: React.KeyboardEvent, index: number) {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const step = keys[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const next = (index + step + types.length) % types.length;
    setSelected(types[next].id);
    cardRefs.current[next]?.focus();
  }

  return (
    <Stack gap="lg" maw={880}>
      <Stack gap={4}>
        <Title order={2}>{t("walls.type_picker.title")}</Title>
        <Text c="dimmed">{t("walls.type_picker.subtitle")}</Text>
      </Stack>

      <SimpleGrid
        cols={{ base: 1, sm: 2 }}
        role="radiogroup"
        aria-label={t("walls.type_picker.title")}
      >
        {types.map((info, index) => {
          const isSelected = selected === info.id;
          const Icon =
            info.id === "gravity"
              ? IconBox
              : info.id === "cantilever"
                ? IconWall
                : IconWall;
          return (
            <UnstyledButton
              key={info.id}
              ref={(el) => {
                cardRefs.current[index] = el;
              }}
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setSelected(info.id)}
              onKeyDown={(e) => handleRadioKey(e, index)}
            >
              <Card
                withBorder
                padding="lg"
                radius="md"
                h="100%"
                style={
                  isSelected
                    ? {
                        borderColor: "var(--mantine-primary-color-filled)",
                        borderWidth: 2,
                      }
                    : undefined
                }
              >
                <Group align="flex-start" wrap="nowrap">
                  <ThemeIcon
                    size="lg"
                    radius="md"
                    variant={isSelected ? "filled" : "light"}
                  >
                    <Icon size={22} />
                  </ThemeIcon>
                  <Stack gap={4}>
                    <Group gap={6} wrap="nowrap">
                      <Text fw={600}>{t(info.title_key)}</Text>
                      {isSelected && <IconCheck size={16} aria-hidden />}
                    </Group>
                    <Text size="sm" c="dimmed">
                      {t(`${info.title_key}.description`)}
                    </Text>
                  </Stack>
                </Group>
              </Card>
            </UnstyledButton>
          );
        })}
      </SimpleGrid>

      <TextInput
        label={t("walls.type_picker.name")}
        placeholder={selectedInfo ? t(selectedInfo.title_key) : undefined}
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
      />

      <NumberInput
        label={t("walls.type_picker.height")}
        value={height}
        onChange={(val) => {
          if (typeof val === "number" && Number.isFinite(val)) setHeight(val);
        }}
        min={1}
        max={15}
        step={0.25}
        decimalScale={2}
      />

      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Text fw={600}>{t("walls.soil_source.title")}</Text>
          {hasProfiles ? (
            <Radio.Group
              value={manual ? "manual" : "copy"}
              onChange={(v) => setSource(v as SoilSource)}
              aria-label={t("walls.soil_source.title")}
            >
              <Group gap="lg">
                <Radio value="copy" label={t("walls.soil_source.copy")} />
                <Radio value="manual" label={t("walls.soil_source.manual")} />
              </Group>
            </Radio.Group>
          ) : (
            <Group gap={6} wrap="nowrap" align="flex-start">
              <IconInfoCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
              <Text size="sm">{t("walls.soil_source.no_profile")}</Text>
            </Group>
          )}

          {!manual && (
            <Select
              label={t("walls.soil_source.profile")}
              value={profileId}
              onChange={setProfileId}
              allowDeselect={false}
              data={profiles.map((p) => ({
                value: p.id,
                label: p.id === activeId ? `${p.name} (${t("walls.soil_source.active")})` : p.name,
              }))}
            />
          )}

          {manual && (
            <Stack gap="sm">
              <Text size="xs" c="dimmed">
                {t("walls.soil_source.manual_hint")}
              </Text>
              <Group gap="xs" align="flex-end" wrap="nowrap">
                <CommitNumberInput
                  label={t("walls.soil_source.gwt")}
                  value={gwtDepth}
                  width={120}
                  ariaLabel={t("walls.soil_source.gwt")}
                  error={gwtIssues.length > 0 ? t("web.soil.error.gwt_negative") : null}
                  onCommit={(v) => setGwtDepth(v ?? Number.NaN)}
                />
                <Tooltip label={t("walls.soil_source.gwt_hint")} multiline w={260} withArrow>
                  <IconInfoCircle
                    size={18}
                    style={{ marginBottom: 6 }}
                    aria-label={t("walls.soil_source.gwt_hint")}
                    role="img"
                  />
                </Tooltip>
              </Group>
              <div style={{ overflowX: "auto" }}>
                <LayerEditor
                  layers={layers}
                  onChange={setEditedLayers}
                  issues={layerIssues}
                  selectedId={selectedLayer}
                  onSelect={(id) => setSelectedLayer(id)}
                  idPrefix="L"
                  ariaLabel={t("walls.soil_source.layers")}
                />
              </div>
              {layerIssues.length + gwtIssues.length > 0 && (
                <IssueList issues={[...layerIssues, ...gwtIssues]} layers={layers} />
              )}
            </Stack>
          )}
        </Stack>
      </Card>

      {submitError != null && <ErrorAlert error={submitError} />}

      <Group justify="flex-end">
        {cancelButton}
        <Button
          disabled={!selected || submitting || manualInvalid || copyInvalid}
          loading={submitting}
          onClick={handleCreate}
        >
          {t("walls.type_picker.create")}
        </Button>
      </Group>
    </Stack>
  );
}
