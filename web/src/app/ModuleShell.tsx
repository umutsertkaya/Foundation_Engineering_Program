import { Suspense, useEffect, useState } from "react";
import {
  AppShell, Badge, Burger, Button, Group, Loader, NavLink, SegmentedControl, Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { matchPath, NavLink as RouterNavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import type { Language } from "../shared/api/types";
import { EmptyState } from "../shared/components/EmptyState";
import { ErrorAlert } from "../shared/components/ErrorAlert";
import { loadLanguageCatalog } from "./i18n";
import { useModules } from "./moduleRegistry";
import { useProjectSession } from "./ProjectProvider";
import { ThemeToggle } from "./ThemeToggle";

export function ModuleShell() {
  const { moduleId } = useParams();
  const manifest = useModules().find((module) => module.id === moduleId);
  const { session, project, save } = useProjectSession();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [navOpened, { toggle: toggleNav, close: closeNav }] = useDisclosure(false);
  useEffect(() => { setError(null); }, [moduleId]);
  useEffect(() => { closeNav(); }, [location.pathname, closeNav]);
  const backButton = <Button onClick={() => navigate("/launcher")}>{t("shell.back_to_menu")}</Button>;

  if (!manifest) {
    return <EmptyState title={t("shell.module_not_found")} description="" action={backButton} />;
  }
  const ModuleIcon = manifest.icon;
  const Root = manifest.Root;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await save();
      notifications.show({ message: t("shell.saved"), color: "green" });
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell header={{ height: 100 }} navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !navOpened } }} padding="md">
      <AppShell.Header px="md" py="xs">
        <Group h="100%" justify="space-between">
          <Group gap="xs">
            <Burger
              opened={navOpened}
              onClick={toggleNav}
              hiddenFrom="sm"
              size="sm"
              aria-label={t("shell.menu_toggle")}
            />
            <ModuleIcon size={24} />
            <Text fw={700}>{t(manifest.titleKey)}</Text>
            <Text size="sm">{t("shell.project_label", { name: project?.meta.name ?? session.file ?? "" })}</Text>
            {session.dirty && <Badge color="amber">{t("shell.unsaved")}</Badge>}
          </Group>
          <Group gap="xs">
            <Button loading={saving} onClick={() => { void handleSave(); }}>{t("shell.save")}</Button>
            <SegmentedControl
              size="xs"
              aria-label={t("web.header.lang_switch")}
              value={i18n.language === "en" ? "en" : "tr"}
              onChange={(value) => { void loadLanguageCatalog(value as Language); }}
              data={[{ value: "tr", label: "TR" }, { value: "en", label: "EN" }]}
            />
            <ThemeToggle />
            {backButton}
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="sm">
        {manifest.nav.map((item) => {
          const path = `/m/${manifest.id}${item.path ? `/${item.path}` : ""}`;
          const end = item.end ?? item.path === "";
          const ItemIcon = item.icon;
          return (
            <NavLink
              key={item.path}
              component={RouterNavLink}
              to={path}
              end={end}
              active={
                Boolean(matchPath({ path, end }, location.pathname)) ||
                (item.matchPrefixes ?? []).some((prefix) =>
                  Boolean(matchPath({ path: `/m/${manifest.id}/${prefix.replace(/\/$/, "")}`, end: false }, location.pathname)),
                )
              }
              label={t(item.labelKey)}
              leftSection={ItemIcon ? <ItemIcon size={18} /> : undefined}
            />
          );
        })}
      </AppShell.Navbar>
      <AppShell.Main>
        {error != null && <ErrorAlert error={error} />}
        <Suspense fallback={<Loader />}><Root key={manifest.id} /></Suspense>
      </AppShell.Main>
    </AppShell>
  );
}
