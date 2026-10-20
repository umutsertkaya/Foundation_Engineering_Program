import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Group, Progress, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { ApiError, cancel_job, get_job } from "../../../shared/api/client";
import type { JobState, SheetPileResultDTO } from "../../../shared/api/types";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";
import { ResultPanel } from "./ResultPanel";

const POLL_MS = 300;
const TERMINAL = new Set<JobState["status"]>(["done", "failed", "cancelled"]);

interface Props {
  jobId: string;
  /** Called once when a job finishes `done`, so the page can refresh stale/result badges. */
  onDone?: () => void;
}

/** Polls one design job and renders progress / cancel / failure / the completed result. */
export function JobPanel({ jobId, onDone }: Props) {
  const { t } = useTranslation();
  const [state, setState] = useState<JobState | null>(null);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [retryKey, setRetryKey] = useState(0);
  const seq = useRef(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const mine = ++seq.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let transientFailures = 0;
    setState(null);
    setGone(false);
    setError(null);
    const tick = async () => {
      try {
        const s = await get_job(jobId);
        if (mine !== seq.current) return;
        setState(s);
        if (!TERMINAL.has(s.status)) timer = setTimeout(tick, POLL_MS);
        else if (s.status === "done") doneRef.current?.();
      } catch (err) {
        if (mine !== seq.current) return;
        if (err instanceof ApiError && err.status === 404) setGone(true);
        else if (transientFailures < 3) {
          transientFailures += 1;
          timer = setTimeout(tick, POLL_MS * transientFailures);
        } else setError(err);
      }
    };
    void tick();
    return () => {
      seq.current += 1;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, retryKey]);

  const cancel = useCallback(async () => {
    try {
      setState(await cancel_job(jobId));
    } catch (err) {
      setError(err);
    }
  }, [jobId]);

  if (gone) return <Alert color="gray">{t("sheet_pile.job.unavailable")}</Alert>;
  if (error != null) return <Stack gap="xs"><Text size="xs" c="dimmed">{t("sheet_pile.job.resume_hint")}</Text><ErrorAlert error={error} onRetry={() => { setError(null); setState(null); setRetryKey((key) => key + 1); }} /></Stack>;
  if (!state) return <Text size="sm">{t("web.common.loading")}</Text>;

  if (state.status === "failed") {
    return state.error ? (
      <ErrorAlert error={new ApiError(400, state.error)} />
    ) : (
      <Alert color="red">{t("sheet_pile.job.failed")}</Alert>
    );
  }
  if (state.status === "cancelled") return <Alert color="gray">{t("sheet_pile.job.cancelled")}</Alert>;
  if (state.status !== "done") {
    return (
      <Stack gap="xs" data-testid="job-progress">
        <Progress value={Math.round(state.progress * 100)} />
        <Text size="sm">{state.message_key ? t(state.message_key) : t("sheet_pile.job.running")}</Text>
        <Group>
          <Button variant="default" size="xs" onClick={() => void cancel()}>
            {t("sheet_pile.job.cancel")}
          </Button>
        </Group>
      </Stack>
    );
  }
  const result = state.result as SheetPileResultDTO | null;
  if (!result) return <Alert color="gray">{t("sheet_pile.job.empty")}</Alert>;
  return <ResultPanel result={result} />;
}
