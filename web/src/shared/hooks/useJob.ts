import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, cancel_job, get_job, parseApiError } from "../api/client";
import type { JobRef, JobState, JobStatus } from "../api/types";

const POLL_INTERVAL_MS = 300;

export interface UseJobReturn<TResult = JobState["result"]> {
  status: JobStatus | "idle";
  progress: number;
  messageKey: string | null;
  result: TResult | null;
  error: ApiError | null;
  start: (starter: () => Promise<JobRef>) => Promise<void>;
  cancel: () => Promise<void>;
  reset: () => void;
}

export function useJob<TResult = JobState["result"]>(): UseJobReturn<TResult> {
  const [status, setStatus] = useState<JobStatus | "idle">("idle");
  const [progress, setProgress] = useState<number>(0);
  const [messageKey, setMessageKey] = useState<string | null>(null);
  const [result, setResult] = useState<TResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const jobIdRef = useRef<string | null>(null);
  /** Job being polled and not yet finished; a newer start cancels it on the server. */
  const liveJobRef = useRef<string | null>(null);
  /** Bumped by every start/cancel/reset: an older start that resolves late must not take over. */
  const startSeqRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef<boolean>(true);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
    };
  }, [clearTimer]);

  const pollOnce = useCallback(
    async (jobId: string) => {
      try {
        const state = await get_job(jobId);
        if (!mountedRef.current || jobIdRef.current !== jobId) {
          return;
        }
        setStatus(state.status);
        setProgress(state.progress);
        setMessageKey(state.message_key);
        setResult((state.result as TResult | null) ?? null);
        if (state.error) {
          setError(parseApiError(400, state.error));
        }

        if (
          state.status === "done" ||
          state.status === "failed" ||
          state.status === "cancelled"
        ) {
          clearTimer();
          liveJobRef.current = null;
          return;
        }

        clearTimer();
        timerRef.current = setTimeout(() => {
          void pollOnce(jobId);
        }, POLL_INTERVAL_MS);
      } catch (err) {
        if (!mountedRef.current || jobIdRef.current !== jobId) {
          return;
        }
        clearTimer();
        liveJobRef.current = null;
        const apiErr =
          err instanceof ApiError
            ? err
            : parseApiError(500, err instanceof Error ? err.message : "Job polling error");
        setStatus("failed");
        setError(apiErr);
      }
    },
    [clearTimer],
  );

  const start = useCallback(
    async (starter: () => Promise<JobRef>) => {
      const seq = ++startSeqRef.current;
      clearTimer();
      const superseded = liveJobRef.current;
      liveJobRef.current = null;
      jobIdRef.current = null;
      if (superseded) {
        // Best effort: the replaced job must not finish later and overwrite the newer result.
        void cancel_job(superseded).catch(() => undefined);
      }
      setError(null);
      setResult(null);
      setProgress(0);
      setMessageKey("job.step.queued");
      setStatus("queued");

      try {
        const ref = await starter();
        if (!mountedRef.current) {
          return;
        }
        if (seq !== startSeqRef.current) {
          // Cancelled, reset or replaced while the job was being started: stop it on the server too.
          void cancel_job(ref.job_id).catch(() => undefined);
          return;
        }
        jobIdRef.current = ref.job_id;
        liveJobRef.current = ref.job_id;
        clearTimer();
        timerRef.current = setTimeout(() => {
          void pollOnce(ref.job_id);
        }, POLL_INTERVAL_MS);
      } catch (err) {
        if (!mountedRef.current || seq !== startSeqRef.current) {
          return;
        }
        const apiErr =
          err instanceof ApiError
            ? err
            : parseApiError(500, err instanceof Error ? err.message : "Job start error");
        setStatus("failed");
        setMessageKey(null);
        setError(apiErr);
      }
    },
    [clearTimer, pollOnce],
  );

  const cancel = useCallback(async () => {
    startSeqRef.current += 1;
    clearTimer();
    const activeJobId = jobIdRef.current;
    jobIdRef.current = null;
    liveJobRef.current = null;
    if (!activeJobId) {
      setStatus("cancelled");
      return;
    }
    try {
      const state = await cancel_job(activeJobId);
      if (mountedRef.current) {
        setStatus(state.status);
        setMessageKey(state.message_key);
      }
    } catch (err) {
      if (mountedRef.current) {
        setStatus("cancelled");
        if (err instanceof ApiError) {
          setError(err);
        }
      }
    }
  }, [clearTimer]);

  const reset = useCallback(() => {
    startSeqRef.current += 1;
    clearTimer();
    jobIdRef.current = null;
    liveJobRef.current = null;
    setStatus("idle");
    setProgress(0);
    setMessageKey(null);
    setResult(null);
    setError(null);
  }, [clearTimer]);

  return {
    status,
    progress,
    messageKey,
    result,
    error,
    start,
    cancel,
    reset,
  };
}
