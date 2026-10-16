import { createTheme } from "@mantine/core";

const SYSTEM_SANS =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SYSTEM_MONO =
  'ui-monospace, SFMono-Regular, "Cascadia Mono", Consolas, "Liberation Mono", monospace';

export const theme = createTheme({
  fontFamily: SYSTEM_SANS,
  fontFamilyMonospace: SYSTEM_MONO,
  headings: {
    fontFamily: SYSTEM_SANS,
    fontWeight: "600",
  },
  primaryColor: "blue",
  defaultRadius: "sm",
  colors: {
    amber: [
      "#fffbeb",
      "#fef3c7",
      "#fde68a",
      "#fcd34d",
      "#fbbf24",
      "#f59e0b",
      "#d97706",
      "#b45309",
      "#92400e",
      "#78350f",
    ],
  },
});
