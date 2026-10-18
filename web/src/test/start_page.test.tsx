import { MantineProvider } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import i18n, { loadLanguageCatalog } from "../app/i18n";
import { theme } from "../app/theme";
import { setMockMode, update_project_meta } from "../shared/api/client";
import { close_project, get_session, list_library } from "../shared/api/core";
import { resetCoreMock } from "../shared/api/mock";

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderApp(path: string) {
  return render(
    <MantineProvider theme={theme}>
      <MemoryRouter initialEntries={[path]}>
        <App />
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

async function openRowAction(file: string, name: string, action: string) {
  const trigger = await screen.findByTestId(`row-actions-${file}`);
  expect(trigger).toHaveAccessibleName(i18n.t("start.row_actions", { name }));
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole("menuitem", { name: i18n.t(action) }));
}

describe("start page", () => {
  it("asks before replacing an open project with unsaved changes", async () => {
    await update_project_meta({ name: "Dirty project" });
    renderApp("/start");
    await openRowAction("caglayan-sev.gtk", "Çağlayan Şev", "start.action.open");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(i18n.t("start.open_unsaved_confirm"))).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: i18n.t("start.new.cancel") }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect((await get_session()).file).toBe("ornek-proje.gtk");
    expect(screen.getByTestId("location")).toHaveTextContent("/start");

    await openRowAction("caglayan-sev.gtk", "Çağlayan Şev", "start.action.open");
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: i18n.t("start.continue") }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/launcher"));
    expect((await get_session()).file).toBe("caglayan-sev.gtk");
  });

  it("creates a project when Enter is pressed in the name field", async () => {
    renderApp("/start");
    fireEvent.click(await screen.findByRole("button", { name: i18n.t("start.new_project") }));
    const dialog = await screen.findByRole("dialog");
    const name = within(dialog).getByRole("textbox", { name: new RegExp(i18n.t("start.new.name")) });
    fireEvent.change(name, { target: { value: "Enter ile" } });
    fireEvent.keyDown(name, { key: "Enter" });
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/launcher"));
    expect((await get_session()).file).toBe("enter-ile.gtk");
  });

  it("shows import errors inside the modal", async () => {
    renderApp("/start");
    fireEvent.click(await screen.findByRole("button", { name: i18n.t("start.import") }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "C:/x/file.txt" } });
    fireEvent.click(within(dialog).getByRole("button", { name: i18n.t("start.import") }));
    expect(await within(dialog).findByText(i18n.t("error.invalid_project_file"))).toBeInTheDocument();
  });

  it("confirms before overwriting an existing export and retries with overwrite", async () => {
    const show = vi.spyOn(notifications, "show");
    renderApp("/start");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await openRowAction("kiyi-iksa.gtk", "Kıyı İksa", "start.action.export");
      const dialog = await screen.findByRole("dialog");
      fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "C:/Export/kiyi.gtk" } });
      fireEvent.click(within(dialog).getByRole("button", { name: i18n.t("start.action.export") }));
      if (attempt === 0) {
        await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ message: "C:/Export/kiyi.gtk" })));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        continue;
      }
      expect(await within(dialog).findByText(i18n.t("start.export.exists_confirm"))).toBeInTheDocument();
      expect(within(dialog).queryByText(i18n.t("error.file_exists"))).not.toBeInTheDocument();
      show.mockClear();
      fireEvent.click(within(dialog).getByRole("button", { name: i18n.t("start.export.overwrite") }));
      await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ message: "C:/Export/kiyi.gtk" })));
    }
  });

  it("renames the open project file and announces it with a named toast", async () => {
    const show = vi.spyOn(notifications, "show");
    renderApp("/start");
    const sample = (await list_library()).find(({ file }) => file === "ornek-proje.gtk")!;
    await openRowAction("ornek-proje.gtk", sample.name, "start.action.rename");
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Yeni İsim" } });
    fireEvent.click(within(dialog).getByRole("button", { name: i18n.t("start.action.rename") }));
    await waitFor(() => expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ message: i18n.t("start.renamed", { name: "Yeni İsim" }) }),
    ));
    expect(await get_session()).toEqual({ open: true, file: "yeni-isim.gtk", dirty: false });
  });

  it("offers a theme toggle and a labelled language switch", async () => {
    await close_project();
    renderApp("/start");
    expect(await screen.findByRole("button", { name: i18n.t("web.header.theme_toggle") })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: i18n.t("web.header.lang_switch") })).toBeInTheDocument();
  });
});

describe("launcher site blur", () => {
  it("saves only when the site values changed and keeps the input mounted", async () => {
    renderApp("/launcher");
    const pga = await screen.findByLabelText(i18n.t("launcher.pga_g"));
    fireEvent.focus(pga);
    fireEvent.blur(pga);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await get_session()).dirty).toBe(false);

    fireEvent.focus(pga);
    fireEvent.change(pga, { target: { value: "0.77" } });
    fireEvent.blur(pga);
    await waitFor(async () => expect((await get_session()).dirty).toBe(true));
    await waitFor(() => expect(screen.getByText(i18n.t("shell.unsaved"))).toBeInTheDocument());
    // The page was not unmounted by the refresh: same element, value retained.
    expect(screen.getByLabelText(i18n.t("launcher.pga_g"))).toBe(pga);
    expect(pga).toHaveValue("0.77");
  });
});
