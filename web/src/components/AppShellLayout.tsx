import type { ReactNode } from "react";
import {
  ActionIcon,
  AppShell,
  Badge,
  Container,
  Group,
  SegmentedControl,
  Text,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";
import { isMockMode } from "../shared/api/client";
import type { Language } from "../shared/api/types";
import { loadLanguageCatalog } from "../i18n";
import { WorkflowBar } from "./WorkflowBar";

export interface AppShellLayoutProps {
  children?: ReactNode;
}

export function AppShellLayout({ children }: AppShellLayoutProps) {
  const { t, i18n } = useTranslation();
  const { setColorScheme } = useMantineColorScheme();
  const computedScheme = useComputedColorScheme("light");
  const currentLang: Language = i18n.language === "en" ? "en" : "tr";
  // Full product name only when there is room next to the workflow bar.
  const wideHeader = useMediaQuery("(min-width: 1500px)") ?? false;

  const handleToggleScheme = () => {
    setColorScheme(computedScheme === "dark" ? "light" : "dark");
  };

  return (
    <AppShell header={{ height: 54 }} padding="sm">
      <AppShell.Header px="md">
        <Group h="100%" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Text fw={700} size="sm" style={{ whiteSpace: "nowrap" }} title={t("app.title")}>
              {wideHeader ? t("app.title") : t("web.header.app_short")}
            </Text>
            {isMockMode() && (
              <Badge color="amber" variant="light" size="xs">
                {t("web.header.mock_badge")}
              </Badge>
            )}
          </Group>

          <WorkflowBar />

          <Group gap="xs" wrap="nowrap">
            <SegmentedControl
              size="xs"
              aria-label={t("web.header.lang_switch")}
              value={currentLang}
              onChange={(val) => {
                void loadLanguageCatalog(val as Language);
              }}
              data={[
                { value: "tr", label: "TR" },
                { value: "en", label: "EN" },
              ]}
            />
            <ActionIcon
              variant="default"
              size="md"
              aria-label={t("web.header.theme_toggle")}
              title={computedScheme === "dark" ? t("ui.theme.light") : t("ui.theme.dark")}
              onClick={handleToggleScheme}
            >
              {computedScheme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Container fluid maw={1880} py="xs" px="md">
          {children ?? <Outlet />}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
