import { useEffect, useRef } from "react";

/**
 * Registry of "flush local drafts" callbacks that the global project Save runs first.
 * A hook persists the module's unsaved structure inputs (or throws to block the save with a message),
 * so the top Save never reports success while an on-screen draft is silently left behind.
 */
type PreSaveHook = () => Promise<void> | void;

const hooks = new Set<PreSaveHook>();

export function registerPreSaveHook(hook: PreSaveHook): () => void {
  hooks.add(hook);
  return () => {
    hooks.delete(hook);
  };
}

/** Runs every registered hook in order; the first rejection aborts the save. */
export async function runPreSaveHooks(): Promise<void> {
  for (const hook of [...hooks]) await hook();
}

/** Registers `hook` while the calling component is mounted; the latest closure is always used. */
export function usePreSaveHook(hook: PreSaveHook): void {
  const ref = useRef(hook);
  ref.current = hook;
  useEffect(() => registerPreSaveHook(() => ref.current()), []);
}
