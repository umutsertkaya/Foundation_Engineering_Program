import { useEffect, useState } from "react";
import {
  ActionIcon, Alert, Badge, Box, Button, Group, Select, SimpleGrid, Stack, Table, Text,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { list_project_profiles } from "../../../shared/api/core";
import type { ProfileSummary } from "../../../shared/api/types";
import { CollapsibleSection } from "../../../shared/components/CollapsibleSection";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";
import { FieldNote } from "../../../shared/components/FieldNote";
import { SectionCard } from "../../../shared/components/SectionCard";
import { ToggleRow } from "../../../shared/components/ToggleRow";
import { get_soil } from "../api";
import { fmt } from "../format";
import { EMPTY_LEVEL, analysisMissing, commonMissing, soilGaps, type AnalysisForm, type Num } from "../inputs";
import type { AnchorReference } from "../types";
import { AnchorFields } from "./AnchorFields";
import { NumField } from "./NumField";

/** Number field with the "Required" note right under it while its key is on the missing list. */
function Field({ missing, id, note, value, ...rest }: React.ComponentProps<typeof NumField> & { missing: string[]; id: string; note?: string }) {
  const { t } = useTranslation();
  const bad = missing.includes(id);
  return (
    <Box>
      <NumField value={value} {...rest} />
      {bad && <FieldNote kind="required">{value === "" ? t("anchored_wall.input.required") : (note ?? t(`anchored_wall.missing.${id}`))}</FieldNote>}
    </Box>
  );
}

const MAX_LEVELS = 6;

interface Props {
  value: AnalysisForm;
  onChange: (next: AnalysisForm) => void;
  reference: AnchorReference | null;
  /** The project profile the stored soil was copied from has changed or is gone. */
  soilStale: boolean;
}

export function AnalysisFormView({ value, onChange, reference, soilStale }: Props) {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<ProfileSummary[] | null>(null);
  const [profileId, setProfileId] = useState<string | null>(value.soil?.source_profile_id ?? null);
  const [error, setError] = useState<unknown>(null);
  const set = (patch: Partial<AnalysisForm>) => onChange({ ...value, ...patch });
  const multi = value.levels.length > 1;
  const soldier = value.wall_type === "soldier_pile";

  useEffect(() => {
    let live = true;
    list_project_profiles().then(
      (p) => live && setProfiles(p),
      (e) => live && setError(e),
    );
    return () => {
      live = false;
    };
  }, []);

  const loadSoil = async (id: string | null) => {
    if (!id) return;
    setError(null);
    try {
      set({ soil: await get_soil(id) });
    } catch (e) {
      setError(e);
    }
  };

  const setLevel = (i: number, patch: Partial<AnalysisForm["levels"][number]>) =>
    set({ levels: value.levels.map((lv, j) => (j === i ? { ...lv, ...patch } : lv)) });
  const gaps = soilGaps(value.soil, value.drainage);
  const clay = value.drainage === "undrained";

  const missing = analysisMissing(value);
  const F = (id: string, props: React.ComponentProps<typeof NumField>) => <Field missing={missing} id={id} {...props} />;

  return (
    <Stack gap="md">
      <SectionCard step={1} title={t("anchored_wall.section.wall")}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {F("excavation_height", { label: t("anchored_wall.input.excavation_height"), value: value.excavation_height, onChange: (v: Num) => set({ excavation_height: v }), min: 0, decimalScale: 2 })}
            <Select
              label={t("anchored_wall.input.wall_type")}
              data={[
                { value: "sheet_pile", label: t("anchored_wall.wall_type.sheet_pile") },
                { value: "soldier_pile", label: t("anchored_wall.wall_type.soldier_pile") },
              ]}
              value={value.wall_type}
              allowDeselect={false}
              onChange={(v) => set({ wall_type: (v as AnalysisForm["wall_type"]) ?? "sheet_pile" })}
            />
            {F("surcharge", { label: t("anchored_wall.input.surcharge"), value: value.surcharge, onChange: (v: Num) => set({ surcharge: v }), min: 0, decimalScale: 1 })}
            <Select
              label={t("anchored_wall.input.drainage")}
              data={[
                { value: "drained", label: t("anchored_wall.drainage.drained") },
                { value: "undrained", label: t("anchored_wall.drainage.undrained") },
              ]}
              value={value.drainage}
              allowDeselect={false}
              onChange={(v) => set({ drainage: (v as AnalysisForm["drainage"]) ?? "drained" })}
            />
            {F("backfill_slope", { label: t("anchored_wall.input.backfill_slope"), description: t("anchored_wall.input.backfill_slope_single_only"), value: value.backfill_slope, onChange: (v: Num) => set({ backfill_slope: v }), min: 0, max: 45, decimalScale: 1 })}
          </SimpleGrid>
          {soldier && (
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              {F("pile_spacing", { label: t("anchored_wall.input.pile_spacing"), value: value.pile_spacing, onChange: (v: Num) => set({ pile_spacing: v }), min: 0, decimalScale: 2 })}
              {F("passive_width", { label: t("anchored_wall.input.passive_width"), value: value.passive_width, onChange: (v: Num) => set({ passive_width: v }), min: 0, decimalScale: 2 })}
            </SimpleGrid>
          )}
          {clay && (
            <Stack gap="xs">
              <Text size="sm" fw={600}>{t("anchored_wall.section.clay")}</Text>
              <Text size="xs" c="dimmed">{t("anchored_wall.input.clay_hint")}</Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Box>
                  <Select
                    label={t("anchored_wall.input.service")}
                    placeholder={t("anchored_wall.input.service_placeholder")}
                    data={[
                      { value: "temporary", label: t("anchored_wall.service.temporary") },
                      { value: "permanent", label: t("anchored_wall.service.permanent") },
                    ]}
                    value={value.service}
                    onChange={(v) => set({ service: (v as AnalysisForm["service"]) ?? null })}
                  />
                  {missing.includes("service") && <FieldNote kind="required">{t("anchored_wall.input.required")}</FieldNote>}
                </Box>
                {F("excavation_width", { label: t("anchored_wall.input.excavation_width"), value: value.excavation_width, onChange: (v: Num) => set({ excavation_width: v }), min: 0, decimalScale: 2 })}
                <NumField label={t("anchored_wall.input.excavation_length")} description={t("anchored_wall.input.excavation_length_hint")} value={value.excavation_length} onChange={(v) => set({ excavation_length: v })} min={0} decimalScale={2} />
                <NumField label={t("anchored_wall.input.stiff_layer_depth")} description={t("anchored_wall.input.stiff_layer_depth_hint")} value={value.stiff_layer_depth} onChange={(v) => set({ stiff_layer_depth: v })} min={0} decimalScale={2} />
                <NumField label={t("anchored_wall.input.henkel_depth")} description={t("anchored_wall.input.henkel_depth_hint")} value={value.henkel_depth} onChange={(v) => set({ henkel_depth: v })} min={0} decimalScale={2} />
                {F("stiff_clay_coefficient", { label: t("anchored_wall.input.stiff_clay_coefficient"), description: t("anchored_wall.input.stiff_clay_coefficient_hint"), value: value.stiff_clay_coefficient, onChange: (v: Num) => set({ stiff_clay_coefficient: v }), min: 0.2, max: 0.4, decimalScale: 2 })}
              </SimpleGrid>
            </Stack>
          )}
          <CollapsibleSection label={t("anchored_wall.advanced.wall")}>
            <Select
              label={t("anchored_wall.input.surcharge_basis")}
              data={[
                { value: "horizontal", label: t("anchored_wall.input.surcharge_basis_horizontal") },
                { value: "inclined", label: t("anchored_wall.input.surcharge_basis_inclined") },
              ]}
              value={value.surcharge_basis}
              allowDeselect={false}
              onChange={(v) => set({ surcharge_basis: (v as AnalysisForm["surcharge_basis"]) ?? "horizontal" })}
            />
          </CollapsibleSection>
        </Stack>
      </SectionCard>

      <SectionCard
        step={2}
        title={t("anchored_wall.section.levels")}
        aside={
          <Button size="compact-sm" variant="default" leftSection={<IconPlus size={14} aria-hidden="true" />} disabled={value.levels.length >= MAX_LEVELS} onClick={() => set({ levels: [...value.levels, { ...EMPTY_LEVEL }] })}>
            {t("anchored_wall.action.add_level")}
          </Button>
        }
      >
        <Table withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>{t("anchored_wall.report.level_depth")}</Table.Th>
              <Table.Th>{t("anchored_wall.report.level_spacing")}</Table.Th>
              <Table.Th>{t("anchored_wall.report.level_inclination")}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {value.levels.map((lv, i) => {
              return (
                <Table.Tr key={i}>
                  <Table.Td>T{i + 1}</Table.Td>
                  <Table.Td><NumField aria-label={`${t("anchored_wall.report.level_depth")} ${i + 1}`} value={lv.depth} onChange={(v) => setLevel(i, { depth: v })} min={0} decimalScale={2} /></Table.Td>
                  <Table.Td><NumField aria-label={`${t("anchored_wall.report.level_spacing")} ${i + 1}`} value={lv.spacing} onChange={(v) => setLevel(i, { spacing: v })} min={0} decimalScale={2} /></Table.Td>
                  <Table.Td><NumField aria-label={`${t("anchored_wall.report.level_inclination")} ${i + 1}`} value={lv.inclination_deg} onChange={(v) => setLevel(i, { inclination_deg: v })} min={0} max={59} decimalScale={1} /></Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" color="red" aria-label={t("anchored_wall.action.remove_level")} disabled={value.levels.length === 1} onClick={() => set({ levels: value.levels.filter((_, j) => j !== i) })}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
        {missing.filter((k) => k.startsWith("level_")).map((k) => {
          const m = /^level_(\d+)_(.+)$/.exec(k);
          return m ? <FieldNote key={k} kind="required">{t(`anchored_wall.missing.level_${m[2]}`, { n: Number(m[1]) + 1 })}</FieldNote> : null;
        })}
      </SectionCard>

      <SectionCard step={3} title={t("anchored_wall.section.soil")}>
        <Stack gap="sm">
          {error != null && <ErrorAlert error={error} />}
          <Group align="flex-end">
            <Select
              label={t("anchored_wall.input.profile")}
              placeholder={t("anchored_wall.input.profile_placeholder")}
              data={(profiles ?? []).map((p) => ({ value: p.id, label: `${p.name} (${p.layer_count})` }))}
              value={profileId}
              onChange={setProfileId}
              nothingFoundMessage={t("anchored_wall.input.no_profiles")}
              style={{ minWidth: 260 }}
            />
            <Button variant="default" disabled={!profileId} onClick={() => void loadSoil(profileId)}>
              {t("anchored_wall.action.load_soil")}
            </Button>
          </Group>
          {!value.soil && <FieldNote kind="required">{t("anchored_wall.missing.soil")}</FieldNote>}
          {soilStale && value.soil?.source_profile_id && (
            <Alert color="blue" variant="light" title={t("anchored_wall.soil.stale_title")}>
              <Group justify="space-between">
                <Text size="sm">{t("anchored_wall.soil.stale")}</Text>
                <Button size="xs" variant="light" onClick={() => void loadSoil(value.soil?.source_profile_id ?? null)}>
                  {t("anchored_wall.action.resync")}
                </Button>
              </Group>
            </Alert>
          )}
          {value.soil && (
            <Table withTableBorder data-testid="aw-soil">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("report.soil.top")}</Table.Th>
                  <Table.Th>{t("report.soil.bottom")}</Table.Th>
                  <Table.Th>{t("report.soil.gamma")}</Table.Th>
                  <Table.Th>{t("report.soil.phi")}</Table.Th>
                  <Table.Th>{t("report.soil.c")}</Table.Th>
                  <Table.Th>{t("report.soil.su")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {value.soil.profile.layers.map((l) => {
                  const gap = gaps.includes(l.id);
                  return (
                    <Table.Tr key={l.id}>
                      <Table.Td>{fmt(l.top)}</Table.Td>
                      <Table.Td>{fmt(l.bottom)}</Table.Td>
                      <Table.Td>{fmt(l.gamma, 1)}</Table.Td>
                      <Table.Td>{fmt(l.design?.phi_eff, 1)}</Table.Td>
                      <Table.Td>{fmt(l.design?.c_eff, 1)}</Table.Td>
                      <Table.Td>
                        {fmt(l.design?.su, 1)}
                        {gap && <Badge ml="xs" color="red" variant="light">{t("anchored_wall.soil.missing_value")}</Badge>}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
          <FieldNote kind="help">{t("anchored_wall.soil.copy_note")}</FieldNote>
        </Stack>
      </SectionCard>

      <SectionCard step={4} title={t("anchored_wall.section.safety")}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {F("passive_factor", { label: t("anchored_wall.input.passive_factor"), description: t("anchored_wall.input.passive_factor_hint"), value: value.passive_factor, onChange: (v: Num) => set({ passive_factor: v }), min: 1, decimalScale: 2 })}
            <NumField label={t("anchored_wall.input.depth_increase")} description={t("anchored_wall.input.depth_increase_hint")} value={value.depth_increase} onChange={(v) => set({ depth_increase: v })} min={0} decimalScale={2} />
            {multi && (
              <Select
                label={t("anchored_wall.input.load_method")}
                data={[
                  { value: "hinge", label: t("anchored_wall.load_method.hinge") },
                  { value: "tributary", label: t("anchored_wall.load_method.tributary") },
                ]}
                value={value.load_method}
                allowDeselect={false}
                onChange={(v) => set({ load_method: (v as AnalysisForm["load_method"]) ?? "hinge" })}
              />
            )}
          </SimpleGrid>
          <CollapsibleSection label={t("anchored_wall.advanced.section")}>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <NumField label={t(soldier ? "anchored_wall.input.w_cm3_pile" : "anchored_wall.input.w_cm3_m")} value={value.w_cm3} onChange={(v) => set({ w_cm3: v })} min={0} decimalScale={1} />
              <NumField label={t("anchored_wall.input.allowable_stress")} value={value.allowable_stress_mpa} onChange={(v) => set({ allowable_stress_mpa: v })} min={0} decimalScale={1} />
              <NumField label={t("anchored_wall.input.ei")} description={t("anchored_wall.input.ei_hint")} value={value.ei_knm2} onChange={(v) => set({ ei_knm2: v })} min={0} decimalScale={0} />
            </SimpleGrid>
          </CollapsibleSection>
          <ToggleRow
            checked={value.design_anchors}
            onChange={(next) => set({ design_anchors: next })}
            label={t("anchored_wall.input.design_anchors")}
            hint={t("anchored_wall.input.design_anchors_hint")}
          />
          {value.design_anchors && (
            <AnchorFields
              value={value.common}
              onChange={(common) => set({ common })}
              reference={reference}
              missing={commonMissing(value.common)}
            />
          )}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
