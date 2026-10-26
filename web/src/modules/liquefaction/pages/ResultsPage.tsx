import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Box, Button, Group, Progress, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, cancel_job, get_job } from "../../../shared/api/client";
import type {
  JobState,
  LiquefactionResultDTO,
  LiquefactionSettingsDTO,
  StoredLiquefactionDTO,
} from "../../../shared/api/types";
import { EmptyState } from "../../../shared/components/EmptyState";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";
import { KpiTile } from "../../../shared/components/KpiTile";
import { PageHeader } from "../../../shared/components/PageHeader";
import { SectionCard } from "../../../shared/components/SectionCard";
import { StatusChip, type StatusTone } from "../../../shared/components/StatusChip";
import { VerdictBanner, type VerdictTone } from "../../../shared/components/VerdictBanner";
import { get_liquefaction_result } from "../api";
import { SoundingDetail } from "../components/SoundingDetail";

const POLL_MS = 300;
const TERMINAL = new Set<JobState["status"]>(["done", "failed", "cancelled"]);
const MOCK_WARNING = "mock_result_not_a_calculation";

type Translate = (key: string, opts?: Record<string, unknown>) => string;
type Sounding = LiquefactionResultDTO["per_sounding"][string];

interface SoundingSummary {
  id: string;
  minFs: number | null;
  /** Depth of the point with the smallest FS; null when that depth is unknown. */
  minDepth: number | null;
  lpi: number | null;
  category: Sounding["LPI_category"] | null;
  incomplete: boolean;
  liquefiable: number;
  total: number;
}

const finite = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

function summarize(id: string, s: Sounding): SoundingSummary {
  let minFs: number | null = null;
  let minDepth: number | null = null;
  s.FS.forEach((value, i) => {
    if (!finite(value)) return;
    if (minFs === null || value < minFs) {
      minFs = value;
      minDepth = finite(s.depth[i]) ? s.depth[i] : null;
    }
  });
  return {
    id,
    minFs,
    minDepth,
    lpi: finite(s.LPI) ? s.LPI : null,
    category: s.LPI_category ?? null,
    incomplete: Boolean(s.LPI_incomplete),
    liquefiable: s.status.filter((x) => x === "liquefiable").length,
    total: s.status.length,
  };
}

const CATEGORY_TONE: Record<NonNullable<Sounding["LPI_category"]>, StatusTone> = {
  very_low: "current",
  low: "current",
  high: "stale",
  very_high: "bad",
};

interface Verdict {
  tone: VerdictTone;
  title: string;
  text?: string;
}

/** One sentence about the whole result; every number and name in it comes from the result itself. */
function buildVerdict(summaries: SoundingSummary[], errorCount: number, t: Translate): Verdict {
  const liquefiable = summaries.reduce((sum, s) => sum + s.liquefiable, 0);
  const withFs = summaries.filter((s) => s.minFs !== null);
  const worst = withFs.reduce<SoundingSummary | null>((acc, s) => (acc === null || (s.minFs as number) < (acc.minFs as number) ? s : acc), null);
  const parts: string[] = [];
  if (worst) {
    const fs = (worst.minFs as number).toFixed(2);
    parts.push(
      worst.minDepth === null
        ? t("liquefaction.results.verdict.min_fs_no_depth", { fs, id: worst.id })
        : t("liquefaction.results.verdict.min_fs", { fs, id: worst.id, depth: worst.minDepth.toFixed(1) }),
    );
  }
  const categories = summaries.filter((s) => s.category !== null);
  if (categories.length > 0) {
    const list = categories.map((s) => `${s.id}: ${t(`liquefaction.results.lpi_category.${s.category}`)}`).join(" · ");
    parts.push(t("liquefaction.results.verdict.lpi", { list }));
  }
  const text = parts.length > 0 ? parts.join(" ") : undefined;
  if (liquefiable > 0) {
    const severe = summaries.some((s) => s.category === "high" || s.category === "very_high");
    return { tone: severe ? "bad" : "warn", title: t("liquefaction.results.verdict.liquefiable", { count: liquefiable }), text };
  }
  if (errorCount > 0) {
    return { tone: "warn", title: t("liquefaction.results.verdict.none_with_errors", { count: errorCount }), text };
  }
  if (worst) return { tone: "ok", title: t("liquefaction.results.verdict.none"), text };
  return { tone: "info", title: t("liquefaction.results.verdict.no_fs"), text: t("liquefaction.results.verdict.no_fs_hint") };
}

export function ResultsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const jobId = params.get("job");

  const [state, setState] = useState<JobState | null>(null);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [stored, setStored] = useState<StoredLiquefactionDTO | "none" | null>(null);
  /** Stale flag and settings of the project's stored result once the job is done (soil edited since the run). */
  const [doneStale, setDoneStale] = useState(false);
  const [doneSettings, setDoneSettings] = useState<LiquefactionSettingsDTO | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!jobId) return;
    const mine = ++seq.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setState(null);
    setGone(false);
    setError(null);
    const tick = async () => {
      try {
        const s = await get_job(jobId);
        if (mine !== seq.current) return;
        setState(s);
        if (!TERMINAL.has(s.status)) timer = setTimeout(tick, POLL_MS);
      } catch (err) {
        if (mine !== seq.current) return;
        if (err instanceof ApiError && err.status === 404) setGone(true);
        else setError(err);
      }
    };
    void tick();
    return () => {
      seq.current += 1;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  const needStored = !jobId || gone;
  useEffect(() => {
    if (!needStored) return;
    let live = true;
    setStored(null);
    get_liquefaction_result().then(
      (r) => { if (live) setStored(r); },
      (err) => {
        if (!live) return;
        if (err instanceof ApiError && err.status === 404) setStored("none");
        else setError(err);
      },
    );
    return () => { live = false; };
  }, [needStored]);

  const jobDone = state?.status === "done";
  useEffect(() => {
    if (!jobDone) return;
    let live = true;
    setDoneStale(false);
    setDoneSettings(null);
    // The finished job saved its result in the project; the stored copy carries the stale flag.
    get_liquefaction_result().then(
      (r) => {
        if (!live) return;
        setDoneStale(r.stale);
        setDoneSettings(r.settings ?? null);
      },
      () => undefined,
    );
    return () => { live = false; };
  }, [jobDone, jobId]);

  const cancel = useCallback(async () => {
    if (!jobId) return;
    try {
      setState(await cancel_job(jobId));
    } catch (err) {
      setError(err);
    }
  }, [jobId]);

  const back = (
    <Button variant="default" onClick={() => navigate("/m/liquefaction")}>
      {t("liquefaction.results.back")}
    </Button>
  );

  if (needStored && error == null) {
    if (stored === null) return <Text size="sm">{t("web.common.loading")}</Text>;
    if (stored !== "none") return <ResultBody result={stored.result} stale={stored.stale} settings={stored.settings} back={back} />;
    return (
      <EmptyState title={t("liquefaction.results.title")}
        description={t(jobId ? "liquefaction.results.unavailable" : "liquefaction.results.no_job")} action={back} />
    );
  }
  if (error != null) {
    return (
      <Stack gap="md" maw={1120}>
        <ErrorAlert error={error} />
        {back}
      </Stack>
    );
  }
  if (!state) return <Text size="sm">{t("web.common.loading")}</Text>;

  if (state.status === "failed") {
    return (
      <Stack gap="md" maw={1120}>
        <PageHeader title={t("liquefaction.results.title")} actions={back} />
        {state.error ? <ErrorAlert error={new ApiError(400, state.error)} /> : <Alert color="red">{t("liquefaction.results.failed")}</Alert>}
      </Stack>
    );
  }
  if (state.status === "cancelled") {
    return <EmptyState title={t("liquefaction.results.title")} description={t("liquefaction.results.cancelled")} action={back} />;
  }
  if (state.status !== "done") {
    return (
      <Stack gap="md" maw={1120}>
        <PageHeader title={t("liquefaction.results.title")} />
        <SectionCard title={t("liquefaction.results.running")}>
          <Stack gap="sm">
            <Progress value={Math.round(state.progress * 100)} />
            <Text size="sm">{state.message_key ? t(state.message_key) : t("liquefaction.results.running")}</Text>
            <Group>
              <Button variant="default" onClick={cancel}>
                {t("liquefaction.results.cancel")}
              </Button>
            </Group>
          </Stack>
        </SectionCard>
      </Stack>
    );
  }

  return <ResultBody result={state.result as LiquefactionResultDTO | null} stale={doneStale} settings={doneSettings} back={back} />;
}

interface ResultBodyProps {
  result: LiquefactionResultDTO | null;
  stale?: boolean;
  settings?: LiquefactionSettingsDTO | null;
  back: ReactNode;
}

function ResultBody({ result, stale, settings, back }: ResultBodyProps) {
  const { t } = useTranslation();
  const [selectedSounding, setSelectedSounding] = useState<string | null>(null);
  const ids = result ? Object.keys(result.per_sounding) : [];
  const errors = result ? Object.entries(result.errors) : [];
  const activeSounding = selectedSounding && ids.includes(selectedSounding) ? selectedSounding : ids[0];
  if (!result || (ids.length === 0 && errors.length === 0)) {
    return <EmptyState title={t("liquefaction.results.title")} description={t("liquefaction.results.empty")} action={back} />;
  }

  const summaries = ids.map((id) => summarize(id, result.per_sounding[id]));
  const isMock = ids.some((id) => result.per_sounding[id].warnings.includes(MOCK_WARNING));
  const verdict = buildVerdict(summaries, errors.length, t as unknown as Translate);

  return (
    <Stack gap="md" maw={1120}>
      <PageHeader
        title={t("liquefaction.results.title")}
        lead={t("liquefaction.results.lead")}
        status={(
          <Group gap={6}>
            <StatusChip tone={stale ? "stale" : "current"}>{t(stale ? "liquefaction.results.chip_stale" : "liquefaction.results.chip_current")}</StatusChip>
            {isMock && <StatusChip tone="info">{t("liquefaction.results.chip_mock")}</StatusChip>}
          </Group>
        )}
        actions={back}
      />
      {stale && (
        <div data-testid="liq-stale">
          <VerdictBanner tone="warn" title={t("liquefaction.results.stale")} />
        </div>
      )}
      {isMock && <Alert color="yellow" variant="light">{t("liquefaction.results.mock_note")}</Alert>}
      <VerdictBanner tone={verdict.tone} title={verdict.title} text={verdict.text} />
      {summaries.some((s) => s.incomplete) && (
        <Alert color="yellow" variant="light" data-testid="liq-lpi-incomplete">{t("liquefaction.results.lpi_incomplete")}</Alert>
      )}
      {summaries.length > 0 && (
        <Box style={{ display: "grid", gap: "var(--mantine-spacing-md)", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 400px), 1fr))" }}>
          {summaries.map((s) => <SoundingTiles key={s.id} summary={s} selected={s.id === activeSounding} onSelect={() => setSelectedSounding(s.id)} />)}
        </Box>
      )}
      {activeSounding && <SoundingDetail id={activeSounding} sounding={result.per_sounding[activeSounding]} />}
      {errors.length > 0 && (
        <Alert color="red" variant="light" title={t("liquefaction.results.errors_title")}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {errors.map(([id, msg]) => (
              <li key={id}>
                {id}: {msg}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      {settings && <UsedInputs settings={settings} />}
    </Stack>
  );
}

/** One sounding's key numbers; the whole group is the button that picks the sounding shown below. */
function SoundingTiles({ summary, selected, onSelect }: { summary: SoundingSummary; selected: boolean; onSelect: () => void }) {
  const { t } = useTranslation();
  const { id, minFs, minDepth, lpi, category, incomplete, liquefiable, total } = summary;
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={t("liquefaction.results.select_sounding", { id })}
      data-testid={`liq-sounding-${id}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      p="md"
      style={{
        cursor: "pointer",
        borderRadius: 14,
        border: `2px solid ${selected ? "var(--mantine-color-primary-6)" : "var(--gt-border)"}`,
        background: "var(--mantine-color-body)",
      }}
    >
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Text ff="monospace" fw={600}>{id}</Text>
        <Group gap={8} wrap="nowrap">
          <Text size="xs" c="dimmed">{t("liquefaction.results.points", { count: total })}</Text>
          {category && <StatusChip tone={CATEGORY_TONE[category]}>{t("liquefaction.results.lpi_chip", { category: t(`liquefaction.results.lpi_category.${category}`) })}</StatusChip>}
        </Group>
      </Group>
      <Box style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <KpiTile
          label={t("liquefaction.results.min_fs")}
          value={minFs === null ? "—" : minFs.toFixed(2)}
          sub={minFs !== null && minDepth !== null ? t("liquefaction.results.at_depth", { depth: minDepth.toFixed(1) }) : undefined}
        />
        <div data-testid={`liq-lpi-${id}`}>
          <KpiTile
            label={t("liquefaction.results.lpi")}
            value={lpi === null ? "—" : `${lpi.toFixed(2)}${incomplete ? " *" : ""}`}
            sub={category ? t(`liquefaction.results.lpi_category.${category}`) : undefined}
          />
        </div>
        <KpiTile
          label={t("liquefaction.results.liquefiable_count")}
          value={liquefiable}
          unit={t("liquefaction.results.of_total", { total })}
        />
      </Box>
    </Box>
  );
}

/** The settings of the run, as stored with the result. */
function UsedInputs({ settings }: { settings: LiquefactionSettingsDTO }) {
  const { t } = useTranslation();
  const rows: Array<[string, string]> = [
    [t("liquefaction.field.method"), t(`liquefaction.method.${settings.method}`)],
    [t("liquefaction.field.amax_g"), String(settings.amax_g)],
    [t("liquefaction.field.mw"), String(settings.mw)],
    [t("liquefaction.field.target_fs"), String(settings.target_fs)],
    [t("liquefaction.field.c_fc"), String(settings.c_fc)],
    [t("liquefaction.field.ic_cutoff"), String(settings.ic_cutoff)],
  ];
  if (settings.default_fc != null) rows.push([t("liquefaction.field.default_fc"), String(settings.default_fc)]);
  if (settings.gwt_seismic != null) rows.push([t("liquefaction.field.gwt_seismic"), String(settings.gwt_seismic)]);
  return (
    <SectionCard title={t("liquefaction.results.inputs_title")}>
        <Box component="dl" m={0} style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "6px 24px" }}>
          {rows.map(([label, value]) => (
            <Box key={label} style={{ display: "contents" }}>
              <Text component="dt" size="sm" c="dimmed">{label}</Text>
              <Text component="dd" size="sm" m={0} ff="monospace">{value}</Text>
            </Box>
          ))}
        </Box>
    </SectionCard>
  );
}
