/** Native dialogs of the local program (exe); absent when the API runs without the launcher. */
export type PickKind = "folder" | "open" | "save";

export async function launcherAvailable(): Promise<boolean> {
  try {
    return (await fetch("/api/launcher")).ok;
  } catch {
    return false;
  }
}

/** Opens the native dialog; resolves to the chosen path or null when cancelled/unavailable. */
export async function pickPath(kind: PickKind, initial = ""): Promise<string | null> {
  try {
    const reply = await fetch(`/api/launcher/pick/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initial }),
    });
    if (!reply.ok) return null;
    return ((await reply.json()) as { path: string | null }).path;
  } catch {
    return null;
  }
}
