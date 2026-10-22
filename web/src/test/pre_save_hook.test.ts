import { describe, expect, it } from "vitest";
import { registerPreSaveHook, runPreSaveHooks } from "../shared/hooks/usePreSaveHook";

describe("pre-save hooks", () => {
  it("runs registered hooks in order and stops after unregistering", async () => {
    const calls: string[] = [];
    const off1 = registerPreSaveHook(() => { calls.push("a"); });
    const off2 = registerPreSaveHook(async () => { calls.push("b"); });
    await runPreSaveHooks();
    expect(calls).toEqual(["a", "b"]);
    off1();
    off2();
    await runPreSaveHooks();
    expect(calls).toEqual(["a", "b"]);
  });

  it("a rejecting hook aborts the save", async () => {
    const off = registerPreSaveHook(() => { throw new Error("blocked"); });
    await expect(runPreSaveHooks()).rejects.toThrow("blocked");
    off();
  });
});
