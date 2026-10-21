import { Alert, List } from "@mantine/core";
import { useTranslation } from "react-i18next";

type Translate = (key: string, options?: Record<string, unknown>) => string;

function label(t: Translate, key: string): string {
  const level = /^level_(\d+)_(.+)$/.exec(key);
  if (level) return t(`anchored_wall.missing.level_${level[2]}`, { n: Number(level[1]) + 1 });
  const design = /^design_(.+)$/.exec(key);
  if (design) return t("anchored_wall.missing.design", { field: t(`anchored_wall.missing.${design[1]}`) });
  return t(`anchored_wall.missing.${key}`);
}

/** Inputs that are still empty or out of range; the run button stays off while this list is not empty. */
export function MissingList({ keys }: { keys: string[] }) {
  const { t } = useTranslation();
  if (keys.length === 0) return null;
  return (
    <Alert color="orange" variant="light" title={t("anchored_wall.missing.title")}>
      <List size="sm" data-testid="aw-missing">
        {keys.map((k) => (
          <List.Item key={k}>{label(t as unknown as Translate, k)}</List.Item>
        ))}
      </List>
    </Alert>
  );
}
