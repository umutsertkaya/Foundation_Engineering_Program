import { lazy } from "react";
import { MantineProvider } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBox } from "@tabler/icons-react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
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
