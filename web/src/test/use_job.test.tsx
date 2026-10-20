import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobRef } from "../shared/api/types";

vi.mock("../shared/api/client", async (importOriginal) => {
  const real = await importOriginal<typeof import("../shared/api/client")>();
  return {
    ...real,
    get_job: vi.fn(async (id: string) => ({
      job_id: id, kind: "wall_size", status: "done", progress: 1, message_key: null, result: { id }, error: null,
    })),
    cancel_job: vi.fn(async (id: string) => ({
      job_id: id, kind: "wall_size", status: "cancelled", progress: 0, message_key: null, result: null, error: null,
    })),
  };
});

import { cancel_job, get_job } from "../shared/api/client";
import { useJob } from "../shared/hooks/useJob";

function deferred() {
  let resolve!: (ref: JobRef) => void;
  const promise = new Promise<JobRef>((r) => { resolve = r; });
  return { promise, resolve };
}

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(get_job).mockClear();
  vi.mocked(cancel_job).mockClear();
});

describe("useJob races", () => {
  it("honours a cancel made while the job is still being started and cancels it on the server", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useJob<{ id: string }>());
    const starting = deferred();
    let started!: Promise<void>;
    act(() => { started = result.current.start(() => starting.promise); });
    await act(async () => { await result.current.cancel(); });
    expect(result.current.status).toBe("cancelled");

    await act(async () => { starting.resolve({ job_id: "J1" }); await started; });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.status).toBe("cancelled");
    expect(result.current.result).toBeNull();
    expect(get_job).not.toHaveBeenCalled();
    expect(cancel_job).toHaveBeenCalledWith("J1");
  });

  it("keeps the newest start when an older start resolves last", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useJob<{ id: string }>());
    const older = deferred();
    const newer = deferred();
    let olderDone!: Promise<void>;
    let newerDone!: Promise<void>;
    act(() => { olderDone = result.current.start(() => older.promise); });
    act(() => { newerDone = result.current.start(() => newer.promise); });
    await act(async () => { newer.resolve({ job_id: "B" }); await newerDone; });
    await act(async () => { older.resolve({ job_id: "A" }); await olderDone; });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(result.current.status).toBe("done");
    expect(result.current.result).toEqual({ id: "B" });
    expect(vi.mocked(get_job).mock.calls.map(([id]) => id)).toEqual(["B"]);
    expect(cancel_job).toHaveBeenCalledWith("A");
  });

  it("cancels a still-running job on the server when a new one replaces it", async () => {
    vi.useFakeTimers();
    vi.mocked(get_job).mockImplementation(async (id: string) => ({
      job_id: id, kind: "wall_size", status: id === "A" ? "running" : "done", progress: 0.5,
      message_key: null, result: id === "A" ? null : { id }, error: null,
    }));
    const { result } = renderHook(() => useJob<{ id: string }>());
    await act(async () => { await result.current.start(async () => ({ job_id: "A" })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(result.current.status).toBe("running");

    await act(async () => { await result.current.start(async () => ({ job_id: "B" })); });
    expect(cancel_job).toHaveBeenCalledWith("A");
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.result).toEqual({ id: "B" });
    expect(vi.mocked(get_job).mock.calls.filter(([id]) => id === "A")).toHaveLength(1);
  });
});
