import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppChrome } from "../app/AppChrome";
import i18n, { loadLanguageCatalog } from "../app/i18n";
import { theme } from "../app/theme";
import { request, setMockMode } from "../shared/api/http";

const calls: { url: string; method: string }[] = [];

function stubFetch(handler: (url: string, method: string) => Response | Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url, method });
    return handler(url, method);
  }));
}

function renderChrome() {
  return render(
    <MantineProvider theme={theme}>
      <AppChrome />
    </MantineProvider>,
  );
}

beforeEach(async () => {
  setMockMode(false);
  await loadLanguageCatalog("tr");
  calls.length = 0;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setMockMode(null);
});

describe("app chrome", () => {
  it("quits the local program after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    stubFetch((url) => {
      if (url === "/api/launcher") return new Response(JSON.stringify({ shutdown: true }), { status: 200 });
      if (url === "/api/session") return new Response(JSON.stringify({ open: true, dirty: false, file: "a.gtk" }), { status: 200 });
      return new Response(JSON.stringify({ stopping: true }), { status: 200 });
    });
    renderChrome();
    fireEvent.click(await screen.findByRole("button", { name: i18n.t("shell.quit") }));
    expect(await screen.findByText(i18n.t("shell.stopped_title"))).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST" && c.url === "/api/launcher/shutdown")).toBe(true);
  });

  it("hides the quit button when the server is not the local launcher", async () => {
    stubFetch(() => new Response(JSON.stringify({ code: "not_found", message: "x" }), { status: 404 }));
    renderChrome();
    await waitFor(() => expect(calls.length).toBe(1));
    expect(screen.queryByRole("button", { name: i18n.t("shell.quit") })).not.toBeInTheDocument();
  });

  it("warns when the server cannot be reached", async () => {
    stubFetch((url) => {
      if (url === "/api/launcher") return new Response(JSON.stringify({ shutdown: true }), { status: 200 });
      throw new TypeError("Failed to fetch");
    });
    renderChrome();
    await screen.findByRole("button", { name: i18n.t("shell.quit") });
    await request("GET", "/health").catch(() => undefined);
    expect(await screen.findByText(i18n.t("shell.disconnected_title"))).toBeInTheDocument();
  });
});
