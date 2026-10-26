import { Suspense, useEffect, useState } from "react";
import { Anchor, AppShell, Box, Burger, Button, Group, Loader, NavLink, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconHome } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { IconDeviceFloppy } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link, matchPath, NavLink as RouterNavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "../shared/components/EmptyState";
import { ErrorAlert } from "../shared/components/ErrorAlert";
import { StatusChip } from "../shared/components/StatusChip";
import { runPreSaveHooks } from "../shared/hooks/usePreSaveHook";
import { useModules } from "./moduleRegistry";
import { useProjectSession } from "./ProjectProvider";
import { ViewMenu } from "./ViewMenu";

export function ModuleShell() {
  const { moduleId } = useParams();
  const manifest = useModules().find((module) => module.id === moduleId);
  const { session, project, save } = useProjectSession();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [navOpened, { toggle: toggleNav, close: closeNav }] = useDisclosure(false);
  useEffect(() => { setError(null); }, [moduleId]);
  useEffect(() => { closeNav(); }, [location.pathname, closeNav]);
  const backButton = (
    <Button variant="subtle" color="gray" c="var(--mantine-color-text)" aria-label={t("shell.back_to_menu")} px={{ base: 8, sm: 14 }} onClick={() => navigate("/launcher")}>
      <Box component="span" hiddenFrom="sm" style={{ display: "inline-flex" }}><IconHome size={18} aria-hidden="true" /></Box>
      <Box component="span" visibleFrom="sm">{t("shell.back_to_menu")}</Box>
    </Button>
  );

  if (!manifest) {
    return <EmptyState title={t("shell.module_not_found")} description="" action={backButton} />;
  }
  const ModuleIcon = manifest.icon;
  const Root = manifest.Root;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Unsaved structure drafts go into the project first; a blocking hook error aborts the file save.
      await runPreSaveHooks();
      await save();
      notifications.show({ message: t("shell.saved"), color: "green" });
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell header={{ height: 60 }} navbar={{ width: 230, breakpoint: "sm", collapsed: { mobile: !navOpened } }} padding="lg">
      <AppShell.Header px="md">
        <Group h="100%" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <Burger
              opened={navOpened}
              onClick={toggleNav}
              hiddenFrom="sm"
              size="sm"
              aria-label={t("shell.menu_toggle")}
            />
            <Anchor
              component={Link}
              to="/launcher"
              c="var(--mantine-color-text)"
              underline="never"
              style={{ display: "inline-flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 17, whiteSpace: "nowrap", minWidth: 0 }}
            >
              <Box component="span" c="primary" style={{ display: "inline-flex" }}><ModuleIcon size={22} /></Box>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t(manifest.titleKey)}</span>
            </Anchor>
            <Text size="sm" c="dimmed" truncate visibleFrom="sm">{project?.meta.name ?? session.file ?? ""}</Text>
            <Box visibleFrom="sm" style={{ display: "contents" }}>
            <StatusChip tone={session.dirty ? "stale" : "current"}>
              {t(session.dirty ? "shell.chip_unsaved" : "shell.chip_saved")}
            </StatusChip>
            </Box>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Button
              variant="default"
              loading={saving}
              aria-label={t("shell.save")}
              px={{ base: 10, sm: 14 }}
              leftSection={<IconDeviceFloppy size={16} aria-hidden="true" />}
              onClick={() => { void handleSave(); }}
            >
              <Box component="span" visibleFrom="sm">{t("shell.save")}</Box>
            </Button>
            {backButton}
            <ViewMenu />
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="sm" style={{ gap: 2 }}>
        {manifest.nav.map((item) => {
          const path = `/m/${manifest.id}${item.path ? `/${item.path}` : ""}`;
          const end = item.end ?? item.path === "";
          const ItemIcon = item.icon;
          const active =
            Boolean(matchPath({ path, end }, location.pathname)) ||
            (item.matchPrefixes ?? []).some((prefix) =>
              Boolean(matchPath({ path: `/m/${manifest.id}/${prefix.replace(/\/$/, "")}`, end: false }, location.pathname)),
            );
          return (
            <NavLink
              key={item.path}
              component={RouterNavLink}
              to={path}
              end={end}
              active={active}
              variant="light"
              styles={{ label: { fontWeight: active ? 600 : 500 } }}
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
