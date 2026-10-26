import { Badge, Button, Card, createTheme, Input, type MantineColorsTuple } from "@mantine/core";

const SANS =
  '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const MONO =
  '"IBM Plex Mono", ui-monospace, SFMono-Regular, "Cascadia Mono", Consolas, "Liberation Mono", monospace';

/** Ten shades around the brand blue #1B62C4 (index 6); index 7 is the hover colour #0F4A99. */
const primary: MantineColorsTuple = [
  "#e7f0fc",
  "#cfe0f8",
  "#a9c7f0",
  "#7fa9e6",
  "#5189d6",
  "#2f70cc",
  "#1b62c4",
  "#0f4a99",
  "#0b3b7a",
  "#082c5c",
];

export const theme = createTheme({
  fontFamily: SANS,
  fontFamilyMonospace: MONO,
  headings: {
    fontFamily: SANS,
    fontWeight: "600",
  },
  primaryColor: "primary",
  primaryShade: { light: 6, dark: 4 },
  defaultRadius: "sm",
  radius: { xs: "4px", sm: "8px", md: "12px", lg: "16px", xl: "24px" },
  colors: {
    primary,
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
  components: {
    Card: Card.extend({ defaultProps: { withBorder: true, radius: "md", padding: "lg" } }),
    Button: Button.extend({ defaultProps: { radius: "sm", fw: 500 } }),
    Input: Input.extend({ defaultProps: { radius: "sm" } }),
    // Help text sits under the field so inputs on one row line up whatever the help length.
    InputWrapper: Input.Wrapper.extend({ defaultProps: { inputWrapperOrder: ["label", "input", "description", "error"] } }),
    Badge: Badge.extend({ defaultProps: { variant: "light", radius: "xl", fw: 500, tt: "none" } }),
  },
});
