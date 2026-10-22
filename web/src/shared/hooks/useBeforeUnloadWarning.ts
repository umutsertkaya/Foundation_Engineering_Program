import { useEffect } from "react";

/** Asks the browser to confirm leaving/reloading the page while `active` (unsaved drafts exist). */
export function useBeforeUnloadWarning(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy browsers need a returnValue to show the prompt.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
