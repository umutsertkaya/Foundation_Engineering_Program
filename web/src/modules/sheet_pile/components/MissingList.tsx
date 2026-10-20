import { Alert, List } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

/** Explicit list of required inputs that are still missing (no silent defaults). */
export function MissingList({ keys }: { keys: string[] }) {
  const { t } = useTranslation();
  if (keys.length === 0) return null;
  const label = (key: string): string => {
    const range = /^range:(.+)$/.exec(key);
    if (range) {
      const layer = /^layer_(\d+)_(geometry|gamma)$/.exec(range[1]);
      return layer
        ? t(`sheet_pile.missing.range_layer_${layer[2]}`, { n: Number(layer[1]) + 1 })
        : t(`sheet_pile.missing.range_${range[1]}`);
    }
    const layer = /^layer_(\d+)_(geometry|phi)$/.exec(key);
    if (layer) return t(`sheet_pile.missing.layer_${layer[2]}`, { n: Number(layer[1]) + 1 });
    const phi = /^phi:(.+)$/.exec(key);
    if (phi) return t("sheet_pile.missing.layer_phi_id", { id: phi[1] });
    return t(`sheet_pile.missing.${key}`);
  };
  return (
    <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={18} />} title={t("sheet_pile.missing.title")}>
      <List size="sm" data-testid="missing-inputs">
        {keys.map((k) => (
          <List.Item key={k}>{label(k)}</List.Item>
        ))}
      </List>
    </Alert>
  );
}
