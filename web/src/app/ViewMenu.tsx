import { Button, Group, Popover, SegmentedControl, Stack, Text, useComputedColorScheme } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { Language } from "../shared/api/types";
import { loadLanguageCatalog } from "./i18n";
import { ThemeToggle } from "./ThemeToggle";

/** Compact "TR · Light" button that opens the language switch and the theme toggle. */
export function ViewMenu() {
  const { t, i18n } = useTranslation();
  const scheme = useComputedColorScheme("light");
  const lang: Language = i18n.language === "en" ? "en" : "tr";
  return (
    <Popover position="bottom-end" shadow="md" withArrow={false}>
      <Popover.Target>
        <Button
          variant="subtle"
          color="gray"
          c="var(--mantine-color-text)"
          aria-label={t("shell.view_menu")}
          rightSection={<IconChevronDown size={14} aria-hidden="true" />}
        >
          {lang.toUpperCase()} · {t(scheme === "dark" ? "shell.theme_short_dark" : "shell.theme_short_light")}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          <Group justify="space-between" gap="lg" wrap="nowrap">
            <Text size="sm">{t("shell.view_language")}</Text>
            <SegmentedControl
              size="xs"
              aria-label={t("web.header.lang_switch")}
              value={lang}
              onChange={(value) => { void loadLanguageCatalog(value as Language); }}
              data={[{ value: "tr", label: "TR" }, { value: "en", label: "EN" }]}
            />
          </Group>
          <Group justify="space-between" gap="lg" wrap="nowrap">
            <Text size="sm">{t("shell.view_theme")}</Text>
            <ThemeToggle />
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
