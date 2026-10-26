import { useState } from "react";
import { Button, Collapse, Input, Select, SegmentedControl, SimpleGrid, Stack, Table, Text, TextInput } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { FieldNote } from "../../../shared/components/FieldNote";
import { fmt } from "../format";
import type { CommonForm } from "../inputs";
import type { AnchorReference } from "../types";
import { NumField } from "./NumField";

interface Props {
  value: CommonForm;
  onChange: (next: CommonForm) => void;
  reference: AnchorReference | null;
  /** Keys from `commonMissing` that should show a required marker. */
  missing: string[];
}

/** Anchor design inputs shared by the single anchor and the per-level design of the wall. */
export function AnchorFields({ value, onChange, reference, missing }: Props) {
  const { t } = useTranslation();
  const [showRef, setShowRef] = useState(false);
  const set = (patch: Partial<CommonForm>) => onChange({ ...value, ...patch });
  const req = (key: string) => (missing.includes(key) ? <FieldNote kind="required">{t("anchored_wall.field.required")}</FieldNote> : null);
  const tendons = (reference?.tendons ?? []).filter((x) => x.type === value.tendon_type);
  const defaults = reference?.defaults;

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2 }} verticalSpacing="md">
        <div>
          <NumField
            label={t("anchored_wall.input.safety_factor")}
            value={value.safety_factor}
            onChange={(v) => set({ safety_factor: v })}
            min={1}
            decimalScale={2}
          />
          {req("safety_factor")}
        </div>
        <div>
          <NumField
            label={t("anchored_wall.input.lock_off_ratio")}
            value={value.lock_off_ratio}
            onChange={(v) => set({ lock_off_ratio: v })}
            min={0}
            max={1.5}
            decimalScale={2}
          />
          {req("lock_off_ratio")}
        </div>
        <Select
          label={t("anchored_wall.input.transfer_mode")}
          data={[
            { value: "q_u", label: t("anchored_wall.input.transfer_mode_qu") },
            { value: "tau", label: t("anchored_wall.input.transfer_mode_tau") },
          ]}
          value={value.transfer_mode}
          allowDeselect={false}
          onChange={(v) => set({ transfer_mode: (v as CommonForm["transfer_mode"]) ?? "q_u" })}
        />
        {value.transfer_mode === "q_u" ? (
          <div>
            <NumField
              label={t("anchored_wall.input.ultimate_transfer_load")}
              value={value.ultimate_transfer_load}
              onChange={(v) => set({ ultimate_transfer_load: v })}
              min={0}
              decimalScale={1}
            />
            {req("ultimate_transfer_load")}
          </div>
        ) : (
          <div />
        )}
        {value.transfer_mode === "tau" && (
          <>
            <div>
              <NumField
                label={t("anchored_wall.input.ultimate_bond_stress")}
                value={value.ultimate_bond_stress}
                onChange={(v) => set({ ultimate_bond_stress: v })}
                min={0}
                decimalScale={1}
              />
              {req("ultimate_bond_stress")}
            </div>
            <div>
              <NumField
                label={t("anchored_wall.input.hole_diameter")}
                value={value.hole_diameter}
                onChange={(v) => set({ hole_diameter: v })}
                min={0}
                decimalScale={3}
              />
              {req("hole_diameter")}
            </div>
          </>
        )}
        <div>
          <TextInput
            label={t("anchored_wall.input.transfer_load_ref")}
            value={value.transfer_load_ref}
            maxLength={120}
            onChange={(e) => set({ transfer_load_ref: e.currentTarget.value })}
          />
          <FieldNote kind="help">{t("anchored_wall.input.transfer_load_ref_hint")}</FieldNote>
        </div>
        <Input.Wrapper label={t("anchored_wall.input.ground")}>
          <SegmentedControl
            fullWidth
            data={[
              { value: "soil", label: t("anchored_wall.ground.soil") },
              { value: "rock", label: t("anchored_wall.ground.rock") },
            ]}
            value={value.ground}
            onChange={(v) => set({ ground: v as CommonForm["ground"] })}
          />
        </Input.Wrapper>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, sm: 2 }} verticalSpacing="md">
        <Select
          label={t("anchored_wall.input.tendon_type")}
          data={[
            { value: "strand", label: t("anchored_wall.tendon.strand") },
            { value: "bar", label: t("anchored_wall.tendon.bar") },
          ]}
          value={value.tendon_type}
          allowDeselect={false}
          onChange={(v) => set({ tendon_type: (v as CommonForm["tendon_type"]) ?? "strand", tendon_library_id: null, strand_count: "" })}
        />
        <Select
          label={t("anchored_wall.input.tendon_library")}
          placeholder={t("anchored_wall.input.tendon_default")}
          clearable
          data={tendons.map((x) => ({ value: x.id, label: `${x.label} — SMTS ${fmt(x.smts_kn, 0)} kN` }))}
          value={value.tendon_library_id}
          onChange={(v) => set({ tendon_library_id: v })}
        />
        {value.tendon_type === "strand" && (
          <div>
            <NumField
              label={t("anchored_wall.input.strand_count")}
              value={value.strand_count}
              onChange={(v) => set({ strand_count: v === "" ? "" : Math.round(v) })}
              min={1}
              decimalScale={0}
            />
            <FieldNote kind="help">{t("anchored_wall.input.strand_count_hint")}</FieldNote>
          </div>
        )}
      </SimpleGrid>

      <Text size="sm" fw={600}>{t("anchored_wall.input.advanced")}</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} verticalSpacing="md">
        <NumField label={t("anchored_wall.input.min_bond_length")} value={value.min_bond_length} onChange={(v) => set({ min_bond_length: v })} min={0} decimalScale={2} />
        <NumField label={t("anchored_wall.input.max_bond_length")} value={value.max_bond_length} onChange={(v) => set({ max_bond_length: v })} min={0} decimalScale={2} />
        <NumField label={t("anchored_wall.input.min_free_length")} value={value.min_free_length} onChange={(v) => set({ min_free_length: v })} min={0} decimalScale={2} />
        <NumField label={t("anchored_wall.input.beyond_wedge")} value={value.beyond_wedge} onChange={(v) => set({ beyond_wedge: v })} min={0} decimalScale={2} />
        <NumField label={t("anchored_wall.input.wedge_origin")} value={value.wedge_origin_below_base} onChange={(v) => set({ wedge_origin_below_base: v })} min={0} decimalScale={2} />
        <NumField label={t("anchored_wall.input.min_overburden")} value={value.min_overburden} onChange={(v) => set({ min_overburden: v })} min={0} decimalScale={2} />
        <NumField label={t("anchored_wall.input.test_factor")} value={value.test_factor} onChange={(v) => set({ test_factor: v })} min={1} decimalScale={2} />
        <NumField label={t("anchored_wall.input.design_limit")} value={value.design_limit} onChange={(v) => set({ design_limit: v })} min={0} max={1} decimalScale={2} />
        <NumField label={t("anchored_wall.input.lock_off_limit")} value={value.lock_off_limit} onChange={(v) => set({ lock_off_limit: v })} min={0} max={1} decimalScale={2} />
        <NumField label={t("anchored_wall.input.test_limit")} value={value.test_limit} onChange={(v) => set({ test_limit: v })} min={0} max={1} decimalScale={2} />
      </SimpleGrid>

      <Button size="xs" variant="subtle" onClick={() => setShowRef((s) => !s)} style={{ alignSelf: "flex-start" }}>
        {t(showRef ? "anchored_wall.reference.hide" : "anchored_wall.reference.show")}
      </Button>
      <Collapse in={showRef}>
        {reference ? (
          <Stack gap="sm" data-testid="aw-reference">
            <Text size="xs" c="dimmed">{t("anchored_wall.reference.note")}</Text>
            <Text size="sm" fw={600}>{t("anchored_wall.reference.safety_factor")}</Text>
            <Table withTableBorder>
              <Table.Tbody>
                {reference.safety_factor_guidance.map((g) => (
                  <Table.Tr key={g.ground}>
                    <Table.Td>{g.ground}</Table.Td>
                    <Table.Td>{fmt(g.value)}</Table.Td>
                    <Table.Td><Text size="xs">{g.source}</Text></Table.Td>
                    <Table.Td>
                      <Button size="compact-xs" variant="light" onClick={() => set({ safety_factor: g.value })}>
                        {t("anchored_wall.reference.use")}
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Text size="sm" fw={600}>{t("anchored_wall.reference.transfer_load")}</Text>
            <Table withTableBorder>
              <Table.Tbody>
                {reference.transfer_loads.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>{row.ground}</Table.Td>
                    <Table.Td><Text size="xs">{row.condition}</Text></Table.Td>
                    <Table.Td>{fmt(row.q_u_kn_per_m, 0)} kN/m</Table.Td>
                    <Table.Td><Text size="xs">{row.source}</Text></Table.Td>
                    <Table.Td>
                      <Button
                        size="compact-xs"
                        variant="light"
                        onClick={() => set({ transfer_mode: "q_u", ultimate_transfer_load: row.q_u_kn_per_m, transfer_load_ref: row.id })}
                      >
                        {t("anchored_wall.reference.use")}
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {defaults && (
              <Text size="xs" c="dimmed">
                {t("anchored_wall.reference.defaults", {
                  strand: fmt(defaults.min_free_length_strand, 1),
                  bar: fmt(defaults.min_free_length_bar, 1),
                  source: defaults.source,
                })}
              </Text>
            )}
          </Stack>
        ) : (
          <Text size="sm">{t("web.common.loading")}</Text>
        )}
      </Collapse>
    </Stack>
  );
}
