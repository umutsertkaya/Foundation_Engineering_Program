import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  VisuallyHidden,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowRight, IconBuildingBridge, IconDeviceFloppy } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { list_codes, set_project_site, update_project_meta } from "../../shared/api/client";
import type { DesignCodeSummary, ProjectMetaPatch, SiteSeismic } from "../../shared/api/types";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorAlert } from "../../shared/components/ErrorAlert";
import { StatusChip } from "../../shared/components/StatusChip";
import type { WebModuleManifest } from "../../shared/moduleTypes";
import { launcherAvailable, pickPath } from "../../shared/api/launcher";
import { groupOfModule, LAUNCHER_GROUPS, moduleStatus, nextStep, type ModuleStatus, type StatusPart } from "../launcherModel";
import { useModules } from "../moduleRegistry";
import { useProjectSession } from "../ProjectProvider";
import { ViewMenu } from "../ViewMenu";

interface SiteDraft {
  pga_g: number | string;
  mw: number | string;
  sds: number | string;
  sd1: number | string;
  site_class: string;
}

function siteKey(site: Omit<SiteSeismic, "source">): string {
  return JSON.stringify([site.pga_g ?? null, site.mw ?? null, site.sds ?? null, site.sd1 ?? null, site.site_class ?? null]);
}

function toNullableNumber(val: number | string): number | null {
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : null;
  }
  const trimmed = val.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function draftToSite(draft: SiteDraft): Omit<SiteSeismic, "source"> {
  return {
    pga_g: toNullableNumber(draft.pga_g),
    mw: toNullableNumber(draft.mw),
    sds: toNullableNumber(draft.sds),
    sd1: toNullableNumber(draft.sd1),
    site_class: draft.site_class.trim() || null,
  };
}

const DOT_VAR: Record<ModuleStatus["tone"], string> = {
  current: "ok", stale: "warn", missing: "warn", neutral: "neutral", bad: "bad", info: "info",
};

interface ModuleCardProps {
  mod: WebModuleManifest;
  status: ModuleStatus;
  renderParts: (parts: StatusPart[]) => string;
}

/** Launcher card for one module: icon tile, title, one-line description and a status line with a coloured dot. */
function ModuleCard({ mod, status, renderParts }: ModuleCardProps) {
  const { t } = useTranslation();
  const Icon = mod.icon;
  const dot = DOT_VAR[status.tone];
  return (
    <Card
      component={Link}
      to={`/m/${mod.id}`}
      data-module={mod.id}
      p="md"
      style={{ color: "inherit", textDecoration: "none", display: "flex", flexDirection: "column", gap: 12 }}
      className="gt-module-card"
    >
      <Group align="flex-start" gap="md" wrap="nowrap">
        <ThemeIcon size={40} radius="md" variant="light" color={mod.id === "education" ? "gray" : undefined}>
          <Icon size={20} />
        </ThemeIcon>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text fz={16} fw={600}>{t(mod.titleKey)}</Text>
          <Text size="sm" c="dimmed">{t(mod.descriptionKey)}</Text>
        </Box>
      </Group>
      <Group
        gap="sm"
        wrap="nowrap"
        pt={12}
        mt="auto"
        style={{ borderTop: "1px solid var(--gt-border-soft)", fontSize: 13 }}
      >
        <span
          aria-hidden="true"
          style={{ width: 8, height: 8, borderRadius: "50%", flex: "none", background: `var(--gt-${dot}-dot)` }}
        />
        <Text size="sm" style={{ flex: 1, minWidth: 0 }}>{renderParts(status.parts)}</Text>
        {status.chip && <StatusChip tone={status.chip.tone} dot={false}>{t(status.chip.key)}</StatusChip>}
      </Group>
    </Card>
  );
}

export function LauncherPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const modules = useModules();
  const { session, project, save, saveAs, close, refresh, refreshSession } = useProjectSession();

  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  // Meta edit modal state
  const [editMetaOpen, setEditMetaOpen] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaName, setMetaName] = useState("");
  const [metaNameError, setMetaNameError] = useState(false);
  const [metaNumber, setMetaNumber] = useState("");
  const [metaEngineer, setMetaEngineer] = useState("");
  const [metaDesignCode, setMetaDesignCode] = useState("");
  const [metaError, setMetaError] = useState<unknown>(null);
  const [codes, setCodes] = useState<DesignCodeSummary[]>([]);

  useEffect(() => {
    void list_codes().then(setCodes).catch(() => undefined);
  }, []);
  const defaultCode = codes[0]?.id ?? "";
  const codeOptions = useMemo(() => codes.map((c) => ({ value: c.id, label: c.name })), [codes]);

  const SITE_CLASSES = ["ZA", "ZB", "ZC", "ZD", "ZE", "ZF"];
  const currentSiteClass = project?.site.site_class ?? "";
  const siteClassOptions = useMemo(() => {
    const options = SITE_CLASSES.map((c) => ({ value: c, label: t(`launcher.site_class.${c}`) }));
    // A value saved earlier as free text stays selectable instead of silently disappearing.
    if (currentSiteClass && !SITE_CLASSES.includes(currentSiteClass)) {
      options.push({ value: currentSiteClass, label: currentSiteClass });
    }
    return options;
  }, [currentSiteClass, t]);

  // Site seismic form state
  const initialSiteDraft: SiteDraft = {
    pga_g: project?.site.pga_g ?? "",
    mw: project?.site.mw ?? "",
    sds: project?.site.sds ?? "",
    sd1: project?.site.sd1 ?? "",
    site_class: project?.site.site_class ?? "",
  };
  const [siteDraft, setSiteDraft] = useState<SiteDraft>(initialSiteDraft);
  const siteDraftRef = useRef<SiteDraft>(initialSiteDraft);
  const [savingSite, setSavingSite] = useState(false);
  // Last site values known to be on the server; blur only saves when the draft differs from them.
  const baselineSiteKey = useRef<string>(project ? siteKey(project.site) : "");
  const siteFocused = useRef(false);

  useEffect(() => {
    if (!project) return;
    const serverKey = siteKey(project.site);
    const draftKey = siteKey(draftToSite(siteDraftRef.current));
    // Never overwrite what the user is typing, nor an unsaved (e.g. failed) draft.
    if (siteFocused.current || (draftKey !== baselineSiteKey.current && draftKey !== serverKey)) return;
    baselineSiteKey.current = serverKey;
    const nextDraft: SiteDraft = {
      pga_g: project.site.pga_g ?? "",
      mw: project.site.mw ?? "",
      sds: project.site.sds ?? "",
      sd1: project.site.sd1 ?? "",
      site_class: project.site.site_class ?? "",
    };
    siteDraftRef.current = nextDraft;
    setSiteDraft(nextDraft);
  }, [project]);

  const updateSiteField = <K extends keyof SiteDraft>(key: K, value: SiteDraft[K]) => {
    const next = { ...siteDraftRef.current, [key]: value };
    siteDraftRef.current = next;
    setSiteDraft(next);
  };

  const [launcherActive, setLauncherActive] = useState(false);
  useEffect(() => {
    void launcherAvailable().then(setLauncherActive);
  }, []);

  const handleSaveProject = async () => {
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

  const handleSaveAs = async () => {
    const target = await pickPath("save");
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      await saveAs(target);
      notifications.show({ message: t("shell.saved_as", { path: target }), color: "green" });
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const performClose = async () => {
    setClosing(true);
    setError(null);
    try {
      await close();
      setConfirmCloseOpen(false);
      navigate("/start");
    } catch (err) {
      setError(err);
    } finally {
      setClosing(false);
    }
  };

  const handleCloseClick = async () => {
    // A finished job or another tab may have changed the project since the last session read.
    let dirty = session.dirty;
    try {
      dirty = (await refreshSession()).dirty;
    } catch {
      // Keep the last known flag when the session cannot be read.
    }
    if (dirty) {
      setConfirmCloseOpen(true);
      return;
    }
    void performClose();
  };

  const openEditMetaModal = () => {
    setMetaName(project?.meta.name ?? "");
    setMetaNameError(false);
    setMetaNumber(project?.meta.number ?? "");
    setMetaEngineer(project?.meta.engineer ?? "");
    setMetaDesignCode(project?.meta.design_code || defaultCode);
    setMetaError(null);
    setEditMetaOpen(true);
  };

  const handleSaveMeta = async () => {
    const trimmedName = metaName.trim();
    if (!trimmedName) {
      setMetaNameError(true);
      return;
    }
    // Only send what actually changed; an unchanged form is not an edit.
    const current = project?.meta;
    const patch: ProjectMetaPatch = {};
    if (trimmedName !== (current?.name ?? "")) patch.name = trimmedName;
    if (metaNumber.trim() !== (current?.number ?? "")) patch.number = metaNumber.trim();
    if (metaEngineer.trim() !== (current?.engineer ?? "")) patch.engineer = metaEngineer.trim();
    const code = metaDesignCode.trim();
    if (code && code !== (current?.design_code ?? "")) patch.design_code = code;
    if (Object.keys(patch).length === 0) {
      setEditMetaOpen(false);
      return;
    }
    setSavingMeta(true);
    setMetaError(null);
    try {
      await update_project_meta(patch);
      await refresh({ silent: true });
      setEditMetaOpen(false);
    } catch (err) {
      setMetaError(err);
    } finally {
      setSavingMeta(false);
    }
  };

  const handleSaveSite = async () => {
    const site = draftToSite(siteDraftRef.current);
    const key = siteKey(site);
    if (key === baselineSiteKey.current) return;
    const payload: SiteSeismic = { ...site, source: project?.site.source ?? "TBDY2018" };
    setSavingSite(true);
    setError(null);
    try {
      await set_project_site(payload);
      baselineSiteKey.current = key;
      await refresh({ silent: true });
    } catch (err) {
      setError(err);
    } finally {
      setSavingSite(false);
    }
  };

  const codeName =
    codes.find((c) => c.id === (project?.meta.design_code || defaultCode))?.name ??
    (project?.meta.design_code || defaultCode);
  const next = useMemo(() => nextStep(project), [project]);
  const grouped = useMemo(
    () => LAUNCHER_GROUPS.map((group) => ({ group, items: modules.filter((mod) => groupOfModule(mod.id) === group) })),
    [modules],
  );
  const renderStatusParts = (parts: StatusPart[]) =>
    parts.map((part) => t(part.key, part.values)).join(" · ");
  const notEntered = (value?: string) =>
    value ? <span>{value}</span> : <Text component="span" c="dimmed">{t("launcher.not_entered")}</Text>;

  return (
    <Box>
      <Box
        component="header"
        px="lg"
        py="sm"
        style={{ background: "var(--mantine-color-body)", borderBottom: "1px solid var(--gt-border)" }}
      >
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Group gap="sm" align="center" wrap="wrap">
            <Group gap={10} wrap="nowrap">
              <IconBuildingBridge size={22} color="var(--mantine-color-primary-6)" aria-hidden="true" />
              <Text fw={600} fz={17}>{t("web.header.app_short")}</Text>
            </Group>
            <VisuallyHidden component="h1">{t("launcher.title")}</VisuallyHidden>
            {project?.meta.name && <Text c="dimmed">{project.meta.name}</Text>}
            <StatusChip tone={session.dirty ? "stale" : "current"}>
              {t(session.dirty ? "shell.chip_unsaved" : "shell.chip_saved")}
            </StatusChip>
          </Group>
          <Group gap="xs" wrap="wrap">
            <Button
              variant="default"
              loading={saving}
              leftSection={<IconDeviceFloppy size={16} aria-hidden="true" />}
              onClick={() => void handleSaveProject()}
            >
              {t("shell.save")}
            </Button>
            {launcherActive && (
              <Button variant="default" disabled={saving} onClick={() => void handleSaveAs()}>
                {t("shell.save_as")}
              </Button>
            )}
            <ViewMenu />
            <Button variant="subtle" color="red" onClick={() => void handleCloseClick()}>
              {t("launcher.close_project")}
            </Button>
          </Group>
        </Group>
      </Box>

      <Box maw={1320} mx="auto" px="lg" pt="xl" pb={48}>
        {error != null && (
          <Box mb="md">
            <ErrorAlert error={error} onRetry={() => void refresh({ silent: true }).catch(() => undefined)} />
          </Box>
        )}

        <Group align="flex-start" gap="lg" wrap="wrap">
          <Stack gap="md" style={{ flex: "1 1 300px", maxWidth: 380 }}>
            <Card>
              <Group justify="space-between" align="center" mb="sm">
                <Title order={2} fz={15} fw={600}>{t("launcher.project_heading")}</Title>
                <Button size="compact-md" variant="default" onClick={openEditMetaModal}>
                  {t("launcher.edit")}
                </Button>
              </Group>
              <Box style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px 12px" }}>
                <Text size="sm" c="dimmed">{t("web.project.name")}</Text>
                <Text size="sm" fw={500}>{notEntered(project?.meta.name)}</Text>
                <Text size="sm" c="dimmed">{t("web.project.number")}</Text>
                <Text size="sm">{notEntered(project?.meta.number)}</Text>
                <Text size="sm" c="dimmed">{t("web.project.engineer")}</Text>
                <Text size="sm">{notEntered(project?.meta.engineer)}</Text>
                <Text size="sm" c="dimmed">{t("launcher.design_code")}</Text>
                <Text size="sm">{notEntered(codeName)}</Text>
              </Box>
            </Card>

            <Card>
              <Stack
                gap="xs"
                onFocus={() => { siteFocused.current = true; }}
                onBlur={(event) => {
                  siteFocused.current = event.currentTarget.contains(event.relatedTarget as Node | null);
                }}
              >
                <Title order={2} fz={15} fw={600}>{t("launcher.site_heading")}</Title>
                <Text size="xs" c="dimmed" mb={4}>{t("launcher.site_note")}</Text>
                <SimpleGrid cols={2} spacing="sm">
                  <NumberInput
                    label={t("launcher.pga_g")}
                    placeholder={t("launcher.empty_value")}
                    value={siteDraft.pga_g}
                    step={0.05}
                    decimalScale={3}
                    hideControls
                    rightSection={<Text size="xs" c="dimmed">{t("launcher.unit_g")}</Text>}
                    rightSectionPointerEvents="none"
                    onChange={(val) => updateSiteField("pga_g", val)}
                    onBlur={() => void handleSaveSite()}
                  />
                  <NumberInput
                    label={t("launcher.mw")}
                    placeholder={t("launcher.empty_value")}
                    value={siteDraft.mw}
                    step={0.1}
                    decimalScale={2}
                    hideControls
                    rightSection={<Text size="xs" c="dimmed">{t("launcher.unit_mw")}</Text>}
                    rightSectionPointerEvents="none"
                    onChange={(val) => updateSiteField("mw", val)}
                    onBlur={() => void handleSaveSite()}
                  />
                  <NumberInput
                    label={t("launcher.sds")}
                    placeholder={t("launcher.empty_value")}
                    value={siteDraft.sds}
                    step={0.05}
                    decimalScale={3}
                    hideControls
                    onChange={(val) => updateSiteField("sds", val)}
                    onBlur={() => void handleSaveSite()}
                  />
                  <NumberInput
                    label={t("launcher.sd1")}
                    placeholder={t("launcher.empty_value")}
                    value={siteDraft.sd1}
                    step={0.05}
                    decimalScale={3}
                    hideControls
                    onChange={(val) => updateSiteField("sd1", val)}
                    onBlur={() => void handleSaveSite()}
                  />
                </SimpleGrid>
                <Select
                  label={t("launcher.site_class")}
                  placeholder={t("launcher.site_class_placeholder")}
                  data={siteClassOptions}
                  value={siteDraft.site_class || null}
                  clearable
                  onChange={(value) => {
                    updateSiteField("site_class", value ?? "");
                    void handleSaveSite();
                  }}
                />
              </Stack>
            </Card>
          </Stack>

          <Stack gap="lg" style={{ flex: "999 1 620px", minWidth: 0 }}>
            {next && (
              <Card
                p="md"
                style={{ background: "var(--gt-info-bg)", borderColor: "var(--mantine-color-primary-2)" }}
                data-next-step={next.kind}
              >
                <Group gap="md" wrap="wrap">
                  <ThemeIcon size={40} radius="md" variant="filled">
                    <IconArrowRight size={20} aria-hidden="true" />
                  </ThemeIcon>
                  <Box style={{ flex: 1, minWidth: 240 }}>
                    <Text fw={600}>{t(next.titleKey)}</Text>
                    <Text size="sm" c="dimmed">{t(next.textKey, next.textValues)}</Text>
                  </Box>
                  <Button onClick={() => navigate(`/m/${next.moduleId}`)}>{t(next.actionKey)}</Button>
                </Group>
              </Card>
            )}

            {modules.length === 0 ? (
              <EmptyState title={t("shell.module_not_found")} description="" />
            ) : (
              grouped.filter(({ items }) => items.length > 0).map(({ group, items }) => (
                <Stack key={group} gap="sm" component="section" aria-label={t(`launcher.group.${group}`)}>
                  <Group gap={8} align="center">
                    <Badge size="sm" variant="light" radius="xl">{LAUNCHER_GROUPS.indexOf(group) + 1}</Badge>
                    <Text fz={12} fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.06em" }}>
                      {t(`launcher.group.${group}`)}
                    </Text>
                  </Group>
                  <SimpleGrid cols={{ base: 1, sm: group === "soil" ? 1 : 2 }} spacing="md">
                    {items.map((mod) => (
                      <ModuleCard key={mod.id} mod={mod} status={moduleStatus(mod.id, project)} renderParts={renderStatusParts} />
                    ))}
                  </SimpleGrid>
                </Stack>
              ))
            )}
          </Stack>
        </Group>
      </Box>

      {/* Edit Project Meta Modal */}
      <Modal
        opened={editMetaOpen}
        onClose={() => setEditMetaOpen(false)}
        title={t("launcher.project_heading")}
        size="md"
      >
        <Stack gap="sm">
          {metaError != null && <ErrorAlert error={metaError} />}
          <TextInput
            required
            label={t("web.project.name")}
            value={metaName}
            error={metaNameError ? t("start.new.name_required") : null}
            onChange={(e) => {
              setMetaName(e.currentTarget.value);
              if (metaNameError && e.currentTarget.value.trim()) {
                setMetaNameError(false);
              }
            }}
          />
          <TextInput
            label={t("web.project.number")}
            value={metaNumber}
            onChange={(e) => setMetaNumber(e.currentTarget.value)}
          />
          <TextInput
            label={t("web.project.engineer")}
            value={metaEngineer}
            onChange={(e) => setMetaEngineer(e.currentTarget.value)}
          />
          {codeOptions.length > 0 ? (
            <Select
              label={t("start.new.design_code")}
              value={metaDesignCode || null}
              onChange={(val) => { if (val) setMetaDesignCode(val); }}
              data={codeOptions}
              allowDeselect={false}
            />
          ) : (
            <TextInput
              label={t("start.new.design_code")}
              value={metaDesignCode}
              onChange={(e) => setMetaDesignCode(e.currentTarget.value)}
            />
          )}
          <Group justify="flex-end" gap="xs" mt="xs">
            <Button variant="default" onClick={() => setEditMetaOpen(false)}>
              {t("web.common.cancel")}
            </Button>
            <Button loading={savingMeta} onClick={() => void handleSaveMeta()}>
              {t("shell.save")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Unsaved Changes Confirm Close Modal */}
      <Modal
        opened={confirmCloseOpen}
        onClose={() => setConfirmCloseOpen(false)}
        title={t("shell.unsaved")}
        size="sm"
      >
        <Stack gap="sm">
          <Text size="sm">{t("launcher.close_unsaved_confirm")}</Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setConfirmCloseOpen(false)}>
              {t("web.common.cancel")}
            </Button>
            <Button color="red" loading={closing} onClick={() => void performClose()}>
              {t("launcher.close_project")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

