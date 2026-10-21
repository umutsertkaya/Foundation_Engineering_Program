import { NumberInput, Select, SimpleGrid, Stack, Switch, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { ShearKey } from "../../../shared/api/types";

const DEFAULT_KEY: ShearKey = { position: "heel", width: 0.5, depth: 0.5 };

interface Props {
  value: ShearKey | null | undefined;
  /** Base slab width B [m]; the key cannot be wider. */
  baseWidth: number;
  onChange: (next: ShearKey | null) => void;
}

/** Optional shear key (kayma dişi) under the base: position, width and depth below the base bottom. */
export function ShearKeyFields({ value, baseWidth, onChange }: Props) {
  const { t } = useTranslation();
  const key = value ?? null;
  const widthTooLarge = key !== null && key.width > baseWidth + 1e-9;
  return (
    <Stack gap="xs" data-testid="shear-key-fields">
      <Switch
        size="sm"
        label={t("walls.key.enable")}
        description={t("walls.key.enable_hint")}
        checked={key !== null}
        onChange={(e) => onChange(e.currentTarget.checked ? { ...DEFAULT_KEY, width: Math.min(DEFAULT_KEY.width, baseWidth) } : null)}
      />
      {key !== null && (
        <>
          <SimpleGrid cols={3} spacing="xs">
            <Select
              size="xs"
              label={t("walls.key.position")}
              allowDeselect={false}
              data={(["toe", "middle", "heel"] as const).map((p) => ({ value: p, label: t(`walls.key.position.${p}`) }))}
              value={key.position}
              onChange={(v) => v && onChange({ ...key, position: v as ShearKey["position"] })}
            />
            <NumberInput
              size="xs"
              label={t("walls.key.width")}
              value={key.width}
              min={0.05}
              step={0.05}
              decimalScale={2}
              error={widthTooLarge ? t("walls.key.width_too_large") : undefined}
              onChange={(v) => typeof v === "number" && Number.isFinite(v) && onChange({ ...key, width: v })}
            />
            <NumberInput
              size="xs"
              label={t("walls.key.depth")}
              value={key.depth}
              min={0.05}
              max={9.9}
              step={0.05}
              decimalScale={2}
              onChange={(v) => typeof v === "number" && Number.isFinite(v) && onChange({ ...key, depth: v })}
            />
          </SimpleGrid>
          <Text size="xs" c="dimmed">{t("walls.key.note")}</Text>
        </>
      )}
    </Stack>
  );
}
