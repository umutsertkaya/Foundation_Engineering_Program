import { Accordion, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { list_codes } from "../../../shared/api/client";
import type { DesignCodeSummary } from "../../../shared/api/types";
import type { Num, PileInputs } from "../inputs";

interface Props {
  value: PileInputs;
  onChange: (next: PileInputs) => void;
  missing: string[];
}

const toNum = (v: number | string): Num => (typeof v === "number" ? v : "");

export function InputsForm({ value, onChange, missing }: Props) {
  const { t } = useTranslation();
  const [codes, setCodes] = useState<DesignCodeSummary[]>([]);
  useEffect(() => { let active = true; void list_codes().then((items) => { if (active) setCodes(items); }).catch(() => undefined); return () => { active = false; }; }, []);
  const selectedCode = codes.find((code) => code.id === value.design_code);
  const set = (patch: Partial<PileInputs>) => onChange({ ...value, ...patch });
  const err = (key: string) => (missing.includes(key) ? t("sheet_pile.inputs.required") : missing.includes(`range:${key}`) ? t(`sheet_pile.missing.range_${key}`) : undefined);

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
          label={t("sheet_pile.inputs.backfill_slope")}
          description={t("sheet_pile.inputs.backfill_slope_hint")}
          value={value.backfill_slope}
          error={err("backfill_slope")}
          min={0}
          max={44.9}
          decimalScale={1}
          onChange={(v) => set({ backfill_slope: toNum(v) })}
        />
        <NumberInput
          label={t("sheet_pile.inputs.surcharge")}
          description={t("sheet_pile.inputs.surcharge_hint")}
          value={value.surcharge}
          error={err("surcharge")}
          min={0}
          decimalScale={2}
          onChange={(v) => set({ surcharge: toNum(v) })}
        />
        <Select
          label={t("sheet_pile.inputs.surcharge_basis")}
          description={t("sheet_pile.inputs.surcharge_basis_hint")}
          allowDeselect={false}
          data={[
            { value: "horizontal", label: t("sheet_pile.inputs.surcharge_basis_horizontal") },
            { value: "inclined", label: t("sheet_pile.inputs.surcharge_basis_inclined") },
          ]}
          value={value.surcharge_basis}
          onChange={(v) => set({ surcharge_basis: (v as PileInputs["surcharge_basis"]) ?? "horizontal" })}
        />
        <NumberInput
          label={t("sheet_pile.inputs.sds")}
          description={t("sheet_pile.inputs.sds_hint")}
          value={value.sds}
          error={err("sds")}
          min={0}
          decimalScale={3}
          onChange={(v) => set({ sds: toNum(v) })}
        />
        <NumberInput
          label={t("sheet_pile.inputs.allowable_stress")}
          description={t("sheet_pile.inputs.allowable_stress_hint")}
          value={value.allowable_stress_mpa}
          error={err("allowable_stress_mpa")}
          min={0}
          decimalScale={1}
          onChange={(v) => set({ allowable_stress_mpa: toNum(v) })}
        />
      </SimpleGrid>
      <Accordion variant="separated">
        <Accordion.Item value="advanced">
          <Accordion.Control>{t("sheet_pile.inputs.advanced")}</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <Select label={t("sheet_pile.inputs.design_code")} data={codes.map((code) => ({ value: code.id, label: code.name }))} value={value.design_code} onChange={(v) => set({ design_code: v ?? "asd", approach: null })} searchable />
                {selectedCode?.approaches?.length ? <Select label={t("sheet_pile.inputs.approach")} placeholder={t("sheet_pile.inputs.service_default")} clearable data={selectedCode.approaches.map((a) => ({ value: a, label: a }))} value={value.approach} onChange={(v) => set({ approach: v })} /> : <TextInput label={t("sheet_pile.inputs.approach")} description={t("sheet_pile.inputs.approach_hint")} value={value.approach ?? ""} onChange={(e) => set({ approach: e.currentTarget.value || null })} />}
                <Select label={t("sheet_pile.inputs.analysis_level")} data={[{ value: "basic", label: t("sheet_pile.inputs.basic") }, { value: "advanced", label: t("sheet_pile.inputs.advanced_analysis") }]} value={value.analysis_level} onChange={(v) => set({ analysis_level: (v as PileInputs["analysis_level"]) ?? "basic" })} />
                <NumberInput label={t("sheet_pile.inputs.depth_increase")} placeholder={value.support === "cantilever" ? "0.2" : "0.0"} description={t("sheet_pile.inputs.depth_increase_hint", { value: value.support === "cantilever" ? "0.2" : "0.0" })} value={value.depth_increase === "" ? undefined : value.depth_increase} error={err("depth_increase")} min={0} decimalScale={3} onChange={(v) => set({ depth_increase: toNum(v) })} />
                {value.support === "anchored" && <>
                  <NumberInput label={t("sheet_pile.inputs.anchor_spacing")} value={value.anchor_spacing} error={err("anchor_spacing")} min={0} decimalScale={2} onChange={(v) => set({ anchor_spacing: toNum(v) })} />
                  <NumberInput label={t("sheet_pile.inputs.anchor_inclination")} value={value.anchor_inclination} error={err("anchor_inclination")} min={0} max={89.999} decimalScale={2} onChange={(v) => set({ anchor_inclination: toNum(v) })} />
                </>}
                <NumberInput label={t("sheet_pile.inputs.front_water_depth")} description={t("sheet_pile.inputs.front_water_depth_hint")} value={value.front_water_depth} error={err("front_water_depth")} min={0} decimalScale={2} onChange={(v) => set({ front_water_depth: toNum(v) })} />
              </SimpleGrid>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
