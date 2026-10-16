import { ActionIcon, useComputedColorScheme, useMantineColorScheme } from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

export function ThemeToggle() {
  const { t } = useTranslation();
  const { setColorScheme } = useMantineColorScheme();
  const computedScheme = useComputedColorScheme("light");
  return (
    <ActionIcon
      variant="default"
      aria-label={t("web.header.theme_toggle")}
      title={computedScheme === "dark" ? t("ui.theme.light") : t("ui.theme.dark")}
      onClick={() => setColorScheme(computedScheme === "dark" ? "light" : "dark")}
    >
      {computedScheme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
    </ActionIcon>
  );
}
