import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  Container,
  Group,
  Loader,
  Select,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconDeviceFloppy, IconFolderSearch, IconRotate } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { get_settings, put_settings } from "../../shared/api/core";
import type { Language } from "../../shared/api/types";
import { launcherAvailable, pickPath } from "../../shared/api/launcher";
import { ErrorAlert } from "../../shared/components/ErrorAlert";
import { loadLanguageCatalog } from "../i18n";

const LANG_STORAGE_KEY = "geotek.lang";

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [initialLibraryDir, setInitialLibraryDir] = useState("");
  const [libraryDir, setLibraryDir] = useState("");
  const [language, setLanguage] = useState<Language>(i18n.language === "en" ? "en" : "tr");
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await get_settings();
      setInitialLibraryDir(data.library_dir);
      setLibraryDir(data.library_dir);
      setLanguage(data.language);
      setRecent(data.recent);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const [launcherActive, setLauncherActive] = useState(false);

  useEffect(() => {
    void launcherAvailable().then(setLauncherActive);
  }, []);

  const handleBrowse = async () => {
    const path = await pickPath("folder", libraryDir);
    if (path) setLibraryDir(path);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await put_settings({
        library_dir: libraryDir,
        language,
        recent,
      });
      setInitialLibraryDir(saved.library_dir);
      setLibraryDir(saved.library_dir);
      setLanguage(saved.language);
      setRecent(saved.recent);
      try {
        window.localStorage.setItem(LANG_STORAGE_KEY, saved.language);
      } catch {
        // Ignore storage errors
      }
      void i18n.changeLanguage(saved.language);
      void loadLanguageCatalog(saved.language);
      notifications.show({ message: t("settings.saved"), color: "green" });
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container size={720} py="xl">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={2}>{t("settings.title")}</Title>
          <Button
            variant="default"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/start")}
          >
            {t("settings.back")}
          </Button>
        </Group>

        {error != null && <ErrorAlert error={error} onRetry={() => void loadSettings()} />}

        {loading ? (
          <Loader />
        ) : (
          <Card withBorder padding="md" radius="sm">
            <Stack gap="md">
              <Group align="flex-end" gap="xs" wrap="wrap">
                <TextInput
                  style={{ flex: 1, minWidth: 240 }}
                  label={t("settings.library_dir")}
                  description={t("settings.library_dir_help")}
                  value={libraryDir}
                  onChange={(e) => setLibraryDir(e.currentTarget.value)}
                />
                {launcherActive && (
                  <Button
                    variant="light"
                    leftSection={<IconFolderSearch size={16} />}
                    onClick={() => void handleBrowse()}
                  >
                    {t("settings.browse")}
                  </Button>
                )}
                <Button
                  variant="light"
                  leftSection={<IconRotate size={16} />}
                  disabled={libraryDir === initialLibraryDir}
                  onClick={() => setLibraryDir(initialLibraryDir)}
                >
                  {t("settings.revert")}
                </Button>
              </Group>

              <Select
                label={t("settings.language")}
                value={language}
                onChange={(val) => {
                  if (val === "tr" || val === "en") setLanguage(val);
                }}
                data={[
                  { value: "tr", label: "TR" },
                  { value: "en", label: "EN" },
                ]}
                allowDeselect={false}
              />

              <Group justify="flex-end">
                <Button
                  loading={saving}
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={() => void handleSave()}
                >
                  {t("settings.save")}
                </Button>
              </Group>
            </Stack>
          </Card>
        )}
      </Stack>
    </Container>
  );
}

