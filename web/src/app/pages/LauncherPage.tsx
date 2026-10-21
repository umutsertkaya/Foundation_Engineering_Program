import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Container,
  Grid,
  Group,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowRight,
  IconCheck,
  IconDeviceFloppy,
  IconLogout,
  IconPencil,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { list_codes, set_project_site, update_project_meta } from "../../shared/api/client";
import type { DesignCodeSummary, Language, ProjectMetaPatch, SiteSeismic } from "../../shared/api/types";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorAlert } from "../../shared/components/ErrorAlert";
import { loadLanguageCatalog } from "../i18n";
import { useModules } from "../moduleRegistry";
import { useProjectSession } from "../ProjectProvider";
import { ThemeToggle } from "../ThemeToggle";

const LANG_STORAGE_KEY = "geotek.lang";

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

export function LauncherPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const modules = useModules();
  const { session, project, save, close, refresh, refreshSession } = useProjectSession();

  const currentLang: Language = i18n.language === "en" ? "en" : "tr";

  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [hoveredModuleId, setHoveredModuleId] = useState<string | null>(null);

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

  const handleLanguageChange = (nextLang: Language) => {
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, nextLang);
    } catch {
      // Ignore storage errors
    }
    void i18n.changeLanguage(nextLang);
    void loadLanguageCatalog(nextLang);
  };

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

  return (
    <Container size="xl" py="md">
      <Stack gap="md">
        {/* Header Bar */}
        <Paper withBorder px="md" py="sm" radius="sm">
          <Group justify="space-between" align="center" wrap="wrap" gap="sm">
            <Group gap="sm" align="center" wrap="wrap">
              <Title order={3}>{t("launcher.title")}</Title>
              {project?.meta.name && (
                <Text fw={600} size="sm" c="dimmed">
                  {project.meta.name}
                </Text>
              )}
              {session.dirty && (
                <Badge color="yellow" variant="light">
                  {t("shell.unsaved")}
                </Badge>
              )}
            </Group>

            <Group gap="xs" wrap="wrap">
              <Button
                size="xs"
                loading={saving}
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={() => void handleSaveProject()}
              >
                {t("shell.save")}
              </Button>
              <SegmentedControl
                size="xs"
                aria-label={t("web.header.lang_switch")}
                value={currentLang}
                onChange={(val) => handleLanguageChange(val as Language)}
                data={[
                  { value: "tr", label: "TR" },
                  { value: "en", label: "EN" },
                ]}
              />
              <ThemeToggle />
              <Button
                size="xs"
                variant="subtle"
                color="red"
                leftSection={<IconLogout size={16} />}
                onClick={() => void handleCloseClick()}
              >
                {t("launcher.close_project")}
              </Button>
            </Group>
          </Group>
        </Paper>

        {error != null && <ErrorAlert error={error} onRetry={() => void refresh({ silent: true }).catch(() => undefined)} />}

        {/* Main 2-column content */}
        <Grid gutter="md" align="flex-start">
          {/* Left column (≈ 1/3) */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="md">
              {/* Project Meta Card */}
              <Card withBorder padding="md" radius="sm">
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Title order={4}>{t("launcher.project_heading")}</Title>
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconPencil size={14} />}
                      onClick={openEditMetaModal}
                    >
                      {t("launcher.edit")}
                    </Button>
                  </Group>

                  <Table withRowBorders={false} verticalSpacing={4}>
                    <Table.Tbody>
                      <Table.Tr>
                        <Table.Td c="dimmed" pl={0}>
                          {t("web.project.name")}
                        </Table.Td>
                        <Table.Td fw={600} pr={0}>
                          {project?.meta.name || t("web.common.none")}
                        </Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td c="dimmed" pl={0}>
                          {t("web.project.number")}
                        </Table.Td>
                        <Table.Td ff="monospace" pr={0}>
                          {project?.meta.number || t("web.common.none")}
                        </Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td c="dimmed" pl={0}>
                          {t("web.project.engineer")}
                        </Table.Td>
                        <Table.Td pr={0}>
                          {project?.meta.engineer || t("web.common.none")}
                        </Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td c="dimmed" pl={0}>
                          {t("start.new.design_code")}
                        </Table.Td>
                        <Table.Td
                          ff="monospace"
                          pr={0}
                          style={{ textTransform: "uppercase" }}
                        >
                          {codes.find((c) => c.id === (project?.meta.design_code || defaultCode))?.name ?? (project?.meta.design_code || defaultCode || t("web.common.none"))}
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>

                  <Group gap="xs">
                    <Badge variant="light">
                      {t("launcher.profiles_count", {
                        count: project?.counts.profiles ?? 0,
                      })}
                    </Badge>
                    <Badge variant="light" color="teal">
                      {t("launcher.structures_count", {
                        count: project?.counts.structures ?? 0,
                      })}
                    </Badge>
                  </Group>
                </Stack>
              </Card>

              {/* Site Seismic Card */}
              <Card withBorder padding="md" radius="sm">
                <Stack
                  gap="xs"
                  onFocus={() => { siteFocused.current = true; }}
                  onBlur={(event) => {
                    siteFocused.current = event.currentTarget.contains(event.relatedTarget as Node | null);
                  }}
                >
                  <Group justify="space-between" align="center">
                    <Title order={4}>{t("launcher.site_heading")}</Title>
                    <Tooltip label={t("ui.apply")}>
                      <ActionIcon
                        variant="light"
                        size="sm"
                        loading={savingSite}
                        aria-label={t("ui.apply")}
                        onClick={() => void handleSaveSite()}
                      >
                        <IconCheck size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>

                  <SimpleGrid cols={2} spacing="xs">
                    <NumberInput
                      size="xs"
                      label={t("launcher.pga_g")}
                      value={siteDraft.pga_g}
                      step={0.05}
                      decimalScale={3}
                      onChange={(val) => updateSiteField("pga_g", val)}
                      onBlur={() => void handleSaveSite()}
                    />
                    <NumberInput
                      size="xs"
                      label={t("launcher.mw")}
                      value={siteDraft.mw}
                      step={0.1}
                      decimalScale={2}
                      onChange={(val) => updateSiteField("mw", val)}
                      onBlur={() => void handleSaveSite()}
                    />
                    <NumberInput
                      size="xs"
                      label={t("launcher.sds")}
                      value={siteDraft.sds}
                      step={0.05}
                      decimalScale={3}
                      onChange={(val) => updateSiteField("sds", val)}
                      onBlur={() => void handleSaveSite()}
                    />
                    <NumberInput
                      size="xs"
                      label={t("launcher.sd1")}
                      value={siteDraft.sd1}
                      step={0.05}
                      decimalScale={3}
                      onChange={(val) => updateSiteField("sd1", val)}
                      onBlur={() => void handleSaveSite()}
                    />
                  </SimpleGrid>

                  <Select
                    size="xs"
                    label={t("launcher.site_class")}
                    description={t("launcher.site_class_hint")}
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
          </Grid.Col>

          {/* Right column (≈ 2/3) */}
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap="sm">
              <Title order={4}>{t("launcher.modules_heading")}</Title>
              {modules.length === 0 ? (
                <EmptyState title={t("shell.module_not_found")} description="" />
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  {modules.map((mod) => {
                    const Icon = mod.icon;
                    const isHovered = hoveredModuleId === mod.id;
                    return (
                      <Card
                        key={mod.id}
                        withBorder
                        padding="lg"
                        radius="sm"
                        shadow={isHovered ? "md" : "xs"}
                        onClick={() => navigate(`/m/${mod.id}`)}
                        onMouseEnter={() => setHoveredModuleId(mod.id)}
                        onMouseLeave={() =>
                          setHoveredModuleId((prev) => (prev === mod.id ? null : prev))
                        }
                        style={{
                          cursor: "pointer",
                          transition: "box-shadow 150ms ease",
                        }}
                      >
                        <Stack gap="md" h="100%" justify="space-between">
                          <Group align="flex-start" gap="md" wrap="nowrap">
                            <ThemeIcon size={54} radius="md" variant="light">
                              <Icon size={36} />
                            </ThemeIcon>
                            <Stack gap={4} style={{ flex: 1 }}>
                              <Title order={4}>{t(mod.titleKey)}</Title>
                              <Text size="sm" c="dimmed">
                                {t(mod.descriptionKey)}
                              </Text>
                            </Stack>
                          </Group>

                          <Button
                            variant="light"
                            fullWidth
                            rightSection={<IconArrowRight size={16} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/m/${mod.id}`);
                            }}
                          >
                            {t("launcher.open_module")}
                          </Button>
                        </Stack>
                      </Card>
                    );
                  })}
                </SimpleGrid>
              )}
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>

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
    </Container>
  );
}

