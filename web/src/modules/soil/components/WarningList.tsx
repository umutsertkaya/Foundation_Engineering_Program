import { List, Text } from "@mantine/core";
import { useWarningText } from "../useWarningText";

/** Warning strings rendered through the shared parser (localised when the i18n key exists, raw otherwise). */
export function WarningList({ warnings, size = "xs", testId }: { warnings: string[]; size?: "xs" | "sm"; testId?: string }) {
  const render = useWarningText();
  if (warnings.length === 0) return null;
  return (
    <List size={size} spacing={2} data-testid={testId} styles={{ item: { overflowWrap: "anywhere" } }}>
      {warnings.map((w, i) => (
        <List.Item key={`${i}-${w}`}>
          <Text span size={size} title={w}>
            {render(w)}
          </Text>
        </List.Item>
      ))}
    </List>
  );
}
