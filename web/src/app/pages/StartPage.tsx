import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Anchor,
  Alert,
  Button,
  Container,
  FileInput,
  Group,
  Loader,
  Menu,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCopy,
  IconDownload,
  IconDotsVertical,
  IconFileExport,
  IconFileImport,
  IconFolderOpen,
  IconPencil,
  IconPlus,
  IconSettings,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ApiError, list_codes } from "../../shared/api/client";
import {
  delete_library_project,
  duplicate_library_project,
  export_library_project,
  get_settings,
  import_library_project,
  library_download_url,
  upload_library_project,
  list_library,
  rename_library_project,
} from "../../shared/api/core";
import type {
  AppSettings,
  DesignCodeSummary,
  Language,
  LibraryEntry,
} from "../../shared/api/types";
import { EmptyState } from "../../shared/components/EmptyState";
import { launcherAvailable, pickPath } from "../../shared/api/launcher";
import { ErrorAlert } from "../../shared/components/ErrorAlert";
import { PageHeader } from "../../shared/components/PageHeader";
import { SectionCard } from "../../shared/components/SectionCard";
import { StatusChip } from "../../shared/components/StatusChip";
import { loadLanguageCatalog } from "../i18n";
import { useProjectSession } from "../ProjectProvider";
import { ThemeToggle } from "../ThemeToggle";

const LANG_STORAGE_KEY = "geotek.lang";

function formatModified(iso: string, lang: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString(lang);
}

export function StartPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { session, openFromLibrary, createInLibrary, openAtPath, refresh: refreshProject, refreshSession } = useProjectSession();

  const currentLang: Language = i18n.language === "en" ? "en" : "tr";

  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [codes, setCodes] = useState<DesignCodeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // New project modal state
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNameError, setNewNameError] = useState(false);
  const [newNumber, setNewNumber] = useState("");
  const [newEngineer, setNewEngineer] = useState("");
  const [newLang, setNewLang] = useState<Language>(currentLang);
  const [newCode, setNewCode] = useState<string>("");
  const [newApiError, setNewApiError] = useState<unknown>(null);

  // Replacing an open project with unsaved changes needs an explicit go-ahead.
  const [pendingReplace, setPendingReplace] = useState<(() => Promise<void>) | null>(null);

  // Import modal state
  const [importOpen, setImportOpen] = useState(false);
  const [importPath, setImportPath] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importApiError, setImportApiError] = useState<unknown>(null);

  // Rename modal state
  const [renameTarget, setRenameTarget] = useState<LibraryEntry | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState(false);
  const [renameApiError, setRenameApiError] = useState<unknown>(null);

  // Export modal state
  const [exportTarget, setExportTarget] = useState<LibraryEntry | null>(null);
  const [exportDest, setExportDest] = useState("");
  const [exportApiError, setExportApiError] = useState<unknown>(null);
  const [exportConflict, setExportConflict] = useState(false);

  // Delete confirm modal state
  const [deleteTarget, setDeleteTarget] = useState<LibraryEntry | null>(null);
  const [deleteApiError, setDeleteApiError] = useState<unknown>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await list_library();
      setEntries(items);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
    void get_settings()
      .then((s) => setSettings(s))
      .catch(() => undefined);
    void list_codes()
      .then((c) => {
        setCodes(c);
        if (c.length > 0) {
          setNewCode((prev) => (c.some((item) => item.id === prev) ? prev : c[0].id));
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const refreshLibrary = useCallback(async () => {
    const items = await list_library();
    setEntries(items);
  }, []);

  const recentEntries = useMemo(
    () =>
      [...entries]
        .sort((a, b) => b.modified.localeCompare(a.modified))
        .slice(0, 5),
    [entries],
  );

  const codeOptions = useMemo(() => {
    return codes.map((c) => ({ value: c.id, label: c.name }));
  }, [codes]);

  const handleLanguageChange = (nextLang: Language) => {
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, nextLang);
    } catch {
      // Ignore storage errors
    }
    void i18n.changeLanguage(nextLang);
    void loadLanguageCatalog(nextLang);
  };

  /** Re-reads the session first: a finished job or another tab may have changed the project meanwhile. */
  const hasUnsavedProject = async (): Promise<boolean> => {
    let current = session;
    try {
      current = await refreshSession();
    } catch {
      // Keep the last known session when it cannot be read.
    }
    return current.open && current.dirty;
  };

  const performOpen = async (file: string) => {
    setBusy(true);
    setError(null);
    try {
      await openFromLibrary(file);
      navigate("/launcher");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async (file: string) => {
    if (await hasUnsavedProject()) {
      setPendingReplace(() => () => performOpen(file));
      return;
    }
    await performOpen(file);
  };

  const [launcherActive, setLauncherActive] = useState(false);
  const [newDirectory, setNewDirectory] = useState("");
  const [locOpen, setLocOpen] = useState(false);
  const [locPath, setLocPath] = useState("");
  const [locApiError, setLocApiError] = useState<unknown>(null);

  useEffect(() => {
    void launcherAvailable().then(setLauncherActive);
  }, []);

  const performOpenAtPath = async (path: string) => {
    setBusy(true);
    setLocApiError(null);
    try {
      await openAtPath(path);
      setLocOpen(false);
      navigate("/launcher");
    } catch (err) {
      setLocApiError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleOpenAtPath = async () => {
    const path = locPath.trim();
    if (!path) return;
    if (await hasUnsavedProject()) {
      setPendingReplace(() => () => performOpenAtPath(path));
      return;
    }
    await performOpenAtPath(path);
  };

  const openNewModal = () => {
    setNewDirectory("");
    setNewName("");
    setNewNameError(false);
    setNewNumber("");
    setNewEngineer("");
    setNewLang(currentLang);
    setNewCode(codes[0]?.id ?? "");
    setNewApiError(null);
    setNewOpen(true);
  };

  const performCreate = async (trimmedName: string) => {
    setBusy(true);
    setNewApiError(null);
    try {
      await createInLibrary({
        name: trimmedName,
        number: newNumber.trim() || undefined,
        engineer: newEngineer.trim() || undefined,
        language: newLang,
        design_code: newCode || undefined,
        directory: newDirectory.trim() || undefined,
      });
      setNewOpen(false);
      navigate("/launcher");
    } catch (err) {
      setNewApiError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateProject = async () => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      setNewNameError(true);
      return;
    }
    if (await hasUnsavedProject()) {
      setPendingReplace(() => () => performCreate(trimmedName));
      return;
    }
    await performCreate(trimmedName);
  };

  const handleImport = async () => {
    const trimmed = importPath.trim();
    if (!trimmed && !importFile) return;
    setBusy(true);
    setImportApiError(null);
    try {
      const imported = importFile
        ? await upload_library_project(importFile)
        : await import_library_project(trimmed);
      setImportFile(null);
      setImportPath("");
      await refreshLibrary();
      setImportOpen(false);
      notifications.show({ message: imported.name || imported.file, color: "green" });
    } catch (err) {
      setImportApiError(err);
    } finally {
      setBusy(false);
    }
  };

  const openRenameModal = (entry: LibraryEntry) => {
    setRenameTarget(entry);
    setRenameValue(entry.name);
    setRenameError(false);
    setRenameApiError(null);
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError(true);
      return;
    }
    setBusy(true);
    setRenameApiError(null);
    try {
      const updated = await rename_library_project(renameTarget.file, trimmed);
      await refreshLibrary();
      // The open session follows the renamed file, so its name may have changed.
      void refreshProject({ silent: true }).catch(() => undefined);
      setRenameTarget(null);
      notifications.show({ message: t("start.renamed", { name: updated.name }), color: "green" });
    } catch (err) {
      setRenameApiError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicate = async (file: string) => {
    setBusy(true);
    setError(null);
    try {
      const copy = await duplicate_library_project(file);
      await refreshLibrary();
      notifications.show({ message: t("start.duplicated", { name: copy.name }), color: "green" });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const openExportModal = (entry: LibraryEntry) => {
    setExportTarget(entry);
    setExportDest("");
    setExportApiError(null);
    setExportConflict(false);
  };

  const handleExport = async () => {
    if (!exportTarget) return;
    const dest = exportDest.trim();
    if (!dest) return;
    setBusy(true);
    setExportApiError(null);
    try {
      const res = await export_library_project(exportTarget.file, dest, exportConflict);
      setExportTarget(null);
      notifications.show({ message: res.path, color: "green" });
    } catch (err) {
      if (!exportConflict && err instanceof ApiError && err.code === "file_exists") {
        // Ask before replacing; the next attempt retries with overwrite=true.
        setExportConflict(true);
      } else {
        setExportApiError(err);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setDeleteApiError(null);
    try {
      await delete_library_project(deleteTarget.file);
      await refreshLibrary();
      setDeleteTarget(null);
    } catch (err) {
      setDeleteApiError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container size={1100} py="xl">
      <Stack gap="lg">
        {/* Header */}
        <PageHeader
          title={t("start.app_title")}
          lead={t("start.subtitle")}
          actions={
        <Group gap="xs">
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
          <Tooltip label={t("start.settings_tooltip")}>
            <ActionIcon
              variant="default"
              size="lg"
              aria-label={t("start.settings_tooltip")}
              onClick={() => navigate("/settings")}
            >
              <IconSettings size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
          }
        />

        {/* Primary actions */}
        <Group gap="sm">
          <Button leftSection={<IconPlus size={16} />} onClick={openNewModal}>
            {t("start.new_project")}
          </Button>
          <Button
            variant="default"
            leftSection={<IconFolderOpen size={16} />}
            onClick={() => { setLocApiError(null); setLocPath(""); setLocOpen(true); }}
          >
            {t("start.open_location")}
          </Button>
          <Button
            variant="light"
            leftSection={<IconFileImport size={16} />}
            onClick={() => {
              setImportPath("");
              setImportApiError(null);
              setImportOpen(true);
            }}
          >
            {t("start.import")}
          </Button>
        </Group>

        {error != null && <ErrorAlert error={error} onRetry={() => void loadData()} />}

        {loading ? (
          <Loader />
        ) : (
          <>
            {/* Top card: Recent projects (first 5 by modified) */}
            {recentEntries.length > 0 && (
              <SectionCard title={t("start.recent_title")}>
                <Stack gap="xs">
                  <Group gap="xs" wrap="wrap">
                    {recentEntries.map((entry) => (
                      <Button
                        key={entry.file}
                        variant="light"
                        size="xs"
                        disabled={entry.error != null || busy}
                        onClick={() => void handleOpen(entry.file)}
                      >
                        {entry.name || entry.file}
                      </Button>
                    ))}
                  </Group>
                </Stack>
              </SectionCard>
            )}

            {/* Main card: Project library table */}
            <SectionCard title={t("start.library_title")}>
              <Stack gap="sm">
                {entries.length === 0 ? (
                  <EmptyState title={t("start.library_empty")} description="" />
                ) : (
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{t("start.col.name")}</Table.Th>
                        <Table.Th>{t("start.col.number")}</Table.Th>
                        <Table.Th>{t("start.col.engineer")}</Table.Th>
                        <Table.Th>{t("start.col.modified")}</Table.Th>
                        <Table.Th />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {entries.map((entry) => {
                        const isCorrupt = entry.error != null;
                        return (
                          <Table.Tr key={entry.file}>
                            <Table.Td>
                              <Group gap="xs" wrap="nowrap">
                                <Text size="sm" fw={500}>
                                  {entry.name || entry.file}
                                </Text>
                                {isCorrupt && (
                                  <StatusChip tone="bad">{t("start.corrupt_badge")}</StatusChip>
                                )}
                              </Group>
                            </Table.Td>
                            <Table.Td>{entry.number}</Table.Td>
                            <Table.Td>{entry.engineer}</Table.Td>
                            <Table.Td>{formatModified(entry.modified, currentLang)}</Table.Td>
                            <Table.Td>
                              <Group gap="xs" justify="flex-end" wrap="nowrap">
                                <Menu shadow="md" position="bottom-end" withinPortal>
                                  <Menu.Target>
                                    <ActionIcon
                                      variant="subtle"
                                      aria-label={t("start.row_actions", { name: entry.name || entry.file })}
                                      data-testid={`row-actions-${entry.file}`}
                                    >
                                      <IconDotsVertical size={16} />
                                    </ActionIcon>
                                  </Menu.Target>
                                  <Menu.Dropdown>
                                    <Menu.Item
                                      leftSection={<IconFolderOpen size={14} />}
                                      disabled={isCorrupt}
                                      onClick={() => void handleOpen(entry.file)}
                                    >
                                      {t("start.action.open")}
                                    </Menu.Item>
                                    <Menu.Item
                                      leftSection={<IconPencil size={14} />}
                                      disabled={isCorrupt}
                                      onClick={() => openRenameModal(entry)}
                                    >
                                      {t("start.action.rename")}
                                    </Menu.Item>
                                    <Menu.Item
                                      leftSection={<IconCopy size={14} />}
                                      disabled={isCorrupt}
                                      onClick={() => void handleDuplicate(entry.file)}
                                    >
                                      {t("start.action.duplicate")}
                                    </Menu.Item>
                                    <Menu.Item
                                      component="a"
                                      href={library_download_url(entry.file)}
                                      download={entry.file}
                                      leftSection={<IconDownload size={14} />}
                                      disabled={isCorrupt}
                                    >
                                      {t("start.action.download")}
                                    </Menu.Item>
                                    <Menu.Item
                                      leftSection={<IconFileExport size={14} />}
                                      disabled={isCorrupt}
                                      onClick={() => openExportModal(entry)}
                                    >
                                      {t("start.action.export")}
                                    </Menu.Item>
                                    <Menu.Item
                                      color="red"
                                      leftSection={<IconTrash size={14} />}
                                      onClick={() => { setDeleteApiError(null); setDeleteTarget(entry); }}
                                    >
                                      {t("start.action.delete")}
                                    </Menu.Item>
                                  </Menu.Dropdown>
                                </Menu>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                )}
              </Stack>
            </SectionCard>
          </>
        )}

        {/* Footer */}
        {settings && (
          <Text size="xs" c="dimmed">
            {t("start.library_path", { path: settings.library_dir })}{" "}
            <Anchor size="xs" onClick={() => navigate("/settings")}>
              {t("start.change_folder")}
            </Anchor>
          </Text>
        )}
      </Stack>

      {/* New Project Modal */}
      <Modal
        opened={newOpen}
        onClose={() => setNewOpen(false)}
        title={t("start.new.title")}
        size="md"
      >
        <Stack gap="sm">
          {newApiError != null && <ErrorAlert error={newApiError} />}
          <TextInput
            required
            data-autofocus
            label={t("start.new.name")}
            value={newName}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) void handleCreateProject();
            }}
            error={newNameError ? t("start.new.name_required") : null}
            onChange={(e) => {
              setNewName(e.currentTarget.value);
              if (newNameError && e.currentTarget.value.trim()) {
                setNewNameError(false);
              }
            }}
          />
          <TextInput
            label={t("start.new.number")}
            value={newNumber}
            onChange={(e) => setNewNumber(e.currentTarget.value)}
          />
          <TextInput
            label={t("start.new.engineer")}
            value={newEngineer}
            onChange={(e) => setNewEngineer(e.currentTarget.value)}
          />
          <Select
            label={t("start.new.language")}
            value={newLang}
            onChange={(val) => {
              if (val === "tr" || val === "en") setNewLang(val);
            }}
            data={[
              { value: "tr", label: "TR" },
              { value: "en", label: "EN" },
            ]}
            allowDeselect={false}
          />
          <Select
            label={t("start.new.design_code")}
            value={newCode}
            onChange={(val) => {
              if (val) setNewCode(val);
            }}
            data={codeOptions}
            allowDeselect={false}
            disabled={codeOptions.length === 0}
          />
          <Group align="flex-end" gap="xs" wrap="nowrap">
            <TextInput
              style={{ flex: 1 }}
              label={t("start.new.directory")}
              description={t("start.new.directory_help")}
              value={newDirectory}
              onChange={(e) => setNewDirectory(e.currentTarget.value)}
            />
            {launcherActive && (
              <Button
                variant="light"
                onClick={() => void pickPath("folder", newDirectory).then((p) => { if (p) setNewDirectory(p); })}
              >
                {t("settings.browse")}
              </Button>
            )}
          </Group>
          <Group justify="flex-end" gap="xs" mt="xs">
            <Button variant="default" onClick={() => setNewOpen(false)}>
              {t("start.new.cancel")}
            </Button>
            <Button loading={busy} onClick={() => void handleCreateProject()}>
              {t("start.new.create")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Open from location */}
      <Modal
        opened={locOpen}
        onClose={() => setLocOpen(false)}
        title={t("start.open_location_title")}
        size="md"
      >
        <Stack gap="sm">
          {locApiError != null && <ErrorAlert error={locApiError} />}
          <Group align="flex-end" gap="xs" wrap="nowrap">
            <TextInput
              style={{ flex: 1 }}
              label={t("start.open_location_path")}
              description={t("start.open_location_help")}
              value={locPath}
              onChange={(e) => setLocPath(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) void handleOpenAtPath();
              }}
            />
            {launcherActive && (
              <Button
                variant="light"
                onClick={() => void pickPath("open", locPath).then((p) => { if (p) setLocPath(p); })}
              >
                {t("settings.browse")}
              </Button>
            )}
          </Group>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setLocOpen(false)}>
              {t("start.new.cancel")}
            </Button>
            <Button loading={busy} disabled={!locPath.trim()} onClick={() => void handleOpenAtPath()}>
              {t("start.action.open")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Import Modal */}
      <Modal
        opened={importOpen}
        onClose={() => setImportOpen(false)}
        title={t("start.import")}
        size="sm"
      >
        <Stack gap="sm">
          {importApiError != null && <ErrorAlert error={importApiError} />}
          <FileInput
            label={t("start.import_file")}
            placeholder={t("start.import_choose")}
            accept=".gtk"
            clearable
            value={importFile}
            onChange={setImportFile}
            data-testid="import-file"
          />
          <TextInput
            label={t("start.import_or_path")}
            disabled={importFile !== null}
            value={importPath}
            onChange={(e) => setImportPath(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) void handleImport();
            }}
          />
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setImportOpen(false)}>
              {t("start.new.cancel")}
            </Button>
            <Button loading={busy} onClick={() => void handleImport()}>
              {t("start.import")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Rename Modal */}
      <Modal
        opened={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title={t("start.rename.title")}
        size="sm"
      >
        <Stack gap="sm">
          {renameApiError != null && <ErrorAlert error={renameApiError} />}
          <TextInput
            required
            label={t("start.rename.label")}
            value={renameValue}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) void handleRename();
            }}
            error={renameError ? t("start.new.name_required") : null}
            onChange={(e) => {
              setRenameValue(e.currentTarget.value);
              if (renameError && e.currentTarget.value.trim()) {
                setRenameError(false);
              }
            }}
          />
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setRenameTarget(null)}>
              {t("start.new.cancel")}
            </Button>
            <Button loading={busy} onClick={() => void handleRename()}>
              {t("start.action.rename")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Export Modal */}
      <Modal
        opened={exportTarget !== null}
        onClose={() => setExportTarget(null)}
        title={t("start.action.export")}
        size="sm"
      >
        <Stack gap="sm">
          {exportApiError != null && <ErrorAlert error={exportApiError} />}
          {exportConflict && (
            <Alert color="yellow" variant="light" role="alert">
              {t("start.export.exists_confirm")}
            </Alert>
          )}
          <TextInput
            label={t("start.action.export")}
            value={exportDest}
            onChange={(e) => {
              setExportDest(e.currentTarget.value);
              setExportConflict(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) void handleExport();
            }}
          />
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setExportTarget(null)}>
              {t("start.new.cancel")}
            </Button>
            <Button
              color={exportConflict ? "red" : undefined}
              loading={busy}
              onClick={() => void handleExport()}
            >
              {exportConflict ? t("start.export.overwrite") : t("start.action.export")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        opened={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("start.delete_confirm.title")}
        size="sm"
      >
        <Stack gap="sm">
          {deleteApiError != null && <ErrorAlert error={deleteApiError} />}
          <Text size="sm">
            {t("start.delete_confirm.body", {
              name: deleteTarget?.name || deleteTarget?.file || "",
            })}
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setDeleteTarget(null)}>
              {t("start.new.cancel")}
            </Button>
            <Button color="red" loading={busy} onClick={() => void handleDelete()}>
              {t("start.action.delete")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Replace-open-project confirm */}
      <Modal
        opened={pendingReplace !== null}
        onClose={() => setPendingReplace(null)}
        title={t("shell.unsaved")}
        size="sm"
      >
        <Stack gap="sm">
          <Text size="sm">{t("start.open_unsaved_confirm")}</Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setPendingReplace(null)}>
              {t("start.new.cancel")}
            </Button>
            <Button
              color="red"
              loading={busy}
              onClick={() => {
                const run = pendingReplace;
                setPendingReplace(null);
                if (run) void run();
              }}
            >
              {t("start.continue")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}

