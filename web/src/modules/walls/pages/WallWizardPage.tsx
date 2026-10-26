import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Group,
  NumberInput,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { IconArrowLeft, IconPlayerPlay, IconSparkles } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  get_structure,
  list_codes,
  list_structures,
  update_structure,
} from "../../../shared/api/client";
import { check_wall, size_wall } from "../api";
import type {
  CantileverGeometry,
  DesignCodeSummary,
  FactorOverride,
  GravityGeometry,
  RetainingWallStructure,
  StructureSoilModel,
  WallResultDTO,
  WallSettings,
  WallType,
} from "../../../shared/api/types";
import { ToggleRow } from "../../../shared/components/ToggleRow";
import { ActionBar } from "../../../shared/components/ActionBar";
import { CollapsibleSection } from "../../../shared/components/CollapsibleSection";
import { EmptyState } from "../../../shared/components/EmptyState";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";
import { FieldNote } from "../../../shared/components/FieldNote";
import { MissingFactorsForm } from "../../../shared/components/MissingFactorsForm";
import { PageHeader } from "../../../shared/components/PageHeader";
import { SectionCard } from "../../../shared/components/SectionCard";
import { StatusChip } from "../../../shared/components/StatusChip";
import { VerdictBanner } from "../../../shared/components/VerdictBanner";
import { useJob } from "../../../shared/hooks/useJob";
import { usePreSaveHook } from "../../../shared/hooks/usePreSaveHook";
import { useUndoable } from "../../../shared/hooks/useUndoable";
import { validateGwt, validateStructureSoil } from "../../../shared/soil/layerOps";
import type { GwtCase } from "../../../shared/soil/zones";
import { StructureSoilStep, type SoilStepValidation } from "../../../shared/structureSoil/StructureSoilStep";
import { AnalysisOptionsForm } from "../components/AnalysisOptionsForm";
import { DimensionField } from "../components/DimensionField";
import { PermeabilityEditor } from "../components/PermeabilityEditor";
import { ShearKeyFields } from "../components/ShearKeyFields";
import { WALL_MARKER_FIELDS } from "../components/sectionLayout";
import { WallCheckCards } from "../components/WallCheckCards";
import { WallCrossSection } from "../components/WallCrossSection";
import { StaleNotice, WallResultView } from "../components/WallResultView";
import { WizardStepBar } from "../components/WizardStepBar";
import { ANALYSIS_DEFAULTS, applyOptions, layersWithoutPermeability, optionsFromSettings } from "../settings";
import type { AnalysisOptions } from "../types";

type GeometrySource = "draft" | "suggested" | "user";

/** Backend WallDesignInputs: S_DS in (0, 3); null = no seismic case. */
const sdsInRange = (v: number | null) => v === null || (v > 0 && v < 3);
/** Backend WallDesignInputs: r in (0, 2]; null = by wall type (TBDY Table 16.7). */
const rInRange = (v: number | null) => v === null || (v > 0 && v <= 2);

/** An emptied field is null (no value is assumed); other non-numbers are ignored. */
const setNullable = (v: string | number, set: (next: number | null) => void) => {
  if (v === "") set(null);
  else if (typeof v === "number" && Number.isFinite(v)) set(v);
};

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
  /** Dimension input that has focus; its callout is highlighted on the drawing. */
  const [focusField, setFocusField] = useState<string | null>(null);

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
  const [surchargeBasis, setSurchargeBasis] = useState<"horizontal" | "inclined">("horizontal");
  const [sds, setSds] = useState<number | null>(null);
  const [rFactor, setRFactor] = useState<number | null>(null);
  const [includeGlobal, setIncludeGlobal] = useState<boolean>(true);
  const [analysisLevel, setAnalysisLevel] = useState<"basic" | "advanced">("basic");
  const [designCode, setDesignCode] = useState<string>("asd");
  const [codes, setCodes] = useState<DesignCodeSummary[]>([]);

  const [lastResult, setLastResult] = useState<WallResultDTO | null>(null);
  /** The shown result is the one stored in the project, not one produced in this session. */
  const [resultFromStore, setResultFromStore] = useState<boolean>(false);
  const [lastRunMode, setLastRunMode] = useState<"suggest" | "check">("suggest");
  const [analysisOptions, setAnalysisOptions] = useState<AnalysisOptions>({ ...ANALYSIS_DEFAULTS });
  const [passiveConfirmed, setPassiveConfirmed] = useState<boolean>(false);
  /** Inputs signature at the moment the shown result was produced (see `inputSignature`). */
  const [resultSig, setResultSig] = useState<string | null>(null);
  const [captureSig, setCaptureSig] = useState<boolean>(false);
  /** Inputs signature of what the stored structure holds; differs from `inputSignature` while a draft is unsaved. */
  const [savedSig, setSavedSig] = useState<string | null>(null);
  const [captureSaved, setCaptureSaved] = useState<boolean>(false);

  const job = useJob<WallResultDTO>();

  const soilDraft = useUndoable<StructureSoilModel | null>(null);
  const [stale, setStale] = useState<boolean>(false);
  const [gwtView, setGwtView] = useState<GwtCase>("design");
  const [runBlocked, setRunBlocked] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  /** Save + job start in flight; the ref also stops a second click before the re-render. */
  const [pending, setPending] = useState<boolean>(false);
  const pendingRef = useRef<boolean>(false);

  useEffect(() => {
    let active = true;
    void list_codes()
      .then((items) => {
        if (active) setCodes(items);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

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
      setSurcharge(wall.inputs?.surcharge ?? 0);
      setSurchargeBasis(wall.inputs?.surcharge_basis ?? "horizontal");
      setSds(wall.inputs?.sds ?? null);
      setRFactor(wall.inputs?.r ?? null);
      setIncludeGlobal(wall.inputs?.include_global_stability ?? true);
      setAnalysisLevel(wall.analysis_level ?? "basic");
      setDesignCode(wall.settings?.design_code ?? "asd");
      setAnalysisOptions(optionsFromSettings(wall.settings));
      setPassiveConfirmed(false);
      // The project keeps the last result: show it (the summary's stale flag marks it out of date).
      const stored = wall.result ?? null;
      setLastResult(stored);
      setResultFromStore(stored !== null);
      if (stored) setCaptureSig(true);
      setCaptureSaved(true);
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
      setResultFromStore(false);
      setCaptureSig(true);
      setCaptureSaved(true);
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

  // The finished job stored its result (and a sized geometry) in the project: take the fresh copy, so a
  // later save (PUT replaces the whole structure) does not write the previous result back.
  useEffect(() => {
    if (job.status !== "done" || !id) return;
    let active = true;
    get_structure(id).then(
      (fresh) => {
        if (active) setStructure(fresh as RetainingWallStructure);
      },
      () => undefined,
    );
    void refreshStale();
    return () => {
      active = false;
    };
  }, [job.status, id, refreshStale]);

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
        surcharge, surchargeBasis, sds, rFactor, includeGlobal, analysisLevel, designCode, analysisOptions, soilDraft.value,
      ]),
    [wallType, height, embedment, backfillSlope, cantileverGeo, gravityGeo, surcharge, surchargeBasis, sds, rFactor, includeGlobal, analysisLevel, designCode, analysisOptions, soilDraft.value],
  );

  // Capture the signature after the finished run's own state updates (e.g. the proposed geometry) have rendered.
  useEffect(() => {
    if (captureSig) {
      setResultSig(inputSignature);
      setCaptureSig(false);
    }
  }, [captureSig, inputSignature]);

  // The stored structure now equals the form (after load, a run's own save, or the top Save).
  useEffect(() => {
    if (captureSaved) {
      setSavedSig(inputSignature);
      setCaptureSaved(false);
    }
  }, [captureSaved, inputSignature]);

  const formDirty = savedSig !== null && !captureSaved && savedSig !== inputSignature;

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

  /** Saves the form into the structure; `settingsPatch` (e.g. entered missing factors) goes in the same PUT. */
  const syncStructureBeforeRun = async (
    settingsPatch: Partial<WallSettings> = {},
  ): Promise<RetainingWallStructure | null> => {
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
        surcharge_basis: surchargeBasis,
        sds,
        r: rFactor,
        include_global_stability: includeGlobal,
      },
      settings: {
        ...applyOptions(structure.settings, analysisOptions),
        design_code: designCode,
        ...settingsPatch,
      },
    };
    const saved = (await update_structure(structure.id, updated)) as RetainingWallStructure;
    setStructure(saved);
    if (soilDraft.dirty) soilDraft.reset(saved.soil);
    setCaptureSaved(true);
    return saved;
  };

  /** Top project Save: persist the on-screen load/seismic/geometry draft into the structure first. */
  usePreSaveHook(async () => {
    if (!structure || !formDirty) return;
    if (seismicInvalid) throw new Error(t("web.wizard.save_blocked_seismic"));
    const saved = await syncStructureBeforeRun();
    if (!saved) throw new Error(t("web.wizard.save_blocked_soil"));
    void refreshStale();
  });

  const passiveUnconfirmed = () => analysisLevel === "advanced" && analysisOptions.use_passive && !passiveConfirmed;
  const seismicInvalid = !sdsInRange(sds) || !rInRange(rFactor);

  /** Save, then start the job; a save failure is shown and a second click while pending is ignored. */
  const runJob = async (mode: "suggest" | "check", settingsPatch?: Partial<WallSettings>) => {
    if (!structure || passiveUnconfirmed() || seismicInvalid || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setActionError(null);
    setLastRunMode(mode);
    try {
      const saved = await syncStructureBeforeRun(settingsPatch);
      if (!saved) return;
      await job.start(() => (mode === "suggest" ? size_wall(saved.id) : check_wall(saved.id)));
    } catch (err) {
      setActionError(err);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const handleSuggest = () => runJob("suggest");
  const handleCheck = () => runJob("check");

  /** Stores the entered factors with the form and re-runs the calculation that asked for them. */
  const handleMissingFactorsSubmit = async (overrides: Record<string, number>) => {
    if (!structure) return;
    const mapped: Record<string, FactorOverride> = {
      ...(structure.settings?.factor_overrides ?? {}),
    };
    for (const [path, val] of Object.entries(overrides)) {
      mapped[path] = { value: val };
    }
    await runJob(lastRunMode, { factor_overrides: mapped });
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
    lastResult !== null &&
    !captureSig &&
    (jobIncomplete || (resultSig !== null && resultSig !== inputSignature) || (resultFromStore && stale));
  const staleReason: "inputs" | "job" = jobIncomplete ? "job" : "inputs";
  const busy = isRunning || pending;
  // Options come from the codes API; a stored id the server no longer lists stays visible as itself.
  const codeOptions = codes.map((c) => ({ value: c.id, label: c.name }));
  if (!codes.some((c) => c.id === designCode)) codeOptions.push({ value: designCode, label: designCode });
  // The service writes "mühendis seçimi" for the passive reduction: it must be confirmed in this session first
  // (at the basic level the service ignores passive resistance, so nothing needs confirming).
  const passiveBlocked = analysisLevel === "advanced" && analysisOptions.use_passive && !passiveConfirmed;
  const missingFactors =
    job.error?.code === "missing_factors" || (job.error?.missing_factors.length ?? 0) > 0
      ? job.error?.missing_factors ?? []
      : [];

  const markerFields = WALL_MARKER_FIELDS[wallType];
  const markerN = (field: string) => {
    const i = markerFields.indexOf(field);
    return i < 0 ? undefined : i + 1;
  };
  const finite = (set: (v: number) => void) => (v: string | number) => {
    if (typeof v === "number" && Number.isFinite(v)) set(v);
  };

  const baseWidth = wallType === "cantilever" ? cantileverGeo.toe + cantileverGeo.stem_bottom + cantileverGeo.heel : gravityGeo.base_width;
  const resultChip = lastResult === null ? (
    <StatusChip tone="neutral">{t("walls.status.draft")}</StatusChip>
  ) : staleResult ? (
    <StatusChip tone="stale">{t("walls.status.stale")}</StatusChip>
  ) : (
    <StatusChip tone="current">{t("walls.status.current")}</StatusChip>
  );

  const stepLabels = [
    t("walls.wizard.step.geometry"),
    t("walls.wizard.step.soil"),
    t("walls.wizard.step.loads"),
    t("walls.wizard.step.run"),
    t("walls.wizard.step.result"),
  ];

  /** Dimension inputs of the wall; `grouped` adds the Height / Base / Stem headings of the first step. */
  const dimensionFields = (grouped: boolean) => {
  const dim = (
    field: string,
    label: string,
    value: number,
    onChange: (v: string | number) => void,
    opts: { min?: number; max?: number; step?: number; decimalScale?: number; unit?: string } = {},
  ) => (
    <DimensionField
      key={field}
      field={field}
      label={label}
      value={value}
      n={grouped ? markerN(field) : undefined}
      focused={focusField === field}
      onFocusField={setFocusField}
      onChange={onChange}
      {...opts}
    />
  );
    const heading = (key: string) => (grouped ? <SubHeading>{t(key)}</SubHeading> : null);
    const cols = (nodes: ReactNode[]) => <SimpleGrid cols={3} spacing="sm">{nodes}</SimpleGrid>;
    return (
      <>
        {heading("walls.geo.group.height")}
        {cols([
          dim("height", t("ui.wall.height"), height, finite(setHeight), { min: 1, max: 15, step: 0.25 }),
          dim("embedment", t("walls.geo.embedment"), embedment, finite(setEmbedment), { min: 0, max: 5, step: 0.1 }),
          dim("slope", t("ui.wall.slope"), backfillSlope, finite(setBackfillSlope), { min: 0, max: 30, step: 1, decimalScale: 1, unit: "°" }),
        ])}
        {heading("walls.geo.group.base")}
        {wallType === "cantilever"
          ? cols([
              dim("toe", t("ui.geo.toe"), cantileverGeo.toe, (v) => handleCantileverEdit("toe", v), { min: 0, max: 10, step: 0.05 }),
              dim("heel", t("ui.geo.heel"), cantileverGeo.heel, (v) => handleCantileverEdit("heel", v), { min: 0.1, max: 15, step: 0.05 }),
              dim("base_thickness", t("walls.geo.base_thickness"), cantileverGeo.base_thickness, (v) => handleCantileverEdit("base_thickness", v), { min: 0.1, max: 3, step: 0.05 }),
            ])
          : cols([dim("base_width", t("ui.geo.base_width"), gravityGeo.base_width, (v) => handleGravityEdit("base_width", v), { min: 0.2, max: 15, step: 0.05 })])}
        {heading("walls.geo.group.stem")}
        {wallType === "cantilever"
          ? cols([
              dim("stem_top", t("walls.geo.stem_top"), cantileverGeo.stem_top, (v) => handleCantileverEdit("stem_top", v), { min: 0.1, max: 3, step: 0.05 }),
              dim("stem_bottom", t("walls.geo.stem_bottom"), cantileverGeo.stem_bottom, (v) => handleCantileverEdit("stem_bottom", v), { min: 0.1, max: 4, step: 0.05 }),
            ])
          : cols([
              dim("top_width", t("ui.geo.top_width"), gravityGeo.top_width, (v) => handleGravityEdit("top_width", v), { min: 0.1, max: 10, step: 0.05 }),
              dim("back_offset", t("ui.geo.back_offset"), gravityGeo.back_offset ?? 0, (v) => handleGravityEdit("back_offset", v), { min: 0, max: 5, step: 0.05 }),
            ])}
      </>
    );
  };

  const nextStepLabel = activeStep < 4 ? stepLabels[activeStep + 1] : null;

  return (
    <Stack gap="md">
      <PageHeader
        back={{ to: "/m/walls", label: t("walls.wizard.back") }}
        title={structure.name ?? structure.id}
        status={resultChip}
        actions={
          <StatusChip tone="neutral" dot={false}>
            {(analysisLevel === "advanced" ? t("ui.level.advanced") : t("ui.level.basic")) + " · " + designCode.toUpperCase()}
          </StatusChip>
        }
      />

      <WizardStepBar ariaLabel={t("walls.wizard.steps")} labels={stepLabels} active={activeStep} onSelect={setActiveStep} />

      <div>
        {/* Step 0: type and dimensions */}
        {activeStep === 0 && (
          <Group align="flex-start" gap="md" wrap="wrap">
            <Box style={{ flex: "1 1 380px", maxWidth: 480, minWidth: 0 }}>
              <SectionCard title={t("walls.geo.title")} aside={<StatusChip tone="neutral" dot={false}>{t(`ui.wall.source.${geometrySource}`)}</StatusChip>}>
                <Text fz={13} fw={500} mb={4}>{t("walls.geo.type")}</Text>
                <SegmentedControl
                  fullWidth
                  value={wallType}
                  onChange={(v) => setWallType(v as WallType)}
                  aria-label={t("walls.geo.type")}
                  data={[
                    { value: "cantilever", label: t("ui.wall.cantilever") },
                    { value: "gravity", label: t("ui.wall.gravity") },
                  ]}
                />
                {dimensionFields(true)}
                <Box mt="md">
                  <ShearKeyFields
                    value={wallType === "cantilever" ? cantileverGeo.key : gravityGeo.key}
                    baseWidth={baseWidth}
                    onChange={(key) => {
                      if (wallType === "cantilever") setCantileverGeo((prev) => ({ ...prev, key }));
                      else setGravityGeo((prev) => ({ ...prev, key }));
                      setGeometrySource("user");
                    }}
                  />
                </Box>
              </SectionCard>
            </Box>

            <Box style={{ flex: "999 1 480px", minWidth: 0 }}>
              <SectionCard
                title={t("walls.geo.section")}
                aside={
                  <Group gap={6}>
                    <StatusChip tone="info" dot={false}>B = {baseWidth.toFixed(2)} m</StatusChip>
                    {wallType === "cantilever" && (
                      <StatusChip tone="neutral" dot={false}>
                        {t("walls.geo.stem_height_chip", { value: currentGeometry && "stem_height" in currentGeometry ? currentGeometry.stem_height.toFixed(2) : "" })}
                      </StatusChip>
                    )}
                  </Group>
                }
              >
                <WallCrossSection
                  bare
                  hideTitle
                  markers
                  focusField={focusField}
                  wallType={wallType}
                  geometry={currentGeometry}
                  height={height}
                  backfillSlope={backfillSlope}
                  soil={soilDraft.value}
                  gwtCase={gwtView}
                />
                <FieldNote kind="help">{t("walls.geo.focus_hint")}</FieldNote>
              </SectionCard>
            </Box>
          </Group>
        )}

        {/* Step 1: soil */}
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

        {/* Step 2: loads and earthquake */}
        {activeStep === 2 && (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <SectionCard title={t("walls.loads.title")}>
              <Stack gap="md">
                <SimpleGrid cols={2} spacing="sm">
                  <DimensionField
                    field="surcharge"
                    label={t("ui.wall.surcharge")}
                    unit="kPa"
                    value={surcharge}
                    min={0}
                    max={200}
                    step={5}
                    decimalScale={1}
                    onChange={finite(setSurcharge)}
                  />
                  <Select
                    label={t("walls.loads.surcharge_basis")}
                    allowDeselect={false}
                    data={[
                      { value: "horizontal", label: t("walls.loads.surcharge_basis_horizontal") },
                      { value: "inclined", label: t("walls.loads.surcharge_basis_inclined") },
                    ]}
                    value={surchargeBasis}
                    onChange={(v) => setSurchargeBasis((v as "horizontal" | "inclined") ?? "horizontal")}
                  />
                </SimpleGrid>
                <Text fz={12} c="dimmed" mt={-8}>{t("walls.loads.surcharge_basis_hint")}</Text>
                <SimpleGrid cols={2} spacing="sm">
                  <Box>
                    <NumberInput
                      label={t("web.project.sds")}
                      error={sdsInRange(sds) ? undefined : t("walls.loads.sds_range")}
                      value={sds ?? ""}
                      step={0.05}
                      decimalScale={3}
                      onChange={(v) => setNullable(v, setSds)}
                    />
                    {sdsInRange(sds) && <FieldNote kind="help">{t("walls.loads.sds_hint")}</FieldNote>}
                  </Box>
                  <Box>
                    <NumberInput
                      label="r"
                      error={rInRange(rFactor) ? undefined : t("walls.loads.r_range")}
                      value={rFactor ?? ""}
                      step={0.1}
                      decimalScale={2}
                      onChange={(v) => setNullable(v, setRFactor)}
                    />
                    {rInRange(rFactor) && <FieldNote kind="help">{t("walls.loads.r_hint")}</FieldNote>}
                  </Box>
                </SimpleGrid>
                <ToggleRow
                  checked={includeGlobal}
                  onChange={setIncludeGlobal}
                  label={t("walls.loads.global")}
                  hint={t("walls.loads.global_hint")}
                />
              </Stack>
            </SectionCard>

            <SectionCard title={t("walls.code.title")}>
              <Stack gap="md">
                <Box>
                  <Text fz={13} fw={500} mb={4}>{t("ui.level")}</Text>
                  <SegmentedControl
                    fullWidth
                    value={analysisLevel}
                    onChange={(v) => setAnalysisLevel(v as "basic" | "advanced")}
                    aria-label={t("ui.level")}
                    data={[
                      { value: "basic", label: t("ui.level.basic") },
                      { value: "advanced", label: t("ui.level.advanced") },
                    ]}
                  />
                </Box>
                <Select
                  label={t("ui.code.code")}
                  value={designCode}
                  onChange={(v) => {
                    if (v) setDesignCode(v);
                  }}
                  data={codeOptions}
                />
              </Stack>
              <CollapsibleSection label={t("walls.options.advanced")} defaultOpened={analysisLevel === "advanced" && analysisOptions.use_passive}>
                <AnalysisOptionsForm
                  value={analysisOptions}
                  onChange={setAnalysisOptions}
                  level={analysisLevel}
                  missingPermeability={layersWithoutPermeability(soilDraft.value)}
                  passiveConfirmed={passiveConfirmed}
                  onConfirmPassive={setPassiveConfirmed}
                  onGoToSoil={() => setActiveStep(1)}
                />
              </CollapsibleSection>
            </SectionCard>
          </SimpleGrid>
        )}

        {/* Step 3: size / check */}
        {activeStep === 3 && (
          <Stack gap="md">
            <SectionCard
              title={t("walls.run.title")}
              aside={
                <Group gap="xs">
                  <Button
                    loading={busy && lastRunMode === "suggest"}
                    disabled={busy || passiveBlocked || seismicInvalid}
                    leftSection={<IconSparkles size={16} />}
                    onClick={() => void handleSuggest()}
                  >
                    {t("ui.wall.suggest")}
                  </Button>
                  <Button
                    variant="default"
                    loading={busy && lastRunMode === "check"}
                    disabled={busy || passiveBlocked || seismicInvalid}
                    leftSection={<IconPlayerPlay size={16} />}
                    onClick={() => void handleCheck()}
                  >
                    {t("ui.wall.check")}
                  </Button>
                  {isRunning && (
                    <Button color="red" variant="subtle" onClick={() => void job.cancel()}>
                      {t("web.wizard.cancel_job")}
                    </Button>
                  )}
                </Group>
              }
            >
              <Text size="sm" c="dimmed" mb="sm">{t("walls.run.geometry_hint")}</Text>
              {dimensionFields(false)}
              {job.status !== "idle" && (
                <Stack gap={4} mt="md">
                  <Group justify="space-between">
                    <Text size="xs" fw={500}>
                      {t("walls.run.progress")}: {job.messageKey ? t(job.messageKey) : t(`walls.job.status.${job.status}`)}
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
            </SectionCard>

            {runBlocked && (
              <VerdictBanner
                tone="warn"
                title={runBlocked}
                action={
                  <Button variant="default" size="compact-sm" onClick={() => setActiveStep(1)}>
                    {t("walls.wizard.step.soil")}
                  </Button>
                }
              />
            )}

            {missingFactors.length > 0 && (
              <MissingFactorsForm
                missingFactors={missingFactors}
                onSubmit={(vals) => {
                  void handleMissingFactorsSubmit(vals);
                }}
              />
            )}

            {job.error && missingFactors.length === 0 && <ErrorAlert error={job.error} />}

            {actionError != null && <ErrorAlert error={actionError} />}

            {seismicInvalid && (
              <div data-testid="seismic-run-blocked">
                <VerdictBanner
                  tone="warn"
                  title={t("walls.run.seismic_invalid")}
                  action={
                    <Button variant="default" size="compact-sm" onClick={() => setActiveStep(2)}>
                      {t("walls.wizard.step.loads")}
                    </Button>
                  }
                />
              </div>
            )}

            {staleResult && <StaleNotice reason={staleReason} />}

            {passiveBlocked && (
              <div data-testid="passive-run-blocked">
                <VerdictBanner
                  tone="warn"
                  title={t("walls.run.passive_unconfirmed", { value: analysisOptions.passive_reduction.toFixed(2) })}
                  action={
                    <Button variant="default" size="compact-sm" onClick={() => setActiveStep(2)}>
                      {t("walls.wizard.step.loads")}
                    </Button>
                  }
                />
              </div>
            )}

            {job.status === "cancelled" && (
              <div data-testid="job-cancelled">
                <VerdictBanner tone="info" title={t("walls.run.cancelled")} />
              </div>
            )}

            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
              <WallCrossSection
                wallType={wallType}
                geometry={currentGeometry}
                height={height}
                backfillSlope={backfillSlope}
                soil={soilDraft.value}
                gwtCase={gwtView}
              />
              {lastResult && <WallCheckCards result={lastResult} stale={staleResult} />}
            </SimpleGrid>
          </Stack>
        )}

        {/* Step 4: result */}
        {activeStep === 4 && (
          <Stack gap="sm">
            {!lastResult ? (
              <EmptyState
                title={t("walls.wizard.step.result")}
                description={t("walls.wizard.no_result_yet")}
                action={
                  <Button onClick={() => setActiveStep(3)}>
                    {t("walls.wizard.step.run")}
                  </Button>
                }
              />
            ) : (
              <WallResultView
                result={lastResult}
                stale={staleResult}
                staleReason={staleReason}
                onEditGeometry={() => setActiveStep(0)}
                onRerun={() => setActiveStep(3)}
              />
            )}
          </Stack>
        )}
      </div>

      <ActionBar text={t("walls.wizard.progress", { n: activeStep + 1, total: stepLabels.length })}>
        <Group gap="xs">
          {activeStep > 0 && (
            <Button variant="default" onClick={() => setActiveStep((s) => Math.max(0, s - 1))}>
              {t("walls.wizard.prev")}
            </Button>
          )}
          {nextStepLabel && (
            <Button onClick={() => setActiveStep((s) => Math.min(4, s + 1))}>
              {t("walls.wizard.next", { step: nextStepLabel })}
            </Button>
          )}
        </Group>
      </ActionBar>
    </Stack>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return (
    <Text fz={12} fw={600} c="dimmed" tt="uppercase" mt="md" mb={8} style={{ letterSpacing: "0.06em" }}>
      {children}
    </Text>
  );
}
