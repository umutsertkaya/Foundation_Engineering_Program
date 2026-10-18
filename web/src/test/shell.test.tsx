import { lazy } from "react";
import { MantineProvider } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBox } from "@tabler/icons-react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import i18n, { loadLanguageCatalog } from "../app/i18n";
import { ModuleRegistryContext, sortManifests } from "../app/moduleRegistry";
import { ProjectProvider, useProjectSession } from "../app/ProjectProvider";
import { theme } from "../app/theme";
import { setMockMode, update_project_meta } from "../shared/api/client";
import { close_project, get_session } from "../shared/api/core";
import { resetCoreMock } from "../shared/api/mock";
import type { WebModuleManifest } from "../shared/moduleTypes";

const fakeManifest: WebModuleManifest = {
  id: "fake", version: "0.1.0", order: 10,
  titleKey: "Fake module", descriptionKey: "Fake description", icon: IconBox,
  Root: lazy(async () => ({ default: function FakeRoot() {
    return <Routes>
      <Route index element={<div>Fake root content<input aria-label="Module draft" /></div>} />
      <Route path="details" element={<div>Fake details content</div>} />
    </Routes>;
  } })),
  nav: [
    { path: "", labelKey: "Fake overview", end: true, icon: IconBox },
    { path: "details", labelKey: "Fake details" },
  ],
};

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderApp(path: string, modules: WebModuleManifest[] = []) {
  return render(
    <MantineProvider theme={theme}>
      <MemoryRouter initialEntries={[path]}>
        <ModuleRegistryContext.Provider value={modules}>
          <App />
        </ModuleRegistryContext.Provider>
        <LocationProbe />
      </MemoryRouter>
    </MantineProvider>,
  );
}

beforeEach(async () => {
  setMockMode(true);
  resetCoreMock();
  await loadLanguageCatalog("tr");
});

afterEach(() => {
  cleanup();
  resetCoreMock();
  setMockMode(null);
  vi.restoreAllMocks();
});

describe("project shell routing", () => {
  it.each(["/launcher", "/m/fake"])("redirects %s to start when the session is closed", async (path) => {
    await close_project();
    renderApp(path, [fakeManifest]);
    expect(await screen.findByRole("heading", { name: i18n.t("start.app_title") })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/start");
    expect(screen.queryByText("Fake root content")).not.toBeInTheDocument();
  });

  it("renders an injected module, follows its relative routes and returns to the launcher", async () => {
    renderApp("/m/fake", [fakeManifest]);
    expect(await screen.findByText("Fake root content")).toBeInTheDocument();
    const overview = screen.getByRole("link", { name: "Fake overview" });
    const details = screen.getByRole("link", { name: "Fake details" });
    expect(overview).toHaveAttribute("href", "/m/fake");
    expect(overview).toHaveAttribute("aria-current", "page");
    expect(details).toHaveAttribute("href", "/m/fake/details");
    fireEvent.click(details);
    expect(await screen.findByText("Fake details content")).toBeInTheDocument();
    expect(details).toHaveAttribute("aria-current", "page");
    expect(overview).not.toHaveAttribute("aria-current");

    fireEvent.click(screen.getByRole("button", { name: i18n.t("shell.back_to_menu") }));
    expect(await screen.findByRole("heading", { name: i18n.t("launcher.title") })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/launcher");
    expect(screen.getByText("Fake description")).toBeInTheDocument();
  });

  it("shows an empty state and back button for an unknown module", async () => {
    renderApp("/m/missing");
    expect(await screen.findByRole("heading", { name: i18n.t("shell.module_not_found") })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("shell.back_to_menu") }));
    expect(await screen.findByRole("heading", { name: i18n.t("launcher.title") })).toBeInTheDocument();
  });

  it("saves a dirty project before notifying success", async () => {
    await update_project_meta({ name: "Shell project" });
    const show = vi.spyOn(notifications, "show");
    renderApp("/m/fake", [fakeManifest]);
    await screen.findByText("Fake root content");
    expect(screen.getByText(i18n.t("shell.project_label", { name: "Shell project" }))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("shell.unsaved"))).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Module draft" }), { target: { value: "Local draft" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("shell.save") }));
    await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ message: i18n.t("shell.saved") })));
    expect((await get_session()).dirty).toBe(false);
    expect(screen.queryByText(i18n.t("shell.unsaved"))).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Module draft" })).toHaveValue("Local draft");
  });
});

describe("project session provider", () => {
  it("refreshes project metadata through close, create and library open", async () => {
    const { result } = renderHook(() => useProjectSession(), { wrapper: ProjectProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.project?.meta.name).toBeTruthy();
    await act(async () => { await result.current.close(); });
    expect(result.current.session.open).toBe(false);
    expect(result.current.project).toBeNull();
    await act(async () => { await result.current.createInLibrary({ name: "New shell project" }); });
    expect(result.current.session.open).toBe(true);
    expect(result.current.project?.meta.name).toBe("New shell project");
    await act(async () => { await result.current.openFromLibrary("caglayan-sev.gtk"); });
    expect(result.current.session.file).toBe("caglayan-sev.gtk");
    expect(result.current.project?.meta.name).toBe("Çağlayan Şev");
  });
});

describe("module registry sorting", () => {
  it("sorts by order then id without mutating its input", () => {
    const manifests = [
      { ...fakeManifest, id: "z", order: 20 },
      { ...fakeManifest, id: "b", order: 10 },
      { ...fakeManifest, id: "a", order: 10 },
    ];
    expect(sortManifests(manifests).map(({ id }) => id)).toEqual(["a", "b", "z"]);
    expect(manifests.map(({ id }) => id)).toEqual(["z", "b", "a"]);
    expect(sortManifests([])).toEqual([]);
  });
});

describe("project session refresh", () => {
  const refreshManifest: WebModuleManifest = {
    ...fakeManifest,
    id: "refreshy",
    Root: lazy(async () => ({ default: function RefreshRoot() {
      const { refresh, markDirty, session } = useProjectSession();
      return <Routes>
        <Route index element={<div>
          <input aria-label="Draft field" />
          <output data-testid="dirty">{String(session.dirty)}</output>
          <button onClick={() => { void refresh({ silent: true }); }}>silent refresh</button>
          <button onClick={() => { void refresh(); }}>full refresh</button>
          <button onClick={markDirty}>mark dirty</button>
        </div>} />
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>;
    } })),
  };

  it("keeps the module mounted (focus and typing survive) across refreshes", async () => {
    renderApp("/m/refreshy", [refreshManifest]);
    const input = await screen.findByRole("textbox", { name: "Draft field" });
    input.focus();
    fireEvent.change(input, { target: { value: "typing" } });
    for (const name of ["silent refresh", "full refresh"]) {
      fireEvent.click(screen.getByRole("button", { name }));
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
      expect(screen.getByRole("textbox", { name: "Draft field" })).toBe(input);
      expect(input).toHaveValue("typing");
    }
  });

  it("only reports loading during the initial load", async () => {
    const seen: boolean[] = [];
    const { result } = renderHook(() => {
      const value = useProjectSession();
      seen.push(value.loading);
      return value;
    }, { wrapper: ProjectProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const afterInitial = seen.length;
    await act(async () => { await result.current.refresh(); });
    await act(async () => { await result.current.refresh({ silent: true }); });
    expect(seen.slice(afterInitial).every((loading) => !loading)).toBe(true);
  });

  it("updates only the session through markDirty and refreshSession", async () => {
    const { result } = renderHook(() => useProjectSession(), { wrapper: ProjectProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const project = result.current.project;
    await update_project_meta({ name: "Changed elsewhere" });
    expect(result.current.session.dirty).toBe(false);
    act(() => { result.current.markDirty(); });
    await waitFor(() => expect(result.current.session.dirty).toBe(true));
    expect(result.current.project).toBe(project);
    expect(result.current.loading).toBe(false);
  });

  it("ignores stale refresh responses that finish after a newer one", async () => {
    setMockMode(false);
    const pending: Array<(session: unknown) => void> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/session")) {
        const session = await new Promise<unknown>((resolve) => { pending.push(resolve); });
        return new Response(JSON.stringify(session), { status: 200 });
      }
      return new Response(JSON.stringify({ meta: { name: "P" }, site: {}, counts: {} }), { status: 200 });
    });
    const { result } = renderHook(() => useProjectSession(), { wrapper: ProjectProvider });
    await waitFor(() => expect(pending).toHaveLength(1));
    await act(async () => { pending[0]({ open: true, file: "initial.gtk", dirty: false }); });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let older!: Promise<void>;
    let newer!: Promise<void>;
    act(() => {
      older = result.current.refresh({ silent: true });
      newer = result.current.refresh({ silent: true });
    });
    await waitFor(() => expect(pending).toHaveLength(3));
    await act(async () => { pending[2]({ open: true, file: "newer.gtk", dirty: true }); await newer; });
    await act(async () => { pending[1]({ open: true, file: "stale.gtk", dirty: false }); await older; });
    expect(result.current.session).toEqual({ open: true, file: "newer.gtk", dirty: true });
  });

  it("shows the unsaved badge after a module marks the session dirty and redirects unknown subroutes", async () => {
    renderApp("/m/refreshy/does/not/exist", [refreshManifest]);
    expect(await screen.findByRole("textbox", { name: "Draft field" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/m/refreshy");
    expect(screen.queryByText(i18n.t("shell.unsaved"))).not.toBeInTheDocument();
    await update_project_meta({ name: "Badge" });
    fireEvent.click(screen.getByRole("button", { name: "mark dirty" }));
    expect(await screen.findByText(i18n.t("shell.unsaved"))).toBeInTheDocument();
    expect(screen.getByTestId("dirty")).toHaveTextContent("true");
    expect(screen.getByRole("button", { name: i18n.t("shell.menu_toggle") })).toBeInTheDocument();
  });
});
