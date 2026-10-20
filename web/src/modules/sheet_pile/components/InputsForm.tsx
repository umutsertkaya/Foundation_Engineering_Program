import { NumberInput, SegmentedControl, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { Num, PileInputs } from "../inputs";

interface Props {
  value: PileInputs;
  onChange: (next: PileInputs) => void;
  missing: string[];
}

const toNum = (v: number | string): Num => (typeof v === "number" ? v : "");

export function InputsForm({ value, onChange, missing }: Props) {
  const { t } = useTranslation();
  const set = (patch: Partial<PileInputs>) => onChange({ ...value, ...patch });
  const err = (key: string) => (missing.includes(key) ? t("sheet_pile.inputs.required") : undefined);

  return (
    <Stack gap="sm">
      <TextInput
        label={t("sheet_pile.inputs.name")}
        value={value.name}
        error={err("name")}
        onChange={(e) => set({ name: e.currentTarget.value })}
      />
      <div>
        <Text size="sm" fw={500} mb={4}>
          {t("sheet_pile.inputs.support")}
        </Text>
        <SegmentedControl
          value={value.support}
          onChange={(v) => set({ support: v as PileInputs["support"] })}
          data={[
            { value: "cantilever", label: t("sheet_pile.support.cantilever") },
            { value: "anchored", label: t("sheet_pile.support.anchored") },
          ]}
        />
      </div>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <NumberInput
          label={t("sheet_pile.inputs.retained_height")}
          value={value.retained_height}
          error={err("retained_height")}
          min={0}
          decimalScale={2}
          onChange={(v) => set({ retained_height: toNum(v) })}
        />
        {value.support === "anchored" && (
          <NumberInput
            label={t("sheet_pile.inputs.anchor_depth")}
            value={value.anchor_depth}
            error={err("anchor_depth")}
            min={0}
            decimalScale={2}
            onChange={(v) => set({ anchor_depth: toNum(v) })}
          />
        )}
        <NumberInput
          label={t("sheet_pile.inputs.surcharge")}
          description={t("sheet_pile.inputs.surcharge_hint")}
          value={value.surcharge}
          min={0}
          decimalScale={2}
          onChange={(v) => set({ surcharge: toNum(v) })}
        />
        <NumberInput
          label={t("sheet_pile.inputs.sds")}
          description={t("sheet_pile.inputs.sds_hint")}
          value={value.sds}
          min={0}
          decimalScale={3}
          onChange={(v) => set({ sds: toNum(v) })}
        />
        <NumberInput
          label={t("sheet_pile.inputs.allowable_stress")}
          description={t("sheet_pile.inputs.allowable_stress_hint")}
          value={value.allowable_stress_mpa}
          min={0}
          decimalScale={1}
          onChange={(v) => set({ allowable_stress_mpa: toNum(v) })}
        />
      </SimpleGrid>
    </Stack>
  );
}
