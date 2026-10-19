import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Grid,
  Group,
  NumberInput,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconPlayerPlay, IconSparkles } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  get_structure,
  list_structures,
  update_structure,
} from "../../../shared/api/client";
import { check_wall, size_wall } from "../api";
import type {
  CantileverGeometry,
  FactorOverride,
  GravityGeometry,
  RetainingWallStructure,
  StructureSoilModel,
  WallResultDTO,
  WallType,
} from "../../../shared/api/types";
import { EmptyState } from "../../../shared/components/EmptyState";
import { MissingFactorsForm } from "../../../shared/components/MissingFactorsForm";
import { StructureSoilSection } from "../../../shared/structureSoil/StructureSoilSection";
import { useJob } from "../../../shared/hooks/useJob";
import { useUndoable } from "../../../shared/hooks/useUndoable";
import { validateGwt, validateStructureSoil } from "../../../shared/soil/layerOps";
import type { GwtCase } from "../../../shared/soil/zones";
import { StructureSoilStep, type SoilStepValidation } from "../../../shared/structureSoil/StructureSoilStep";
import { AnalysisOptionsForm } from "../components/AnalysisOptionsForm";
import { PermeabilityEditor } from "../components/PermeabilityEditor";
import { WallCheckCards, type RunMode } from "../components/WallCheckCards";
import { WallCrossSection } from "../components/WallCrossSection";
import { StaleNotice, WallResultView } from "../components/WallResultView";
import { WizardStepBar } from "../components/WizardStepBar";
import { ANALYSIS_DEFAULTS, applyOptions, layersWithoutPermeability, optionsFromSettings } from "../settings";
import type { AnalysisOptions } from "../types";

type GeometrySource = "draft" | "suggested" | "user";

const DEFAULT_GRAVITY_5M: GravityGeometry = {
  height: 5.0,
  base_width: 3.0,
  top_width: 0.8,
  back_offset: 0.2,
  embedment: 0.6,
};

const DEFAULT_CANTILEVER_5M: CantileverGeometry = {
  stem_height: 4.5,
  stem_top: 0.3,
  stem_bottom: 0.5,
  toe: 0.9,
  heel: 3.2,
  base_thickness: 0.5,
  embedment: 0.6,
};

export function WallWizardPage() {
  const { sid: id } = useParams<{ sid: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [structure, setStructure] = useState<RetainingWallStructure | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [activeStep, setActiveStep] = useState<number>(0);

  const [wallType, setWallType] = useState<WallType>("cantilever");
  const [height, setHeight] = useState<number>(5.0);
  const [embedment, setEmbedment] = useState<number>(0.6);
  const [backfillSlope, setBackfillSlope] = useState<number>(0.0);
  const [cantileverGeo, setCantileverGeo] = useState<CantileverGeometry>({
    ...DEFAULT_CANTILEVER_5M,
  });
  const [gravityGeo, setGravityGeo] = useState<GravityGeometry>({
    ...DEFAULT_GRAVITY_5M,
  });
  const [geometrySource, setGeometrySource] = useState<GeometrySource>("draft");

  const [surcharge, setSurcharge] = useState<number>(10.0);
  const [sds, setSds] = useState<number>(0.5);
  const [rFactor, setRFactor] = useState<number>(1.5);
  const [includeGlobal, setIncludeGlobal] = useState<boolean>(true);
  const [analysisLevel, setAnalysisLevel] = useState<"basic" | "advanced">("basic");
  const [designCode, setDesignCode] = useState<string>("asd");

  const [lastResult, setLastResult] = useState<WallResultDTO | null>(null);
  const [lastRunMode, setLastRunMode] = useState<RunMode>("suggest");
  /** Mode of the run that produced `lastResult` (the cards depend on it, not on the next click). */
  const [resultMode, setResultMode] = useState<RunMode>("suggest");
  const [analysisOptions, setAnalysisOptions] = useState<AnalysisOptions>({ ...ANALYSIS_DEFAULTS });
  const [passiveConfirmed, setPassiveConfirmed] = useState<boolean>(false);
  /** Inputs signature at the moment the shown result was produced (see `inputSignature`). */
  const [resultSig, setResultSig] = useState<string | null>(null);
  const [captureSig, setCaptureSig] = useState<boolean>(false);

  const job = useJob<WallResultDTO>();

  const soilDraft = useUndoable<StructureSoilModel | null>(null);
  const [stale, setStale] = useState<boolean>(false);
  const [gwtView, setGwtView] = useState<GwtCase>("design");
  const [runBlocked, setRunBlocked] = useState<string | null>(null);

  const refreshStale = useCallback(async () => {
    if (!id) return;
    try {
      const list = await list_structures();
      setStale(Boolean(list.find((s) => s.id === id)?.stale));
    } catch {
      // the badge keeps its last value when the list cannot be loaded
    }
  }, [id]);

  const loadStructure = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const s = await get_structure(id);
      const wall = s as RetainingWallStructure;
      setStructure(wall);
      soilDraft.reset(wall.soil);
      setGwtView(wall.inputs?.gwt_case ?? "design");
      void refreshStale();
      setWallType(wall.wall_type);
      setHeight(wall.height);
      setEmbedment(wall.embedment ?? 0.6);
      setBackfillSlope(wall.backfill_slope ?? 0.0);
      if (wall.geometry) {
        if ("stem_bottom" in wall.geometry) {
          setCantileverGeo({ ...wall.geometry });
        } else {
          setGravityGeo({ ...wall.geometry });
        }
      }
      setSurcharge(wall.inputs?.surcharge ?? 10.0);
      setSds(wall.inputs?.sds ?? 0.5);
      setRFactor(wall.inputs?.r ?? 1.5);
      setIncludeGlobal(wall.inputs?.include_global_stability ?? true);
      setAnalysisLevel(wall.analysis_level ?? "basic");
      setDesignCode(wall.settings?.design_code ?? "asd");
      setAnalysisOptions(optionsFromSettings(wall.settings));
      setPassiveConfirmed(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setLoadError(err);
      }
    } finally {
      setLoading(false);
    }
    // soilDraft.reset is a stable callback
  }, [id, refreshStale]);

  useEffect(() => {
    void loadStructure();
  }, [loadStructure]);

  // Apply job outcome when calculation reaches done
  useEffect(() => {
    if (job.status === "done" && job.result) {
      setLastResult(job.result);
      setResultMode(lastRunMode);
      setCaptureSig(true);
      if (lastRunMode === "suggest") {
        if ("stem_bottom" in job.result.geometry) {
          setCantileverGeo({ ...job.result.geometry });
        } else {
          setGravityGeo({ ...job.result.geometry });
        }
        setGeometrySource("suggested");
      }
    }
  }, [job.status, job.result, lastRunMode]);

  const currentGeometry: CantileverGeometry | GravityGeometry =
    wallType === "cantilever"
      ? {
          ...cantileverGeo,
          stem_height: Math.max(0.2, height - cantileverGeo.base_thickness),
          embedment,
        }
      : {
          ...gravityGeo,
          height,
          embedment,
        };

  const soilValidation: SoilStepValidation = useMemo(() => {
    const soil = soilDraft.value;
    if (!soil) {
      return { fill: [], profile: [], gwtRetained: [], gwtFront: [], gwtProfile: [], count: 0 };
    }
    const checks = validateStructureSoil(soil.retained_fill ?? [], soil.profile.layers, height);
    const gwtProfile = validateGwt(soil.profile.gwt);
    const gwtRetained = validateGwt(soil.gwt_retained);
    const gwtFront = validateGwt(soil.gwt_front);
    return {
      fill: checks.fill,
      profile: checks.profile,
      gwtRetained,
      gwtFront,
      gwtProfile,
      count:
        checks.fill.length + checks.profile.length + gwtProfile.length + gwtRetained.length + gwtFront.length,
    };
  }, [soilDraft.value, height]);

  /** Everything a run depends on; a result is stale once this differs from the value it was produced with. */
  const inputSignature = useMemo(
    () =>
      JSON.stringify([
        wallType, height, embedment, backfillSlope,
        wallType === "cantilever" ? cantileverGeo : gravityGeo,
        surcharge, sds, rFactor, includeGlobal, analysisLevel, designCode, analysisOptions, soilDraft.value,
      ]),
    [wallType, height, embedment, backfillSlope, cantileverGeo, gravityGeo, surcharge, sds, rFactor, includeGlobal, analysisLevel, designCode, analysisOptions, soilDraft.value],
  );

  // Capture the signature after the finished run's own state updates (e.g. the proposed geometry) have rendered.
  useEffect(() => {
    if (captureSig) {
      setResultSig(inputSignature);
      setCaptureSig(false);
    }
  }, [captureSig, inputSignature]);

  const handleCantileverEdit = (field: keyof CantileverGeometry, val: string | number) => {
    const num = typeof val === "number" ? val : Number.parseFloat(val);
    if (!Number.isFinite(num)) return;
    setCantileverGeo((prev) => ({ ...prev, [field]: num }));
    setGeometrySource("user");
  };

  const handleGravityEdit = (field: keyof GravityGeometry, val: string | number) => {
    const num = typeof val === "number" ? val : Number.parseFloat(val);
    if (!Number.isFinite(num)) return;
    setGravityGeo((prev) => ({ ...prev, [field]: num }));
    setGeometrySource("user");
  };

  const syncStructureBeforeRun = async (): Promise<RetainingWallStructure | null> => {
    if (!structure) return null;
    // Unsaved soil edits go with the run when valid; invalid edits block the run.
    if (soilDraft.dirty && soilValidation.count > 0) {
      setRunBlocked(t("web.wizard.run_blocked_soil"));
      return null;
    }
    setRunBlocked(null);
    const soilForRun = soilDraft.dirty && soilDraft.value ? soilDraft.value : structure.soil;
    const updated: RetainingWallStructure = {
      ...structure,
      soil: soilForRun,
      wall_type: wallType,
      height,
      embedment,
      backfill_slope: backfillSlope,
      geometry: currentGeometry,
      analysis_level: analysisLevel,
      inputs: {
        ...structure.inputs,
        surcharge,
        sds,
        r: rFactor,
        include_global_stability: includeGlobal,
      },
      settings: {
        ...applyOptions(structure.settings, analysisOptions),
        design_code: designCode,
      },
    };
    const saved = (await update_structure(structure.id, updated)) as RetainingWallStructure;
    setStructure(saved);
    if (soilDraft.dirty) soilDraft.reset(saved.soil);
    return saved;
  };

  const passiveUnconfirmed = () => analysisLevel === "advanced" && analysisOptions.use_passive && !passiveConfirmed;

  const handleSuggest = async () => {
    if (!structure || passiveUnconfirmed()) return;
    setLastRunMode("suggest");
    if (!(await syncStructureBeforeRun())) return;
    await job.start(() => size_wall(structure.id));
  };

  const handleCheck = async () => {
    if (!structure || passiveUnconfirmed()) return;
    setLastRunMode("check");
    if (!(await syncStructureBeforeRun())) return;
    await job.start(() => check_wall(structure.id));
  };

  const handleMissingFactorsSubmit = async (overrides: Record<string, number>) => {
    if (!structure) return;
    const mapped: Record<string, FactorOverride> = {
      ...(structure.settings?.factor_overrides ?? {}),
    };
    for (const [path, val] of Object.entries(overrides)) {
      mapped[path] = { value: val };
    }
    const updated: RetainingWallStructure = {
      ...structure,
      settings: {
        ...structure.settings,
        design_code: designCode,
        factor_overrides: mapped,
      },
    };
    const saved = (await update_structure(structure.id, updated)) as RetainingWallStructure;
    setStructure(saved);
  };

  if (loading && !structure) {
    return <Text size="sm">{t("web.common.loading")}</Text>;
  }

  if (loadError || !structure) {
    return (
      <Stack gap="sm">
        <Alert color="red" title={t(`error.${loadError?.code ?? "not_found"}`)}>
          <Text size="xs">{loadError?.message}</Text>
        </Alert>
        <Group>
          <Button
            size="xs"
            variant="default"
            leftSection={<IconArrowLeft size={14} />}
            onClick={() => navigate("/m/walls")}
          >
            {t("web.common.back_to_list")}
          </Button>
        </Group>
      </Stack>
    );
  }

  const isRunning = job.status === "queued" || job.status === "running";
  const jobIncomplete = job.status === "failed" || job.status === "cancelled" || isRunning;
  const staleResult =
    lastResult !== null && !captureSig && (jobIncomplete || (resultSig !== null && resultSig !== inputSignature));
  const staleReason: "inputs" | "job" = jobIncomplete ? "job" : "inputs";
  // The service writes "mühendis seçimi" for the passive reduction: it must be confirmed in this session first
  // (at the basic level the service ignores passive resistance, so nothing needs confirming).
  const passiveBlocked = analysisLevel === "advanced" && analysisOptions.use_passive && !passiveConfirmed;
  const missingFactors =
    job.error?.code === "missing_factors" || (job.error?.missing_factors.length ?? 0) > 0
      ? job.error?.missing_factors ?? []
      : [];

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <Button
            size="compact-xs"
            variant="subtle"
            leftSection={<IconArrowLeft size={14} />}
            onClick={() => navigate("/m/walls")}
          >
            {t("web.common.back_to_list")}
          </Button>
          <Title order={4}>{structure.name ?? structure.id}</Title>
          <Badge size="xs" color="blue" variant="light">
            {t("web.structures.kind.retaining_wall")}
          </Badge>
          <Badge
            size="xs"
            color={
              geometrySource === "suggested"
                ? "blue"
                : geometrySource === "user"
                  ? "teal"
                  : "gray"
            }
            variant="outline"
          >
            {t(`ui.wall.source.${geometrySource}`)}
          </Badge>
        </Group>

        <Group gap="xs">
          <Badge size="xs" variant="light">
            {analysisLevel === "advanced" ? t("ui.level.advanced") : t("ui.level.basic")}
          </Badge>
          <Badge size="xs" variant="outline" ff="monospace">
            {designCode.toUpperCase()}
          </Badge>
        </Group>
      </Group>

      <WizardStepBar
        ariaLabel={t("walls.wizard.steps")}
        labels={[
          t("web.wizard.step.geometry"),
          t("web.wizard.step.soil"),
          t("web.wizard.step.loads"),
          t("web.wizard.step.run"),
          t("web.wizard.step.result"),
        ]}
        active={activeStep}
        onSelect={setActiveStep}
      />
      <div>
        {/* Step 0: Tip/geometri */}
        {activeStep === 0 && (
<>
          <Grid gutter="sm" mt="sm">
            <Grid.Col span={{ base: 12, md: 5 }}>
            <Card withBorder padding="sm" radius="sm">
              <Stack gap="xs">
                <Text fw={600} size="sm">
                  {t("ui.wall.card.wall")} &amp; {t("ui.wall.card.geometry")}
                </Text>
                <SegmentedControl
                  size="xs"
                  value={wallType}
                  onChange={(v) => setWallType(v as WallType)}
                  data={[
                    { value: "cantilever", label: t("ui.wall.cantilever") },
                    { value: "gravity", label: t("ui.wall.gravity") },
                  ]}
                />
                <SimpleGrid cols={3} spacing="xs">
                  <NumberInput
                    size="xs"
                    label={t("ui.wall.height")}
                    value={height}
                    min={1.0}
                    max={15.0}
                    step={0.25}
                    decimalScale={2}
                    onChange={(v) => {
                      if (typeof v === "number" && Number.isFinite(v)) setHeight(v);
                    }}
                  />
                  <NumberInput
                    size="xs"
                    label={t("ui.wall.embedment")}
                    value={embedment}
                    min={0.0}
                    max={5.0}
                    step={0.1}
                    decimalScale={2}
                    onChange={(v) => {
                      if (typeof v === "number" && Number.isFinite(v)) setEmbedment(v);
                    }}
                  />
                  <NumberInput
                    size="xs"
                    label={t("ui.wall.slope")}
                    value={backfillSlope}
                    min={0.0}
                    max={30.0}
                    step={1.0}
                    decimalScale={1}
                    onChange={(v) => {
                      if (typeof v === "number" && Number.isFinite(v)) setBackfillSlope(v);
                    }}
                  />
                </SimpleGrid>

                {wallType === "cantilever" ? (
                  <SimpleGrid cols={3} spacing="xs">
                    <NumberInput
                      size="xs"
                      label={t("ui.geo.toe")}
                      value={cantileverGeo.toe}
                      min={0.0}
                      max={10.0}
                      step={0.05}
                      decimalScale={2}
                      onChange={(v) => handleCantileverEdit("toe", v)}
                    />
                    <NumberInput
                      size="xs"
                      label={t("ui.geo.heel")}
                      value={cantileverGeo.heel}
                      min={0.1}
                      max={15.0}
                      step={0.05}
                      decimalScale={2}
                      onChange={(v) => handleCantileverEdit("heel", v)}
                    />
                    <NumberInput
                      size="xs"
                      label={t("ui.geo.base_thickness")}
                      value={cantileverGeo.base_thickness}
                      min={0.1}
                      max={3.0}
                      step={0.05}
                      decimalScale={2}
                      onChange={(v) => handleCantileverEdit("base_thickness", v)}
                    />
                    <NumberInput
                      size="xs"
                      label={t("ui.geo.stem_top")}
                      value={cantileverGeo.stem_top}
                      min={0.1}
                      max={3.0}
                      step={0.05}
                      decimalScale={2}
                      onChange={(v) => handleCantileverEdit("stem_top", v)}
                    />
                    <NumberInput
                      size="xs"
                      label={t("ui.geo.stem_bottom")}
                      value={cantileverGeo.stem_bottom}
                      min={0.1}
                      max={4.0}
                      step={0.05}
                      decimalScale={2}
                      onChange={(v) => handleCantileverEdit("stem_bottom", v)}
                    />
                  </SimpleGrid>
                ) : (
                  <SimpleGrid cols={3} spacing="xs">
                    <NumberInput
                      size="xs"
                      label={t("ui.geo.base_width")}
                      value={gravityGeo.base_width}
                      min={0.2}
                      max={15.0}
                      step={0.05}
                      decimalScale={2}
                      onChange={(v) => handleGravityEdit("base_width", v)}
                    />
                    <NumberInput
                      size="xs"
                      label={t("ui.geo.top_width")}
                      value={gravityGeo.top_width}
                      min={0.1}
                      max={10.0}
                      step={0.05}
                      decimalScale={2}
                      onChange={(v) => handleGravityEdit("top_width", v)}
                    />
                    <NumberInput
                      size="xs"
                      label={t("ui.geo.back_offset")}
                      value={gravityGeo.back_offset ?? 0}
                      min={0.0}
                      max={5.0}
                      step={0.05}
                      decimalScale={2}
                      onChange={(v) => handleGravityEdit("back_offset", v)}
                    />
                  </SimpleGrid>
                )}
              </Stack>
            </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 7 }}>
            <StructureSoilSection
              wallType={wallType}
              geometry={currentGeometry}
              height={height}
              backfillSlope={backfillSlope}
              soil={soilDraft.value}
              gwtCase={gwtView}
            />
            </Grid.Col>
          </Grid>
        </>
)}

        {/* Step 1: Zemin */}
        {activeStep === 1 && (
<>
          <StructureSoilStep
            structure={structure}
            draft={soilDraft}
            validation={soilValidation}
            stale={stale}
            wallType={wallType}
            geometry={currentGeometry}
            height={height}
            backfillSlope={backfillSlope}
            gwtView={gwtView}
            onGwtViewChange={setGwtView}
            onSaved={(saved) => {
              setStructure(saved);
              soilDraft.reset(saved.soil);
              void refreshStale();
            }}
          />
          {soilDraft.value && (
            <Stack gap="sm" mt="sm">
              <PermeabilityEditor soil={soilDraft.value} onChange={(next) => soilDraft.set(next)} />
            </Stack>
          )}
        </>
)}
        {/* Step 2: Yükler/deprem */}
        {activeStep === 2 && (
<>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm" mt="sm">
            <Stack gap="sm">
            <Card withBorder padding="sm" radius="sm">
              <Stack gap="xs">
                <Text fw={600} size="sm">
                  {t("ui.wall.card.loads")}
                </Text>
                <SimpleGrid cols={3} spacing="xs">
                  <NumberInput
                    size="xs"
                    label={t("ui.wall.surcharge")}
                    value={surcharge}
                    min={0}
                    max={200}
                    step={5}
                    decimalScale={1}
                    onChange={(v) => {
                      if (typeof v === "number" && Number.isFinite(v)) setSurcharge(v);
                    }}
                  />
                  <NumberInput
                    size="xs"
                    label={t("web.project.sds")}
                    value={sds}
                    min={0}
                    max={3}
                    step={0.05}
                    decimalScale={2}
                    onChange={(v) => {
                      if (typeof v === "number" && Number.isFinite(v)) setSds(v);
                    }}
                  />
                  <NumberInput
                    size="xs"
                    label="r"
                    value={rFactor}
                    min={1.0}
                    max={2.5}
                    step={0.25}
                    decimalScale={2}
                    onChange={(v) => {
                      if (typeof v === "number" && Number.isFinite(v)) setRFactor(v);
                    }}
                  />
                </SimpleGrid>
                <Checkbox
                  size="xs"
                  label={t("ui.wall.global")}
                  checked={includeGlobal}
                  onChange={(e) => setIncludeGlobal(e.currentTarget.checked)}
                />
              </Stack>
            </Card>

            <Card withBorder padding="sm" radius="sm">
              <Stack gap="xs">
                <Text fw={600} size="sm">
                  {t("ui.code.title")} &amp; {t("ui.level")}
                </Text>
                <SegmentedControl
                  size="xs"
                  value={analysisLevel}
                  onChange={(v) => setAnalysisLevel(v as "basic" | "advanced")}
                  data={[
                    { value: "basic", label: t("ui.level.basic") },
                    { value: "advanced", label: t("ui.level.advanced") },
                  ]}
                />
                <Select
                  size="xs"
                  label={t("ui.code.code")}
                  value={designCode}
                  onChange={(v) => {
                    if (v) setDesignCode(v);
                  }}
                  data={[
                    { value: "asd", label: "ASD" },
                    { value: "tbdy2018", label: "TBDY 2018" },
                    { value: "ec7", label: "Eurocode 7" },
                    { value: "lrfd", label: "AASHTO LRFD" },
                  ]}
                />
              </Stack>
            </Card>
            </Stack>

            <AnalysisOptionsForm
              value={analysisOptions}
              onChange={setAnalysisOptions}
              level={analysisLevel}
              missingPermeability={layersWithoutPermeability(soilDraft.value)}
              passiveConfirmed={passiveConfirmed}
              onConfirmPassive={setPassiveConfirmed}
              onGoToSoil={() => setActiveStep(1)}
            />
          </SimpleGrid>
        </>
)}

        {/* Step 3: Öner/Kontrol */}
        {activeStep === 3 && (
<>
          <Stack gap="sm" mt="sm">
            <Card withBorder padding="sm" radius="sm">
              <Stack gap="sm">
                <Group justify="space-between">
                  <div>
                    <Text fw={600} size="sm">
                      {t("ui.wall.card.geometry")} ({t(`ui.wall.source.${geometrySource}`)})
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t("ui.wall.geometry_hint")}
                    </Text>
                  </div>

                  <Group gap="xs">
                    <Button
                      size="xs"
                      color="blue"
                      loading={isRunning && lastRunMode === "suggest"}
                      disabled={isRunning || passiveBlocked}
                      leftSection={<IconSparkles size={14} />}
                      onClick={() => void handleSuggest()}
                    >
                      {t("ui.wall.suggest")}
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      loading={isRunning && lastRunMode === "check"}
                      disabled={isRunning || passiveBlocked}
                      leftSection={<IconPlayerPlay size={14} />}
                      onClick={() => void handleCheck()}
                    >
                      {t("ui.wall.check")}
                    </Button>
                    {isRunning && (
                      <Button
                        size="xs"
                        color="red"
                        variant="subtle"
                        onClick={() => void job.cancel()}
                      >
                        {t("web.wizard.cancel_job")}
                      </Button>
                    )}
                  </Group>
                </Group>

                {wallType === "cantilever" ? (
                  <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="xs">
                    <NumberInput
                      size="xs"
                      label={t("ui.geo.toe")}
                      value={cantileverGeo.toe}
                      min={0}
                      max={10}
                      step={0.05}
                      decimalScale={2}
                      onChange={(v) => handleCantileverEdit("toe", v)}
                    />
                    <NumberInput
                      size="xs"
                      label={t("ui.geo.heel")}
                      value={cantileverGeo.heel}
                      min={0.1}
                      max={15}
                      step={0.05}
                      decimalScale={2}
                      onChange={(v) => handleCantileverEdit("heel", v)}
                    />
                    <NumberInput
                      size="xs"
                      label={t("ui.geo.base_thickness")}
                      value={cantileverGeo.base_thickness}
                      min={0.1}
                      max={3}
                      step={0.05}
                      decimalScale={2}
                      onChange={(v) => handleCantileverEdit("base_thickness", v)}
                    />
                    <NumberInput
                      size="xs"
                      label={t("ui.geo.stem_top")}
                      value={cantileverGeo.stem_top}
                      min={0.1}
                      max={3}
                      step={0.05}
                      decimalScale={2}
                      onChange={(v) => handleCantileverEdit("stem_top", v)}
                    />
                    <NumberInput
                      size="xs"
                      label={t("ui.geo.stem_bottom")}
                      value={cantileverGeo.stem_bottom}
                      min={0.1}
                      max={4}
                      step={0.05}
                      decimalScale={2}
                      onChange={(v) => handleCantileverEdit("stem_bottom", v)}
                    />
                  </SimpleGrid>
                ) : (
                  <SimpleGrid cols={3} spacing="xs">
                    <NumberInput
                      size="xs"
                      label={t("ui.geo.base_width")}
                      value={gravityGeo.base_width}
                      min={0.2}
                      max={15}
                      step={0.05}
                      decimalScale={2}
                      onChange={(v) => handleGravityEdit("base_width", v)}
                    />
                    <NumberInput
                      size="xs"
                      label={t("ui.geo.top_width")}
                      value={gravityGeo.top_width}
                      min={0.1}
                      max={10}
                      step={0.05}
                      decimalScale={2}
                      onChange={(v) => handleGravityEdit("top_width", v)}
                    />
                    <NumberInput
                      size="xs"
                      label={t("ui.geo.back_offset")}
                      value={gravityGeo.back_offset ?? 0}
                      min={0}
                      max={5}
                      step={0.05}
                      decimalScale={2}
                      onChange={(v) => handleGravityEdit("back_offset", v)}
                    />
                  </SimpleGrid>
                )}

                {job.status !== "idle" && (
                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Text size="xs" fw={500}>
                        {t("web.wizard.job_progress")}:{" "}
                        {job.messageKey ? t(job.messageKey) : t(`walls.job.status.${job.status}`)}
                      </Text>
                      <Text size="xs" ff="monospace">
                        {Math.round(job.progress * 100)}%
                      </Text>
                    </Group>
                    <Progress
                      value={Math.round(job.progress * 100)}
                      size="sm"
                      animated={isRunning}
                      color={job.status === "failed" ? "red" : "blue"}
                    />
                  </Stack>
                )}
              </Stack>
            </Card>

            {runBlocked && (
              <Alert color="orange" variant="light" withCloseButton onClose={() => setRunBlocked(null)}>
                <Group justify="space-between" gap="xs">
                  <Text size="xs">{runBlocked}</Text>
                  <Button size="compact-xs" variant="light" onClick={() => setActiveStep(1)}>
                    {t("web.wizard.step.soil")}
                  </Button>
                </Group>
              </Alert>
            )}

            {missingFactors.length > 0 && (
              <MissingFactorsForm
                missingFactors={missingFactors}
                onSubmit={(vals) => {
                  void handleMissingFactorsSubmit(vals);
                }}
              />
            )}

            {job.error && missingFactors.length === 0 && (
              <Alert color="red" title={t(`error.${job.error.code}`)}>
                <Text size="xs">{job.error.message}</Text>
              </Alert>
            )}

            {staleResult && <StaleNotice reason={staleReason} />}

            {passiveBlocked && (
              <Alert color="orange" variant="light" p="xs" data-testid="passive-run-blocked">
                <Group justify="space-between" gap="xs">
                  <Text size="xs">{t("walls.run.passive_unconfirmed", { value: analysisOptions.passive_reduction.toFixed(2) })}</Text>
                  <Button size="compact-xs" variant="light" onClick={() => setActiveStep(2)}>
                    {t("web.wizard.step.loads")}
                  </Button>
                </Group>
              </Alert>
            )}

            {job.status === "cancelled" && (
              <Alert color="gray" variant="light" p="xs" data-testid="job-cancelled">
                <Text size="xs">{t("walls.run.cancelled")}</Text>
              </Alert>
            )}

            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="sm">
              <WallCrossSection
                wallType={wallType}
                geometry={currentGeometry}
                height={height}
                backfillSlope={backfillSlope}
                soil={soilDraft.value}
                gwtCase={gwtView}
              />
              {lastResult && <WallCheckCards result={lastResult} mode={resultMode} stale={staleResult} />}
            </SimpleGrid>
          </Stack>
        </>
)}

        {/* Step 4: Sonuç */}
        {activeStep === 4 && (
<>
          <Stack gap="sm" mt="sm">
            {!lastResult ? (
              <EmptyState
                title={t("web.wizard.step.result")}
                description={t("web.wizard.no_result_yet")}
                action={
                  <Button size="xs" onClick={() => setActiveStep(3)}>
                    {t("web.wizard.step.run")}
                  </Button>
                }
              />
            ) : (
              <WallResultView result={lastResult} mode={resultMode} stale={staleResult} staleReason={staleReason} />
            )}
          </Stack>
        </>
)}
      </div>

      <Group justify="space-between">
        <Button
          size="xs"
          variant="default"
          disabled={activeStep === 0}
          onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
        >
          {t("web.wizard.prev")}
        </Button>
        <Button
          size="xs"
          disabled={activeStep >= 4}
          onClick={() => setActiveStep((s) => Math.min(4, s + 1))}
        >
          {t("web.wizard.next")}
        </Button>
      </Group>
    </Stack>
  );
}
